-- ============================================================================
-- Agenda Fácil 365 — Atendente WhatsApp (fluxo do link público por conversa).
-- 1) Outbox aceita mensagem interativa (lista/botões) com payload + fallback em texto.
-- 2) Resposta do chatbot pode ter várias mensagens (menu, QR do PIX, copia e cola).
-- 3) Agendamento v2: cadastro do cliente (nome completo, telefone do cadastro, nascimento),
--    "qualquer profissional", cupom validado no servidor, pontos de fidelidade como o link público.
-- 4) Pedido de avaliação pelo WhatsApp ao concluir (liga/desliga por salão) e avaliação pela conversa.
-- Aditiva e idempotente. Não altera funções existentes (v1 continuam). Rollback comentado no fim.
-- ============================================================================
BEGIN;

-- Configurações novas por salão (UI: src/components/whatsapp/AutomationSettingsCard.tsx).
ALTER TABLE public.whatsapp_automation_settings ADD COLUMN IF NOT EXISTS review_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.whatsapp_automation_settings ADD COLUMN IF NOT EXISTS interactive_enabled boolean NOT NULL DEFAULT true;

-- Outbox: tipo "interactive" (payload = corpo Evolution sem o número; text_content = fallback numerado).
ALTER TABLE public.whatsapp_outbox ADD COLUMN IF NOT EXISTS payload jsonb;
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.whatsapp_outbox'::regclass AND contype='c'
   AND pg_get_constraintdef(oid) ILIKE '%content_type%' AND pg_get_constraintdef(oid) NOT ILIKE '%interactive%' LOOP
  EXECUTE format('ALTER TABLE public.whatsapp_outbox DROP CONSTRAINT %I', c.conname);
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.whatsapp_outbox'::regclass AND conname='whatsapp_outbox_content_type_v2') THEN
  ALTER TABLE public.whatsapp_outbox ADD CONSTRAINT whatsapp_outbox_content_type_v2
   CHECK(content_type IN('text','image','video','document','status_text','status_image','status_video','interactive'));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.whatsapp_outbox'::regclass AND conname='whatsapp_outbox_payload_size') THEN
  ALTER TABLE public.whatsapp_outbox ADD CONSTRAINT whatsapp_outbox_payload_size
   CHECK(payload IS NULL OR (jsonb_typeof(payload)='object' AND length(payload::text)<=8000));
 END IF;
END $$;

-- Resposta com várias mensagens, em ordem (scheduled_for escalonado). Mensagem 0 usa a mesma chave da v1.
CREATE OR REPLACE FUNCTION public.whatsapp_finish_inbound_v2(p_event_id uuid,p_claim uuid,p_messages jsonb,p_provider text,p_model text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE e whatsapp_webhook_events; m jsonb; i integer:=0; v_type text; v_text text; v_path text; BEGIN
 SELECT * INTO e FROM whatsapp_webhook_events WHERE id=p_event_id AND claim_token=p_claim AND status='processing' AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
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
  INSERT INTO whatsapp_outbox(salon_id,instance_id,source_event_id,idempotency_key,category,recipient_phone,content_type,text_content,payload,media_path,media_mime,media_filename,scheduled_for)
  VALUES(e.salon_id,e.instance_id,e.id,'inbound-reply:'||e.id::text||CASE WHEN i=0 THEN '' ELSE ':'||i::text END,'chatbot',e.sender_phone,v_type,v_text,
   CASE WHEN v_type='interactive' THEN m->'payload' END,
   CASE WHEN v_type='image' THEN v_path END,CASE WHEN v_type='image' THEN coalesce(m->>'media_mime','image/png') END,CASE WHEN v_type='image' THEN left(coalesce(m->>'media_filename','imagem.png'),120) END,
   now()+make_interval(secs=>i*2))
  ON CONFLICT(salon_id,idempotency_key) DO NOTHING;
  i:=i+1;
 END LOOP;
 UPDATE whatsapp_webhook_events SET status=CASE WHEN i>0 THEN 'completed' ELSE 'ignored' END,claim_token=NULL,lease_until=NULL,completed_at=now() WHERE id=e.id;
 RETURN true;
END $$;

-- Cupom: mesmas regras do link público (ativo, vigência, usos, mínimo) + "só clientes novos". Nunca lista códigos.
CREATE OR REPLACE FUNCTION public.whatsapp_coupon_eval(p_salon_id uuid,p_phone text,p_code text,p_total numeric)
RETURNS TABLE(coupon_id uuid,discount numeric,reason text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$ DECLARE c coupons; v numeric; BEGIN
 IF p_code IS NULL OR length(btrim(p_code)) NOT BETWEEN 2 AND 40 THEN RETURN QUERY SELECT NULL::uuid,0::numeric,'not_found'; RETURN; END IF;
 SELECT * INTO c FROM coupons WHERE salon_id=p_salon_id AND upper(code)=upper(btrim(p_code)) AND coalesce(is_active,true) LIMIT 1;
 IF NOT FOUND THEN RETURN QUERY SELECT NULL::uuid,0::numeric,'not_found'; RETURN; END IF;
 IF c.valid_from IS NOT NULL AND c.valid_from>now() THEN RETURN QUERY SELECT c.id,0::numeric,'not_started'; RETURN; END IF;
 IF c.valid_until IS NOT NULL AND c.valid_until<now() THEN RETURN QUERY SELECT c.id,0::numeric,'expired'; RETURN; END IF;
 IF c.max_uses IS NOT NULL AND coalesce(c.uses_count,0)>=c.max_uses THEN RETURN QUERY SELECT c.id,0::numeric,'exhausted'; RETURN; END IF;
 IF c.min_purchase IS NOT NULL AND p_total<c.min_purchase THEN RETURN QUERY SELECT c.id,0::numeric,'min_purchase'; RETURN; END IF;
 IF coalesce(c.is_new_clients_only,false) AND EXISTS(SELECT 1 FROM appointments a WHERE a.salon_id=p_salon_id AND a.client_phone=p_phone AND a.status IN('confirmed','completed')) THEN
  RETURN QUERY SELECT c.id,0::numeric,'new_clients_only'; RETURN; END IF;
 v:=CASE WHEN c.type::text='percentage' THEN p_total*(c.value/100) ELSE least(c.value,p_total) END;
 RETURN QUERY SELECT c.id,round(greatest(0,least(v,p_total)),2),NULL::text;
END $$;

-- Agendamento v2. Identidade (salão + telefone da conversa) vem do evento autenticado; nada do modelo.
-- client_phone do agendamento = WhatsApp da conversa (avisos nunca vão para número digitado e não verificado);
-- p_client_phone = telefone do cadastro (pode ser outro), gravado em clients.
CREATE OR REPLACE FUNCTION public.whatsapp_book_appointment_v2(
 p_event_id uuid,p_service_id uuid,p_professional_id uuid,p_date date,p_start time,p_client_name text,
 p_client_phone text,p_birth_date date,p_coupon_code text,p_request_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE e whatsapp_webhook_events; v_key text; v_id uuid; v_client uuid; v_dur integer; v_price numeric; v_pro uuid;
 v_coupon uuid; v_discount numeric:=0; v_reason text; v_final numeric; v_phone text; v_name text; a appointments;
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
 IF FOUND THEN RETURN jsonb_build_object('id',a.id,'duplicate',true,'professional_id',a.professional_id,'price',a.price,'discount',coalesce(a.discount,0),'final_price',a.final_price); END IF;
 SELECT duration_minutes,price INTO v_dur,v_price FROM services WHERE id=p_service_id AND salon_id=e.salon_id AND coalesce(is_active,true);
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_service'; END IF;
 IF p_professional_id IS NOT NULL THEN
  v_pro:=p_professional_id;
 ELSE
  -- "Qualquer profissional": primeiro (por nome) que atende o serviço e está livre no horário.
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
 -- Cliente idempotente por telefone normalizado; não sobrescreve nome completo nem nascimento já cadastrados.
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
 RETURNING id INTO v_id;
 RETURN jsonb_build_object('id',v_id,'duplicate',false,'professional_id',v_pro,'price',v_price,'discount',coalesce(v_discount,0),'final_price',v_final);
END $$;

-- Pedido de avaliação: um por agendamento; avaliação pela conversa grava em reviews (mesma tabela do /avaliar/:id).
CREATE TABLE IF NOT EXISTS public.whatsapp_review_requests(
 appointment_id uuid PRIMARY KEY REFERENCES public.appointments(id) ON DELETE CASCADE,
 salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
 phone text NOT NULL CHECK(phone ~ '^\+[1-9][0-9]{6,14}$'),
 requested_at timestamptz NOT NULL DEFAULT now(),
 review_id uuid REFERENCES public.reviews(id) ON DELETE SET NULL,
 comment_until timestamptz
);
CREATE INDEX IF NOT EXISTS whatsapp_review_requests_open ON public.whatsapp_review_requests(salon_id,phone,requested_at DESC);
ALTER TABLE public.whatsapp_review_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read review requests" ON public.whatsapp_review_requests;
CREATE POLICY "Owners read review requests" ON public.whatsapp_review_requests FOR SELECT TO authenticated USING(public.whatsapp_can_manage_salon(salon_id));
DROP POLICY IF EXISTS "Workers manage review requests" ON public.whatsapp_review_requests;
CREATE POLICY "Workers manage review requests" ON public.whatsapp_review_requests FOR ALL TO service_role USING(true) WITH CHECK(true);
REVOKE ALL ON public.whatsapp_review_requests FROM anon,authenticated;
GRANT SELECT ON public.whatsapp_review_requests TO authenticated;
GRANT ALL ON public.whatsapp_review_requests TO service_role;

CREATE OR REPLACE FUNCTION public.whatsapp_enqueue_review_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE v_instance uuid; v_salon text; v_service text; v_first text; v_url text; v_text text; n integer; BEGIN
 IF NEW.status::text<>'completed' OR OLD.status::text='completed' THEN RETURN NEW; END IF;
 IF NOT coalesce((SELECT review_enabled FROM whatsapp_automation_settings WHERE salon_id=NEW.salon_id),false) THEN RETURN NEW; END IF;
 IF NEW.client_phone IS NULL OR NEW.client_phone !~ '^\+[1-9][0-9]{6,14}$' THEN RETURN NEW; END IF;
 IF EXISTS(SELECT 1 FROM reviews WHERE appointment_id=NEW.id) THEN RETURN NEW; END IF;
 SELECT id INTO v_instance FROM whatsapp_instances WHERE salon_id=NEW.salon_id;
 IF v_instance IS NULL THEN RETURN NEW; END IF;
 INSERT INTO whatsapp_review_requests(appointment_id,salon_id,phone) VALUES(NEW.id,NEW.salon_id,NEW.client_phone) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n=0 THEN RETURN NEW; END IF;
 SELECT name INTO v_salon FROM salons WHERE id=NEW.salon_id;
 SELECT name INTO v_service FROM services WHERE id=NEW.service_id AND salon_id=NEW.salon_id;
 v_first:=coalesce(nullif(split_part(btrim(coalesce(NEW.client_name,'')),' ',1),''),'tudo bem');
 -- Domínio oficial (mesmo de 20261106000200_official_domain_links). Configurável: ALTER DATABASE ... SET app.public_url.
 v_url:=coalesce(nullif(current_setting('app.public_url',true),''),'https://agendafacil365.com.br')||'/avaliar/'||NEW.id::text;
 v_text:='Oi, '||v_first||'! Obrigado por vir ao '||coalesce(v_salon,'salão')||'. Como foi seu '||coalesce(v_service,'atendimento')||E'?\n\n'
  ||E'1. ⭐⭐⭐⭐⭐ Excelente\n2. ⭐⭐⭐⭐ Muito bom\n3. ⭐⭐⭐ Bom\n4. ⭐⭐ Regular\n5. ⭐ Ruim\n\nResponda com o número ou avalie pelo link: '||v_url;
 INSERT INTO whatsapp_outbox(salon_id,instance_id,idempotency_key,category,recipient_phone,content_type,text_content,payload,scheduled_for)
 VALUES(NEW.salon_id,v_instance,'review:'||NEW.id::text,'transactional',NEW.client_phone,'interactive',v_text,
  jsonb_build_object('op','list','body',jsonb_build_object('title','Avalie seu atendimento','description','Como foi seu '||coalesce(v_service,'atendimento')||'? Se preferir, use o link: '||v_url,
   'buttonText','Dar nota','footerText','','sections',jsonb_build_array(jsonb_build_object('title','Sua nota','rows',jsonb_build_array(
    jsonb_build_object('title','⭐⭐⭐⭐⭐ Excelente','description','Nota 5','rowId','rate.5'),
    jsonb_build_object('title','⭐⭐⭐⭐ Muito bom','description','Nota 4','rowId','rate.4'),
    jsonb_build_object('title','⭐⭐⭐ Bom','description','Nota 3','rowId','rate.3'),
    jsonb_build_object('title','⭐⭐ Regular','description','Nota 2','rowId','rate.2'),
    jsonb_build_object('title','⭐ Ruim','description','Nota 1','rowId','rate.1')))))),
  now()+interval '1 hour')
 ON CONFLICT(salon_id,idempotency_key) DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS whatsapp_enqueue_review_request ON public.appointments;
CREATE TRIGGER whatsapp_enqueue_review_request AFTER UPDATE OF status ON public.appointments
 FOR EACH ROW EXECUTE FUNCTION public.whatsapp_enqueue_review_request();

-- Nota pela conversa: pedido aberto mais recente (7 dias) deste telefone neste salão. Uma avaliação por agendamento.
CREATE OR REPLACE FUNCTION public.whatsapp_submit_review(p_event_id uuid,p_rating integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE e whatsapp_webhook_events; r whatsapp_review_requests; a appointments; v_client uuid; v_review uuid; BEGIN
 SELECT * INTO e FROM whatsapp_webhook_events WHERE id=p_event_id AND status='processing';
 IF NOT FOUND THEN RAISE EXCEPTION 'event_missing'; END IF;
 IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'invalid_rating'; END IF;
 SELECT * INTO r FROM whatsapp_review_requests WHERE salon_id=e.salon_id AND phone=e.sender_phone AND review_id IS NULL
  AND requested_at>now()-interval '7 days' ORDER BY requested_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','no_request'); END IF;
 SELECT * INTO a FROM appointments WHERE id=r.appointment_id AND salon_id=e.salon_id;
 SELECT id INTO v_review FROM reviews WHERE appointment_id=a.id LIMIT 1;
 IF v_review IS NULL THEN
  v_client:=a.client_id;
  IF v_client IS NULL THEN SELECT id INTO v_client FROM clients WHERE salon_id=e.salon_id AND phone_normalized=e.sender_phone ORDER BY created_at LIMIT 1; END IF;
  IF v_client IS NULL THEN
   INSERT INTO clients(salon_id,name,phone,phone_normalized) VALUES(e.salon_id,coalesce(nullif(a.client_name,''),'Cliente'),e.sender_phone,e.sender_phone) RETURNING id INTO v_client;
  END IF;
  INSERT INTO reviews(salon_id,client_id,professional_id,appointment_id,rating,is_public) VALUES(e.salon_id,v_client,a.professional_id,a.id,p_rating,true) RETURNING id INTO v_review;
 END IF;
 UPDATE whatsapp_review_requests SET review_id=v_review,comment_until=now()+interval '30 minutes' WHERE appointment_id=r.appointment_id;
 RETURN jsonb_build_object('ok',true,'rating',p_rating);
END $$;

CREATE OR REPLACE FUNCTION public.whatsapp_review_comment(p_event_id uuid,p_comment text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE e whatsapp_webhook_events; r whatsapp_review_requests; BEGIN
 SELECT * INTO e FROM whatsapp_webhook_events WHERE id=p_event_id AND status='processing';
 IF NOT FOUND THEN RAISE EXCEPTION 'event_missing'; END IF;
 SELECT * INTO r FROM whatsapp_review_requests WHERE salon_id=e.salon_id AND phone=e.sender_phone AND review_id IS NOT NULL
  AND comment_until>now() ORDER BY requested_at DESC LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE reviews SET comment=left(btrim(p_comment),1000) WHERE id=r.review_id AND salon_id=e.salon_id AND comment IS NULL;
 UPDATE whatsapp_review_requests SET comment_until=NULL WHERE appointment_id=r.appointment_id;
 RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.whatsapp_finish_inbound_v2(uuid,uuid,jsonb,text,text),public.whatsapp_coupon_eval(uuid,text,text,numeric),
 public.whatsapp_book_appointment_v2(uuid,uuid,uuid,date,time,text,text,date,text,text),public.whatsapp_enqueue_review_request(),
 public.whatsapp_submit_review(uuid,integer),public.whatsapp_review_comment(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_finish_inbound_v2(uuid,uuid,jsonb,text,text),public.whatsapp_coupon_eval(uuid,text,text,numeric),
 public.whatsapp_book_appointment_v2(uuid,uuid,uuid,date,time,text,text,date,text,text),
 public.whatsapp_submit_review(uuid,integer),public.whatsapp_review_comment(uuid,text) TO service_role;

COMMIT;

-- Rollback (manual, revisar antes):
-- BEGIN;
-- DROP TRIGGER IF EXISTS whatsapp_enqueue_review_request ON public.appointments;
-- DROP FUNCTION IF EXISTS public.whatsapp_enqueue_review_request(), public.whatsapp_submit_review(uuid,integer), public.whatsapp_review_comment(uuid,text),
--   public.whatsapp_book_appointment_v2(uuid,uuid,uuid,date,time,text,text,date,text,text), public.whatsapp_coupon_eval(uuid,text,text,numeric),
--   public.whatsapp_finish_inbound_v2(uuid,uuid,jsonb,text,text);
-- -- Tabela de pedidos e colunas novas podem ficar (sem uso); remover só se não houver dados:
-- -- DROP TABLE IF EXISTS public.whatsapp_review_requests;
-- -- ALTER TABLE public.whatsapp_outbox DROP CONSTRAINT IF EXISTS whatsapp_outbox_content_type_v2; (antes, cancelar outbox 'interactive' pendente)
-- COMMIT;
