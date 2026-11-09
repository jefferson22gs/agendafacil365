-- ============================================================================
-- Agenda Fácil 365 — Push completo com Web Push padrão (RFC 8030/8291/8292, VAPID), sem Firebase.
--
-- 1) push_subscriptions ganha web_endpoint (endpoint real do serviço de push), motivo de desativação e opt-out de
--    marketing. p256dh/auth/web_endpoint/fcm_token NUNCA são legíveis por anon/authenticated (privilégio por coluna).
--    Tokens FCM antigos não servem para Web Push: ficam inativos com motivo 'fcm_legacy' (nada é apagado) e o app
--    se reinscreve sozinho na próxima abertura quando a permissão já estiver concedida (RPC push_legacy_salons).
-- 2) Fila push_outbox ganha público (owner/test/appointment/subscribers), agendamento (next_attempt_at),
--    expiração, contadores e backoff. Eventos por trigger (idempotentes por dedupe_key), com liga/desliga por salão
--    (push_preferences). Kick imediato coalescido via pg_net (15 s); cron de 1 min continua como rede de segurança.
-- 3) Remove triggers duplicados de admin_notifications (cada evento gerava 2 avisos no sino).
-- Aditiva e idempotente. Rollback comentado no fim.
-- ============================================================================

BEGIN;

-- ---------- Inscrições ----------
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS web_endpoint text;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS deactivated_reason text;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS marketing_opt_out boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_salon_web_endpoint_key
  ON public.push_subscriptions (salon_id, web_endpoint) WHERE web_endpoint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_web_endpoint ON public.push_subscriptions (web_endpoint) WHERE web_endpoint IS NOT NULL;

-- Tokens FCM (sem chaves Web Push) não podem receber Web Push: inativos com motivo. Nenhuma linha é apagada.
UPDATE public.push_subscriptions SET is_active = false, deactivated_reason = 'fcm_legacy', updated_at = now()
 WHERE is_active AND web_endpoint IS NULL;

-- Painel conta aparelhos sem receber endpoint/chaves (mantém a lista de 20261106001000 + colunas novas não sensíveis).
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
GRANT SELECT (id, salon_id, client_id, user_id, is_active, device_info, created_at, updated_at, deactivated_reason, marketing_opt_out)
  ON public.push_subscriptions TO authenticated;

-- Vínculo inscrição ↔ agendamento (lembrete/confirmação/avaliação para o aparelho de quem agendou). Só servidor.
CREATE TABLE IF NOT EXISTS public.push_appointment_links (
  subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subscription_id, appointment_id)
);
CREATE INDEX IF NOT EXISTS idx_push_appointment_links_appointment ON public.push_appointment_links (appointment_id);
ALTER TABLE public.push_appointment_links ENABLE ROW LEVEL SECURITY; -- sem policies: só service_role/definer
REVOKE ALL ON public.push_appointment_links FROM anon, authenticated;

-- ---------- Preferências por salão (liga/desliga por tipo) ----------
CREATE TABLE IF NOT EXISTS public.push_preferences (
  salon_id uuid PRIMARY KEY REFERENCES public.salons(id) ON DELETE CASCADE,
  new_appointment boolean NOT NULL DEFAULT true,
  appointment_cancelled boolean NOT NULL DEFAULT true,
  appointment_rescheduled boolean NOT NULL DEFAULT true,
  whatsapp_human boolean NOT NULL DEFAULT true,
  payment_proof boolean NOT NULL DEFAULT true,
  new_review boolean NOT NULL DEFAULT true,
  client_reminder boolean NOT NULL DEFAULT true,
  client_status boolean NOT NULL DEFAULT true,
  client_review_request boolean NOT NULL DEFAULT true,
  reminder_minutes integer NOT NULL DEFAULT 120 CHECK (reminder_minutes BETWEEN 30 AND 1440),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.push_preferences ENABLE ROW LEVEL SECURITY; -- leitura/escrita via RPC
REVOKE ALL ON public.push_preferences FROM anon, authenticated;

-- ---------- Fila ----------
ALTER TABLE public.push_outbox ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'owner';
ALTER TABLE public.push_outbox ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE;
ALTER TABLE public.push_outbox ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.push_outbox ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.push_outbox ADD COLUMN IF NOT EXISTS sent_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.push_outbox ADD COLUMN IF NOT EXISTS failed_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.push_outbox ADD COLUMN IF NOT EXISTS created_by uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_outbox_audience_check') THEN
    ALTER TABLE public.push_outbox ADD CONSTRAINT push_outbox_audience_check CHECK (audience IN ('owner', 'test', 'appointment', 'subscribers'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_push_outbox_due ON public.push_outbox (next_attempt_at) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS idx_push_outbox_salon_recent ON public.push_outbox (salon_id, created_at DESC);

-- Estado da plataforma (uma linha): o worker informa se as chaves VAPID existem e o último resultado.
CREATE TABLE IF NOT EXISTS public.push_platform_status (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  configured boolean,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  last_kick_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.push_platform_status (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.push_platform_status ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_platform_status FROM anon, authenticated;

-- ---------- Validação ----------
-- Lista fechada de serviços de push (o servidor faz POST no endpoint: evita SSRF). Igual a isPushEndpoint (core.ts).
CREATE OR REPLACE FUNCTION public.push_valid_endpoint(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT p IS NOT NULL AND length(p) BETWEEN 30 AND 2048
     AND p ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)/[!-~]+$'
$$;

-- ---------- RPCs do navegador (visitante e dono) ----------
-- Registra/renova a inscrição Web Push deste aparelho no salão. p256dh = ponto P-256 não comprimido (65 bytes,
-- base64url 87 chars, começa com 'B'); auth = 16 bytes (22 chars). Vínculo com dono/admin só pelo JWT (auth.uid()).
CREATE OR REPLACE FUNCTION public.register_web_push(p_salon_slug text, p_endpoint text, p_p256dh text, p_auth text, p_device jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_salon public.salons;
  v_uid uuid := auth.uid();
  v_manager boolean := false;
  v_device jsonb := '{}'::jsonb;
  v_id uuid;
BEGIN
  IF p_salon_slug IS NULL OR p_salon_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$' THEN
    RAISE EXCEPTION 'invalid_salon' USING ERRCODE = '22023';
  END IF;
  IF NOT public.push_valid_endpoint(p_endpoint) THEN RAISE EXCEPTION 'invalid_endpoint' USING ERRCODE = '22023'; END IF;
  IF p_p256dh IS NULL OR p_p256dh !~ '^B[A-Za-z0-9_-]{86}$' OR p_auth IS NULL OR p_auth !~ '^[A-Za-z0-9_-]{22}$' THEN
    RAISE EXCEPTION 'invalid_keys' USING ERRCODE = '22023';
  END IF;
  v_salon := public.push_salon_for_slug(p_salon_slug);
  IF v_salon.id IS NULL THEN RAISE EXCEPTION 'salon_unavailable' USING ERRCODE = 'P0002'; END IF;
  IF v_uid IS NOT NULL THEN v_manager := public.whatsapp_can_manage_salon(v_salon.id); END IF;

  IF jsonb_typeof(p_device) = 'object' THEN
    SELECT coalesce(jsonb_object_agg(k, left(p_device ->> k, 200)), '{}'::jsonb) INTO v_device
      FROM unnest(ARRAY['platform', 'standalone', 'browser', 'source']) k WHERE p_device ? k;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_salon.id::text || ':' || p_endpoint, 0));
  UPDATE public.push_subscriptions
     SET is_active = true, deactivated_reason = NULL, updated_at = now(), device_info = v_device,
         p256dh = p_p256dh, auth = p_auth,
         -- Dono/admin logado marca o aparelho como dele; visitante nunca apaga um vínculo existente.
         user_id = CASE WHEN v_manager THEN v_uid ELSE user_id END
   WHERE salon_id = v_salon.id AND web_endpoint = p_endpoint
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    INSERT INTO public.push_subscriptions (salon_id, user_id, endpoint, web_endpoint, p256dh, auth, device_info, is_active)
    VALUES (v_salon.id, CASE WHEN v_manager THEN v_uid END, 'wp:' || v_salon.id || ':' || md5(p_endpoint), p_endpoint, p_p256dh, p_auth, v_device, true)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.unregister_web_push(p_salon_slug text, p_endpoint text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.push_valid_endpoint(p_endpoint) THEN RETURN false; END IF;
  UPDATE public.push_subscriptions ps SET is_active = false, deactivated_reason = 'user', updated_at = now()
    FROM public.salons s
   WHERE s.id = ps.salon_id AND s.slug = p_salon_slug AND ps.web_endpoint = p_endpoint AND ps.is_active;
  RETURN FOUND;
END $$;

-- Só responde sobre o endpoint que o próprio aparelho apresenta.
CREATE OR REPLACE FUNCTION public.web_push_status(p_salon_slug text, p_endpoint text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('subscribed', coalesce(bool_or(ps.is_active), false), 'marketing', NOT coalesce(bool_or(ps.marketing_opt_out), false))
    FROM public.push_subscriptions ps JOIN public.salons s ON s.id = ps.salon_id
   WHERE s.slug = p_salon_slug AND ps.web_endpoint = p_endpoint AND public.push_valid_endpoint(p_endpoint)
$$;

-- Opt-out de campanhas (o cliente continua recebendo lembretes do próprio horário).
CREATE OR REPLACE FUNCTION public.web_push_set_marketing(p_salon_slug text, p_endpoint text, p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.push_valid_endpoint(p_endpoint) OR p_enabled IS NULL THEN RETURN false; END IF;
  UPDATE public.push_subscriptions ps SET marketing_opt_out = NOT p_enabled, updated_at = now()
    FROM public.salons s
   WHERE s.id = ps.salon_id AND s.slug = p_salon_slug AND ps.web_endpoint = p_endpoint;
  RETURN FOUND;
END $$;

-- Vincula ESTE aparelho (endpoint já inscrito no salão) a um agendamento. Prova de posse: o cancellation_token
-- (segredo de 256 bits do link do agendamento). Não devolve nenhum dado do agendamento.
CREATE OR REPLACE FUNCTION public.link_web_push_appointment(p_endpoint text, p_cancellation_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_appt_id uuid; v_salon uuid; v_status text;
BEGIN
  IF p_cancellation_token IS NULL OR p_cancellation_token !~ '^[A-Za-z0-9_-]{32,128}$' OR NOT public.push_valid_endpoint(p_endpoint) THEN
    RETURN false;
  END IF;
  SELECT id, salon_id, status INTO v_appt_id, v_salon, v_status FROM public.appointments WHERE cancellation_token = p_cancellation_token;
  IF v_appt_id IS NULL OR v_status IN ('cancelled', 'no_show') THEN RETURN false; END IF;
  INSERT INTO public.push_appointment_links (subscription_id, appointment_id)
  SELECT ps.id, v_appt_id FROM public.push_subscriptions ps
   WHERE ps.salon_id = v_salon AND ps.web_endpoint = p_endpoint AND ps.is_active
  ON CONFLICT DO NOTHING;
  RETURN EXISTS (SELECT 1 FROM public.push_appointment_links l JOIN public.push_subscriptions ps ON ps.id = l.subscription_id
                  WHERE l.appointment_id = v_appt_id AND ps.web_endpoint = p_endpoint AND ps.is_active);
END $$;

-- Migração automática: o aparelho apresenta o token FCM antigo (guardado pelo SDK no IndexedDB dele) e recebe
-- só os slugs dos salões em que aquele token estava inscrito, para se reinscrever via Web Push sem novo pedido.
CREATE OR REPLACE FUNCTION public.push_legacy_salons(p_fcm_token text)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(DISTINCT s.slug), '{}')
    FROM public.push_subscriptions ps JOIN public.salons s ON s.id = ps.salon_id
   -- Tamanho à parte: o regex do Postgres limita repetição a {0,255}.
   WHERE length(p_fcm_token) BETWEEN 20 AND 4096 AND p_fcm_token ~ '^[A-Za-z0-9_:.\-]+$' AND ps.fcm_token = p_fcm_token
     AND (ps.is_active OR ps.deactivated_reason = 'fcm_legacy') AND s.slug IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.push_valid_endpoint(text), public.register_web_push(text, text, text, text, jsonb),
  public.unregister_web_push(text, text), public.web_push_status(text, text), public.web_push_set_marketing(text, text, boolean),
  public.link_web_push_appointment(text, text), public.push_legacy_salons(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_web_push(text, text, text, text, jsonb), public.unregister_web_push(text, text),
  public.web_push_status(text, text), public.web_push_set_marketing(text, text, boolean),
  public.link_web_push_appointment(text, text), public.push_legacy_salons(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_valid_endpoint(text) TO anon, authenticated, service_role;

-- ---------- Enfileiramento (servidor) ----------
-- Kick imediato coalescido: no máximo 1 chamada ao worker a cada 15 s (pg_net, enviado no COMMIT). O cron de 1 min
-- continua como rede de segurança; falha aqui nunca afeta a transação de origem.
CREATE OR REPLACE FUNCTION public.push_kick()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.push_platform_status SET last_kick_at = now()
   WHERE id IN (SELECT id FROM public.push_platform_status
                 WHERE last_kick_at IS NULL OR last_kick_at < now() - interval '15 seconds' FOR UPDATE SKIP LOCKED);
  IF FOUND THEN PERFORM public.invoke_edge_function('send-push-notification'); END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Tipo de aviso → coluna de preferência (NULL = sempre ligado: teste e campanha).
CREATE OR REPLACE FUNCTION public.push_pref_column(p_kind text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_kind
    WHEN 'new_appointment' THEN 'new_appointment' WHEN 'appointment_cancelled' THEN 'appointment_cancelled'
    WHEN 'appointment_rescheduled' THEN 'appointment_rescheduled' WHEN 'whatsapp_human' THEN 'whatsapp_human'
    WHEN 'whatsapp_handoff' THEN 'whatsapp_human' WHEN 'payment_proof' THEN 'payment_proof' WHEN 'new_review' THEN 'new_review'
    WHEN 'client_reminder' THEN 'client_reminder' WHEN 'client_confirmed' THEN 'client_status' WHEN 'client_cancelled' THEN 'client_status'
    WHEN 'client_rescheduled' THEN 'client_status' WHEN 'review_request' THEN 'client_review_request' END
$$;

-- Quem administra o salão (dono ou papel admin): destinatários dos avisos "owner".
CREATE OR REPLACE FUNCTION public.push_manager_ids(p_salon uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT owner_id FROM public.salons WHERE id = p_salon
  UNION SELECT user_id FROM public.user_roles WHERE salon_id = p_salon AND role = 'admin' AND user_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.push_enqueue(p_salon uuid, p_kind text, p_audience text, p_title text, p_body text, p_url text,
  p_dedupe text, p_appointment uuid DEFAULT NULL, p_not_before timestamptz DEFAULT NULL, p_expires timestamptz DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pref text := public.push_pref_column(p_kind); v_on boolean; v_id uuid; v_at timestamptz := coalesce(p_not_before, now());
BEGIN
  IF v_pref IS NOT NULL THEN
    SELECT (to_jsonb(p) ->> v_pref)::boolean INTO v_on FROM public.push_preferences p WHERE p.salon_id = p_salon;
    IF v_on IS FALSE THEN RETURN false; END IF;
  END IF;
  -- Sem aparelho para receber: não ocupa a fila.
  IF p_audience = 'owner' AND NOT EXISTS (SELECT 1 FROM public.push_subscriptions ps WHERE ps.salon_id = p_salon AND ps.is_active
       AND ps.web_endpoint IS NOT NULL AND ps.user_id IN (SELECT public.push_manager_ids(p_salon))) THEN RETURN false; END IF;
  IF p_audience = 'appointment' AND NOT EXISTS (SELECT 1 FROM public.push_appointment_links l JOIN public.push_subscriptions ps ON ps.id = l.subscription_id
       WHERE l.appointment_id = p_appointment AND ps.is_active AND ps.web_endpoint IS NOT NULL) THEN RETURN false; END IF;
  INSERT INTO public.push_outbox (salon_id, kind, audience, title, body, url, dedupe_key, appointment_id, next_attempt_at, expires_at)
  VALUES (p_salon, p_kind, p_audience, left(p_title, 100), left(p_body, 300), p_url, p_dedupe, p_appointment,
          v_at, coalesce(p_expires, v_at + interval '24 hours'))
  ON CONFLICT (dedupe_key) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NOT NULL AND p_audience = 'owner' AND v_at <= now() THEN PERFORM public.push_kick(); END IF;
  RETURN v_id IS NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION public.push_when(p_date date, p_time time)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT to_char(p_date, 'DD/MM') || ' às ' || to_char(p_time, 'HH24:MI') $$;
CREATE OR REPLACE FUNCTION public.push_client_label(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT left(coalesce(nullif(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', ' ', 'g')), ''), 'Cliente'), 60) $$;

-- ---------- Eventos de agendamento ----------
CREATE OR REPLACE FUNCTION public.push_enqueue_new_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_enqueue(NEW.salon_id, 'new_appointment', 'owner', 'Novo agendamento',
    public.push_client_label(NEW.client_name) || ' agendou para ' || public.push_when(NEW.date, NEW.start_time),
    '/admin/appointments', 'appointment:' || NEW.id, NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- push nunca impede o agendamento
END $$;

-- Quem mudou: dono/admin logado (painel) avisa o CLIENTE; cliente/link/WhatsApp (sem JWT de gestor) avisa o DONO.
CREATE OR REPLACE FUNCTION public.push_on_appointment_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_by_manager boolean := auth.uid() IS NOT NULL AND public.whatsapp_can_manage_salon(NEW.salon_id);
  v_salon text; v_slug text; v_start timestamptz;
  v_when text := public.push_when(NEW.date, NEW.start_time);
BEGIN
  SELECT left(name, 60), slug, (NEW.date + NEW.start_time) AT TIME ZONE coalesce(timezone, 'America/Sao_Paulo')
    INTO v_salon, v_slug, v_start FROM public.salons WHERE id = NEW.salon_id;
  v_salon := coalesce(v_salon, 'O salão');
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    IF v_by_manager THEN
      PERFORM public.push_enqueue(NEW.salon_id, 'client_cancelled', 'appointment', 'Agendamento cancelado',
        v_salon || ' cancelou seu horário de ' || v_when || '.', '/s/' || v_slug, 'client_cancelled:' || NEW.id, NEW.id);
    ELSE
      PERFORM public.push_enqueue(NEW.salon_id, 'appointment_cancelled', 'owner', 'Agendamento cancelado',
        public.push_client_label(NEW.client_name) || ' cancelou o horário de ' || v_when, '/admin/appointments',
        'appointment_cancelled:' || NEW.id, NEW.id);
    END IF;
  ELSIF NEW.status <> 'cancelled' AND (OLD.date IS DISTINCT FROM NEW.date OR OLD.start_time IS DISTINCT FROM NEW.start_time) THEN
    IF v_by_manager THEN
      PERFORM public.push_enqueue(NEW.salon_id, 'client_rescheduled', 'appointment', 'Horário alterado',
        v_salon || ' remarcou seu horário para ' || v_when || '.', '/s/' || v_slug,
        'client_rescheduled:' || NEW.id || ':' || NEW.date || ':' || NEW.start_time, NEW.id, NULL, least(v_start, now() + interval '24 hours'));
    ELSE
      PERFORM public.push_enqueue(NEW.salon_id, 'appointment_rescheduled', 'owner', 'Agendamento remarcado',
        public.push_client_label(NEW.client_name) || ' remarcou de ' || public.push_when(OLD.date, OLD.start_time) || ' para ' || v_when,
        '/admin/appointments', 'appointment_rescheduled:' || NEW.id || ':' || NEW.date || ':' || NEW.start_time, NEW.id);
    END IF;
  END IF;
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    PERFORM public.push_enqueue(NEW.salon_id, 'client_confirmed', 'appointment', 'Horário confirmado',
      v_salon || ' confirmou seu horário de ' || v_when || '.', '/s/' || v_slug,
      'client_confirmed:' || NEW.id, NEW.id, NULL, least(v_start, now() + interval '24 hours'));
  END IF;
  -- Avaliação: 1 h depois de concluído; vale por 3 dias.
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed'
     AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.appointment_id = NEW.id) THEN
    PERFORM public.push_enqueue(NEW.salon_id, 'review_request', 'appointment', 'Como foi seu atendimento?',
      'Conte para ' || v_salon || ' como foi. Leva menos de um minuto.', '/avaliar/' || NEW.id,
      'review_request:' || NEW.id, NEW.id, now() + interval '1 hour', now() + interval '3 days');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS push_enqueue_new_appointment ON public.appointments;
CREATE TRIGGER push_enqueue_new_appointment AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.push_enqueue_new_appointment();
DROP TRIGGER IF EXISTS push_on_appointment_update ON public.appointments;
CREATE TRIGGER push_on_appointment_update AFTER UPDATE OF status, date, start_time ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.push_on_appointment_update();

-- Lembrete ao cliente (aparelho vinculado): chamado pelo worker a cada execução. Nunca atrasado: expira no início do horário.
CREATE OR REPLACE FUNCTION public.push_enqueue_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; n integer := 0;
BEGIN
  FOR a IN
    SELECT DISTINCT ap.id, ap.salon_id, ap.date, ap.start_time, left(s.name, 60) salon_name, s.slug,
           (ap.date + ap.start_time) AT TIME ZONE coalesce(s.timezone, 'America/Sao_Paulo') starts_at, coalesce(p.reminder_minutes, 120) mins
      FROM public.push_appointment_links l
      JOIN public.push_subscriptions ps ON ps.id = l.subscription_id AND ps.is_active AND ps.web_endpoint IS NOT NULL
      JOIN public.appointments ap ON ap.id = l.appointment_id AND ap.status IN ('pending', 'confirmed')
      JOIN public.salons s ON s.id = ap.salon_id
      LEFT JOIN public.push_preferences p ON p.salon_id = ap.salon_id
     WHERE coalesce(p.client_reminder, true) AND ap.date BETWEEN current_date - 1 AND current_date + 2
  LOOP
    CONTINUE WHEN a.starts_at <= now() + interval '10 minutes' OR a.starts_at - make_interval(mins => a.mins) > now();
    IF public.push_enqueue(a.salon_id, 'client_reminder', 'appointment', 'Lembrete de horário',
         a.salon_name || ': seu horário é ' || public.push_when(a.date, a.start_time) || '.', '/s/' || a.slug,
         'client_reminder:' || a.id || ':' || a.date || ':' || a.start_time, a.id, NULL, a.starts_at) THEN n := n + 1; END IF;
  END LOOP;
  RETURN n;
END $$;

-- ---------- WhatsApp, comprovante, avaliação ----------
-- Mensagem do cliente em conversa com atendimento humano: no máximo 1 aviso por conversa a cada 10 min.
CREATE OR REPLACE FUNCTION public.push_on_whatsapp_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_who text;
BEGIN
  IF NEW.direction <> 'in' OR NOT EXISTS (SELECT 1 FROM public.whatsapp_conversation_state st
       WHERE st.salon_id = NEW.salon_id AND st.phone = NEW.phone AND st.human_takeover) THEN RETURN NEW; END IF;
  v_who := coalesce(nullif(btrim(regexp_replace(coalesce(NEW.contact_name, ''), '[[:cntrl:]]', ' ', 'g')), ''), 'Contato final ' || right(NEW.phone, 4));
  PERFORM public.push_enqueue(NEW.salon_id, 'whatsapp_human', 'owner', 'Mensagem no WhatsApp',
    left(v_who, 60) || ' está aguardando sua resposta.', '/admin/whatsapp?aba=conversas&tel=' || replace(NEW.phone, '+', '%2B'),
    'whatsapp_human:' || NEW.salon_id || ':' || NEW.phone || ':' || floor(extract(epoch FROM NEW.created_at) / 600)::bigint);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS push_on_whatsapp_message ON public.whatsapp_messages;
CREATE TRIGGER push_on_whatsapp_message AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.push_on_whatsapp_message();

-- IA passou a conversa para a equipe (takeover sem usuário = não foi o dono que pausou).
CREATE OR REPLACE FUNCTION public.push_on_whatsapp_handoff()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.human_takeover AND NEW.taken_over_by IS NULL AND (TG_OP = 'INSERT' OR NOT coalesce(OLD.human_takeover, false)) THEN
    PERFORM public.push_enqueue(NEW.salon_id, 'whatsapp_handoff', 'owner', 'Assistente pediu ajuda',
      'Uma conversa no WhatsApp precisa da equipe (final ' || right(NEW.phone, 4) || ').',
      '/admin/whatsapp?aba=conversas&tel=' || replace(NEW.phone, '+', '%2B'),
      'whatsapp_handoff:' || NEW.id || ':' || coalesce(NEW.taken_over_at, now())::text);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS push_on_whatsapp_handoff ON public.whatsapp_conversation_state;
CREATE TRIGGER push_on_whatsapp_handoff AFTER INSERT OR UPDATE OF human_takeover ON public.whatsapp_conversation_state
  FOR EACH ROW EXECUTE FUNCTION public.push_on_whatsapp_handoff();

CREATE OR REPLACE FUNCTION public.push_on_payment_proof()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_enqueue(NEW.salon_id, 'payment_proof', 'owner', 'Comprovante PIX recebido',
    'Um cliente enviou comprovante pelo WhatsApp. Confira antes de marcar como pago.', '/admin/whatsapp?aba=conversas',
    'payment_proof:' || NEW.id, NEW.appointment_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS push_on_payment_proof ON public.appointment_payment_proofs;
CREATE TRIGGER push_on_payment_proof AFTER INSERT ON public.appointment_payment_proofs
  FOR EACH ROW EXECUTE FUNCTION public.push_on_payment_proof();

CREATE OR REPLACE FUNCTION public.push_on_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_enqueue(NEW.salon_id, 'new_review', 'owner', 'Nova avaliação',
    'Você recebeu ' || NEW.rating || ' de 5 estrelas' || CASE WHEN nullif(btrim(NEW.comment), '') IS NOT NULL THEN ' com comentário.' ELSE '.' END,
    '/admin/reviews', 'review:' || NEW.id, NEW.appointment_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS push_on_review ON public.reviews;
CREATE TRIGGER push_on_review AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.push_on_review();

-- Sino do painel (admin_notifications): cada evento tinha 2 triggers chamando a mesma função (aviso duplicado).
-- Mantém on_appointment_created/cancelled/rescheduled; remove as cópias.
DROP TRIGGER IF EXISTS trigger_notify_admin_new_appointment ON public.appointments;
DROP TRIGGER IF EXISTS trigger_notify_admin_cancelled ON public.appointments;
DROP TRIGGER IF EXISTS trigger_notify_admin_rescheduled ON public.appointments;

-- ---------- Worker (só service_role) ----------
-- Expira o que passou da validade (lembrete atrasado não sai), gera lembretes e reserva um lote (SKIP LOCKED).
CREATE OR REPLACE FUNCTION public.push_claim_outbox(p_limit integer DEFAULT 25)
RETURNS SETOF public.push_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.push_outbox SET status = 'expired', locked_at = NULL
   WHERE status IN ('pending', 'processing') AND coalesce(expires_at, created_at + interval '24 hours') < now();
  BEGIN PERFORM public.push_enqueue_reminders(); EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN QUERY
  UPDATE public.push_outbox o SET status = 'processing', locked_at = now(), attempts = o.attempts + 1
   WHERE o.id IN (SELECT id FROM public.push_outbox
                   WHERE ((status = 'pending' AND next_attempt_at <= now()) OR (status = 'processing' AND locked_at < now() - interval '5 minutes'))
                     AND attempts < 5
                   ORDER BY next_attempt_at LIMIT least(greatest(p_limit, 1), 100) FOR UPDATE SKIP LOCKED)
  RETURNING o.*;
END $$;

-- Destinatários de um item (chaves só para o worker). Público decidido aqui, nunca pelo chamador.
CREATE OR REPLACE FUNCTION public.push_job_targets(p_job uuid)
RETURNS TABLE (id uuid, endpoint text, p256dh text, auth text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (ps.web_endpoint) ps.id, ps.web_endpoint, ps.p256dh, ps.auth
    FROM public.push_outbox o
    JOIN public.push_subscriptions ps ON ps.salon_id = o.salon_id AND ps.is_active AND ps.web_endpoint IS NOT NULL
                                     AND ps.p256dh IS NOT NULL AND ps.auth IS NOT NULL
   WHERE o.id = p_job AND CASE o.audience
     WHEN 'owner' THEN ps.user_id IN (SELECT public.push_manager_ids(o.salon_id))
     WHEN 'test' THEN ps.user_id = o.created_by
     WHEN 'appointment' THEN EXISTS (SELECT 1 FROM public.push_appointment_links l WHERE l.subscription_id = ps.id AND l.appointment_id = o.appointment_id)
     WHEN 'subscribers' THEN NOT ps.marketing_opt_out AND (ps.user_id IS NULL OR ps.user_id NOT IN (SELECT public.push_manager_ids(o.salon_id)))
     ELSE false END
   ORDER BY ps.web_endpoint, ps.updated_at DESC
   LIMIT 1000
$$;

-- ---------- Painel do dono (authenticated; confere dono/admin) ----------
CREATE OR REPLACE FUNCTION public.push_assert_manager(p_salon uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR p_salon IS NULL OR NOT public.whatsapp_can_manage_salon(p_salon) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.push_get_preferences(p_salon_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public.push_assert_manager(p_salon_id);
  SELECT to_jsonb(p) - 'salon_id' - 'updated_at' INTO v FROM public.push_preferences p WHERE p.salon_id = p_salon_id;
  -- Sem linha: tudo ligado (mesmos defaults da tabela).
  RETURN coalesce(v, jsonb_build_object('new_appointment', true, 'appointment_cancelled', true, 'appointment_rescheduled', true,
    'whatsapp_human', true, 'payment_proof', true, 'new_review', true, 'client_reminder', true, 'client_status', true,
    'client_review_request', true, 'reminder_minutes', 120));
END $$;

CREATE OR REPLACE FUNCTION public.push_set_preferences(p_salon_id uuid, p_prefs jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; v_min integer;
BEGIN
  PERFORM public.push_assert_manager(p_salon_id);
  IF jsonb_typeof(p_prefs) <> 'object' THEN RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.push_preferences (salon_id) VALUES (p_salon_id) ON CONFLICT (salon_id) DO NOTHING;
  FOREACH k IN ARRAY ARRAY['new_appointment', 'appointment_cancelled', 'appointment_rescheduled', 'whatsapp_human', 'payment_proof',
                           'new_review', 'client_reminder', 'client_status', 'client_review_request'] LOOP
    IF jsonb_typeof(p_prefs -> k) = 'boolean' THEN
      EXECUTE format('UPDATE public.push_preferences SET %I = $1, updated_at = now() WHERE salon_id = $2', k) USING (p_prefs ->> k)::boolean, p_salon_id;
    END IF;
  END LOOP;
  IF jsonb_typeof(p_prefs -> 'reminder_minutes') = 'number' THEN
    v_min := (p_prefs ->> 'reminder_minutes')::numeric::integer;
    IF v_min NOT BETWEEN 30 AND 1440 THEN RAISE EXCEPTION 'invalid_reminder' USING ERRCODE = '22023'; END IF;
    UPDATE public.push_preferences SET reminder_minutes = v_min, updated_at = now() WHERE salon_id = p_salon_id;
  END IF;
  RETURN public.push_get_preferences(p_salon_id);
END $$;

-- Aparelhos (dono/equipe vs clientes), estado da plataforma e últimos envios. Sem endpoint/chave.
CREATE OR REPLACE FUNCTION public.push_overview(p_salon_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM public.push_assert_manager(p_salon_id);
  SELECT jsonb_build_object(
    'configured', (SELECT configured FROM public.push_platform_status WHERE id),
    'my_devices', (SELECT count(*) FROM public.push_subscriptions WHERE salon_id = p_salon_id AND is_active AND web_endpoint IS NOT NULL AND user_id = auth.uid()),
    'team_devices', (SELECT count(*) FROM public.push_subscriptions WHERE salon_id = p_salon_id AND is_active AND web_endpoint IS NOT NULL
                       AND user_id IN (SELECT public.push_manager_ids(p_salon_id))),
    'client_devices', (SELECT count(*) FROM public.push_subscriptions WHERE salon_id = p_salon_id AND is_active AND web_endpoint IS NOT NULL
                       AND (user_id IS NULL OR user_id NOT IN (SELECT public.push_manager_ids(p_salon_id)))),
    'marketing_devices', (SELECT count(*) FROM public.push_subscriptions WHERE salon_id = p_salon_id AND is_active AND web_endpoint IS NOT NULL
                       AND NOT marketing_opt_out AND (user_id IS NULL OR user_id NOT IN (SELECT public.push_manager_ids(p_salon_id)))),
    'legacy_devices', (SELECT count(*) FROM public.push_subscriptions WHERE salon_id = p_salon_id AND NOT is_active AND deactivated_reason = 'fcm_legacy'),
    'campaigns_today', (SELECT count(*) FROM public.push_outbox WHERE salon_id = p_salon_id AND kind = 'marketing' AND created_at > now() - interval '24 hours'),
    'history', coalesce((SELECT jsonb_agg(h ORDER BY h.created_at DESC) FROM (
        SELECT kind, audience, title, status, sent_count, failed_count, last_error, created_at, sent_at
          FROM public.push_outbox WHERE salon_id = p_salon_id ORDER BY created_at DESC LIMIT 15) h), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;

-- Campanha para inscritos do salão (respeita opt-out; limite de 3 por 24 h). Envio pelo worker, em lote.
CREATE OR REPLACE FUNCTION public.push_enqueue_campaign(p_salon_id uuid, p_title text, p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title text := btrim(regexp_replace(coalesce(p_title, ''), '[[:cntrl:]]', ' ', 'g'));
        v_body text := btrim(regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]', ' ', 'g'));
        v_slug text; v_count integer;
BEGIN
  PERFORM public.push_assert_manager(p_salon_id);
  IF v_title = '' OR v_body = '' THEN RAISE EXCEPTION 'invalid_request' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('push_campaign:' || p_salon_id, 0));
  IF (SELECT count(*) FROM public.push_outbox WHERE salon_id = p_salon_id AND kind = 'marketing' AND created_at > now() - interval '24 hours') >= 3 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;
  SELECT slug INTO v_slug FROM public.salons WHERE id = p_salon_id;
  SELECT count(*) INTO v_count FROM public.push_subscriptions WHERE salon_id = p_salon_id AND is_active AND web_endpoint IS NOT NULL
     AND NOT marketing_opt_out AND (user_id IS NULL OR user_id NOT IN (SELECT public.push_manager_ids(p_salon_id)));
  IF v_count = 0 THEN RETURN jsonb_build_object('queued', false, 'recipients', 0); END IF;
  INSERT INTO public.push_outbox (salon_id, kind, audience, title, body, url, dedupe_key, created_by, expires_at)
  VALUES (p_salon_id, 'marketing', 'subscribers', left(v_title, 100), left(v_body, 300), '/s/' || v_slug,
          'marketing:' || gen_random_uuid(), auth.uid(), now() + interval '12 hours');
  PERFORM public.push_kick();
  RETURN jsonb_build_object('queued', true, 'recipients', v_count);
END $$;

-- ---------- Super admin ----------
CREATE OR REPLACE FUNCTION public.push_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT coalesce(public.is_super_admin(), false) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'configured', st.configured, 'last_run_at', st.last_run_at, 'last_success_at', st.last_success_at, 'last_error', st.last_error,
    'sent_24h', (SELECT coalesce(sum(sent_count), 0) FROM public.push_outbox WHERE created_at > now() - interval '24 hours'),
    'failed_24h', (SELECT coalesce(sum(failed_count), 0) FROM public.push_outbox WHERE created_at > now() - interval '24 hours'),
    'pending', (SELECT count(*) FROM public.push_outbox WHERE status IN ('pending', 'processing')),
    'expired_24h', (SELECT count(*) FROM public.push_outbox WHERE status = 'expired' AND created_at > now() - interval '24 hours'),
    'removed_24h', (SELECT count(*) FROM public.push_subscriptions WHERE deactivated_reason = 'gone' AND updated_at > now() - interval '24 hours'),
    'active_subscriptions', (SELECT count(*) FROM public.push_subscriptions WHERE is_active AND web_endpoint IS NOT NULL),
    'legacy_inactive', (SELECT count(*) FROM public.push_subscriptions WHERE deactivated_reason = 'fcm_legacy')
  ) INTO v FROM public.push_platform_status st WHERE st.id;
  RETURN v;
END $$;

-- RPC FCM antiga: o app atual usa register_web_push. Bundle desatualizado recebe erro claro (não reativa token FCM).
CREATE OR REPLACE FUNCTION public.register_push_subscription(p_salon_slug text, p_fcm_token text, p_device jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'client_outdated' USING ERRCODE = 'P0001', HINT = 'Recarregue a página para atualizar o app.';
END $$;

REVOKE ALL ON FUNCTION public.push_kick(), public.push_pref_column(text), public.push_manager_ids(uuid),
  public.push_enqueue(uuid, text, text, text, text, text, text, uuid, timestamptz, timestamptz), public.push_when(date, time),
  public.push_client_label(text), public.push_enqueue_new_appointment(), public.push_on_appointment_update(), public.push_enqueue_reminders(),
  public.push_on_whatsapp_message(), public.push_on_whatsapp_handoff(), public.push_on_payment_proof(), public.push_on_review(),
  public.push_claim_outbox(integer), public.push_job_targets(uuid), public.push_assert_manager(uuid),
  public.push_get_preferences(uuid), public.push_set_preferences(uuid, jsonb), public.push_overview(uuid),
  public.push_enqueue_campaign(uuid, text, text), public.push_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_claim_outbox(integer), public.push_job_targets(uuid), public.push_enqueue_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.push_get_preferences(uuid), public.push_set_preferences(uuid, jsonb), public.push_overview(uuid),
  public.push_enqueue_campaign(uuid, text, text), public.push_health() TO authenticated;
-- push_assert_manager é chamado de dentro das funções DEFINER (dono = owner): sem grant direto.

-- Cron de segurança (1/min). Idempotente: recria o mesmo job.
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'push-outbox-worker';
  PERFORM cron.schedule('push-outbox-worker', '* * * * *', $c$SELECT public.invoke_edge_function('send-push-notification')$c$);
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK (manual; não executar junto). Não reativa tokens FCM (não servem sem Firebase).
-- BEGIN;
-- DROP TRIGGER IF EXISTS push_on_appointment_update ON public.appointments;
-- DROP TRIGGER IF EXISTS push_on_whatsapp_message ON public.whatsapp_messages;
-- DROP TRIGGER IF EXISTS push_on_whatsapp_handoff ON public.whatsapp_conversation_state;
-- DROP TRIGGER IF EXISTS push_on_payment_proof ON public.appointment_payment_proofs;
-- DROP TRIGGER IF EXISTS push_on_review ON public.reviews;
-- DROP FUNCTION IF EXISTS public.push_on_appointment_update(), public.push_on_whatsapp_message(), public.push_on_whatsapp_handoff(),
--   public.push_on_payment_proof(), public.push_on_review(), public.push_enqueue_reminders(), public.push_job_targets(uuid),
--   public.push_get_preferences(uuid), public.push_set_preferences(uuid, jsonb), public.push_overview(uuid),
--   public.push_enqueue_campaign(uuid, text, text), public.push_health(), public.push_assert_manager(uuid),
--   public.register_web_push(text, text, text, text, jsonb), public.unregister_web_push(text, text), public.web_push_status(text, text),
--   public.web_push_set_marketing(text, text, boolean), public.link_web_push_appointment(text, text), public.push_legacy_salons(text),
--   public.push_enqueue(uuid, text, text, text, text, text, text, uuid, timestamptz, timestamptz), public.push_kick(),
--   public.push_pref_column(text), public.push_manager_ids(uuid), public.push_when(date, time), public.push_client_label(text),
--   public.push_valid_endpoint(text);
-- -- push_enqueue_new_appointment, push_claim_outbox e register_push_subscription: reaplicar 20261106001000_pwa_push_security.sql.
-- CREATE TRIGGER trigger_notify_admin_new_appointment AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION notify_admin_new_appointment();
-- CREATE TRIGGER trigger_notify_admin_cancelled AFTER UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION notify_admin_cancelled_appointment();
-- CREATE TRIGGER trigger_notify_admin_rescheduled AFTER UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION notify_admin_rescheduled_appointment();
-- DROP TABLE IF EXISTS public.push_appointment_links, public.push_preferences, public.push_platform_status;
-- ALTER TABLE public.push_outbox DROP CONSTRAINT IF EXISTS push_outbox_audience_check;
-- -- Colunas novas (web_endpoint, deactivated_reason, marketing_opt_out, audience, appointment_id, next_attempt_at, expires_at,
-- -- sent_count, failed_count, created_by) podem ficar; são aditivas.
-- COMMIT;
-- ============================================================================
