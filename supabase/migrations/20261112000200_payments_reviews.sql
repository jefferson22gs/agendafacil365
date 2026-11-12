-- Cobrança pelo WhatsApp com a conta do próprio salão (Pix manual, Mercado Pago, Asaas, PagBank, InfinitePay)
-- e avaliações em toda parte (WhatsApp, área do cliente, escolha do profissional).
-- Credenciais ficam em payment_private (sem acesso de anon/authenticated); o painel só vê a dica (últimos 4).
BEGIN;

-- ------------------------------------------------------------------------------------------- configuração
CREATE TABLE IF NOT EXISTS public.salon_payment_settings (
  salon_id uuid PRIMARY KEY REFERENCES public.salons(id) ON DELETE CASCADE,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  provider text NOT NULL DEFAULT 'pix_manual' CHECK (provider IN ('pix_manual','mercadopago','asaas','pagbank','infinitepay')),
  methods text[] NOT NULL DEFAULT '{pix}' CHECK (methods <@ ARRAY['pix','card']::text[] AND cardinality(methods) BETWEEN 1 AND 2),
  pay_at_salon boolean NOT NULL DEFAULT true,
  sandbox boolean NOT NULL DEFAULT false,
  infinitepay_handle text CHECK (infinitepay_handle IS NULL OR infinitepay_handle ~ '^[a-z0-9][a-z0-9_.-]{1,59}$'),
  credential_hint text CHECK (credential_hint IS NULL OR length(credential_hint) <= 12),
  credential_ok_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.salon_payment_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage payment settings" ON public.salon_payment_settings;
CREATE POLICY "Owners manage payment settings" ON public.salon_payment_settings FOR ALL TO authenticated
  USING (public.whatsapp_can_manage_salon(salon_id)) WITH CHECK (public.whatsapp_can_manage_salon(salon_id));
REVOKE ALL ON public.salon_payment_settings FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.salon_payment_settings TO authenticated;
GRANT ALL ON public.salon_payment_settings TO service_role;
-- Dica e verificação da credencial só o servidor grava (depois de testar com o provedor).
CREATE OR REPLACE FUNCTION public.salon_payment_settings_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF TG_OP = 'INSERT' THEN NEW.credential_hint := NULL; NEW.credential_ok_at := NULL;
    ELSE NEW.credential_hint := OLD.credential_hint; NEW.credential_ok_at := CASE WHEN NEW.provider = OLD.provider THEN OLD.credential_ok_at END; END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS salon_payment_settings_guard ON public.salon_payment_settings;
CREATE TRIGGER salon_payment_settings_guard BEFORE INSERT OR UPDATE ON public.salon_payment_settings FOR EACH ROW EXECUTE FUNCTION public.salon_payment_settings_guard();

-- Quem já cobrava por PIX no WhatsApp (chave cadastrada) continua igual.
INSERT INTO public.salon_payment_settings (salon_id, whatsapp_enabled, provider)
SELECT id, true, 'pix_manual' FROM public.salons WHERE nullif(btrim(pix_key), '') IS NOT NULL
ON CONFLICT (salon_id) DO NOTHING;

CREATE SCHEMA IF NOT EXISTS payment_private;
REVOKE ALL ON SCHEMA payment_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA payment_private TO service_role;
CREATE TABLE IF NOT EXISTS payment_private.gateway_secrets (
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('mercadopago','asaas','pagbank','infinitepay')),
  secret text NOT NULL CHECK (length(secret) BETWEEN 8 AND 600),
  webhook_token text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (salon_id, provider)
);
REVOKE ALL ON payment_private.gateway_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON payment_private.gateway_secrets TO service_role;

CREATE OR REPLACE FUNCTION public.payment_save_secret(p_salon_id uuid, p_provider text, p_secret text, p_webhook_token text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, payment_private AS $$
  INSERT INTO payment_private.gateway_secrets(salon_id, provider, secret, webhook_token) VALUES (p_salon_id, p_provider, p_secret, p_webhook_token)
  ON CONFLICT (salon_id, provider) DO UPDATE SET secret = EXCLUDED.secret, webhook_token = coalesce(EXCLUDED.webhook_token, gateway_secrets.webhook_token), updated_at = now();
$$;
CREATE OR REPLACE FUNCTION public.payment_secret(p_salon_id uuid, p_provider text)
RETURNS TABLE(secret text, webhook_token text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, payment_private AS $$
  SELECT secret, webhook_token FROM payment_private.gateway_secrets WHERE salon_id = p_salon_id AND provider = p_provider;
$$;
REVOKE ALL ON FUNCTION public.payment_save_secret(uuid, text, text, text), public.payment_secret(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_save_secret(uuid, text, text, text), public.payment_secret(uuid, text) TO service_role;

-- ------------------------------------------------------------------------------------------- cobranças
CREATE TABLE IF NOT EXISTS public.payment_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('mercadopago','asaas','pagbank','infinitepay')),
  method text NOT NULL CHECK (method IN ('pix','card','link')),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','failed','cancelled')),
  external_id text,
  checkout_url text,
  pix_code text,
  provider_ref jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (length(provider_ref::text) <= 2000),
  expires_at timestamptz,
  paid_at timestamptz,
  paid_amount_cents integer,
  paid_method text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_charges_external ON public.payment_charges(provider, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_charges_appointment ON public.payment_charges(appointment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_charges_pending ON public.payment_charges(last_checked_at NULLS FIRST) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS payment_charges_salon ON public.payment_charges(salon_id, created_at DESC);
ALTER TABLE public.payment_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read charges" ON public.payment_charges;
CREATE POLICY "Owners read charges" ON public.payment_charges FOR SELECT TO authenticated USING (public.whatsapp_can_manage_salon(salon_id));
REVOKE ALL ON public.payment_charges FROM anon, authenticated;
GRANT SELECT ON public.payment_charges TO authenticated;
GRANT ALL ON public.payment_charges TO service_role;

-- Pagamento confirmado PELA API do provedor (nunca pelo webhook sozinho): uma vez só por cobrança.
-- Registra em payments, confirma o agendamento pendente, avisa o dono e o cliente.
CREATE OR REPLACE FUNCTION public.payment_mark_paid(p_charge_id uuid, p_paid_cents integer, p_method text DEFAULT NULL, p_external_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ch payment_charges; a appointments; v_inst uuid; v_value text; v_method text;
BEGIN
  SELECT * INTO ch FROM payment_charges WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF ch.status = 'paid' THEN RETURN true; END IF;
  IF p_paid_cents IS NULL OR p_paid_cents < ch.amount_cents THEN RAISE EXCEPTION 'amount_mismatch'; END IF;
  v_method := CASE WHEN p_method IN ('pix','card') THEN p_method WHEN ch.method = 'link' THEN 'link' ELSE ch.method END;
  UPDATE payment_charges SET status = 'paid', paid_at = now(), paid_amount_cents = p_paid_cents, paid_method = v_method,
    external_id = coalesce(external_id, p_external_id), updated_at = now(), last_checked_at = now() WHERE id = ch.id;
  SELECT * INTO a FROM appointments WHERE id = ch.appointment_id AND salon_id = ch.salon_id;
  IF NOT FOUND THEN RETURN true; END IF;
  INSERT INTO payments(salon_id, client_id, appointment_id, amount, payment_method, payment_status, payment_type, transaction_id, metadata, paid_at)
  VALUES (ch.salon_id, a.client_id, a.id, p_paid_cents / 100.0, CASE v_method WHEN 'card' THEN 'credit_card' WHEN 'link' THEN 'online' ELSE 'pix' END,
    'paid', 'appointment', coalesce(p_external_id, ch.external_id), jsonb_build_object('provider', ch.provider, 'charge_id', ch.id, 'channel', 'whatsapp'), now());
  UPDATE appointments SET status = 'confirmed' WHERE id = a.id AND status = 'pending';
  v_value := replace(to_char(p_paid_cents / 100.0, 'FM999999990.00'), '.', ',');
  INSERT INTO admin_notifications(salon_id, appointment_id, type, title, message, client_name, client_phone, appointment_date, appointment_time, metadata)
  VALUES (ch.salon_id, a.id, 'payment_received', '💰 Pagamento recebido',
    format('%s pagou R$ %s pelo WhatsApp (%s). Horário: %s às %s.', coalesce(nullif(a.client_name, ''), 'Cliente'), v_value, ch.provider, to_char(a.date, 'DD/MM'), to_char(a.start_time, 'HH24:MI')),
    a.client_name, a.client_phone, a.date, a.start_time, jsonb_build_object('charge_id', ch.id, 'provider', ch.provider));
  SELECT id INTO v_inst FROM whatsapp_instances WHERE salon_id = ch.salon_id;
  IF v_inst IS NOT NULL AND a.client_phone ~ '^\+[1-9][0-9]{6,14}$' THEN
    INSERT INTO whatsapp_outbox(salon_id, instance_id, idempotency_key, category, recipient_phone, content_type, text_content)
    VALUES (ch.salon_id, v_inst, 'payment:' || ch.id::text, 'transactional', a.client_phone, 'text',
      format(E'✅ *Pagamento de R$ %s recebido!*\n\nSeu horário de %s às %s está garantido. Obrigado! 💜\n\nDigite *0* para o menu.', v_value, to_char(a.date, 'DD/MM'), to_char(a.start_time, 'HH24:MI')))
    ON CONFLICT (salon_id, idempotency_key) DO NOTHING;
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.payment_mark_paid(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_mark_paid(uuid, integer, text, text) TO service_role;

-- Conferência periódica das cobranças pendentes (rede de segurança se o webhook não chegar).
DO $$ BEGIN
  PERFORM cron.unschedule('payment-charges-check') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'payment-charges-check');
  PERFORM cron.schedule('payment-charges-check', '* * * * *', $c$SELECT public.invoke_edge_function('payment-webhook', '{"worker":true}'::jsonb) WHERE EXISTS (SELECT 1 FROM public.payment_charges WHERE status = 'pending' AND created_at > now() - interval '2 days')$c$);
END $$;

-- ------------------------------------------------------------------------------------------- avaliações
-- Nota de cada profissional (só avaliações públicas) e a lista com nome abreviado do cliente.
CREATE OR REPLACE FUNCTION public.public_professional_ratings(p_salon_id uuid)
RETURNS TABLE(professional_id uuid, average numeric, total integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.professional_id, round(avg(r.rating)::numeric, 1), count(*)::integer
  FROM reviews r JOIN professionals p ON p.id = r.professional_id AND p.salon_id = p_salon_id
  WHERE r.salon_id = p_salon_id AND r.is_public GROUP BY r.professional_id;
$$;
CREATE OR REPLACE FUNCTION public.public_professional_reviews(p_professional_id uuid, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, rating integer, comment text, created_at timestamptz, author text, service text, response text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.rating, nullif(btrim(r.comment), ''), r.created_at,
    coalesce(nullif(btrim(split_part(btrim(c.name), ' ', 1) || ' ' || left(split_part(btrim(c.name), ' ', 2), 1) || CASE WHEN split_part(btrim(c.name), ' ', 2) <> '' THEN '.' ELSE '' END), ''), 'Cliente'),
    sv.name, nullif(btrim(r.response), '')
  FROM reviews r LEFT JOIN clients c ON c.id = r.client_id LEFT JOIN appointments a ON a.id = r.appointment_id LEFT JOIN services sv ON sv.id = a.service_id
  WHERE r.professional_id = p_professional_id AND r.is_public
  ORDER BY (nullif(btrim(r.comment), '') IS NULL), r.created_at DESC
  LIMIT least(greatest(p_limit, 1), 50) OFFSET greatest(p_offset, 0);
$$;
REVOKE ALL ON FUNCTION public.public_professional_ratings(uuid), public.public_professional_reviews(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_professional_ratings(uuid), public.public_professional_reviews(uuid, integer, integer) TO anon, authenticated, service_role;

-- Área do cliente: avaliar um atendimento próprio (o token prova o telefone).
CREATE OR REPLACE FUNCTION public.client_portal_review(p_token text, p_appointment_id uuid, p_rating integer, p_comment text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s client_portal_sessions;
BEGIN
  s := public.client_portal_session(p_token);
  IF s.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'expired'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_portal_appts(s.salon_id, s.phone_key) a WHERE a.id = p_appointment_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  RETURN public.submit_public_review(p_appointment_id, p_rating, p_comment);
END $$;
REVOKE ALL ON FUNCTION public.client_portal_review(text, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_review(text, uuid, integer, text) TO anon, authenticated;

-- WhatsApp ("Meus agendamentos" → Avaliar): só atendimento concluído do próprio remetente; abre 30 min para comentário.
CREATE OR REPLACE FUNCTION public.whatsapp_rate_appointment(p_event_id uuid, p_appointment_id uuid, p_rating integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e whatsapp_webhook_events; a appointments; v_result jsonb; v_review uuid;
BEGIN
  SELECT * INTO e FROM whatsapp_webhook_events WHERE id = p_event_id AND status = 'processing';
  IF NOT FOUND THEN RAISE EXCEPTION 'event_missing'; END IF;
  SELECT * INTO a FROM appointments WHERE id = p_appointment_id AND salon_id = e.salon_id
    AND public.portal_phone_key(client_phone) = public.portal_phone_key(e.sender_phone);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  v_result := public.submit_public_review(a.id, p_rating, NULL);
  SELECT id INTO v_review FROM reviews WHERE appointment_id = a.id;
  INSERT INTO whatsapp_review_requests(appointment_id, salon_id, phone, review_id, comment_until)
  VALUES (a.id, e.salon_id, e.sender_phone, v_review, CASE WHEN (v_result->>'duplicate')::boolean THEN NULL ELSE now() + interval '30 minutes' END)
  ON CONFLICT (appointment_id) DO UPDATE SET review_id = EXCLUDED.review_id, comment_until = EXCLUDED.comment_until;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_rate_appointment(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_rate_appointment(uuid, uuid, integer) TO service_role;

-- Etapas novas do fluxo guiado: nota e comentário.
ALTER TABLE public.whatsapp_chatbot_sessions DROP CONSTRAINT IF EXISTS whatsapp_chatbot_sessions_current_step_check;
ALTER TABLE public.whatsapp_chatbot_sessions ADD CONSTRAINT whatsapp_chatbot_sessions_current_step_check CHECK (current_step = ANY (ARRAY[
  'IDLE','MAIN_MENU','SELECT_SERVICE','SELECT_PROFESSIONAL','SELECT_DATE','SELECT_TIME','CONFIRM_NAME','CONFIRM_BOOKING','MY_APPOINTMENTS',
  'APPOINTMENT_ACTIONS','CONFIRM_CANCEL_APPOINTMENT','RESCHEDULE_SELECT_DATE','RESCHEDULE_SELECT_TIME','HUMAN_HANDOFF','RATE_APPOINTMENT','RATE_COMMENT','PAYMENT']::text[]));

-- Pedido de avaliação quando o dono marca "Concluído": sai em 15 min (antes, 1 h). O fluxo guiado recebe a nota pelo
-- clique (rate.N) ou pelo número digitado logo depois do pedido, e abre o comentário opcional.
-- Nota aberta mais recente deste telefone (fluxo guiado decide se um número digitado é nota).
DROP FUNCTION IF EXISTS public.whatsapp_open_review_request(uuid, text);
CREATE FUNCTION public.whatsapp_open_review_request(p_salon_id uuid, p_phone text)
RETURNS TABLE(appointment_id uuid, sent_at timestamptz, service text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.appointment_id, o.completed_at, sv.name FROM whatsapp_review_requests r
  JOIN whatsapp_outbox o ON o.salon_id = r.salon_id AND o.idempotency_key = 'review:' || r.appointment_id::text
  LEFT JOIN appointments a ON a.id = r.appointment_id LEFT JOIN services sv ON sv.id = a.service_id
  WHERE r.salon_id = p_salon_id AND r.phone = p_phone AND r.review_id IS NULL AND o.status IN ('accepted','delivered','read') AND o.completed_at > now() - interval '2 days'
  ORDER BY r.requested_at DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.whatsapp_open_review_request(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_open_review_request(uuid, text) TO service_role;
CREATE OR REPLACE FUNCTION public.whatsapp_enqueue_review_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE v_instance uuid; v_salon text; v_service text; v_first text; v_url text; v_text text; n integer; BEGIN
 IF NEW.status::text <> 'completed' OR OLD.status::text = 'completed' THEN RETURN NEW; END IF;
 IF NOT coalesce((SELECT review_enabled FROM whatsapp_automation_settings WHERE salon_id = NEW.salon_id), false) THEN RETURN NEW; END IF;
 IF NEW.client_phone IS NULL OR NEW.client_phone !~ '^\+[1-9][0-9]{6,14}$' THEN RETURN NEW; END IF;
 IF EXISTS (SELECT 1 FROM reviews WHERE appointment_id = NEW.id) THEN RETURN NEW; END IF;
 SELECT id INTO v_instance FROM whatsapp_instances WHERE salon_id = NEW.salon_id;
 IF v_instance IS NULL THEN RETURN NEW; END IF;
 INSERT INTO whatsapp_review_requests(appointment_id, salon_id, phone) VALUES (NEW.id, NEW.salon_id, NEW.client_phone) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n = 0 THEN RETURN NEW; END IF;
 SELECT name INTO v_salon FROM salons WHERE id = NEW.salon_id;
 SELECT name INTO v_service FROM services WHERE id = NEW.service_id AND salon_id = NEW.salon_id;
 v_first := coalesce(nullif(split_part(btrim(coalesce(NEW.client_name, '')), ' ', 1), ''), 'tudo bem');
 v_url := coalesce(nullif(current_setting('app.public_url', true), ''), 'https://agendafacil365.com.br') || '/avaliar/' || NEW.id::text;
 v_text := 'Oi, ' || v_first || '! Obrigado por vir ao ' || coalesce(v_salon, 'salão') || '. Como foi seu ' || coalesce(v_service, 'atendimento') || E'?\n\n'
  || E'1. ⭐⭐⭐⭐⭐ Excelente\n2. ⭐⭐⭐⭐ Muito bom\n3. ⭐⭐⭐ Bom\n4. ⭐⭐ Regular\n5. ⭐ Ruim\n\nResponda com o número ou avalie pelo link: ' || v_url;
 INSERT INTO whatsapp_outbox(salon_id, instance_id, idempotency_key, category, recipient_phone, content_type, text_content, payload, scheduled_for)
 VALUES (NEW.salon_id, v_instance, 'review:' || NEW.id::text, 'transactional', NEW.client_phone, 'interactive', v_text,
  jsonb_build_object('op', 'list', 'body', jsonb_build_object('title', 'Avalie seu atendimento', 'description', 'Como foi seu ' || coalesce(v_service, 'atendimento') || '? Sua opinião ajuda o ' || coalesce(v_salon, 'salão') || ' a melhorar. Se preferir, use o link: ' || v_url,
   'buttonText', '⭐ Dar nota', 'footerText', '', 'sections', jsonb_build_array(jsonb_build_object('title', 'Sua nota', 'rows', jsonb_build_array(
    jsonb_build_object('title', '⭐⭐⭐⭐⭐ Excelente', 'description', 'Nota 5', 'rowId', 'rate.5'),
    jsonb_build_object('title', '⭐⭐⭐⭐ Muito bom', 'description', 'Nota 4', 'rowId', 'rate.4'),
    jsonb_build_object('title', '⭐⭐⭐ Bom', 'description', 'Nota 3', 'rowId', 'rate.3'),
    jsonb_build_object('title', '⭐⭐ Regular', 'description', 'Nota 2', 'rowId', 'rate.2'),
    jsonb_build_object('title', '⭐ Ruim', 'description', 'Nota 1', 'rowId', 'rate.1')))))),
  now() + interval '15 minutes')
 ON CONFLICT (salon_id, idempotency_key) DO NOTHING;
 RETURN NEW;
END $$;

-- Histórico da área do cliente com a nota dada (rating) e se ainda pode avaliar (concluído, até 30 dias, sem nota).
CREATE OR REPLACE FUNCTION public.client_portal_overview(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s client_portal_sessions; v_tz text; v_now timestamp; v_name text;
BEGIN
  s := public.client_portal_session(p_token);
  IF s.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'expired'); END IF;
  IF s.last_used_at IS NULL OR s.last_used_at < now() - interval '10 minutes' THEN
    UPDATE client_portal_sessions SET last_used_at = now() WHERE id = s.id;
  END IF;
  SELECT coalesce(timezone, 'America/Sao_Paulo') INTO v_tz FROM salons WHERE id = s.salon_id;
  v_now := now() AT TIME ZONE v_tz;
  SELECT nullif(btrim(client_name), '') INTO v_name FROM public.client_portal_appts(s.salon_id, s.phone_key)
   WHERE nullif(btrim(client_name), '') IS NOT NULL ORDER BY created_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'client', jsonb_build_object('name', v_name,
      'since', (SELECT min(date) FROM public.client_portal_appts(s.salon_id, s.phone_key)),
      'visits', (SELECT count(*) FROM public.client_portal_appts(s.salon_id, s.phone_key) WHERE status = 'completed')),
    'upcoming', coalesce((SELECT jsonb_agg(row_to_json(u) ORDER BY u.date, u.start_time) FROM (
      SELECT a.id, a.date, to_char(a.start_time, 'HH24:MI') AS start_time, to_char(a.end_time, 'HH24:MI') AS end_time, a.status::text AS status,
             sv.name AS service, p.name AS professional, coalesce(a.final_price, a.price) AS price,
             CASE WHEN (a.date + a.start_time) - v_now > interval '24 hours' THEN a.cancellation_token END AS manage_token
      FROM public.client_portal_appts(s.salon_id, s.phone_key) a LEFT JOIN services sv ON sv.id = a.service_id LEFT JOIN professionals p ON p.id = a.professional_id
      WHERE a.status::text IN ('pending', 'confirmed') AND (a.date + coalesce(a.end_time, a.start_time)) >= v_now
      ORDER BY a.date, a.start_time LIMIT 10) u), '[]'::jsonb),
    'history', coalesce((SELECT jsonb_agg(row_to_json(h) ORDER BY h.date DESC, h.start_time DESC) FROM (
      SELECT a.id, a.date, to_char(a.start_time, 'HH24:MI') AS start_time,
             CASE WHEN a.status::text IN ('pending', 'confirmed') THEN 'past' ELSE a.status::text END AS status,
             sv.name AS service, p.name AS professional, coalesce(a.final_price, a.price) AS price,
             r.rating,
             (r.id IS NULL AND a.status::text = 'completed' AND a.professional_id IS NOT NULL AND a.date >= current_date - 30) AS can_review
      FROM public.client_portal_appts(s.salon_id, s.phone_key) a LEFT JOIN services sv ON sv.id = a.service_id LEFT JOIN professionals p ON p.id = a.professional_id
        LEFT JOIN reviews r ON r.appointment_id = a.id
      WHERE NOT (a.status::text IN ('pending', 'confirmed') AND (a.date + coalesce(a.end_time, a.start_time)) >= v_now)
      ORDER BY a.date DESC, a.start_time DESC LIMIT 50) h), '[]'::jsonb),
    'returns', coalesce((SELECT jsonb_agg(row_to_json(r) ORDER BY r.alert_date) FROM (
      SELECT procedure_name, alert_date FROM procedure_return_alerts
      WHERE salon_id = s.salon_id AND public.portal_phone_key(client_phone) = s.phone_key AND status IN ('pending', 'notified')
      ORDER BY alert_date LIMIT 3) r), '[]'::jsonb)
  );
END $$;

COMMIT;

-- Rollback:
-- SELECT cron.unschedule('payment-charges-check');
-- DROP FUNCTION IF EXISTS public.payment_mark_paid(uuid,integer,text,text), public.payment_save_secret(uuid,text,text,text), public.payment_secret(uuid,text),
--   public.public_professional_ratings(uuid), public.public_professional_reviews(uuid,integer,integer), public.client_portal_review(text,uuid,integer,text),
--   public.whatsapp_rate_appointment(uuid,uuid,integer);
-- DROP TABLE IF EXISTS public.payment_charges, public.salon_payment_settings, payment_private.gateway_secrets;
