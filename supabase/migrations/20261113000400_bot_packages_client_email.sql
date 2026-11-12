-- Pacotes no bot do WhatsApp + e-mail do cliente (identificador junto do telefone) + e-mail de agendamento confirmado.
-- Aditiva: colunas novas, tabela nova, funções recriadas com parâmetros opcionais (chamadas antigas continuam valendo).
BEGIN;

-- ------------------------------------------------------------------------------------------------ e-mail do cliente
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_email text;
CREATE INDEX IF NOT EXISTS clients_salon_email_lookup ON public.clients (salon_id, lower(email)) WHERE email IS NOT NULL;

-- Agendamento com e-mail: normaliza, liga ao cadastro (telefone primeiro, depois e-mail único no salão) e grava o
-- e-mail no cliente. Sem cadastro, cria. Nunca bloqueia o agendamento (falha vira aviso no log).
CREATE OR REPLACE FUNCTION public.appointments_client_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text := nullif(lower(btrim(coalesce(NEW.client_email, ''))), ''); v_key text; v_digits text; v_client uuid;
BEGIN
  IF v_email IS NOT NULL AND (length(v_email) > 254 OR v_email !~ '^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$') THEN v_email := NULL; END IF;
  NEW.client_email := v_email;
  IF v_email IS NULL THEN RETURN NEW; END IF;
  BEGIN
    v_key := public.portal_phone_key(NEW.client_phone);
    v_digits := regexp_replace(coalesce(NEW.client_phone, ''), '\D', '', 'g');
    v_client := NEW.client_id;
    IF v_client IS NULL AND length(v_key) BETWEEN 10 AND 13 THEN
      SELECT id INTO v_client FROM clients WHERE salon_id = NEW.salon_id
        AND public.portal_phone_key(coalesce(phone_normalized, phone)) = v_key ORDER BY created_at LIMIT 1;
    END IF;
    IF v_client IS NULL AND (SELECT count(*) FROM clients WHERE salon_id = NEW.salon_id AND lower(email) = v_email) = 1 THEN
      SELECT id INTO v_client FROM clients WHERE salon_id = NEW.salon_id AND lower(email) = v_email;
    END IF;
    IF v_client IS NULL AND length(v_key) BETWEEN 10 AND 13 AND length(btrim(coalesce(NEW.client_name, ''))) >= 2 THEN
      INSERT INTO clients(salon_id, name, phone, phone_normalized, email)
      VALUES (NEW.salon_id, btrim(NEW.client_name), NEW.client_phone,
        CASE WHEN NEW.client_phone ~ '^\+[1-9][0-9]{7,14}$' THEN NEW.client_phone WHEN length(v_digits) IN (10, 11) THEN '+55' || v_digits END, v_email)
      RETURNING id INTO v_client;
    END IF;
    IF v_client IS NOT NULL THEN
      NEW.client_id := coalesce(NEW.client_id, v_client);
      UPDATE clients SET email = v_email WHERE id = v_client AND lower(coalesce(email, '')) <> v_email;
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'appointments_client_identity: %', SQLERRM;
  END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS appointments_client_identity ON public.appointments;
CREATE TRIGGER appointments_client_identity BEFORE INSERT OR UPDATE OF client_email ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointments_client_identity();

-- Lembrete de retorno: usa o e-mail do cadastro e, na falta, o informado no agendamento.
DO $$
DECLARE def text := pg_get_functiondef('public.procedure_return_sync()'::regprocedure);
BEGIN
  IF position('NEW.client_email' IN def) = 0 THEN
    EXECUTE replace(def, 'nullif(btrim(c.email), '''')', 'coalesce(nullif(btrim(c.email), ''''), nullif(btrim(NEW.client_email), ''''))');
  END IF;
END $$;

-- ------------------------------------------------------------------------------------------------ e-mail de confirmação
CREATE TABLE IF NOT EXISTS public.client_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('confirmed')),
  to_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  claim_token uuid, lease_until timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  resend_id text, error_code text, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
  UNIQUE (appointment_id, kind)
);
CREATE INDEX IF NOT EXISTS client_email_outbox_due ON public.client_email_outbox (next_attempt_at) WHERE status = 'pending';
ALTER TABLE public.client_email_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads client emails" ON public.client_email_outbox;
CREATE POLICY "Owner reads client emails" ON public.client_email_outbox FOR SELECT TO authenticated USING (public.whatsapp_can_manage_salon(salon_id));

-- Só quando o agendamento fica confirmado (criado já confirmado ou confirmado depois). Um e-mail por agendamento.
CREATE OR REPLACE FUNCTION public.appointments_email_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_new integer;
BEGIN
  IF NEW.status::text <> 'confirmed' OR (TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) OR NEW.date < current_date - 1 THEN RETURN NEW; END IF;
  v_email := coalesce(nullif(NEW.client_email, ''), (SELECT nullif(lower(btrim(email)), '') FROM clients WHERE id = NEW.client_id AND salon_id = NEW.salon_id));
  IF v_email IS NULL OR v_email !~ '^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$' THEN RETURN NEW; END IF;
  INSERT INTO client_email_outbox(salon_id, appointment_id, kind, to_email) VALUES (NEW.salon_id, NEW.id, 'confirmed', v_email)
  ON CONFLICT (appointment_id, kind) DO NOTHING;
  GET DIAGNOSTICS v_new = ROW_COUNT;
  -- Envio imediato (pg_net sai depois do commit); se falhar, o cron de 5 min envia.
  IF v_new > 0 THEN BEGIN PERFORM public.invoke_edge_function('client-emails'); EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'appointments_email_confirmed: %', SQLERRM; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS appointments_email_confirmed ON public.appointments;
CREATE TRIGGER appointments_email_confirmed AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointments_email_confirmed();

CREATE OR REPLACE FUNCTION public.client_email_claim()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r client_email_outbox; a appointments; s salons;
BEGIN
  SELECT o.* INTO r FROM client_email_outbox o WHERE o.status = 'pending' AND o.next_attempt_at <= now()
    AND (o.lease_until IS NULL OR o.lease_until < now()) ORDER BY o.created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF r.id IS NULL THEN RETURN NULL; END IF;
  UPDATE client_email_outbox SET claim_token = gen_random_uuid(), lease_until = now() + interval '2 minutes', attempts = attempts + 1
   WHERE id = r.id RETURNING * INTO r;
  SELECT * INTO a FROM appointments WHERE id = r.appointment_id;
  IF a.status::text <> 'confirmed' THEN
    UPDATE client_email_outbox SET status = 'failed', error_code = 'not_confirmed', lease_until = NULL WHERE id = r.id;
    RETURN jsonb_build_object('skip', true);
  END IF;
  SELECT * INTO s FROM salons WHERE id = r.salon_id;
  RETURN jsonb_build_object('id', r.id, 'claim', r.claim_token, 'to', r.to_email, 'kind', r.kind, 'salon_id', r.salon_id,
    'client_name', a.client_name, 'client_phone', a.client_phone, 'date', a.date, 'start', to_char(a.start_time, 'HH24:MI'),
    'final_price', coalesce(a.final_price, a.price), 'credit', a.credit_id IS NOT NULL,
    'service', (SELECT name FROM services WHERE id = a.service_id), 'professional', (SELECT name FROM professionals WHERE id = a.professional_id),
    'salon', jsonb_build_object('name', s.name, 'slug', s.slug, 'logo_url', s.logo_url, 'primary_color', s.primary_color,
      'pwa_icon_url', s.pwa_icon_url, 'email', s.email, 'address', s.address, 'city', s.city, 'phone', coalesce(s.whatsapp, s.phone)));
END $$;

-- accepted = enviado; retry = tenta de novo (até 5 vezes, espaçando); failed = encerra.
CREATE OR REPLACE FUNCTION public.client_email_finish(p_id uuid, p_claim uuid, p_status text, p_resend_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE client_email_outbox SET lease_until = NULL, resend_id = coalesce(p_resend_id, resend_id),
    status = CASE WHEN p_status = 'accepted' THEN 'sent' WHEN p_status = 'retry' AND attempts < 5 THEN 'pending' ELSE 'failed' END,
    sent_at = CASE WHEN p_status = 'accepted' THEN now() END,
    error_code = CASE WHEN p_status = 'accepted' THEN NULL ELSE p_status END,
    next_attempt_at = now() + make_interval(mins => 5 * attempts)
  WHERE id = p_id AND claim_token = p_claim AND status = 'pending';
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.client_email_claim() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.client_email_finish(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_email_claim() TO service_role;
GRANT EXECUTE ON FUNCTION public.client_email_finish(uuid, uuid, text, text) TO service_role;
SELECT cron.schedule('client-emails', '*/5 * * * *', $c$SELECT public.invoke_edge_function('client-emails')$c$);

-- ------------------------------------------------------------------------------------------------ fluxo guiado
ALTER TABLE public.whatsapp_chatbot_sessions DROP CONSTRAINT IF EXISTS whatsapp_chatbot_sessions_current_step_check;
ALTER TABLE public.whatsapp_chatbot_sessions ADD CONSTRAINT whatsapp_chatbot_sessions_current_step_check CHECK (current_step = ANY (ARRAY[
  'IDLE','MAIN_MENU','SELECT_SERVICE','SELECT_PROFESSIONAL','SELECT_DATE','SELECT_TIME','CONFIRM_NAME','CONFIRM_BOOKING','MY_APPOINTMENTS',
  'APPOINTMENT_ACTIONS','CONFIRM_CANCEL_APPOINTMENT','RESCHEDULE_SELECT_DATE','RESCHEDULE_SELECT_TIME','HUMAN_HANDOFF','RATE_APPOINTMENT','RATE_COMMENT','PAYMENT',
  'CONFIRM_EMAIL','PACKAGES','PACKAGE_BUY']::text[]));

-- Pacote assinado junto de um agendamento ("quer agendar hoje? sim"): pago, o agendamento já usa 1 crédito.
ALTER TABLE public.package_orders ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

-- Créditos liberados: se o pedido veio com agendamento e o serviço está no pacote, usa 1 crédito e confirma o horário.
CREATE OR REPLACE FUNCTION public.package_order_apply_appointment(p_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o package_orders; v_cc uuid;
BEGIN
  SELECT * INTO o FROM package_orders WHERE id = p_order_id;
  IF o.appointment_id IS NULL OR o.status <> 'paid' THEN RETURN false; END IF;
  SELECT cc.id INTO v_cc FROM client_credits cc JOIN appointments a ON a.id = o.appointment_id AND a.service_id = cc.service_id
   WHERE cc.order_id = o.id AND cc.remaining_uses > 0 AND a.salon_id = o.salon_id AND a.credit_id IS NULL AND a.status IN ('pending', 'confirmed')
   FOR UPDATE OF cc;
  IF v_cc IS NULL THEN RETURN false; END IF;
  UPDATE client_credits SET remaining_uses = remaining_uses - 1 WHERE id = v_cc;
  UPDATE appointments a SET credit_id = v_cc, status = 'confirmed',
    final_price = greatest(0, coalesce(a.final_price, a.price, 0) - coalesce((SELECT price FROM services WHERE id = a.service_id), 0)),
    notes = concat_ws(' | ', a.notes, '🎁 Usou 1 crédito do pacote')
  WHERE a.id = o.appointment_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.package_order_apply_appointment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.package_order_apply_appointment(uuid) TO service_role;

DO $$
DECLARE def text := pg_get_functiondef('public.package_order_fulfill(uuid)'::regprocedure);
BEGIN
  IF position('package_order_apply_appointment' IN def) = 0 THEN
    def := replace(def, 'v_value := replace(to_char(o.amount_cents', E'PERFORM public.package_order_apply_appointment(o.id);\n  v_value := replace(to_char(o.amount_cents');
    def := replace(def, 'ao agendar pelo link, responda que é assinante e informe este número.', 'ao agendar aqui pelo WhatsApp eles entram sozinhos; pelo link, responda que é assinante e informe este número.');
    EXECUTE def;
  END IF;
END $$;

-- Agendamento pelo bot: e-mail opcional e crédito de pacote usado sozinho (mesmo telefone, mesmo serviço, com saldo).
DROP FUNCTION IF EXISTS public.whatsapp_book_appointment_v2(uuid, uuid, uuid, date, time, text, text, date, text, text);
CREATE OR REPLACE FUNCTION public.whatsapp_book_appointment_v2(
 p_event_id uuid,p_service_id uuid,p_professional_id uuid,p_date date,p_start time,p_client_name text,
 p_client_phone text,p_birth_date date,p_coupon_code text,p_request_key text,p_email text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE e whatsapp_webhook_events; v_key text; v_id uuid; v_client uuid; v_dur integer; v_price numeric; v_pro uuid;
 v_coupon uuid; v_discount numeric:=0; v_reason text; v_final numeric; v_phone text; v_name text; a appointments; v_status text; v_credit uuid;
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
 IF FOUND THEN RETURN jsonb_build_object('id',a.id,'duplicate',true,'professional_id',a.professional_id,'price',a.price,'discount',coalesce(a.discount,0),'final_price',a.final_price,'status',a.status,'credit',a.credit_id IS NOT NULL); END IF;
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
 -- Crédito de pacote do próprio número para este serviço (o que vence primeiro). O trigger confere e desconta.
 SELECT cc.id INTO v_credit FROM client_credits cc JOIN clients c ON c.id=cc.client_id
  WHERE cc.salon_id=e.salon_id AND cc.service_id=p_service_id AND cc.remaining_uses>0 AND (cc.expires_at IS NULL OR cc.expires_at>now())
    AND public.portal_phone_key(coalesce(c.phone_normalized,c.phone))=public.portal_phone_key(e.sender_phone)
  ORDER BY cc.expires_at NULLS LAST, cc.created_at LIMIT 1;
 v_final:=CASE WHEN v_credit IS NOT NULL THEN 0 ELSE v_price-coalesce(v_discount,0) END;
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
 INSERT INTO appointments(salon_id,service_id,professional_id,client_id,client_name,client_phone,client_email,date,start_time,end_time,status,price,discount,final_price,coupon_id,notes,whatsapp_request_key,credit_id)
 VALUES(e.salon_id,p_service_id,v_pro,v_client,v_name,e.sender_phone,p_email,p_date,p_start,p_start+make_interval(mins=>v_dur),'pending',v_price,coalesce(v_discount,0),v_price-coalesce(v_discount,0),v_coupon,
  'Agendado pelo WhatsApp.'||CASE WHEN v_phone<>e.sender_phone THEN ' Telefone do cadastro: '||v_phone ELSE '' END,v_key,v_credit)
 RETURNING id,status::text,final_price INTO v_id,v_status,v_final;
 RETURN jsonb_build_object('id',v_id,'duplicate',false,'professional_id',v_pro,'price',v_price,'discount',coalesce(v_discount,0),'final_price',v_final,'status',v_status,
  'credit',v_credit IS NOT NULL,'credit_left',(SELECT remaining_uses FROM client_credits WHERE id=v_credit));
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_book_appointment_v2(uuid,uuid,uuid,date,time,text,text,date,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_book_appointment_v2(uuid,uuid,uuid,date,time,text,text,date,text,text,text) TO service_role;

COMMIT;

-- Rollback:
-- BEGIN; SELECT cron.unschedule('client-emails'); DROP TRIGGER IF EXISTS appointments_email_confirmed ON public.appointments;
-- DROP TRIGGER IF EXISTS appointments_client_identity ON public.appointments; DROP TABLE IF EXISTS public.client_email_outbox; COMMIT;
-- (whatsapp_book_appointment_v2 e package_order_fulfill: reaplicar as versões de 20261109000300 e 20261112000300/20261113000100.)
