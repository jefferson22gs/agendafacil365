-- ============================================================================
-- Agenda Fácil 365 — Retornos de procedimentos (cron multicanal) + Contrato SaaS (Autentique).
-- White-label/PWA e WCAG não precisam de esquema novo: usam salons.logo_url/primary_color/pwa_* existentes.
--
-- Pré-requisitos (já em produção): whatsapp_outbox, whatsapp_can_manage_salon, push_enqueue/push_outbox
-- (20261109000200), admin_notifications, invoke_edge_function (Vault), is_super_admin(), pg_cron.
-- Aditiva e idempotente: pode rodar de novo. Nada é enviado durante a aplicação (sem backfill).
-- Edge Functions: process-return-alerts, autentique-contract, autentique-webhook.
-- Segredos (Supabase → Edge Functions → Secrets): RESEND_API_KEY, RESEND_FROM, APP_PUBLIC_URL,
--   AUTENTIQUE_API_KEY, AUTENTIQUE_WEBHOOK_SECRET, AUTENTIQUE_SANDBOX (opcional, "true" em testes).
-- Rollback no fim do arquivo (comentado).
-- ============================================================================
BEGIN;

-- ============================ FRENTE 1: RETORNOS ============================
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS default_return_days integer CHECK (default_return_days BETWEEN 1 AND 3650),
  ADD COLUMN IF NOT EXISTS auto_return_alert boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_whatsapp boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_push boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS return_message_template text CHECK (length(return_message_template) <= 2000);
-- NULL = herda o padrão do serviço; 0 = sem retorno para este atendimento.
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS return_days integer CHECK (return_days BETWEEN 0 AND 3650);

CREATE TABLE IF NOT EXISTS public.procedure_return_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  client_name text, client_phone text, client_email text,
  procedure_name text NOT NULL,
  performed_at date NOT NULL,
  return_days integer NOT NULL CHECK (return_days BETWEEN 1 AND 3650),
  alert_date date NOT NULL,
  notify_whatsapp boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT true,
  notify_push boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'scheduled', 'dismissed')),
  -- Estado real por canal: queued/accepted/failed/retry/uncertain/skipped (+ motivo). "queued" não é "entregue".
  channels_sent jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(channels_sent) = 'object'),
  notified_at timestamptz,
  -- Controle do worker (lease + backoff). E-mail: payload imutável + mesma Idempotency-Key por até 23 h.
  claim_token uuid, lease_until timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  email_payload jsonb, email_first_attempt_at timestamptz, email_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS procedure_return_alerts_due ON public.procedure_return_alerts (alert_date, next_attempt_at) WHERE status IN ('pending', 'notified');
CREATE INDEX IF NOT EXISTS procedure_return_alerts_salon ON public.procedure_return_alerts (salon_id, alert_date);
CREATE INDEX IF NOT EXISTS procedure_return_alerts_match ON public.procedure_return_alerts (salon_id, service_id, client_id) WHERE status IN ('pending', 'notified');
ALTER TABLE public.procedure_return_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procedure_return_alerts FROM anon, authenticated;
GRANT SELECT ON public.procedure_return_alerts TO authenticated;
GRANT ALL ON public.procedure_return_alerts TO service_role;
DROP POLICY IF EXISTS procedure_return_alerts_managers ON public.procedure_return_alerts;
CREATE POLICY procedure_return_alerts_managers ON public.procedure_return_alerts FOR SELECT TO authenticated
  USING (public.whatsapp_can_manage_salon(salon_id));

CREATE OR REPLACE FUNCTION public.procedure_return_digits(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 11) $$;

-- Trigger 1 (cria/atualiza alerta) + Trigger 2 (novo agendamento do mesmo serviço converte alertas anteriores).
-- Nunca bloqueia o agendamento: erro vira WARNING.
CREATE OR REPLACE FUNCTION public.procedure_return_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sv public.services; c public.clients; v_days integer; v_digits text := public.procedure_return_digits(NEW.client_phone);
  v_phone text; v_status text;
BEGIN
  SELECT * INTO sv FROM services WHERE id = NEW.service_id AND salon_id = NEW.salon_id;
  IF sv.id IS NULL THEN RETURN NEW; END IF;
  IF NEW.client_id IS NOT NULL THEN
    SELECT * INTO c FROM clients WHERE id = NEW.client_id AND salon_id = NEW.salon_id;
  ELSIF length(v_digits) >= 10 THEN
    -- Só associa por telefone quando há exatamente um cliente com esse número no salão.
    SELECT * INTO c FROM clients WHERE salon_id = NEW.salon_id
      AND public.procedure_return_digits(coalesce(phone_normalized, phone)) = v_digits
      AND (SELECT count(*) FROM clients x WHERE x.salon_id = NEW.salon_id
             AND public.procedure_return_digits(coalesce(x.phone_normalized, x.phone)) = v_digits) = 1;
  END IF;

  -- Trigger 2: cliente reagendou o mesmo procedimento → alertas anteriores viram "scheduled" (convertidos).
  IF NEW.status IN ('pending', 'confirmed', 'completed') THEN
    UPDATE procedure_return_alerts r SET status = 'scheduled', updated_at = now()
     WHERE r.salon_id = NEW.salon_id AND r.service_id = NEW.service_id AND r.appointment_id <> NEW.id
       AND r.status IN ('pending', 'notified') AND r.performed_at <= NEW.date
       AND ((c.id IS NOT NULL AND r.client_id = c.id) OR (length(v_digits) >= 10 AND public.procedure_return_digits(r.client_phone) = v_digits));
  END IF;

  v_days := coalesce(NEW.return_days, sv.default_return_days);
  IF NEW.status NOT IN ('confirmed', 'completed') OR NOT sv.auto_return_alert OR coalesce(v_days, 0) <= 0 THEN
    UPDATE procedure_return_alerts SET status = 'dismissed', updated_at = now()
     WHERE appointment_id = NEW.id AND status = 'pending';
    RETURN NEW;
  END IF;

  v_phone := CASE WHEN c.phone_normalized ~ '^\+[1-9][0-9]{6,14}$' THEN c.phone_normalized
                  WHEN NEW.client_phone ~ '^\+[1-9][0-9]{6,14}$' THEN NEW.client_phone
                  WHEN length(v_digits) IN (10, 11) THEN '+55' || v_digits END;
  -- Já existe agendamento posterior do mesmo procedimento: nasce convertido.
  v_status := CASE WHEN EXISTS (SELECT 1 FROM appointments a WHERE a.salon_id = NEW.salon_id AND a.service_id = NEW.service_id
      AND a.id <> NEW.id AND a.status IN ('pending', 'confirmed', 'completed') AND a.date > NEW.date
      AND ((c.id IS NOT NULL AND a.client_id = c.id) OR (length(v_digits) >= 10 AND public.procedure_return_digits(a.client_phone) = v_digits)))
    THEN 'scheduled' ELSE 'pending' END;

  INSERT INTO procedure_return_alerts (salon_id, client_id, appointment_id, service_id, client_name, client_phone, client_email,
    procedure_name, performed_at, return_days, alert_date, notify_whatsapp, notify_email, notify_push, status)
  VALUES (NEW.salon_id, c.id, NEW.id, sv.id, coalesce(c.name, NEW.client_name), v_phone, nullif(btrim(c.email), ''),
    sv.name, NEW.date, v_days, NEW.date + v_days, sv.notify_whatsapp, sv.notify_email, sv.notify_push, v_status)
  ON CONFLICT (appointment_id) DO UPDATE SET
    client_id = EXCLUDED.client_id, client_name = EXCLUDED.client_name, client_phone = EXCLUDED.client_phone,
    client_email = EXCLUDED.client_email, service_id = EXCLUDED.service_id, procedure_name = EXCLUDED.procedure_name,
    performed_at = EXCLUDED.performed_at, return_days = EXCLUDED.return_days, alert_date = EXCLUDED.alert_date,
    notify_whatsapp = EXCLUDED.notify_whatsapp, notify_email = EXCLUDED.notify_email, notify_push = EXCLUDED.notify_push,
    status = CASE WHEN procedure_return_alerts.status = 'dismissed' THEN EXCLUDED.status ELSE procedure_return_alerts.status END,
    next_attempt_at = now(), updated_at = now()
  -- Alerta já disparado não é reescrito (histórico fiel do que saiu).
  WHERE procedure_return_alerts.channels_sent = '{}'::jsonb AND procedure_return_alerts.status IN ('pending', 'dismissed');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'procedure_return_sync: %', SQLERRM;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS procedure_return_sync ON public.appointments;
CREATE TRIGGER procedure_return_sync AFTER INSERT OR UPDATE OF status, date, service_id, client_id, client_phone, return_days
  ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.procedure_return_sync();

-- Alerta convertido/descartado: cancela o que ainda não saiu nas filas.
CREATE OR REPLACE FUNCTION public.procedure_return_cancel_queues()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('scheduled', 'dismissed') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE whatsapp_outbox SET status = 'cancelled', error_code = 'return_suppressed', claim_token = NULL, lease_until = NULL
     WHERE salon_id = NEW.salon_id AND idempotency_key = 'return:' || NEW.id AND status = 'pending';
    UPDATE push_outbox SET status = 'expired', locked_at = NULL
     WHERE salon_id = NEW.salon_id AND dedupe_key = 'return:' || NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS procedure_return_cancel_queues ON public.procedure_return_alerts;
CREATE TRIGGER procedure_return_cancel_queues AFTER UPDATE OF status ON public.procedure_return_alerts
  FOR EACH ROW EXECUTE FUNCTION public.procedure_return_cancel_queues();

-- ---------- Worker (service_role) ----------
-- Cron: vencidos (alert_date <= hoje no fuso do salão) a partir das 09h locais. Manual (p_id): ignora data/horário.
CREATE OR REPLACE FUNCTION public.procedure_return_claim(p_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r procedure_return_alerts; s salons; sv services; v_opt boolean;
BEGIN
  SELECT a.* INTO r FROM procedure_return_alerts a JOIN salons sl ON sl.id = a.salon_id
   WHERE (a.status = 'pending' OR (a.status = 'notified' AND a.channels_sent -> 'email' ->> 'status' = 'retry'))
     AND (a.lease_until IS NULL OR a.lease_until < now())
     AND CASE WHEN p_id IS NOT NULL THEN a.id = p_id
         ELSE a.next_attempt_at <= now()
          AND a.alert_date <= (now() AT TIME ZONE coalesce(sl.timezone, 'America/Sao_Paulo'))::date
          AND extract(hour FROM now() AT TIME ZONE coalesce(sl.timezone, 'America/Sao_Paulo')) >= 9 END
   ORDER BY a.alert_date, a.next_attempt_at LIMIT 1 FOR UPDATE OF a SKIP LOCKED;
  IF r.id IS NULL THEN RETURN NULL; END IF;
  UPDATE procedure_return_alerts SET claim_token = gen_random_uuid(), lease_until = now() + interval '2 minutes'
   WHERE id = r.id RETURNING * INTO r;
  SELECT * INTO s FROM salons WHERE id = r.salon_id;
  SELECT * INTO sv FROM services WHERE id = r.service_id;
  SELECT coalesce(bool_or(marketing_opt_out), false) INTO v_opt FROM clients WHERE id = r.client_id;
  RETURN jsonb_build_object('id', r.id, 'claim', r.claim_token, 'client_name', r.client_name, 'client_email', r.client_email,
    'procedure_name', r.procedure_name, 'performed_at', r.performed_at, 'return_days', r.return_days, 'alert_date', r.alert_date,
    'notify_email', r.notify_email, 'opt_out', v_opt, 'email_payload', r.email_payload, 'channels', r.channels_sent,
    'template', sv.return_message_template,
    'salon', jsonb_build_object('name', s.name, 'slug', s.slug, 'logo_url', s.logo_url, 'primary_color', s.primary_color,
      'pwa_icon_url', s.pwa_icon_url, 'phone', coalesce(s.whatsapp, s.phone), 'email', s.email));
END $$;

-- Enfileira WhatsApp (fila do salão, categoria marketing → opt-out revalidado no envio), Push no aparelho que agendou,
-- aviso interno ao dono e congela o payload do e-mail. Cada canal uma única vez (chave return:<id>).
CREATE OR REPLACE FUNCTION public.procedure_return_prepare(p_id uuid, p_claim uuid, p_message text, p_url text, p_email jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r procedure_return_alerts; v_opt boolean; v_instance uuid; st jsonb; v_push boolean; v_email jsonb;
BEGIN
  SELECT * INTO r FROM procedure_return_alerts WHERE id = p_id FOR UPDATE;
  IF r.claim_token IS DISTINCT FROM p_claim OR r.lease_until <= now() OR r.status NOT IN ('pending', 'notified') THEN RETURN NULL; END IF;
  SELECT coalesce(bool_or(marketing_opt_out), false) INTO v_opt FROM clients WHERE id = r.client_id;
  v_opt := v_opt OR EXISTS (SELECT 1 FROM whatsapp_marketing_suppression b WHERE b.salon_id = r.salon_id AND b.phone = r.client_phone);
  st := r.channels_sent;

  IF NOT st ? 'in_app' THEN
    INSERT INTO admin_notifications (salon_id, appointment_id, type, title, message, client_name, client_phone, metadata)
    VALUES (r.salon_id, r.appointment_id, 'procedure_return', 'Retorno de procedimento',
      left(coalesce(r.client_name, 'Cliente') || ' atingiu o prazo de retorno de ' || r.procedure_name || ' (' || r.return_days || ' dias).', 500),
      r.client_name, r.client_phone, jsonb_build_object('return_id', r.id, 'url', '/admin/returns'));
    st := st || jsonb_build_object('in_app', jsonb_build_object('status', 'created', 'at', now()));
  END IF;

  IF NOT st ? 'whatsapp' THEN
    IF NOT r.notify_whatsapp THEN st := st || '{"whatsapp":{"status":"skipped","reason":"disabled"}}';
    ELSIF v_opt THEN st := st || '{"whatsapp":{"status":"skipped","reason":"opt_out"}}';
    ELSIF r.client_phone !~ '^\+[1-9][0-9]{6,14}$' OR r.client_phone IS NULL THEN st := st || '{"whatsapp":{"status":"skipped","reason":"no_phone"}}';
    ELSE
      SELECT id INTO v_instance FROM whatsapp_instances WHERE salon_id = r.salon_id LIMIT 1;
      IF v_instance IS NULL THEN st := st || '{"whatsapp":{"status":"skipped","reason":"no_instance"}}';
      ELSE
        INSERT INTO whatsapp_outbox (salon_id, instance_id, idempotency_key, category, recipient_phone, text_content)
        VALUES (r.salon_id, v_instance, 'return:' || r.id, 'marketing', r.client_phone, left(p_message, 4000))
        ON CONFLICT (salon_id, idempotency_key) DO NOTHING;
        st := st || jsonb_build_object('whatsapp', jsonb_build_object('status', 'queued', 'at', now()));
      END IF;
    END IF;
  END IF;

  IF NOT st ? 'push' THEN
    IF NOT r.notify_push THEN st := st || '{"push":{"status":"skipped","reason":"disabled"}}';
    ELSIF v_opt THEN st := st || '{"push":{"status":"skipped","reason":"opt_out"}}';
    ELSE
      v_push := public.push_enqueue(r.salon_id, 'procedure_return', 'appointment', 'Hora do seu retorno',
        left(p_message, 300), p_url, 'return:' || r.id, r.appointment_id, NULL, now() + interval '3 days');
      st := st || CASE WHEN v_push THEN jsonb_build_object('push', jsonb_build_object('status', 'queued', 'at', now()))
                       ELSE '{"push":{"status":"skipped","reason":"no_device"}}'::jsonb END;
    END IF;
  END IF;

  IF NOT st ? 'email' OR st -> 'email' ->> 'status' = 'retry' THEN
    IF NOT r.notify_email THEN st := st || '{"email":{"status":"skipped","reason":"disabled"}}';
    ELSIF v_opt THEN st := st || '{"email":{"status":"skipped","reason":"opt_out"}}';
    ELSIF r.client_email IS NULL THEN st := st || '{"email":{"status":"skipped","reason":"no_email"}}';
    ELSIF r.email_payload IS NULL AND p_email IS NULL THEN st := st || '{"email":{"status":"skipped","reason":"not_configured"}}';
    ELSIF r.email_first_attempt_at IS NOT NULL AND (r.email_first_attempt_at < now() - interval '23 hours' OR r.email_attempts >= 8) THEN
      -- Fora da janela de idempotência do Resend: não reenvia (evita duplicar). Dono decide pelo painel.
      st := st || '{"email":{"status":"uncertain","reason":"retry_window_closed"}}';
    ELSE
      UPDATE procedure_return_alerts SET email_payload = coalesce(email_payload, p_email),
        email_first_attempt_at = coalesce(email_first_attempt_at, now()), email_attempts = email_attempts + 1
       WHERE id = r.id RETURNING email_payload INTO v_email;
      st := st || '{"email":{"status":"sending"}}';
    END IF;
  END IF;

  UPDATE procedure_return_alerts SET channels_sent = st, updated_at = now() WHERE id = r.id;
  RETURN jsonb_build_object('email', v_email);
END $$;

CREATE OR REPLACE FUNCTION public.procedure_return_finish(p_id uuid, p_claim uuid, p_email_status text DEFAULT NULL, p_email_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r procedure_return_alerts; st jsonb; v_any boolean;
BEGIN
  IF p_email_status IS NOT NULL AND p_email_status NOT IN ('accepted', 'retry', 'failed') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  SELECT * INTO r FROM procedure_return_alerts WHERE id = p_id FOR UPDATE;
  IF r.claim_token IS DISTINCT FROM p_claim THEN RETURN false; END IF;
  st := r.channels_sent;
  IF p_email_status IS NOT NULL THEN
    st := st || jsonb_build_object('email', jsonb_build_object('status', p_email_status, 'id', p_email_id, 'at', now()));
  ELSIF st -> 'email' ->> 'status' = 'sending' THEN
    st := st || '{"email":{"status":"retry"}}';
  END IF;
  v_any := EXISTS (SELECT 1 FROM jsonb_each(st) e WHERE e.key <> 'in_app' AND e.value ->> 'status' IN ('queued', 'accepted'));
  UPDATE procedure_return_alerts SET channels_sent = st, claim_token = NULL, lease_until = NULL, updated_at = now(),
    status = CASE WHEN status = 'pending' AND v_any THEN 'notified' ELSE status END,
    notified_at = CASE WHEN notified_at IS NULL AND v_any THEN now() ELSE notified_at END,
    -- Sem canal disponível: reavalia em 7 dias (aviso interno já foi criado). E-mail com falha temporária: 1 h.
    next_attempt_at = now() + CASE WHEN st -> 'email' ->> 'status' = 'retry' THEN interval '1 hour'
                                   WHEN NOT v_any THEN interval '7 days' ELSE interval '1 day' END
   WHERE id = p_id;
  RETURN true;
END $$;

-- Resumo do dia para o dono (push no aparelho do dono/admin), uma vez por salão por dia local.
CREATE OR REPLACE FUNCTION public.procedure_return_owner_digest()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE x record; n integer := 0;
BEGIN
  FOR x IN SELECT a.salon_id, count(*) total, (now() AT TIME ZONE coalesce(s.timezone, 'America/Sao_Paulo'))::date d
      FROM procedure_return_alerts a JOIN salons s ON s.id = a.salon_id
     WHERE a.notified_at >= now() - interval '1 day' AND a.channels_sent ? 'in_app'
       AND (a.notified_at AT TIME ZONE coalesce(s.timezone, 'America/Sao_Paulo'))::date = (now() AT TIME ZONE coalesce(s.timezone, 'America/Sao_Paulo'))::date
     GROUP BY a.salon_id, s.timezone LOOP
    IF public.push_enqueue(x.salon_id, 'procedure_return_digest', 'owner', 'Retornos de hoje',
         x.total || ' cliente(s) atingiram o prazo de retorno hoje.', '/admin/returns',
         'return_digest:' || x.salon_id || ':' || x.d) THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;

-- ---------- Painel do salão ----------
CREATE OR REPLACE FUNCTION public.procedure_returns_list(p_salon uuid, p_from date DEFAULT NULL, p_to date DEFAULT NULL,
  p_status text DEFAULT NULL, p_client uuid DEFAULT NULL)
RETURNS TABLE (id uuid, client_id uuid, appointment_id uuid, service_id uuid, client_name text, client_phone text, client_email text,
  procedure_name text, performed_at date, return_days integer, alert_date date, status text, channels_sent jsonb,
  whatsapp_status text, push_status text, notified_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.whatsapp_can_manage_salon(p_salon) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  SELECT a.id, a.client_id, a.appointment_id, a.service_id, a.client_name, a.client_phone, a.client_email, a.procedure_name,
         a.performed_at, a.return_days, a.alert_date, a.status, a.channels_sent,
         -- Estado vivo da fila (accepted/delivered/read/failed), não o que foi gravado no disparo.
         (SELECT o.status FROM whatsapp_outbox o WHERE o.salon_id = a.salon_id AND o.idempotency_key = 'return:' || a.id),
         (SELECT p.status FROM push_outbox p WHERE p.salon_id = a.salon_id AND p.dedupe_key = 'return:' || a.id),
         a.notified_at
    FROM procedure_return_alerts a
   WHERE a.salon_id = p_salon AND (p_from IS NULL OR a.alert_date >= p_from) AND (p_to IS NULL OR a.alert_date <= p_to)
     AND (p_status IS NULL OR a.status = p_status) AND (p_client IS NULL OR a.client_id = p_client)
   ORDER BY a.alert_date, a.client_name LIMIT 500;
END $$;

CREATE OR REPLACE FUNCTION public.procedure_returns_kpis(p_salon uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE d date;
BEGIN
  IF NOT public.whatsapp_can_manage_salon(p_salon) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT (now() AT TIME ZONE coalesce(timezone, 'America/Sao_Paulo'))::date INTO d FROM salons WHERE id = p_salon;
  RETURN (SELECT jsonb_build_object(
    'today', count(*) FILTER (WHERE status = 'pending' AND alert_date = d),
    'next7', count(*) FILTER (WHERE status = 'pending' AND alert_date > d AND alert_date <= d + 7),
    'overdue', count(*) FILTER (WHERE status IN ('pending', 'notified') AND alert_date < d),
    'notified', count(*) FILTER (WHERE status = 'notified'),
    'converted', count(*) FILTER (WHERE status = 'scheduled'))
    FROM procedure_return_alerts WHERE salon_id = p_salon);
END $$;

-- Ajuste manual (data, descartar/reativar). Alerta já disparado só pode ser descartado.
CREATE OR REPLACE FUNCTION public.procedure_return_update(p_id uuid, p_alert_date date DEFAULT NULL, p_status text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r procedure_return_alerts;
BEGIN
  SELECT * INTO r FROM procedure_return_alerts WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL OR auth.uid() IS NULL OR NOT public.whatsapp_can_manage_salon(r.salon_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('pending', 'dismissed') THEN RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023'; END IF;
  IF p_alert_date IS NOT NULL THEN
    IF r.channels_sent <> '{}'::jsonb THEN RAISE EXCEPTION 'already_dispatched' USING ERRCODE = '22023'; END IF;
    IF p_alert_date < r.performed_at OR p_alert_date > r.performed_at + 3650 THEN RAISE EXCEPTION 'invalid_date' USING ERRCODE = '22023'; END IF;
  END IF;
  IF p_status = 'pending' AND r.channels_sent <> '{}'::jsonb THEN RAISE EXCEPTION 'already_dispatched' USING ERRCODE = '22023'; END IF;
  UPDATE procedure_return_alerts SET alert_date = coalesce(p_alert_date, alert_date),
    return_days = CASE WHEN p_alert_date IS NULL THEN return_days ELSE p_alert_date - performed_at END,
    status = coalesce(p_status, status), next_attempt_at = now(), updated_at = now()
   WHERE id = p_id AND (p_alert_date IS NULL OR p_alert_date > performed_at);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace = 'public'::regnamespace
     AND proname IN ('procedure_return_claim', 'procedure_return_prepare', 'procedure_return_finish', 'procedure_return_owner_digest',
                     'procedure_returns_list', 'procedure_returns_kpis', 'procedure_return_update', 'procedure_return_sync',
                     'procedure_return_cancel_queues') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.procedure_returns_list(uuid, date, date, text, uuid), public.procedure_returns_kpis(uuid),
  public.procedure_return_update(uuid, date, text) TO authenticated;

-- Roda de hora em hora; cada salão só é processado a partir das 09h no próprio fuso (= "todo dia às 09h" local).
DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-return-alerts';
  PERFORM cron.schedule('process-return-alerts', '7 * * * *', $c$SELECT public.invoke_edge_function('process-return-alerts')$c$);
END $$;

-- ===================== FRENTE 4: CONTRATO SaaS (AUTENTIQUE) =====================
-- Dados da CONTRATADA (dono do sistema): uma linha, editada só pelo super admin. Lida pelo servidor.
CREATE TABLE IF NOT EXISTS public.platform_contract_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  company_name text, cnpj text, address text, representative_name text, representative_cpf text, email text,
  platform_url text NOT NULL DEFAULT 'https://agendafacil365.com.br',
  city text NOT NULL DEFAULT 'São Paulo', forum text NOT NULL DEFAULT 'São Paulo/SP',
  updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid
);
INSERT INTO public.platform_contract_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
-- Qualificação própria da CONTRATADA (ex.: MEI) e e-mail que recebe o convite de assinatura.
ALTER TABLE public.platform_contract_settings ADD COLUMN IF NOT EXISTS preamble text CHECK (length(preamble) <= 2000);
ALTER TABLE public.platform_contract_settings ADD COLUMN IF NOT EXISTS signer_email text;
ALTER TABLE public.platform_contract_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_contract_settings FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.platform_contract_settings TO authenticated;
GRANT ALL ON public.platform_contract_settings TO service_role;
DROP POLICY IF EXISTS platform_contract_settings_super ON public.platform_contract_settings;
CREATE POLICY platform_contract_settings_super ON public.platform_contract_settings FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE IF NOT EXISTS public.saas_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  version text NOT NULL DEFAULT '1.0',
  -- generating → sent → partially_signed → signed | rejected | cancelled | error (nada criado) | uncertain (resultado desconhecido)
  status text NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating', 'sent', 'partially_signed', 'signed', 'rejected', 'cancelled', 'error', 'uncertain')),
  plan text NOT NULL CHECK (plan IN ('monthly', 'annual')),
  contract_data jsonb NOT NULL CHECK (jsonb_typeof(contract_data) = 'object'),
  content_text text NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  pdf_sha256 text CHECK (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  autentique_document_id text UNIQUE,
  sandbox boolean NOT NULL DEFAULT false,
  signed_file_url text,
  contratada_signed_at timestamptz, contratante_signed_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), signed_at timestamptz
);
-- Um contrato em andamento por salão (impede envio duplicado por clique duplo/abas).
CREATE UNIQUE INDEX IF NOT EXISTS saas_contracts_one_in_flight ON public.saas_contracts (salon_id)
  WHERE status IN ('generating', 'sent', 'partially_signed', 'uncertain');
CREATE INDEX IF NOT EXISTS saas_contracts_salon ON public.saas_contracts (salon_id, created_at DESC);
ALTER TABLE public.saas_contracts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saas_contracts FROM anon, authenticated;
GRANT SELECT ON public.saas_contracts TO authenticated;
GRANT ALL ON public.saas_contracts TO service_role;
DROP POLICY IF EXISTS saas_contracts_read ON public.saas_contracts;
CREATE POLICY saas_contracts_read ON public.saas_contracts FOR SELECT TO authenticated
  USING (public.whatsapp_can_manage_salon(salon_id) OR public.is_super_admin());

CREATE TABLE IF NOT EXISTS public.saas_contract_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.saas_contracts(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('contratada', 'contratante')),
  name text NOT NULL, email text NOT NULL,
  public_id text UNIQUE, short_link text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'signed', 'rejected')),
  viewed_at timestamptz, signed_at timestamptz, rejected_at timestamptz, signer_ip text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, role)
);
ALTER TABLE public.saas_contract_signers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saas_contract_signers FROM anon, authenticated;
GRANT SELECT ON public.saas_contract_signers TO authenticated;
GRANT ALL ON public.saas_contract_signers TO service_role;
DROP POLICY IF EXISTS saas_contract_signers_read ON public.saas_contract_signers;
-- O salão vê só a própria linha (link de assinatura da CONTRATADA fica restrito ao super admin).
CREATE POLICY saas_contract_signers_read ON public.saas_contract_signers FOR SELECT TO authenticated
  USING (public.is_super_admin() OR (role = 'contratante' AND EXISTS (SELECT 1 FROM public.saas_contracts c
    WHERE c.id = contract_id AND public.whatsapp_can_manage_salon(c.salon_id))));

CREATE TABLE IF NOT EXISTS public.saas_contract_events (
  event_id text PRIMARY KEY,
  contract_id uuid REFERENCES public.saas_contracts(id) ON DELETE SET NULL,
  type text NOT NULL, payload jsonb NOT NULL, received_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saas_contract_events ENABLE ROW LEVEL SECURITY; -- sem policy: só service_role
REVOKE ALL ON public.saas_contract_events FROM anon, authenticated;
GRANT ALL ON public.saas_contract_events TO service_role;

-- Aplica um evento do webhook (idempotente pelo id do evento). Retorna false se já processado/desconhecido.
CREATE OR REPLACE FUNCTION public.saas_contract_apply_event(p_event_id text, p_type text, p_object jsonb, p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c saas_contracts; s saas_contract_signers; v_at timestamptz; v_ip text;
BEGIN
  IF p_event_id IS NULL OR length(p_event_id) > 200 THEN RETURN false; END IF;
  INSERT INTO saas_contract_events (event_id, type, payload) VALUES (p_event_id, p_type, p_payload) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;

  IF p_type LIKE 'signature.%' THEN
    SELECT * INTO s FROM saas_contract_signers WHERE public_id = p_object ->> 'public_id' FOR UPDATE;
    IF s.id IS NULL THEN RETURN false; END IF;
    SELECT * INTO c FROM saas_contracts WHERE id = s.contract_id FOR UPDATE;
    v_ip := left(coalesce(p_object ->> 'ip', p_object ->> 'ip_address', p_object -> 'signed_info' ->> 'ip'), 64);
    IF p_type = 'signature.viewed' AND s.status = 'pending' THEN
      UPDATE saas_contract_signers SET status = 'viewed', viewed_at = coalesce((p_object ->> 'viewed')::timestamptz, now()), updated_at = now() WHERE id = s.id;
    ELSIF p_type = 'signature.accepted' THEN
      v_at := coalesce((p_object ->> 'signed')::timestamptz, now());
      UPDATE saas_contract_signers SET status = 'signed', signed_at = v_at, signer_ip = coalesce(v_ip, signer_ip), updated_at = now() WHERE id = s.id;
      IF s.role = 'contratada' THEN UPDATE saas_contracts SET contratada_signed_at = v_at WHERE id = c.id;
      ELSE UPDATE saas_contracts SET contratante_signed_at = v_at WHERE id = c.id; END IF;
    ELSIF p_type = 'signature.rejected' THEN
      UPDATE saas_contract_signers SET status = 'rejected', rejected_at = coalesce((p_object ->> 'rejected')::timestamptz, now()), updated_at = now() WHERE id = s.id;
      UPDATE saas_contracts SET status = 'rejected', updated_at = now() WHERE id = c.id AND status NOT IN ('signed', 'cancelled');
    END IF;
  ELSIF p_type LIKE 'document.%' THEN
    SELECT * INTO c FROM saas_contracts WHERE autentique_document_id = p_object ->> 'id' FOR UPDATE;
    IF c.id IS NULL THEN RETURN false; END IF;
    IF p_type = 'document.finished' THEN
      UPDATE saas_contracts SET status = 'signed', signed_at = coalesce(signed_at, now()),
        signed_file_url = coalesce(p_object -> 'files' ->> 'signed', signed_file_url), updated_at = now() WHERE id = c.id;
    ELSIF p_type = 'document.deleted' THEN
      UPDATE saas_contracts SET status = 'cancelled', updated_at = now() WHERE id = c.id AND status <> 'signed';
    END IF;
  ELSE
    RETURN false;
  END IF;
  UPDATE saas_contract_events SET contract_id = c.id WHERE event_id = p_event_id;
  -- Estado agregado pelas assinaturas (cobre document.finished atrasado ou fora de ordem).
  UPDATE saas_contracts SET updated_at = now(),
    status = CASE WHEN contratada_signed_at IS NOT NULL AND contratante_signed_at IS NOT NULL THEN 'signed'
                  WHEN status IN ('sent', 'uncertain') AND (contratada_signed_at IS NOT NULL OR contratante_signed_at IS NOT NULL) THEN 'partially_signed'
                  ELSE status END,
    signed_at = CASE WHEN contratada_signed_at IS NOT NULL AND contratante_signed_at IS NOT NULL
                     THEN coalesce(signed_at, greatest(contratada_signed_at, contratante_signed_at)) ELSE signed_at END
   WHERE id = c.id AND status NOT IN ('rejected', 'cancelled');
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.saas_contract_apply_event(text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.saas_contract_apply_event(text, text, jsonb, jsonb) TO service_role;

-- Rede de segurança do webhook: a cada 10 min consulta na Autentique os contratos ainda em andamento.
DO $$ BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'autentique-contract-sync';
  PERFORM cron.schedule('autentique-contract-sync', '*/10 * * * *',
    $c$SELECT public.invoke_edge_function('autentique-contract', '{"worker":"sync"}'::jsonb)
       WHERE EXISTS (SELECT 1 FROM public.saas_contracts WHERE status IN ('sent', 'partially_signed', 'uncertain'))$c$);
END $$;

-- Tempo real no painel (status do contrato muda sozinho quando o webhook chega).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'saas_contracts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saas_contracts;
  END IF;
END $$;

COMMIT;

-- ============================ ROLLBACK (manual) ============================
-- SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('process-return-alerts', 'autentique-contract-sync');
-- DROP TRIGGER IF EXISTS procedure_return_sync ON public.appointments;
-- DROP TABLE IF EXISTS public.procedure_return_alerts, public.saas_contract_events, public.saas_contract_signers,
--   public.saas_contracts, public.platform_contract_settings;
-- DROP FUNCTION IF EXISTS public.procedure_return_sync(), public.procedure_return_cancel_queues(), public.procedure_return_digits(text),
--   public.procedure_return_claim(uuid), public.procedure_return_prepare(uuid, uuid, text, text, jsonb),
--   public.procedure_return_finish(uuid, uuid, text, text), public.procedure_return_owner_digest(),
--   public.procedure_returns_list(uuid, date, date, text, uuid), public.procedure_returns_kpis(uuid),
--   public.procedure_return_update(uuid, date, text), public.saas_contract_apply_event(text, text, jsonb, jsonb);
-- ALTER TABLE public.appointments DROP COLUMN IF EXISTS return_days;
-- ALTER TABLE public.services DROP COLUMN IF EXISTS default_return_days, DROP COLUMN IF EXISTS auto_return_alert,
--   DROP COLUMN IF EXISTS notify_whatsapp, DROP COLUMN IF EXISTS notify_email, DROP COLUMN IF EXISTS notify_push,
--   DROP COLUMN IF EXISTS return_message_template;
