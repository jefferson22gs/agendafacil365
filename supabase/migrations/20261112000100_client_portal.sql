-- Área do cliente no app do salão (/s/:slug/meus-agendamentos): próximos horários, histórico e retornos.
-- Acesso por link pessoal enviado no WhatsApp (o cliente pediu pelo próprio número = posse do telefone comprovada).
-- O token só existe no link; o banco guarda o SHA-256. Telefone sozinho nunca abre o histórico.
BEGIN;

-- Chave de comparação de telefone: só dígitos, sem DDI 55 e sem zero inicial ("+55 11 96162-6897" = "11961626897").
CREATE OR REPLACE FUNCTION public.portal_phone_key(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN length(d) IN (12, 13) AND d LIKE '55%' THEN substr(d, 3) ELSE d END
  FROM (SELECT ltrim(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '0') AS d) x;
$$;

CREATE TABLE IF NOT EXISTS public.client_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  phone_key text NOT NULL CHECK (phone_key ~ '^[1-9][0-9]{7,13}$'),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '180 days',
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS client_portal_sessions_owner ON public.client_portal_sessions (salon_id, phone_key, created_at DESC);
-- Sem políticas: só as funções abaixo (SECURITY DEFINER) leem ou gravam.
ALTER TABLE public.client_portal_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_portal_sessions FROM anon, authenticated;

-- Emite um link pessoal (chamado só pelo servidor do WhatsApp). Mantém no máximo 10 acessos por cliente.
CREATE OR REPLACE FUNCTION public.client_portal_issue(p_salon_id uuid, p_phone text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_key text := public.portal_phone_key(p_phone); v_token text;
BEGIN
  IF v_key !~ '^[1-9][0-9]{7,13}$' THEN RAISE EXCEPTION 'invalid_phone'; END IF;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO client_portal_sessions(salon_id, phone_key, token_hash) VALUES (p_salon_id, v_key, encode(extensions.digest(v_token, 'sha256'), 'hex'));
  DELETE FROM client_portal_sessions WHERE id IN (
    SELECT id FROM client_portal_sessions WHERE salon_id = p_salon_id AND phone_key = v_key ORDER BY created_at DESC OFFSET 10);
  RETURN v_token;
END $$;
REVOKE ALL ON FUNCTION public.client_portal_issue(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_portal_issue(uuid, text) TO service_role;

-- Sessão válida do token (ou nada). Uso interno.
CREATE OR REPLACE FUNCTION public.client_portal_session(p_token text)
RETURNS client_portal_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE s client_portal_sessions;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{48}$' THEN RETURN NULL; END IF;
  SELECT * INTO s FROM client_portal_sessions WHERE token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') AND expires_at > now();
  RETURN s;
END $$;
REVOKE ALL ON FUNCTION public.client_portal_session(text) FROM PUBLIC, anon, authenticated;

-- Agendamentos do cliente neste salão: pelo telefone do agendamento ou pelo cadastro do cliente. Uso interno.
CREATE OR REPLACE FUNCTION public.client_portal_appts(p_salon uuid, p_key text)
RETURNS SETOF appointments LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.* FROM appointments a
  WHERE a.salon_id = p_salon AND (public.portal_phone_key(a.client_phone) = p_key OR a.client_id IN (
    SELECT c.id FROM clients c WHERE c.salon_id = p_salon AND public.portal_phone_key(coalesce(c.phone_normalized, c.phone)) = p_key));
$$;
REVOKE ALL ON FUNCTION public.client_portal_appts(uuid, text) FROM PUBLIC, anon, authenticated;

-- Tudo que a tela mostra, só deste salão e deste telefone.
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
             -- Remarcar/cancelar pelo link só com mais de 24 h (mesma regra de can_modify_appointment).
             CASE WHEN (a.date + a.start_time) - v_now > interval '24 hours' THEN a.cancellation_token END AS manage_token
      FROM public.client_portal_appts(s.salon_id, s.phone_key) a LEFT JOIN services sv ON sv.id = a.service_id LEFT JOIN professionals p ON p.id = a.professional_id
      WHERE a.status::text IN ('pending', 'confirmed') AND (a.date + coalesce(a.end_time, a.start_time)) >= v_now
      ORDER BY a.date, a.start_time LIMIT 10) u), '[]'::jsonb),
    'history', coalesce((SELECT jsonb_agg(row_to_json(h) ORDER BY h.date DESC, h.start_time DESC) FROM (
      SELECT a.id, a.date, to_char(a.start_time, 'HH24:MI') AS start_time,
             CASE WHEN a.status::text IN ('pending', 'confirmed') THEN 'past' ELSE a.status::text END AS status,
             sv.name AS service, p.name AS professional, coalesce(a.final_price, a.price) AS price
      FROM public.client_portal_appts(s.salon_id, s.phone_key) a LEFT JOIN services sv ON sv.id = a.service_id LEFT JOIN professionals p ON p.id = a.professional_id
      WHERE NOT (a.status::text IN ('pending', 'confirmed') AND (a.date + coalesce(a.end_time, a.start_time)) >= v_now)
      ORDER BY a.date DESC, a.start_time DESC LIMIT 50) h), '[]'::jsonb),
    'returns', coalesce((SELECT jsonb_agg(row_to_json(r) ORDER BY r.alert_date) FROM (
      SELECT procedure_name, alert_date FROM procedure_return_alerts
      WHERE salon_id = s.salon_id AND public.portal_phone_key(client_phone) = s.phone_key AND status IN ('pending', 'notified')
      ORDER BY alert_date LIMIT 3) r), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.client_portal_overview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_overview(text) TO anon, authenticated;

-- "Sair": invalida o link neste aparelho.
CREATE OR REPLACE FUNCTION public.client_portal_logout(p_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s client_portal_sessions;
BEGIN
  s := public.client_portal_session(p_token);
  IF s.id IS NOT NULL THEN DELETE FROM client_portal_sessions WHERE id = s.id; END IF;
END $$;
REVOKE ALL ON FUNCTION public.client_portal_logout(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_portal_logout(text) TO anon, authenticated;

COMMIT;
