-- Alertas por e-mail ao cliente, todos na mesma fila (client_email_outbox) e com a marca do salão:
-- confirmado, lembrete 24 h, cancelado, remarcado, recibo de pagamento, pacote liberado, créditos acabando/vencendo,
-- pedido de avaliação e aniversário. Avaliação, créditos e aniversário respeitam marketing_opt_out.
-- ponytail: sem liga/desliga por salão (todos ligados). Se algum dono pedir, vira coluna em salons + filtro no enqueue.
BEGIN;

ALTER TABLE public.client_email_outbox ALTER COLUMN appointment_id DROP NOT NULL;
ALTER TABLE public.client_email_outbox ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_email_outbox ADD COLUMN IF NOT EXISTS dedupe_key text;
ALTER TABLE public.client_email_outbox ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb;
UPDATE public.client_email_outbox SET dedupe_key = kind || ':' || appointment_id::text WHERE dedupe_key IS NULL;
ALTER TABLE public.client_email_outbox ALTER COLUMN dedupe_key SET NOT NULL;
ALTER TABLE public.client_email_outbox DROP CONSTRAINT IF EXISTS client_email_outbox_appointment_id_kind_key;
CREATE UNIQUE INDEX IF NOT EXISTS client_email_outbox_dedupe ON public.client_email_outbox (dedupe_key);
ALTER TABLE public.client_email_outbox DROP CONSTRAINT IF EXISTS client_email_outbox_kind_check;
ALTER TABLE public.client_email_outbox ADD CONSTRAINT client_email_outbox_kind_check
  CHECK (kind IN ('confirmed', 'reminder', 'cancelled', 'rescheduled', 'payment', 'package', 'credits', 'review', 'birthday'));

-- Um e-mail por chave (dedupe_key). Retorna true quando entrou na fila agora.
CREATE OR REPLACE FUNCTION public.client_email_enqueue(p_salon_id uuid, p_kind text, p_to text, p_key text, p_appointment_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb, p_at timestamptz DEFAULT now())
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text := nullif(lower(btrim(coalesce(p_to, ''))), ''); v_n integer;
BEGIN
  IF v_email IS NULL OR length(v_email) > 254 OR v_email !~ '^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$' THEN RETURN false; END IF;
  INSERT INTO client_email_outbox(salon_id, appointment_id, client_id, kind, to_email, dedupe_key, payload, next_attempt_at)
  VALUES (p_salon_id, p_appointment_id, p_client_id, p_kind, v_email, p_key, coalesce(p_payload, '{}'::jsonb), coalesce(p_at, now()))
  ON CONFLICT (dedupe_key) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END $$;
REVOKE ALL ON FUNCTION public.client_email_enqueue(uuid, text, text, text, uuid, uuid, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;

-- Agendamento: confirmado, cancelado, remarcado e (15 min depois de concluído) pedido de avaliação.
CREATE OR REPLACE FUNCTION public.appointments_email_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; v_opt boolean := false; v_now boolean := false; v_slot text := NEW.date::text || ':' || to_char(NEW.start_time, 'HH24:MI');
BEGIN
  IF NEW.date < current_date - 1 THEN RETURN NEW; END IF;
  SELECT nullif(lower(btrim(email)), ''), coalesce(marketing_opt_out, false) INTO v_email, v_opt FROM clients WHERE id = NEW.client_id AND salon_id = NEW.salon_id;
  v_email := coalesce(nullif(NEW.client_email, ''), v_email);
  IF v_email IS NULL THEN RETURN NEW; END IF;
  IF NEW.status::text = 'confirmed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF public.client_email_enqueue(NEW.salon_id, 'confirmed', v_email, 'confirmed:' || NEW.id::text, NEW.id, NEW.client_id) THEN v_now := true; END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status::text = 'cancelled' AND OLD.status::text IN ('pending', 'confirmed') THEN
      IF public.client_email_enqueue(NEW.salon_id, 'cancelled', v_email, 'cancelled:' || NEW.id::text, NEW.id, NEW.client_id) THEN v_now := true; END IF;
    ELSIF NEW.status::text IN ('pending', 'confirmed') AND OLD.status::text IN ('pending', 'confirmed')
          AND (NEW.date IS DISTINCT FROM OLD.date OR NEW.start_time IS DISTINCT FROM OLD.start_time) THEN
      IF public.client_email_enqueue(NEW.salon_id, 'rescheduled', v_email, 'rescheduled:' || NEW.id::text || ':' || v_slot, NEW.id, NEW.client_id,
           jsonb_build_object('old_date', OLD.date, 'old_start', to_char(OLD.start_time, 'HH24:MI'))) THEN v_now := true; END IF;
    ELSIF NEW.status::text = 'completed' AND OLD.status::text <> 'completed' AND NEW.professional_id IS NOT NULL AND NOT coalesce(v_opt, false) THEN
      PERFORM public.client_email_enqueue(NEW.salon_id, 'review', v_email, 'review:' || NEW.id::text, NEW.id, NEW.client_id, '{}'::jsonb, now() + interval '15 minutes');
    END IF;
  END IF;
  -- Envio imediato (pg_net sai depois do commit); se falhar, o cron de 5 min envia.
  IF v_now THEN BEGIN PERFORM public.invoke_edge_function('client-emails'); EXCEPTION WHEN OTHERS THEN NULL; END; END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'appointments_email_events: %', SQLERRM; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS appointments_email_confirmed ON public.appointments;
DROP TRIGGER IF EXISTS appointments_email_events ON public.appointments;
CREATE TRIGGER appointments_email_events AFTER INSERT OR UPDATE OF status, date, start_time ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointments_email_events();
DROP FUNCTION IF EXISTS public.appointments_email_confirmed();

-- Recibo: cobrança do agendamento paga (a do pacote sai no e-mail de pacote liberado).
CREATE OR REPLACE FUNCTION public.payment_charges_email_receipt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a appointments; v_email text;
BEGIN
  IF NEW.status <> 'paid' OR OLD.status = 'paid' OR NEW.appointment_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO a FROM appointments WHERE id = NEW.appointment_id;
  v_email := coalesce(nullif(a.client_email, ''), (SELECT nullif(lower(btrim(email)), '') FROM clients WHERE id = a.client_id));
  IF public.client_email_enqueue(NEW.salon_id, 'payment', v_email, 'payment:' || NEW.id::text, a.id, a.client_id,
       jsonb_build_object('amount_cents', coalesce(NEW.paid_amount_cents, NEW.amount_cents), 'method', coalesce(NEW.paid_method, NEW.method))) THEN
    BEGIN PERFORM public.invoke_edge_function('client-emails'); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'payment_charges_email_receipt: %', SQLERRM; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payment_charges_email_receipt ON public.payment_charges;
CREATE TRIGGER payment_charges_email_receipt AFTER UPDATE OF status ON public.payment_charges
  FOR EACH ROW EXECUTE FUNCTION public.payment_charges_email_receipt();

-- Pacote liberado (pago pelo provedor ou confirmado pelo dono).
CREATE OR REPLACE FUNCTION public.package_orders_email_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text; pk service_packages;
BEGIN
  IF NEW.status <> 'paid' OR OLD.status = 'paid' THEN RETURN NEW; END IF;
  v_email := coalesce((SELECT nullif(lower(btrim(email)), '') FROM clients WHERE id = NEW.client_id),
                      (SELECT nullif(client_email, '') FROM appointments WHERE id = NEW.appointment_id));
  SELECT * INTO pk FROM service_packages WHERE id = NEW.package_id;
  IF public.client_email_enqueue(NEW.salon_id, 'package', v_email, 'package:' || NEW.id::text, NULL, NEW.client_id,
       jsonb_build_object('client_name', NEW.client_name, 'package', pk.name, 'amount_cents', NEW.amount_cents, 'validity_days', pk.validity_days,
         'items', (SELECT coalesce(jsonb_agg(jsonb_build_object('service', s.name, 'quantity', i.quantity) ORDER BY s.name), '[]'::jsonb)
                   FROM service_package_items i JOIN services s ON s.id = i.service_id WHERE i.package_id = NEW.package_id))) THEN
    BEGIN PERFORM public.invoke_edge_function('client-emails'); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'package_orders_email_paid: %', SQLERRM; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS package_orders_email_paid ON public.package_orders;
CREATE TRIGGER package_orders_email_paid AFTER UPDATE OF status ON public.package_orders
  FOR EACH ROW EXECUTE FUNCTION public.package_orders_email_paid();

-- Agendados (cron de 15 min): lembrete 24 h, créditos acabando/vencendo e aniversário.
CREATE OR REPLACE FUNCTION public.client_email_enqueue_scheduled()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_n integer := 0;
BEGIN
  -- Lembrete: confirmado, começa entre 2 h e 24 h, marcado há mais de 12 h (não repete a confirmação recém-enviada).
  FOR r IN
    SELECT a.id, a.salon_id, a.client_id, a.date, a.start_time, coalesce(nullif(a.client_email, ''), nullif(lower(btrim(c.email)), '')) AS email
    FROM appointments a JOIN salons s ON s.id = a.salon_id LEFT JOIN clients c ON c.id = a.client_id
    WHERE a.status = 'confirmed' AND a.date BETWEEN current_date - 1 AND current_date + 2 AND a.created_at < now() - interval '12 hours'
      AND (a.date + a.start_time) AT TIME ZONE coalesce(s.timezone, 'America/Sao_Paulo') > now() + interval '2 hours'
      AND (a.date + a.start_time) AT TIME ZONE coalesce(s.timezone, 'America/Sao_Paulo') <= now() + interval '24 hours'
  LOOP
    IF public.client_email_enqueue(r.salon_id, 'reminder', r.email, 'reminder:' || r.id::text || ':' || r.date::text || ':' || to_char(r.start_time, 'HH24:MI'), r.id, r.client_id) THEN v_n := v_n + 1; END IF;
  END LOOP;

  -- Créditos: último uso do pacote ou vencendo em 7 dias. Um e-mail por cliente, cada crédito avisado uma vez por motivo.
  FOR r IN
    WITH cand AS (
      SELECT cc.salon_id, cc.client_id, lower(btrim(c.email)) AS email, sv.name AS service, cc.remaining_uses, cc.expires_at,
        CASE WHEN cc.expires_at IS NOT NULL AND cc.expires_at <= now() + interval '7 days' THEN 'expiring:' ELSE 'low:' END || cc.id::text AS k
      FROM client_credits cc JOIN clients c ON c.id = cc.client_id JOIN salons s ON s.id = cc.salon_id JOIN services sv ON sv.id = cc.service_id
      WHERE cc.remaining_uses > 0 AND (cc.expires_at IS NULL OR cc.expires_at > now())
        AND nullif(btrim(c.email), '') IS NOT NULL AND NOT coalesce(c.marketing_opt_out, false)
        AND ((cc.expires_at IS NOT NULL AND cc.expires_at <= now() + interval '7 days') OR (cc.remaining_uses = 1 AND cc.total_uses > 1))
        AND extract(hour FROM now() AT TIME ZONE coalesce(s.timezone, 'America/Sao_Paulo')) BETWEEN 9 AND 19
    )
    SELECT salon_id, client_id, email, array_agg(k ORDER BY k) AS keys,
      jsonb_agg(jsonb_build_object('service', service, 'remaining', remaining_uses, 'expires_at', expires_at) ORDER BY service) AS items
    FROM cand WHERE NOT EXISTS (SELECT 1 FROM client_email_outbox o WHERE o.kind = 'credits' AND o.client_id = cand.client_id AND o.payload -> 'keys' ? cand.k)
    GROUP BY salon_id, client_id, email
  LOOP
    IF public.client_email_enqueue(r.salon_id, 'credits', r.email, 'credits:' || md5(array_to_string(r.keys, ',')), NULL, r.client_id,
         jsonb_build_object('keys', to_jsonb(r.keys), 'items', r.items)) THEN v_n := v_n + 1; END IF;
  END LOOP;

  -- Aniversário: no dia, a partir das 9 h no fuso do salão, uma vez por ano.
  FOR r IN
    SELECT c.id, c.salon_id, lower(btrim(c.email)) AS email, to_char(now() AT TIME ZONE coalesce(s.timezone, 'America/Sao_Paulo'), 'YYYY') AS y
    FROM clients c JOIN salons s ON s.id = c.salon_id
    WHERE c.birth_date IS NOT NULL AND nullif(btrim(c.email), '') IS NOT NULL AND NOT coalesce(c.marketing_opt_out, false) AND coalesce(s.is_active, true)
      AND to_char(c.birth_date, 'MM-DD') = to_char(now() AT TIME ZONE coalesce(s.timezone, 'America/Sao_Paulo'), 'MM-DD')
      AND extract(hour FROM now() AT TIME ZONE coalesce(s.timezone, 'America/Sao_Paulo')) BETWEEN 9 AND 19
  LOOP
    IF public.client_email_enqueue(r.salon_id, 'birthday', r.email, 'birthday:' || r.id::text || ':' || r.y, NULL, r.id) THEN v_n := v_n + 1; END IF;
  END LOOP;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.client_email_enqueue_scheduled() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_email_enqueue_scheduled() TO service_role;
SELECT cron.schedule('client-email-alerts', '*/15 * * * *', $c$SELECT public.client_email_enqueue_scheduled()$c$);

-- Entrega: confere se o aviso ainda vale (status/horário mudaram, já avaliou) antes de enviar.
CREATE OR REPLACE FUNCTION public.client_email_claim()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r client_email_outbox; a appointments; s salons; c clients; v_slot text; v_stale boolean := false;
BEGIN
  SELECT o.* INTO r FROM client_email_outbox o WHERE o.status = 'pending' AND o.next_attempt_at <= now()
    AND (o.lease_until IS NULL OR o.lease_until < now()) ORDER BY o.next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF r.id IS NULL THEN RETURN NULL; END IF;
  UPDATE client_email_outbox SET claim_token = gen_random_uuid(), lease_until = now() + interval '2 minutes', attempts = attempts + 1
   WHERE id = r.id RETURNING * INTO r;
  IF r.appointment_id IS NOT NULL THEN
    SELECT * INTO a FROM appointments WHERE id = r.appointment_id;
    v_slot := a.id::text || ':' || a.date::text || ':' || to_char(a.start_time, 'HH24:MI');
    v_stale := CASE r.kind
      WHEN 'confirmed' THEN a.status::text <> 'confirmed'
      WHEN 'reminder' THEN a.status::text <> 'confirmed' OR r.dedupe_key <> 'reminder:' || v_slot
      WHEN 'cancelled' THEN a.status::text <> 'cancelled'
      WHEN 'rescheduled' THEN a.status::text NOT IN ('pending', 'confirmed') OR r.dedupe_key <> 'rescheduled:' || v_slot
      WHEN 'review' THEN a.status::text <> 'completed' OR EXISTS (SELECT 1 FROM reviews WHERE appointment_id = a.id)
      ELSE false END;
  END IF;
  IF v_stale THEN
    UPDATE client_email_outbox SET status = 'failed', error_code = 'stale', lease_until = NULL WHERE id = r.id;
    RETURN jsonb_build_object('skip', true);
  END IF;
  SELECT * INTO s FROM salons WHERE id = r.salon_id;
  SELECT * INTO c FROM clients WHERE id = coalesce(r.client_id, a.client_id);
  RETURN jsonb_build_object('id', r.id, 'claim', r.claim_token, 'to', r.to_email, 'kind', r.kind, 'salon_id', r.salon_id, 'payload', r.payload,
    'client_name', coalesce(a.client_name, c.name, r.payload ->> 'client_name'), 'date', a.date, 'start', to_char(a.start_time, 'HH24:MI'),
    'final_price', coalesce(a.final_price, a.price), 'credit', a.credit_id IS NOT NULL,
    'service', (SELECT name FROM services WHERE id = a.service_id), 'professional', (SELECT name FROM professionals WHERE id = a.professional_id),
    'salon', jsonb_build_object('name', s.name, 'slug', s.slug, 'logo_url', s.logo_url, 'primary_color', s.primary_color,
      'pwa_icon_url', s.pwa_icon_url, 'email', s.email, 'address', s.address, 'city', s.city, 'phone', coalesce(s.whatsapp, s.phone)));
END $$;
REVOKE ALL ON FUNCTION public.client_email_claim() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_email_claim() TO service_role;

-- Nascimento informado no link do salão (vai em notes como "Aniversário: DD/MM/AAAA") passa a valer no cadastro.
CREATE OR REPLACE FUNCTION public.appointments_client_birthday()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_txt text := substring(coalesce(NEW.notes, '') FROM 'Aniversário: (\d{2}/\d{2}/\d{4})'); v_date date;
BEGIN
  IF v_txt IS NULL OR NEW.client_id IS NULL THEN RETURN NEW; END IF;
  v_date := to_date(v_txt, 'DD/MM/YYYY');
  IF to_char(v_date, 'DD/MM/YYYY') = v_txt AND v_date BETWEEN date '1900-01-01' AND current_date THEN
    UPDATE clients SET birth_date = v_date WHERE id = NEW.client_id AND salon_id = NEW.salon_id AND birth_date IS NULL;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS appointments_client_birthday ON public.appointments;
CREATE TRIGGER appointments_client_birthday AFTER INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.appointments_client_birthday();

COMMIT;

-- Rollback: SELECT cron.unschedule('client-email-alerts'); DROP TRIGGER appointments_email_events / payment_charges_email_receipt /
-- package_orders_email_paid / appointments_client_birthday; reaplicar client_email_claim e appointments_email_confirmed de 20261113000400.
