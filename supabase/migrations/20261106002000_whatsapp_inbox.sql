BEGIN;
-- Central WhatsApp: caixa de entrada (Conversas). Aditiva e idempotente.
-- Fluxo: evolution-webhook grava recebidas/enviadas pelo celular; trigger do outbox grava IA/sistema;
-- whatsapp-reply grava respostas humanas. Leitura pelo dono/admin do salão; escrita só service_role.

-- Quem administra o salão: dono ou papel admin (mesma regra de authorizeSalon nas Edge Functions).
CREATE OR REPLACE FUNCTION public.whatsapp_can_manage_salon(p_salon_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
 SELECT EXISTS(SELECT 1 FROM salons s WHERE s.id=p_salon_id AND s.owner_id=auth.uid())
     OR EXISTS(SELECT 1 FROM user_roles r WHERE r.salon_id=p_salon_id AND r.user_id=auth.uid() AND r.role='admin');
$$;
REVOKE ALL ON FUNCTION public.whatsapp_can_manage_salon(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_can_manage_salon(uuid) TO authenticated,service_role;

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
 phone text NOT NULL CHECK(phone ~ '^\+[1-9][0-9]{6,14}$'),
 direction text NOT NULL CHECK(direction IN('in','out')),
 author text NOT NULL CHECK(author IN('contact','ai','human','system')),
 -- Origem: chatbot|transactional|marketing|administrative (outbox), reply (sistema), phone (celular), sync, legacy.
 source text,
 body text NOT NULL DEFAULT '' CHECK(length(body)<=8000),
 -- kind: grupo de exibição (text|interactive|media); message_type: detalhe (image, audio, list, buttons, pix…).
 kind text NOT NULL DEFAULT 'text' CHECK(kind IN('text','interactive','media')),
 message_type text NOT NULL DEFAULT 'text',
 -- Conteúdo estruturado opcional (opções de lista/botões, dados de PIX, seleção feita). Nunca segredos.
 payload jsonb,
 media_url text,
 media_mime text,
 media_name text,
 contact_name text,
 provider_message_id text,
 outbox_id uuid REFERENCES public.whatsapp_outbox(id) ON DELETE SET NULL,
 client_ref uuid,
 legacy_conversation_id uuid,
 sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'received' CHECK(status IN('received','sending','sent','delivered','read','failed','uncertain')),
 error_code text,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- NULLs são distintos: unicidade só vale para quem tem o identificador (idempotência por origem).
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_provider_unique ON public.whatsapp_messages(salon_id,provider_message_id);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_client_ref_unique ON public.whatsapp_messages(salon_id,client_ref);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_outbox_unique ON public.whatsapp_messages(outbox_id);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_legacy_unique ON public.whatsapp_messages(legacy_conversation_id);
CREATE INDEX IF NOT EXISTS whatsapp_messages_thread ON public.whatsapp_messages(salon_id,phone,created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_messages_recent ON public.whatsapp_messages(salon_id,created_at DESC);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Salon managers read messages" ON public.whatsapp_messages;
CREATE POLICY "Salon managers read messages" ON public.whatsapp_messages FOR SELECT TO authenticated
 USING(public.whatsapp_can_manage_salon(salon_id));
DROP POLICY IF EXISTS "Workers manage messages" ON public.whatsapp_messages;
CREATE POLICY "Workers manage messages" ON public.whatsapp_messages FOR ALL TO service_role USING(true) WITH CHECK(true);
REVOKE ALL ON public.whatsapp_messages FROM anon,authenticated;
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_conversation_state ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

-- Mensagens enviadas pela fila (IA, lembretes, campanhas, relatórios) entram no histórico.
CREATE OR REPLACE FUNCTION public.whatsapp_outbox_to_inbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE v_status text; BEGIN
 IF NEW.recipient_phone IS NULL OR NEW.category='status' OR NEW.status IS NOT DISTINCT FROM OLD.status
    OR NEW.status NOT IN('accepted','failed','uncertain') THEN RETURN NEW; END IF;
 v_status:=CASE NEW.status WHEN 'accepted' THEN 'sent' ELSE NEW.status END;
 UPDATE whatsapp_messages SET status=v_status,error_code=NEW.error_code WHERE outbox_id=NEW.id;
 IF FOUND THEN RETURN NEW; END IF;
 INSERT INTO whatsapp_messages(salon_id,phone,direction,author,source,body,kind,message_type,provider_message_id,outbox_id,status,error_code)
 VALUES(NEW.salon_id,NEW.recipient_phone,'out',CASE WHEN NEW.category='chatbot' THEN 'ai' ELSE 'system' END,NEW.category,
  left(NEW.text_content,8000),
  CASE WHEN NEW.content_type IN('text','status_text') THEN 'text' WHEN NEW.content_type IN('interactive','list','buttons') THEN 'interactive' ELSE 'media' END,
  NEW.content_type,NEW.remote_message_id,NEW.id,v_status,NEW.error_code)
 -- Webhook (fromMe) pode ter chegado antes: corrige autoria sem duplicar.
 ON CONFLICT(salon_id,provider_message_id) DO UPDATE SET author=EXCLUDED.author,source=EXCLUDED.source,outbox_id=EXCLUDED.outbox_id,status=EXCLUDED.status
  WHERE whatsapp_messages.outbox_id IS NULL AND whatsapp_messages.client_ref IS NULL;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS whatsapp_outbox_to_inbox ON public.whatsapp_outbox;
CREATE TRIGGER whatsapp_outbox_to_inbox AFTER UPDATE OF status ON public.whatsapp_outbox
 FOR EACH ROW EXECUTE FUNCTION public.whatsapp_outbox_to_inbox();
REVOKE ALL ON FUNCTION public.whatsapp_outbox_to_inbox() FROM PUBLIC,anon,authenticated;

-- Mesmo corpo de 20261009000300 + confirmação de entrega/leitura no histórico de conversas.
CREATE OR REPLACE FUNCTION public.whatsapp_record_delivery(p_salon_id uuid,p_instance_id uuid,p_message_id text,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
 IF p_status NOT IN('delivered','read') THEN RETURN; END IF;
 UPDATE whatsapp_outbox SET status=p_status
 WHERE salon_id=p_salon_id AND instance_id=p_instance_id AND remote_message_id=p_message_id
 AND (status='accepted' OR (p_status='read' AND status='delivered'));
 UPDATE broadcast_messages SET status=p_status
 WHERE salon_id=p_salon_id AND whatsapp_message_id=p_message_id
 AND (status='sent' OR (p_status='read' AND status='delivered'));
 UPDATE whatsapp_messages SET status=p_status
 WHERE salon_id=p_salon_id AND provider_message_id=p_message_id AND direction='out'
 AND (status='sent' OR (p_status='read' AND status='delivered'));
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_record_delivery(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_record_delivery(uuid,uuid,text,text) TO service_role;

-- Lista de conversas (só contatos que já escreveram). INVOKER: RLS das tabelas vale.
CREATE OR REPLACE FUNCTION public.whatsapp_inbox_conversations(p_salon_id uuid,p_limit integer DEFAULT 300)
RETURNS TABLE(phone text,contact_name text,last_body text,last_kind text,last_type text,last_author text,last_direction text,
 last_at timestamptz,unread integer,human_takeover boolean,taken_over_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public
AS $$
 WITH conv AS (
  SELECT m.phone,max(m.created_at) last_at FROM whatsapp_messages m WHERE m.salon_id=p_salon_id
  GROUP BY m.phone HAVING bool_or(m.direction='in')
  ORDER BY max(m.created_at) DESC LIMIT least(greatest(coalesce(p_limit,300),1),500)
 )
 SELECT c.phone,
  coalesce((SELECT cl.name FROM clients cl WHERE cl.salon_id=p_salon_id AND cl.phone_normalized=c.phone ORDER BY cl.created_at LIMIT 1),
           (SELECT x.contact_name FROM whatsapp_messages x WHERE x.salon_id=p_salon_id AND x.phone=c.phone AND x.contact_name IS NOT NULL ORDER BY x.created_at DESC LIMIT 1)),
  l.body,l.kind,l.message_type,l.author,l.direction,c.last_at,
  (SELECT count(*)::integer FROM whatsapp_messages u WHERE u.salon_id=p_salon_id AND u.phone=c.phone AND u.direction='in'
    AND u.created_at>coalesce(s.last_read_at,'-infinity'::timestamptz)),
  coalesce(s.human_takeover,false),s.taken_over_at
 FROM conv c
 CROSS JOIN LATERAL (SELECT y.body,y.kind,y.message_type,y.author,y.direction FROM whatsapp_messages y
  WHERE y.salon_id=p_salon_id AND y.phone=c.phone ORDER BY y.created_at DESC LIMIT 1) l
 LEFT JOIN whatsapp_conversation_state s ON s.salon_id=p_salon_id AND s.phone=c.phone
 ORDER BY c.last_at DESC;
$$;
REVOKE ALL ON FUNCTION public.whatsapp_inbox_conversations(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_inbox_conversations(uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.whatsapp_mark_conversation_read(p_salon_id uuid,p_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
 IF NOT public.whatsapp_can_manage_salon(p_salon_id) OR p_phone !~ '^\+[1-9][0-9]{6,14}$' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 INSERT INTO whatsapp_conversation_state(salon_id,phone,last_read_at) VALUES(p_salon_id,p_phone,now())
 ON CONFLICT(salon_id,phone) DO UPDATE SET last_read_at=now();
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_mark_conversation_read(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_mark_conversation_read(uuid,text) TO authenticated;

-- Backfill do histórico antigo: só telefones inequívocos (E.164 ou 55+DDD+número). Reexecução não duplica.
INSERT INTO public.whatsapp_messages(salon_id,phone,direction,author,source,body,kind,message_type,provider_message_id,legacy_conversation_id,contact_name,status,created_at)
SELECT c.salon_id,p.phone,CASE WHEN c.direction='incoming' THEN 'in' ELSE 'out' END,
 CASE WHEN c.direction='incoming' THEN 'contact' WHEN c.ai_response THEN 'ai' ELSE 'system' END,
 'legacy',left(c.content,8000),CASE WHEN coalesce(c.message_type,'text')='text' THEN 'text' ELSE 'media' END,coalesce(c.message_type,'text'),c.whatsapp_message_id,c.id,
 CASE WHEN c.direction='incoming' THEN left(c.client_name,120) END,
 CASE WHEN c.direction='incoming' THEN 'received' ELSE 'sent' END,c.created_at
FROM public.chatbot_conversations c
CROSS JOIN LATERAL (SELECT CASE WHEN c.client_phone ~ '^\+[1-9][0-9]{6,14}$' THEN c.client_phone
 WHEN c.client_phone ~ '^55[1-9][0-9]{9,10}$' THEN '+'||c.client_phone END AS phone) p
WHERE p.phone IS NOT NULL AND c.direction IN('incoming','outgoing')
ON CONFLICT DO NOTHING;

-- Tempo real (RLS continua valendo para postgres_changes).
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='whatsapp_messages') THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='whatsapp_conversation_state') THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversation_state;
  END IF;
 END IF;
END $$;
COMMIT;

-- Rollback (manual, se necessário):
-- BEGIN;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.whatsapp_messages;
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.whatsapp_conversation_state;
-- DROP TRIGGER IF EXISTS whatsapp_outbox_to_inbox ON public.whatsapp_outbox;
-- DROP FUNCTION IF EXISTS public.whatsapp_outbox_to_inbox();
-- DROP FUNCTION IF EXISTS public.whatsapp_inbox_conversations(uuid,integer);
-- DROP FUNCTION IF EXISTS public.whatsapp_mark_conversation_read(uuid,text);
-- -- whatsapp_record_delivery: reaplicar a versão de 20261009000300_whatsapp_outbox.sql.
-- DROP TABLE IF EXISTS public.whatsapp_messages;
-- ALTER TABLE public.whatsapp_conversation_state DROP COLUMN IF EXISTS last_read_at;
-- DROP FUNCTION IF EXISTS public.whatsapp_can_manage_salon(uuid);
-- COMMIT;
