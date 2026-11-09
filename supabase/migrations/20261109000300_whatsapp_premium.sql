-- ============================================================================
-- Agenda Fácil 365 — WhatsApp premium + confirmação automática/manual.
-- A) Status honesto: whatsapp_messages ganha "queued" (na fila) e acompanha o outbox desde a criação;
--    "sent" = aceito pela Evolution (um tique), "delivered"/"read" só com confirmação do WhatsApp.
--    Consulta ativa de entrega (findMessages) para quando MESSAGES_UPDATE não chega. Reenvio idempotente.
-- B) Enquete (poll): o mapeamento opção -> id fica no payload do outbox (por remote_message_id); nada novo aqui.
-- C) Reserva: v2 devolve o status real; pente-fino de funções que chamam pgcrypto/uuid-ossp sem esquema.
-- D) Atraso da Evolution: horário do WhatsApp (messageTimestamp) por evento + whatsapp_reply_latency_v2.
-- F) Confirmação automática (salons.auto_confirm_appointments): trigger BEFORE INSERT; mensagens e push coerentes.
--    Salões existentes: comportamento real hoje é MANUAL (a coluna não tinha efeito). Normaliza para false e o
--    padrão passa a ser false; o dono liga em Configurações. Só na primeira aplicação (reaplicar não desfaz escolhas).
-- Aditiva e idempotente. Migrações já aplicadas não são editadas. Rollback comentado no fim.
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------------------------------------
-- A) Status honesto
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.whatsapp_messages'::regclass AND contype='c'
   AND pg_get_constraintdef(oid) ILIKE '%received%' AND pg_get_constraintdef(oid) NOT ILIKE '%queued%' LOOP
  EXECUTE format('ALTER TABLE public.whatsapp_messages DROP CONSTRAINT %I', c.conname);
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.whatsapp_messages'::regclass AND conname='whatsapp_messages_status_v2') THEN
  ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_status_v2
   CHECK(status IN('received','queued','sending','sent','delivered','read','failed','uncertain'));
 END IF;
END $$;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS delivery_checks integer NOT NULL DEFAULT 0;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS delivery_next_check_at timestamptz;
CREATE INDEX IF NOT EXISTS whatsapp_messages_delivery_pending ON public.whatsapp_messages(created_at)
 WHERE direction='out' AND status='sent' AND provider_message_id IS NOT NULL;

-- Outbox -> histórico desde a criação ("Na fila"), sem regredir status (aceito tardio não apaga "entregue").
CREATE OR REPLACE FUNCTION public.whatsapp_outbox_to_inbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE v_status text; v_type text; v_payload jsonb; BEGIN
 IF NEW.recipient_phone IS NULL OR NEW.category='status' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 END IF;
 v_status:=CASE NEW.status WHEN 'pending' THEN 'queued' WHEN 'processing' THEN 'queued' WHEN 'accepted' THEN 'sent'
  WHEN 'cancelled' THEN 'failed' ELSE NEW.status END;
 v_type:=CASE WHEN NEW.content_type='interactive' THEN coalesce(nullif(NEW.payload->>'op',''),'interactive') ELSE NEW.content_type END;
 -- Opções exibidas na Central: enquete (options[].title), botões (displayText) ou lista (rows[].title).
 v_payload:=CASE WHEN NEW.content_type='interactive' THEN jsonb_build_object('options',coalesce(
   (SELECT jsonb_agg(o->>'title') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.payload->'options')='array' THEN NEW.payload->'options' ELSE '[]' END) o),
   (SELECT jsonb_agg(b->>'displayText') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.payload->'body'->'buttons')='array' THEN NEW.payload->'body'->'buttons' ELSE '[]' END) b),
   (SELECT jsonb_agg(r->>'title') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW.payload->'body'->'sections'->0->'rows')='array' THEN NEW.payload->'body'->'sections'->0->'rows' ELSE '[]' END) r),
   '[]'::jsonb)) END;
 IF NEW.remote_message_id IS NOT NULL THEN
  -- SEND_MESSAGE pode ter gravado a mesma mensagem como "celular" antes do aceite: fica a linha do outbox.
  DELETE FROM whatsapp_messages WHERE salon_id=NEW.salon_id AND provider_message_id=NEW.remote_message_id
   AND outbox_id IS NULL AND client_ref IS NULL AND EXISTS(SELECT 1 FROM whatsapp_messages x WHERE x.outbox_id=NEW.id);
 END IF;
 UPDATE whatsapp_messages SET status=v_status,error_code=NEW.error_code,provider_message_id=coalesce(NEW.remote_message_id,provider_message_id)
 WHERE outbox_id=NEW.id
  AND NOT (status IN('delivered','read') AND v_status IN('queued','sent','failed','uncertain'))
  AND NOT (status='read' AND v_status='delivered');
 IF EXISTS(SELECT 1 FROM whatsapp_messages WHERE outbox_id=NEW.id) THEN RETURN NEW; END IF;
 INSERT INTO whatsapp_messages(salon_id,phone,direction,author,source,body,kind,message_type,payload,provider_message_id,outbox_id,status,error_code)
 VALUES(NEW.salon_id,NEW.recipient_phone,'out',CASE WHEN NEW.category='chatbot' THEN 'ai' ELSE 'system' END,NEW.category,
  left(NEW.text_content,8000),
  CASE WHEN NEW.content_type IN('text','status_text') THEN 'text' WHEN NEW.content_type IN('interactive','list','buttons') THEN 'interactive' ELSE 'media' END,
  v_type,v_payload,NEW.remote_message_id,NEW.id,v_status,NEW.error_code)
 ON CONFLICT(salon_id,provider_message_id) DO UPDATE SET author=EXCLUDED.author,source=EXCLUDED.source,outbox_id=EXCLUDED.outbox_id,status=EXCLUDED.status,
  kind=EXCLUDED.kind,message_type=EXCLUDED.message_type,payload=EXCLUDED.payload
  WHERE whatsapp_messages.outbox_id IS NULL AND whatsapp_messages.client_ref IS NULL;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS whatsapp_outbox_to_inbox ON public.whatsapp_outbox;
CREATE TRIGGER whatsapp_outbox_to_inbox AFTER INSERT OR UPDATE OF status ON public.whatsapp_outbox
 FOR EACH ROW EXECUTE FUNCTION public.whatsapp_outbox_to_inbox();
REVOKE ALL ON FUNCTION public.whatsapp_outbox_to_inbox() FROM PUBLIC,anon,authenticated;

-- Confirmação de entrega/leitura: também resolve "incerto" (o WhatsApp provou que chegou).
CREATE OR REPLACE FUNCTION public.whatsapp_record_delivery(p_salon_id uuid,p_instance_id uuid,p_message_id text,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
 IF p_status NOT IN('delivered','read') THEN RETURN; END IF;
 UPDATE whatsapp_outbox SET status=p_status
 WHERE salon_id=p_salon_id AND instance_id=p_instance_id AND remote_message_id=p_message_id
 AND (status IN('accepted','uncertain') OR (p_status='read' AND status='delivered'));
 UPDATE broadcast_messages SET status=p_status
 WHERE salon_id=p_salon_id AND whatsapp_message_id=p_message_id
 AND (status='sent' OR (p_status='read' AND status='delivered'));
 UPDATE whatsapp_messages SET status=p_status
 WHERE salon_id=p_salon_id AND provider_message_id=p_message_id AND direction='out'
 AND (status IN('sent','uncertain') OR (p_status='read' AND status='delivered'));
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_record_delivery(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_record_delivery(uuid,uuid,text,text) TO service_role;

-- Consulta ativa (whatsapp-dispatch): "Enviada" há 30 s–24 h, com espera crescente (30 s, 1, 2, 4… até 30 min).
CREATE OR REPLACE FUNCTION public.whatsapp_delivery_candidates(p_limit integer DEFAULT 20)
RETURNS TABLE(salon_id uuid,instance_id uuid,instance_name text,provider_message_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
 RETURN QUERY
 WITH c AS (
  SELECT m.id FROM whatsapp_messages m
  WHERE m.direction='out' AND m.status='sent' AND m.provider_message_id IS NOT NULL
   AND m.created_at BETWEEN now()-interval '24 hours' AND now()-interval '30 seconds'
   AND coalesce(m.delivery_next_check_at,'-infinity'::timestamptz)<=now()
  ORDER BY m.created_at DESC LIMIT least(greatest(coalesce(p_limit,20),1),50) FOR UPDATE SKIP LOCKED
 ), u AS (
  UPDATE whatsapp_messages m SET delivery_checks=m.delivery_checks+1,
   delivery_next_check_at=now()+least(interval '30 minutes',make_interval(secs=>30*power(2,least(m.delivery_checks,6))::integer))
  FROM c WHERE m.id=c.id RETURNING m.salon_id,m.provider_message_id
 )
 SELECT u.salon_id,w.id,w.instance_name,u.provider_message_id FROM u JOIN whatsapp_instances w ON w.salon_id=u.salon_id AND w.status='connected';
END $$;

-- Reenvio idempotente ("Tentar de novo"): só falhou/incerto/cancelado; a segunda chamada não faz nada.
CREATE OR REPLACE FUNCTION public.whatsapp_retry_outbox(p_salon_id uuid,p_message_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE v_outbox uuid; n integer; BEGIN
 SELECT outbox_id INTO v_outbox FROM whatsapp_messages WHERE id=p_message_id AND salon_id=p_salon_id AND direction='out'
  AND status IN('failed','uncertain') FOR UPDATE;
 IF v_outbox IS NULL THEN RETURN false; END IF;
 UPDATE whatsapp_outbox SET status='pending',attempts=0,error_code=NULL,claim_token=NULL,lease_until=NULL,send_started_at=NULL,
  remote_message_id=NULL,completed_at=NULL,scheduled_for=now()
 WHERE id=v_outbox AND salon_id=p_salon_id AND status IN('failed','uncertain','cancelled');
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n=1;
END $$;

-- ---------------------------------------------------------------------------------------------
-- D) Atraso da Evolution: horário da mensagem no WhatsApp (messageTimestamp, precisão de 1 s).
ALTER TABLE public.whatsapp_webhook_events ADD COLUMN IF NOT EXISTS whatsapp_at timestamptz;

CREATE OR REPLACE FUNCTION public.whatsapp_reply_latency_v2(p_from timestamptz, p_to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
 WITH r AS (
  SELECT e.created_at, e.completed_at, e.whatsapp_at,
   (SELECT min(o.completed_at) FROM whatsapp_outbox o WHERE o.source_event_id=e.id AND o.category='chatbot'
     AND o.status IN('accepted','delivered','read')) AS sent_at
  FROM whatsapp_webhook_events e
  WHERE e.created_at>=p_from AND e.created_at<p_to AND e.status='completed'
 ), m AS (
  SELECT extract(epoch FROM sent_at-created_at)*1000 AS total_ms, extract(epoch FROM completed_at-created_at)*1000 AS proc_ms,
   CASE WHEN whatsapp_at IS NOT NULL THEN greatest(0,extract(epoch FROM sent_at-whatsapp_at)*1000) END AS phone_ms
  FROM r WHERE sent_at IS NOT NULL
 ), evo AS (
  SELECT greatest(0,extract(epoch FROM e.created_at-e.whatsapp_at)*1000) AS ms FROM whatsapp_webhook_events e
  WHERE e.created_at>=p_from AND e.created_at<p_to AND e.whatsapp_at IS NOT NULL
 )
 SELECT jsonb_build_object(
  'from',p_from,'to',p_to,'replies',(SELECT count(*) FROM m),
  'p50_ms',(SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY total_ms)) FROM m),
  'p95_ms',(SELECT round(percentile_cont(0.95) WITHIN GROUP (ORDER BY total_ms)) FROM m),
  'max_ms',(SELECT round(max(total_ms)) FROM m),
  'processing_p50_ms',(SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY proc_ms)) FROM m),
  'processing_p95_ms',(SELECT round(percentile_cont(0.95) WITHIN GROUP (ORDER BY proc_ms)) FROM m),
  'not_sent',(SELECT count(*) FROM r WHERE sent_at IS NULL),
  'evolution_samples',(SELECT count(*) FROM evo),
  'evolution_p50_ms',(SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ms)) FROM evo),
  'evolution_p95_ms',(SELECT round(percentile_cont(0.95) WITHIN GROUP (ORDER BY ms)) FROM evo),
  'phone_to_reply_p50_ms',(SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY phone_ms)) FROM m),
  'phone_to_reply_p95_ms',(SELECT round(percentile_cont(0.95) WITHIN GROUP (ORDER BY phone_ms)) FROM m))
$$;

-- ---------------------------------------------------------------------------------------------
-- F) Confirmação automática ou manual
DO $$ BEGIN
 -- Primeira aplicação: o default ainda é true. Reaplicar não reverte salões que ligaram o modo automático.
 IF (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='salons'
     AND column_name='auto_confirm_appointments') ILIKE 'true%' THEN
  UPDATE public.salons SET auto_confirm_appointments=false WHERE auto_confirm_appointments IS DISTINCT FROM false;
  ALTER TABLE public.salons ALTER COLUMN auto_confirm_appointments SET DEFAULT false;
 END IF;
END $$;
ALTER TABLE public.salons ADD COLUMN IF NOT EXISTS auto_confirm_appointments boolean DEFAULT false;
UPDATE public.salons SET auto_confirm_appointments=false WHERE auto_confirm_appointments IS NULL;

-- Função morta (sem trigger; colunas inexistentes): removida.
DROP FUNCTION IF EXISTS public.trigger_appointment_confirmation();

-- Nome "appointments_auto_confirm" < "whatsapp_validate_appointment": roda antes, então a validação de grade e
-- conflito (que trata pending e confirmed igual) enxerga o status final. Painel (gestor logado) decide sozinho.
CREATE OR REPLACE FUNCTION public.appointments_auto_confirm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
 IF NEW.status='pending'
    AND NOT (auth.uid() IS NOT NULL AND public.whatsapp_can_manage_salon(NEW.salon_id))
    AND coalesce((SELECT auto_confirm_appointments FROM salons WHERE id=NEW.salon_id),false) THEN
  NEW.status:='confirmed';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS appointments_auto_confirm ON public.appointments;
CREATE TRIGGER appointments_auto_confirm BEFORE INSERT ON public.appointments
 FOR EACH ROW EXECUTE FUNCTION public.appointments_auto_confirm();
REVOKE ALL ON FUNCTION public.appointments_auto_confirm() FROM PUBLIC,anon,authenticated;

-- Aviso ao cliente: criado já confirmado = uma mensagem "confirmado"; manual = "aguarda" e depois "confirmado".
CREATE OR REPLACE FUNCTION public.whatsapp_enqueue_appointment_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE cfg whatsapp_automation_settings; v_instance uuid; v_type text; v_text text; v_phone text;
 v_service text; v_salon text; v_professional text;
BEGIN
 SELECT * INTO cfg FROM whatsapp_automation_settings WHERE salon_id=NEW.salon_id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT id INTO v_instance FROM whatsapp_instances WHERE salon_id=NEW.salon_id;
 IF v_instance IS NULL THEN RETURN NEW; END IF;
 v_phone:=CASE WHEN NEW.client_phone ~ '^\+[1-9][0-9]{6,14}$' THEN NEW.client_phone ELSE NULL END;
 IF v_phone IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND cfg.confirmation_enabled THEN v_type:='created';
 ELSIF TG_OP='UPDATE' AND NEW.status='cancelled' AND OLD.status IS DISTINCT FROM NEW.status AND cfg.cancellation_enabled THEN v_type:='cancelled';
 ELSIF TG_OP='UPDATE' AND NEW.status='confirmed' AND OLD.status IS DISTINCT FROM NEW.status AND cfg.confirmation_enabled THEN v_type:='confirmed';
 ELSIF TG_OP='UPDATE' AND (OLD.date IS DISTINCT FROM NEW.date OR OLD.start_time IS DISTINCT FROM NEW.start_time) AND cfg.reschedule_enabled THEN v_type:='rescheduled';
 ELSE RETURN NEW; END IF;
 SELECT name INTO v_salon FROM salons WHERE id=NEW.salon_id;
 SELECT name INTO v_service FROM services WHERE id=NEW.service_id AND salon_id=NEW.salon_id;
 SELECT name INTO v_professional FROM professionals WHERE id=NEW.professional_id AND salon_id=NEW.salon_id;
 v_text:='Olá, '||coalesce(NEW.client_name,'cliente')||'! '||CASE WHEN v_type='cancelled' THEN 'Seu agendamento foi cancelado.'
  WHEN NEW.status='pending' THEN 'Recebemos sua solicitação de agendamento. Ela aguarda confirmação do salão.'
  ELSE 'Seu agendamento está confirmado ✅' END
 ||E'\nSalão: '||coalesce(v_salon,'Salão')||E'\nServiço: '||coalesce(v_service,'Serviço')||E'\nProfissional: '||coalesce(v_professional,'Profissional')||E'\nData: '||to_char(NEW.date,'DD/MM/YYYY')||' às '||to_char(NEW.start_time,'HH24:MI');
 INSERT INTO whatsapp_outbox(salon_id,instance_id,appointment_id,idempotency_key,category,recipient_phone,text_content,expected_appointment_version)
 VALUES(NEW.salon_id,v_instance,NEW.id,'appointment:'||NEW.id::text||':'||v_type||':'||NEW.updated_at::text,'transactional',v_phone,v_text,NEW.updated_at)
 ON CONFLICT(salon_id,idempotency_key) DO NOTHING;
 RETURN NEW;
END $$;

-- Push ao dono: o texto diz se precisa da confirmação dele. Mesma regra/dedupe de 20261109000200.
CREATE OR REPLACE FUNCTION public.push_enqueue_new_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_enqueue(NEW.salon_id, 'new_appointment', 'owner',
    CASE WHEN NEW.status = 'pending' THEN 'Agendamento aguardando sua confirmação' ELSE 'Novo agendamento confirmado' END,
    public.push_client_label(NEW.client_name) || ' agendou para ' || public.push_when(NEW.date, NEW.start_time),
    '/admin/appointments', 'appointment:' || NEW.id, NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- push nunca impede o agendamento
END $$;

-- Reserva v2: mesma regra de 20261106004000, devolvendo também o status real (pending|confirmed).
CREATE OR REPLACE FUNCTION public.whatsapp_book_appointment_v2(
 p_event_id uuid,p_service_id uuid,p_professional_id uuid,p_date date,p_start time,p_client_name text,
 p_client_phone text,p_birth_date date,p_coupon_code text,p_request_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE e whatsapp_webhook_events; v_key text; v_id uuid; v_client uuid; v_dur integer; v_price numeric; v_pro uuid;
 v_coupon uuid; v_discount numeric:=0; v_reason text; v_final numeric; v_phone text; v_name text; a appointments; v_status text;
BEGIN
 SELECT * INTO e FROM whatsapp_webhook_events WHERE id=p_event_id AND status='processing';
 IF NOT FOUND THEN RAISE EXCEPTION 'event_missing'; END IF;
 IF NOT coalesce((SELECT chatbot_booking_enabled FROM whatsapp_automation_settings WHERE salon_id=e.salon_id),false) THEN RAISE EXCEPTION 'booking_disabled'; END IF;
 v_name:=btrim(regexp_replace(coalesce(p_client_name,''),'\s+',' ','g'));
 IF length(v_name) NOT BETWEEN 5 AND 120 OR position(' ' IN v_name)=0 THEN RAISE EXCEPTION 'invalid_client_name'; END IF;
 v_phone:=coalesce(nullif(p_client_phone,''),e.sender_phone);
 IF v_phone !~ '^\+[1-9][0-9]{6,14}$' THEN RAISE EXCEPTION 'invalid_phone'; END IF;
 IF p_birth_date IS NOT NULL AND (p_birth_date>current_date OR p_birth_date<date '1900-01-01') THEN RAISE EXCEPTION 'invalid_birth_date'; END IF;
 IF p_request_key IS NULL OR p_request_key !~ '^[A-Za-z0-9-]+$' OR length(p_request_key) NOT BETWEEN 8 AND 64 THEN RAISE EXCEPTION 'invalid_request'; END IF;
 v_key:='booking:'||e.salon_id::text||':'||e.sender_phone||':'||p_request_key;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_key,0));
 SELECT * INTO a FROM appointments WHERE whatsapp_request_key=v_key;
 IF FOUND THEN RETURN jsonb_build_object('id',a.id,'duplicate',true,'professional_id',a.professional_id,'price',a.price,'discount',coalesce(a.discount,0),'final_price',a.final_price,'status',a.status); END IF;
 SELECT duration_minutes,price INTO v_dur,v_price FROM services WHERE id=p_service_id AND salon_id=e.salon_id AND coalesce(is_active,true);
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_service'; END IF;
 IF p_professional_id IS NOT NULL THEN
  v_pro:=p_professional_id;
 ELSE
  SELECT p.id INTO v_pro FROM professionals p
   WHERE p.salon_id=e.salon_id AND coalesce(p.is_active,true)
     AND (NOT EXISTS(SELECT 1 FROM professional_services x WHERE x.service_id=p_service_id)
          OR EXISTS(SELECT 1 FROM professional_services x WHERE x.service_id=p_service_id AND x.professional_id=p.id))
     AND to_char(p_start,'HH24:MI')=ANY(public.get_available_time_slots(e.salon_id,p.id,p_service_id,p_date))
   ORDER BY p.name LIMIT 1;
  IF v_pro IS NULL THEN RAISE EXCEPTION 'slot_unavailable'; END IF;
 END IF;
 IF nullif(btrim(coalesce(p_coupon_code,'')),'') IS NOT NULL THEN
  SELECT x.coupon_id,x.discount,x.reason INTO v_coupon,v_discount,v_reason FROM public.whatsapp_coupon_eval(e.salon_id,e.sender_phone,p_coupon_code,v_price) x;
  IF v_reason IS NOT NULL THEN RAISE EXCEPTION 'invalid_coupon'; END IF;
  UPDATE coupons SET uses_count=coalesce(uses_count,0)+1 WHERE id=v_coupon AND (max_uses IS NULL OR coalesce(uses_count,0)<max_uses);
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_coupon'; END IF;
 END IF;
 v_final:=v_price-coalesce(v_discount,0);
 SELECT id INTO v_client FROM clients WHERE salon_id=e.salon_id AND phone_normalized=v_phone ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF v_client IS NULL THEN
  INSERT INTO clients(salon_id,name,phone,phone_normalized,birth_date,total_visits,total_spent,loyalty_points,last_visit_at)
  VALUES(e.salon_id,v_name,v_phone,v_phone,p_birth_date,1,v_final,floor(v_final)::integer,now()) RETURNING id INTO v_client;
 ELSE
  UPDATE clients SET name=CASE WHEN position(' ' IN btrim(coalesce(name,'')))=0 THEN v_name ELSE name END,
   birth_date=coalesce(birth_date,p_birth_date),total_visits=coalesce(total_visits,0)+1,total_spent=coalesce(total_spent,0)+v_final,
   loyalty_points=coalesce(loyalty_points,0)+floor(v_final)::integer,last_visit_at=now()
  WHERE id=v_client;
 END IF;
 INSERT INTO appointments(salon_id,service_id,professional_id,client_id,client_name,client_phone,date,start_time,end_time,status,price,discount,final_price,coupon_id,notes,whatsapp_request_key)
 VALUES(e.salon_id,p_service_id,v_pro,v_client,v_name,e.sender_phone,p_date,p_start,p_start+make_interval(mins=>v_dur),'pending',v_price,coalesce(v_discount,0),v_final,v_coupon,
  'Agendado pelo WhatsApp.'||CASE WHEN v_phone<>e.sender_phone THEN ' Telefone do cadastro: '||v_phone ELSE '' END,v_key)
 RETURNING id,status::text INTO v_id,v_status;
 RETURN jsonb_build_object('id',v_id,'duplicate',false,'professional_id',v_pro,'price',v_price,'discount',coalesce(v_discount,0),'final_price',v_final,'status',v_status);
END $$;

-- ---------------------------------------------------------------------------------------------
-- C) Pente-fino: função do schema public que chama pgcrypto/uuid-ossp sem esquema e sem "extensions" no
-- search_path quebra quando chamada de SECURITY DEFINER com search_path=public (caso gen_random_bytes,
-- corrigido em 20261109000250). Acrescenta "extensions" ao search_path existente; não mexe em função de extensão.
DO $$ DECLARE f record; v_path text; BEGIN
 FOR f IN
  SELECT p.oid, p.oid::regprocedure AS sig, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f'
   AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e')
   AND p.prosrc ~* '(^|[^.[:alnum:]_])(gen_random_bytes|digest|crypt|gen_salt|hmac|uuid_generate_v[14]|pgp_sym_encrypt|pgp_sym_decrypt)[[:space:]]*\('
   AND NOT EXISTS(SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) c WHERE c ILIKE 'search_path=%extensions%')
 LOOP
  SELECT substr(c,13) INTO v_path FROM unnest(coalesce(f.proconfig,'{}')) c WHERE c ILIKE 'search_path=%';
  EXECUTE format('ALTER FUNCTION %s SET search_path = %s', f.sig, coalesce(nullif(v_path,'') || ', extensions', 'public, extensions'));
  RAISE NOTICE 'search_path com extensions: %', f.sig;
 END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.whatsapp_delivery_candidates(integer),public.whatsapp_retry_outbox(uuid,uuid),
 public.whatsapp_reply_latency_v2(timestamptz,timestamptz),
 public.whatsapp_book_appointment_v2(uuid,uuid,uuid,date,time,text,text,date,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_delivery_candidates(integer),public.whatsapp_retry_outbox(uuid,uuid),
 public.whatsapp_reply_latency_v2(timestamptz,timestamptz),
 public.whatsapp_book_appointment_v2(uuid,uuid,uuid,date,time,text,text,date,text,text) TO service_role;

COMMIT;

-- Rollback (manual, revisar antes):
-- BEGIN;
-- DROP TRIGGER IF EXISTS appointments_auto_confirm ON public.appointments;
-- DROP FUNCTION IF EXISTS public.appointments_auto_confirm(), public.whatsapp_delivery_candidates(integer),
--   public.whatsapp_retry_outbox(uuid,uuid), public.whatsapp_reply_latency_v2(timestamptz,timestamptz);
-- -- Reaplicar de 20261106002000: whatsapp_outbox_to_inbox (+ trigger AFTER UPDATE OF status) e whatsapp_record_delivery;
-- -- de 20261106004000: whatsapp_book_appointment_v2; de 20261109000200: push_enqueue_new_appointment;
-- -- whatsapp_enqueue_appointment_event: definição em af365-qa/autoconf.txt.
-- -- trigger_appointment_confirmation() estava morta (sem trigger); recriar só se houver motivo (definição em autoconf.txt).
-- -- Antes de remover 'queued' da CHECK: UPDATE public.whatsapp_messages SET status='sending' WHERE status='queued';
-- -- ALTER TABLE public.salons ALTER COLUMN auto_confirm_appointments SET DEFAULT true; (valores por salão: decidir com o dono)
-- -- Colunas novas (whatsapp_at, delivery_checks, delivery_next_check_at) podem ficar.
-- COMMIT;
