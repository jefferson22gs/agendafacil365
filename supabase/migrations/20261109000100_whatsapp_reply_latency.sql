-- Latência do atendente WhatsApp (meta: p50 <= 8 s, p95 <= 15 s do recebimento ao envio).
-- 1) Kick: evento inbound novo aciona o whatsapp-inbound-worker na hora (pg_net, assíncrono, só após COMMIT),
--    coalescido por conversa. O worker envia a resposta na mesma invocação. Crons de 1 min seguem como rede de segurança.
-- 2) Claim inbound: ordem por conversa (com vários workers simultâneos, nunca duas mensagens do mesmo
--    telefone em paralelo/fora de ordem).
-- 3) Outbox: conversa (category='chatbot') tem prioridade e gate de 1 s; campanhas e demais seguem com 3 s.
--    Novas respostas com várias mensagens: ordem por scheduled_for (+1 ms por item), sem espera artificial de 2 s.
-- 4) Atendente nunca responde grupo/comunidade/canal: telefone de origem e destino precisam ser individuais (E.164).
-- 5) Métrica: whatsapp_reply_latency(de, até) -> p50/p95 (super admin via ai-admin).
-- Aditiva e idempotente. Funções existentes mantêm assinatura (workers antigos continuam funcionando).
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- Índices de apoio
-- Claim/kick por conversa e limite de rajada do chatbot (count por telefone no último minuto).
CREATE INDEX IF NOT EXISTS whatsapp_webhook_events_conversation
 ON public.whatsapp_webhook_events(salon_id,sender_phone,created_at);
CREATE INDEX IF NOT EXISTS whatsapp_webhook_events_created ON public.whatsapp_webhook_events(created_at);
CREATE INDEX IF NOT EXISTS whatsapp_outbox_source_event ON public.whatsapp_outbox(source_event_id) WHERE source_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_outbox_chatbot_due
 ON public.whatsapp_outbox(scheduled_for,created_at) WHERE status='pending' AND category='chatbot';

-- ---------------------------------------------------------------------------------------------
-- Nunca grupo: resposta de chatbot só para número individual (a tabela já exige E.164 quando não nulo;
-- aqui também proíbe nulo para chatbot). NOT VALID + VALIDATE não bloqueia escrita.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.whatsapp_outbox'::regclass AND conname='whatsapp_outbox_chatbot_private') THEN
  ALTER TABLE public.whatsapp_outbox ADD CONSTRAINT whatsapp_outbox_chatbot_private
   CHECK(category<>'chatbot' OR (recipient_phone IS NOT NULL AND recipient_phone ~ '^\+[1-9][0-9]{6,14}$')) NOT VALID;
 END IF;
END $$;
ALTER TABLE public.whatsapp_outbox VALIDATE CONSTRAINT whatsapp_outbox_chatbot_private;

-- ---------------------------------------------------------------------------------------------
-- Gate por instância: lembra o último claim para o intervalo curto de conversa.
ALTER TABLE whatsapp_private.instance_dispatch ADD COLUMN IF NOT EXISTS last_claim_at timestamptz;

-- Kick coalescido por conversa: se o mesmo telefone já tem evento pendente (que já acionou um worker e ainda
-- não foi pego), não chama de novo: esse worker drena a conversa em ordem (repete o claim ao terminar).
-- Com evento em processamento, chama: o worker novo só pega após o anterior terminar (claim por conversa) e,
-- como a chamada sai após o COMMIT, não há janela em que a mensagem fique esperando o cron.
-- Conversas diferentes = workers em paralelo. Campanhas não passam por aqui (só mensagens recebidas).
-- Falha do kick nunca derruba a gravação do evento.
CREATE OR REPLACE FUNCTION public.whatsapp_kick_inbound()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM whatsapp_webhook_events b
  WHERE b.salon_id=NEW.salon_id AND b.sender_phone=NEW.sender_phone AND b.id<>NEW.id
   AND b.status='pending' AND b.attempts=0 AND b.next_attempt_at<=now() AND b.created_at>now()-interval '30 seconds') THEN
  RETURN NULL;
 END IF;
 BEGIN
  PERFORM public.invoke_edge_function('whatsapp-inbound-worker','{"source":"kick"}'::jsonb);
 EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'whatsapp_kick_failed %', SQLSTATE; -- cron de 1 min assume
 END;
 RETURN NULL;
END $$;
-- ON CONFLICT DO NOTHING (reentrega do webhook) não insere linha, então não dispara.
DROP TRIGGER IF EXISTS whatsapp_kick_inbound ON public.whatsapp_webhook_events;
CREATE TRIGGER whatsapp_kick_inbound AFTER INSERT ON public.whatsapp_webhook_events
 FOR EACH ROW WHEN (NEW.status='pending') EXECUTE FUNCTION public.whatsapp_kick_inbound();

-- ---------------------------------------------------------------------------------------------
-- Claim inbound: igual ao anterior + ordem por conversa. Pula evento se o mesmo telefone tem outro em
-- processamento (lease válido) ou um pendente mais antigo. Vários workers (kick + cron) podem rodar juntos.
CREATE OR REPLACE FUNCTION public.whatsapp_claim_inbound()
RETURNS SETOF public.whatsapp_webhook_events LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
 UPDATE whatsapp_webhook_events SET status='pending',claim_token=NULL,lease_until=NULL
 WHERE status='processing' AND lease_until<now() AND attempts<3;
 UPDATE whatsapp_webhook_events SET status='failed',claim_token=NULL,lease_until=NULL
 WHERE status='processing' AND lease_until<now() AND attempts>=3;
 RETURN QUERY
 WITH candidate AS (
  SELECT e.id FROM whatsapp_webhook_events e
  WHERE e.status='pending' AND e.next_attempt_at<=now() AND e.attempts<3
   AND NOT EXISTS(SELECT 1 FROM whatsapp_webhook_events b
    WHERE b.salon_id=e.salon_id AND b.sender_phone=e.sender_phone AND b.id<>e.id
     AND ((b.status='processing' AND b.lease_until>now())
       -- Evento mais antigo em espera de nova tentativa (next_attempt_at futuro) não trava a conversa.
       OR (b.status='pending' AND b.attempts<3 AND b.next_attempt_at<=now() AND (b.created_at,b.id)<(e.created_at,e.id))))
  ORDER BY e.created_at,e.id FOR UPDATE SKIP LOCKED LIMIT 1
 )
 UPDATE whatsapp_webhook_events e SET status='processing',claim_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=e.attempts+1
 FROM candidate c WHERE e.id=c.id RETURNING e.*;
END $$;

-- ---------------------------------------------------------------------------------------------
-- Finalização: idêntica à de produção + guarda de conversa individual + itens sem espera artificial.
CREATE OR REPLACE FUNCTION public.whatsapp_finish_inbound(p_event_id uuid,p_claim uuid,p_response text,p_provider text,p_model text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE e whatsapp_webhook_events; BEGIN
 SELECT * INTO e FROM whatsapp_webhook_events WHERE id=p_event_id AND claim_token=p_claim AND status='processing' AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 -- Grupo/comunidade/canal nunca recebem resposta (defesa em profundidade; o webhook já filtra).
 IF e.sender_phone IS NULL OR e.sender_phone !~ '^\+[1-9][0-9]{6,14}$' THEN
  UPDATE whatsapp_webhook_events SET status='ignored',error_code='not_private_chat',claim_token=NULL,lease_until=NULL,completed_at=now() WHERE id=e.id;
  RETURN true;
 END IF;
 INSERT INTO chatbot_conversations(salon_id,client_phone,client_name,direction,content,whatsapp_message_id)
 VALUES(e.salon_id,e.sender_phone,e.payload->>'name','incoming',e.payload->>'text',e.provider_message_id)
 ON CONFLICT(salon_id,whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL DO NOTHING;
 IF length(p_response)>0 THEN
  INSERT INTO whatsapp_outbox(salon_id,instance_id,source_event_id,idempotency_key,category,recipient_phone,text_content)
  VALUES(e.salon_id,e.instance_id,e.id,'inbound-reply:'||e.id::text,'chatbot',e.sender_phone,left(p_response,4096))
  ON CONFLICT(salon_id,idempotency_key) DO NOTHING;
 END IF;
 UPDATE whatsapp_webhook_events SET status=CASE WHEN length(p_response)>0 THEN 'completed' ELSE 'ignored' END,claim_token=NULL,lease_until=NULL,completed_at=now() WHERE id=e.id;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.whatsapp_finish_inbound_v2(p_event_id uuid,p_claim uuid,p_messages jsonb,p_provider text,p_model text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE e whatsapp_webhook_events; m jsonb; i integer:=0; v_type text; v_text text; v_path text; BEGIN
 SELECT * INTO e FROM whatsapp_webhook_events WHERE id=p_event_id AND claim_token=p_claim AND status='processing' AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF e.sender_phone IS NULL OR e.sender_phone !~ '^\+[1-9][0-9]{6,14}$' THEN
  UPDATE whatsapp_webhook_events SET status='ignored',error_code='not_private_chat',claim_token=NULL,lease_until=NULL,completed_at=now() WHERE id=e.id;
  RETURN true;
 END IF;
 IF jsonb_typeof(p_messages)<>'array' OR jsonb_array_length(p_messages)>6 THEN RAISE EXCEPTION 'invalid_messages'; END IF;
 INSERT INTO chatbot_conversations(salon_id,client_phone,client_name,direction,content,whatsapp_message_id)
 VALUES(e.salon_id,e.sender_phone,e.payload->>'name','incoming',coalesce(nullif(e.payload->>'text',''),'[arquivo]'),e.provider_message_id)
 ON CONFLICT(salon_id,whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL DO NOTHING;
 FOR m IN SELECT value FROM jsonb_array_elements(p_messages) LOOP
  v_type:=m->>'type'; v_text:=coalesce(m->>'text',''); v_path:=m->>'media_path';
  IF v_type IS NULL OR v_type NOT IN('text','interactive','image') OR length(v_text)>4096 THEN RAISE EXCEPTION 'invalid_messages'; END IF;
  IF v_type='image' AND (v_path IS NULL OR split_part(v_path,'/',1)<>e.salon_id::text OR v_path LIKE '%..%' OR length(v_path)>300) THEN RAISE EXCEPTION 'invalid_media'; END IF;
  IF v_type='interactive' AND (jsonb_typeof(m->'payload')<>'object' OR length((m->'payload')::text)>8000) THEN RAISE EXCEPTION 'invalid_messages'; END IF;
  IF v_type<>'image' AND length(v_text)=0 THEN CONTINUE; END IF;
  -- Ordem garantida por scheduled_for crescente (+1 ms) + claim sequencial; o ritmo vem do gate por instância.
  INSERT INTO whatsapp_outbox(salon_id,instance_id,source_event_id,idempotency_key,category,recipient_phone,content_type,text_content,payload,media_path,media_mime,media_filename,scheduled_for)
  VALUES(e.salon_id,e.instance_id,e.id,'inbound-reply:'||e.id::text||CASE WHEN i=0 THEN '' ELSE ':'||i::text END,'chatbot',e.sender_phone,v_type,v_text,
   CASE WHEN v_type='interactive' THEN m->'payload' END,
   CASE WHEN v_type='image' THEN v_path END,CASE WHEN v_type='image' THEN coalesce(m->>'media_mime','image/png') END,CASE WHEN v_type='image' THEN left(coalesce(m->>'media_filename','imagem.png'),120) END,
   now()+make_interval(secs=>i*0.001))
  ON CONFLICT(salon_id,idempotency_key) DO NOTHING;
  i:=i+1;
 END LOOP;
 UPDATE whatsapp_webhook_events SET status=CASE WHEN i>0 THEN 'completed' ELSE 'ignored' END,claim_token=NULL,lease_until=NULL,completed_at=now() WHERE id=e.id;
 RETURN true;
END $$;

-- ---------------------------------------------------------------------------------------------
-- Claim do outbox v2.
--  p_source_event: só itens da resposta deste evento (envio imediato pelo whatsapp-inbound-worker).
--  p_chatbot_only: só conversa (dreno curto do dispatcher).
-- Conversa: prioridade e gate de 1 s desde o último claim, sem furar pausa (desconectado/limite = +5 min).
-- Demais (marketing/transacional/status): exatamente como antes, 3 s entre envios por instância.
-- Nunca dois itens da mesma instância em voo; itens de uma resposta saem em ordem de scheduled_for.
CREATE OR REPLACE FUNCTION public.whatsapp_claim_outbox_v2(p_source_event uuid DEFAULT NULL, p_chatbot_only boolean DEFAULT false)
RETURNS SETOF public.whatsapp_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,whatsapp_private
AS $$
DECLARE v_id uuid; v_instance uuid;
BEGIN
 UPDATE whatsapp_outbox SET status=CASE WHEN send_started_at IS NULL AND attempts<max_attempts THEN 'pending' ELSE 'uncertain' END,
 error_code=CASE WHEN send_started_at IS NULL THEN 'lease_expired_before_send' ELSE 'result_unknown_after_restart' END,
 claim_token=NULL,lease_until=NULL WHERE status='processing' AND lease_until<now();
 INSERT INTO whatsapp_private.instance_dispatch(instance_id)
 SELECT DISTINCT instance_id FROM whatsapp_outbox WHERE status='pending' AND (p_source_event IS NULL OR source_event_id=p_source_event) ON CONFLICT DO NOTHING;

 SELECT o.id,o.instance_id INTO v_id,v_instance FROM whatsapp_outbox o
 JOIN whatsapp_private.instance_dispatch gate ON gate.instance_id=o.instance_id
 WHERE o.status='pending' AND o.category='chatbot' AND o.scheduled_for<=now() AND o.attempts<o.max_attempts
  AND (p_source_event IS NULL OR o.source_event_id=p_source_event)
  AND (gate.next_available_at<=now()
   OR (gate.last_claim_at IS NOT NULL AND gate.last_claim_at<=now()-interval '1 second' AND gate.next_available_at<=gate.last_claim_at+interval '3 seconds'))
  AND NOT EXISTS(SELECT 1 FROM whatsapp_outbox busy WHERE busy.instance_id=o.instance_id AND busy.status='processing' AND busy.lease_until>now())
 ORDER BY o.scheduled_for,o.created_at LIMIT 1 FOR UPDATE OF o,gate SKIP LOCKED;

 IF v_id IS NULL AND p_source_event IS NULL AND NOT p_chatbot_only THEN
  SELECT o.id,o.instance_id INTO v_id,v_instance FROM whatsapp_outbox o
  JOIN whatsapp_private.instance_dispatch gate ON gate.instance_id=o.instance_id
  WHERE o.status='pending' AND o.category<>'chatbot' AND o.scheduled_for<=now() AND o.attempts<o.max_attempts AND gate.next_available_at<=now()
  AND NOT EXISTS(SELECT 1 FROM whatsapp_outbox busy WHERE busy.instance_id=o.instance_id AND busy.status='processing' AND busy.lease_until>now())
  ORDER BY o.scheduled_for,o.created_at LIMIT 1 FOR UPDATE OF o,gate SKIP LOCKED;
 END IF;
 IF v_id IS NULL THEN RETURN; END IF;
 UPDATE whatsapp_private.instance_dispatch SET next_available_at=now()+interval '3 seconds',last_claim_at=now() WHERE instance_id=v_instance;
 RETURN QUERY UPDATE whatsapp_outbox SET status='processing',attempts=attempts+1,
 claim_token=gen_random_uuid(),lease_until=now()+interval '90 seconds',send_started_at=NULL
 WHERE id=v_id RETURNING *;
END $$;

-- Assinatura antiga (cron/dispatcher já publicados): mesma regra nova, sem filtro.
CREATE OR REPLACE FUNCTION public.whatsapp_claim_outbox()
RETURNS SETOF public.whatsapp_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,whatsapp_private
AS $$ BEGIN
 RETURN QUERY SELECT * FROM public.whatsapp_claim_outbox_v2(NULL,false);
END $$;

-- ---------------------------------------------------------------------------------------------
-- Métrica: do recebimento (evento salvo) ao envio aceito da 1ª mensagem da resposta.
-- "processing" = recebimento até a resposta gravada no outbox (inclui espera pelo worker).
CREATE OR REPLACE FUNCTION public.whatsapp_reply_latency(p_from timestamptz, p_to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
 WITH r AS (
  SELECT e.created_at, e.completed_at,
   (SELECT min(o.completed_at) FROM whatsapp_outbox o WHERE o.source_event_id=e.id AND o.category='chatbot'
     AND o.status IN('accepted','delivered','read')) AS sent_at
  FROM whatsapp_webhook_events e
  WHERE e.created_at>=p_from AND e.created_at<p_to AND e.status='completed'
 ), m AS (
  SELECT extract(epoch FROM sent_at-created_at)*1000 AS total_ms, extract(epoch FROM completed_at-created_at)*1000 AS proc_ms
  FROM r WHERE sent_at IS NOT NULL
 )
 SELECT jsonb_build_object(
  'from',p_from,'to',p_to,'replies',count(*),
  'p50_ms',round(percentile_cont(0.5) WITHIN GROUP (ORDER BY total_ms)),
  'p95_ms',round(percentile_cont(0.95) WITHIN GROUP (ORDER BY total_ms)),
  'max_ms',round(max(total_ms)),
  'processing_p50_ms',round(percentile_cont(0.5) WITHIN GROUP (ORDER BY proc_ms)),
  'processing_p95_ms',round(percentile_cont(0.95) WITHIN GROUP (ORDER BY proc_ms)),
  'not_sent',(SELECT count(*) FROM r WHERE sent_at IS NULL))
 FROM m
$$;

REVOKE ALL ON FUNCTION public.whatsapp_kick_inbound(),public.whatsapp_claim_inbound(),
 public.whatsapp_finish_inbound(uuid,uuid,text,text,text),public.whatsapp_finish_inbound_v2(uuid,uuid,jsonb,text,text),
 public.whatsapp_claim_outbox_v2(uuid,boolean),public.whatsapp_claim_outbox(),public.whatsapp_reply_latency(timestamptz,timestamptz)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_claim_inbound(),public.whatsapp_finish_inbound(uuid,uuid,text,text,text),
 public.whatsapp_finish_inbound_v2(uuid,uuid,jsonb,text,text),public.whatsapp_claim_outbox_v2(uuid,boolean),public.whatsapp_claim_outbox(),
 public.whatsapp_reply_latency(timestamptz,timestamptz) TO service_role;

COMMIT;

-- Rollback (manual, revisar antes):
-- BEGIN;
-- DROP TRIGGER IF EXISTS whatsapp_kick_inbound ON public.whatsapp_webhook_events;
-- DROP FUNCTION IF EXISTS public.whatsapp_kick_inbound();
-- DROP FUNCTION IF EXISTS public.whatsapp_reply_latency(timestamptz,timestamptz);
-- -- Recriar whatsapp_claim_inbound, whatsapp_finish_inbound, whatsapp_finish_inbound_v2 e whatsapp_claim_outbox
-- -- com as definições de 20261009000200 / 20261009000300 / 20261106004000 (cópia em af365-qa/worker-fns.sql e outbox-fns.sql),
-- -- publicar a versão anterior das Edge Functions e só então:
-- DROP FUNCTION IF EXISTS public.whatsapp_claim_outbox_v2(uuid,boolean);
-- ALTER TABLE public.whatsapp_outbox DROP CONSTRAINT IF EXISTS whatsapp_outbox_chatbot_private;
-- ALTER TABLE whatsapp_private.instance_dispatch DROP COLUMN IF EXISTS last_claim_at;
-- DROP INDEX IF EXISTS public.whatsapp_webhook_events_conversation, public.whatsapp_webhook_events_created,
--  public.whatsapp_outbox_source_event, public.whatsapp_outbox_chatbot_due;
-- COMMIT;
