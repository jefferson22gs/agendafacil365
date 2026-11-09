-- Reserva pelo WhatsApp falhava sempre: o trigger set_appointment_cancellation_token chama generate_cancellation_token(),
-- que usa gen_random_bytes() sem esquema. pgcrypto está em "extensions"; funções SECURITY DEFINER com
-- search_path=public (whatsapp_book_appointment_v2) não a encontram ("function gen_random_bytes(integer) does not exist").
-- Correção: qualificar o esquema e fixar search_path. Mesmo comportamento, mesmo formato do token (64 hex).
BEGIN;

CREATE OR REPLACE FUNCTION public.generate_cancellation_token()
RETURNS text LANGUAGE plpgsql SET search_path = public, extensions
AS $$
BEGIN
  RETURN encode(extensions.gen_random_bytes(32), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_google_oauth_url(p_salon_id uuid)
RETURNS text LANGUAGE plpgsql SET search_path = public, extensions
AS $$
DECLARE
  v_client_id TEXT;
  v_redirect_uri TEXT;
  v_scope TEXT;
  v_state TEXT;
BEGIN
  v_client_id := current_setting('app.google_client_id', true);
  v_redirect_uri := current_setting('app.base_url', true) || '/api/google-calendar/callback';
  v_scope := 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events';
  v_state := encode(extensions.gen_random_bytes(32), 'hex') || ':' || p_salon_id::TEXT;
  RETURN 'https://accounts.google.com/o/oauth2/v2/auth' ||
         '?client_id=' || v_client_id || '&redirect_uri=' || v_redirect_uri || '&response_type=code' ||
         '&scope=' || v_scope || '&access_type=offline' || '&prompt=consent' || '&state=' || v_state;
END;
$$;

COMMIT;

-- Rollback: reaplicar as definições anteriores (gen_random_bytes sem esquema, sem SET search_path).
