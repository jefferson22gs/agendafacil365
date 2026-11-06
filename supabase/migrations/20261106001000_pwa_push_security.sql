-- ============================================================================
-- Agenda Fácil 365 — PWA por salão + push seguro (NÃO aplicado; revisar antes)
--
-- 1) push_subscriptions: removidas as policies "true" (qualquer visitante lia/alterava/apagava tokens de
--    todos os salões). Escrita agora só por RPC SECURITY DEFINER com validação; dono lê só o próprio salão
--    (sem a coluna fcm_token); super admin lê tudo. Nenhuma linha é apagada ou alterada.
-- 2) Novo agendamento: trigger grava em push_outbox (fila durável) e o worker send-push-notification,
--    chamado pelo cron com chave do Vault, envia aos dispositivos do DONO. O cliente anônimo não dispara push.
-- ============================================================================

BEGIN;

-- ---------- push_subscriptions: RLS ----------
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert push subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_delete_policy ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_insert_policy ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_select_policy ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_update_policy ON public.push_subscriptions;
DROP POLICY IF EXISTS "Salon owners can view subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_owner_select ON public.push_subscriptions;
DROP POLICY IF EXISTS push_subscriptions_super_admin_select ON public.push_subscriptions;

CREATE POLICY push_subscriptions_owner_select ON public.push_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.salons s WHERE s.id = push_subscriptions.salon_id AND s.owner_id = auth.uid()));
CREATE POLICY push_subscriptions_super_admin_select ON public.push_subscriptions FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Privilégio por coluna: o painel conta dispositivos sem nunca receber o token FCM.
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
GRANT SELECT (id, salon_id, client_id, user_id, is_active, device_info, created_at, updated_at) ON public.push_subscriptions TO authenticated;

-- Um token por salão. Só cria o índice se não houver duplicata (nenhuma linha é apagada); as RPCs usam lock.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE fcm_token IS NOT NULL GROUP BY salon_id, fcm_token HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_salon_token_key ON public.push_subscriptions (salon_id, fcm_token) WHERE fcm_token IS NOT NULL;
  ELSE
    RAISE NOTICE 'push_subscriptions: duplicatas (salon_id, fcm_token) existentes; índice único não criado';
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_owner ON public.push_subscriptions (salon_id, user_id) WHERE is_active;

-- Funções antigas retornavam endpoints/chaves; sem uso no app. Só servidor.
DO $$
BEGIN
  IF to_regprocedure('public.get_user_push_subscriptions(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_user_push_subscriptions(uuid) FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('public.get_salon_push_subscriptions(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_salon_push_subscriptions(uuid) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- ---------- RPCs públicas (visitante e dono) ----------
CREATE OR REPLACE FUNCTION public.push_salon_for_slug(p_salon_slug text)
RETURNS public.salons LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.* FROM public.salons s
   WHERE s.slug = p_salon_slug AND coalesce(s.is_active, true)
     AND (coalesce(s.pwa_enabled, true) OR s.owner_id = auth.uid())
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.push_salon_for_slug(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.register_push_subscription(p_salon_slug text, p_fcm_token text, p_device jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_salon public.salons;
  v_uid uuid := auth.uid();
  v_client uuid;
  v_device jsonb := '{}'::jsonb;
  v_id uuid;
BEGIN
  IF p_salon_slug IS NULL OR p_salon_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$' THEN
    RAISE EXCEPTION 'invalid_salon' USING ERRCODE = '22023';
  END IF;
  -- Tamanho à parte: o regex do Postgres limita repetição a {0,255}.
  IF p_fcm_token IS NULL OR length(p_fcm_token) NOT BETWEEN 20 AND 4096 OR p_fcm_token !~ '^[A-Za-z0-9_:.\-]+$' THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = '22023';
  END IF;
  v_salon := public.push_salon_for_slug(p_salon_slug);
  IF v_salon.id IS NULL THEN RAISE EXCEPTION 'salon_unavailable' USING ERRCODE = 'P0002'; END IF;

  -- Só campos pequenos e conhecidos do aparelho.
  IF jsonb_typeof(p_device) = 'object' THEN
    SELECT coalesce(jsonb_object_agg(k, left(p_device ->> k, 200)), '{}'::jsonb) INTO v_device
      FROM unnest(ARRAY['platform', 'standalone', 'userAgent', 'source']) k WHERE p_device ? k;
  END IF;
  -- Vínculo com cliente só pela conta autenticada (nunca por id enviado pelo navegador).
  IF v_uid IS NOT NULL THEN
    SELECT c.id INTO v_client FROM public.clients c WHERE c.salon_id = v_salon.id AND c.user_id = v_uid LIMIT 1;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_salon.id::text || ':' || p_fcm_token, 0));
  UPDATE public.push_subscriptions
     SET is_active = true, updated_at = now(), device_info = v_device,
         user_id = coalesce(v_uid, user_id), client_id = coalesce(v_client, client_id)
   WHERE salon_id = v_salon.id AND fcm_token = p_fcm_token
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    INSERT INTO public.push_subscriptions (salon_id, user_id, client_id, endpoint, fcm_token, device_info, is_active)
    VALUES (v_salon.id, v_uid, v_client, 'fcm:' || v_salon.id || ':' || md5(p_fcm_token), p_fcm_token, v_device, true)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.unregister_push_subscription(p_salon_slug text, p_fcm_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_fcm_token IS NULL OR length(p_fcm_token) NOT BETWEEN 20 AND 4096 THEN RETURN false; END IF;
  UPDATE public.push_subscriptions ps SET is_active = false, updated_at = now()
    FROM public.salons s
   WHERE s.id = ps.salon_id AND s.slug = p_salon_slug AND ps.fcm_token = p_fcm_token AND ps.is_active;
  RETURN FOUND;
END $$;

-- Só responde sobre o token que o próprio aparelho apresenta.
CREATE OR REPLACE FUNCTION public.push_subscription_status(p_salon_slug text, p_fcm_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.push_subscriptions ps JOIN public.salons s ON s.id = ps.salon_id
                  WHERE s.slug = p_salon_slug AND ps.fcm_token = p_fcm_token AND ps.is_active
                    AND length(p_fcm_token) BETWEEN 20 AND 4096)
$$;

REVOKE ALL ON FUNCTION public.register_push_subscription(text, text, jsonb), public.unregister_push_subscription(text, text),
  public.push_subscription_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, text, jsonb), public.unregister_push_subscription(text, text),
  public.push_subscription_status(text, text) TO anon, authenticated;

-- ---------- Novo agendamento → push para o dono (fila durável) ----------
CREATE TABLE IF NOT EXISTS public.push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'new_appointment',
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL DEFAULT '/admin/appointments',
  dedupe_key text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'expired')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_push_outbox_pending ON public.push_outbox (created_at) WHERE status IN ('pending', 'processing');
ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY; -- sem policies: só service_role
REVOKE ALL ON public.push_outbox FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.push_enqueue_new_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.push_outbox (salon_id, kind, title, body, url, dedupe_key)
  VALUES (NEW.salon_id, 'new_appointment', 'Novo agendamento',
          left(coalesce(nullif(trim(NEW.client_name), ''), 'Cliente') || ' agendou para ' ||
               to_char(NEW.date, 'DD/MM') || ' às ' || left(NEW.start_time::text, 5), 300),
          '/admin/appointments', 'appointment:' || NEW.id)
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- push nunca impede o agendamento
END $$;
REVOKE ALL ON FUNCTION public.push_enqueue_new_appointment() FROM PUBLIC, anon, authenticated;

-- Trigger antigo chamava send-push-notification (só simulava) via net.http_post com settings inexistentes.
DROP TRIGGER IF EXISTS trigger_notify_new_appointment ON public.appointments;
DROP TRIGGER IF EXISTS push_enqueue_new_appointment ON public.appointments;
CREATE TRIGGER push_enqueue_new_appointment AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.push_enqueue_new_appointment();

-- Worker: reserva itens (SKIP LOCKED); itens com mais de 24 h expiram em vez de chegar atrasados.
CREATE OR REPLACE FUNCTION public.push_claim_outbox(p_limit integer DEFAULT 25)
RETURNS SETOF public.push_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.push_outbox SET status = 'expired' WHERE status IN ('pending', 'processing') AND created_at < now() - interval '24 hours';
  RETURN QUERY
  UPDATE public.push_outbox o SET status = 'processing', locked_at = now(), attempts = o.attempts + 1
   WHERE o.id IN (SELECT id FROM public.push_outbox
                   WHERE (status = 'pending' OR (status = 'processing' AND locked_at < now() - interval '5 minutes'))
                     AND attempts < 5
                   ORDER BY created_at LIMIT least(greatest(p_limit, 1), 100) FOR UPDATE SKIP LOCKED)
  RETURNING o.*;
END $$;
REVOKE ALL ON FUNCTION public.push_claim_outbox(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_claim_outbox(integer) TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'push-outbox-worker';
  PERFORM cron.schedule('push-outbox-worker', '* * * * *', $c$SELECT public.invoke_edge_function('send-push-notification')$c$);
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK (executar só se necessário; restaura as policies antigas, inclusive as inseguras):
-- BEGIN;
-- DO $$ BEGIN PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'push-outbox-worker'; END $$;
-- DROP TRIGGER IF EXISTS push_enqueue_new_appointment ON public.appointments;
-- DROP FUNCTION IF EXISTS public.push_enqueue_new_appointment(), public.push_claim_outbox(integer),
--   public.register_push_subscription(text, text, jsonb), public.unregister_push_subscription(text, text),
--   public.push_subscription_status(text, text), public.push_salon_for_slug(text);
-- DROP TABLE IF EXISTS public.push_outbox;
-- DROP INDEX IF EXISTS public.push_subscriptions_salon_token_key, public.idx_push_subscriptions_owner;
-- DROP POLICY IF EXISTS push_subscriptions_owner_select ON public.push_subscriptions;
-- DROP POLICY IF EXISTS push_subscriptions_super_admin_select ON public.push_subscriptions;
-- GRANT ALL ON public.push_subscriptions TO anon, authenticated;
-- CREATE POLICY "Salon owners can view subscriptions" ON public.push_subscriptions FOR SELECT
--   USING (EXISTS (SELECT 1 FROM salons WHERE salons.id = push_subscriptions.salon_id AND salons.owner_id = auth.uid()));
-- CREATE POLICY "Users can manage own subscriptions" ON public.push_subscriptions FOR ALL
--   USING (user_id = auth.uid() OR client_id IN (SELECT clients.id FROM clients WHERE clients.user_id = auth.uid()));
-- CREATE POLICY "Anyone can insert push subscription" ON public.push_subscriptions FOR INSERT WITH CHECK (true);
-- CREATE POLICY push_subscriptions_select_policy ON public.push_subscriptions FOR SELECT USING (true);
-- CREATE POLICY push_subscriptions_insert_policy ON public.push_subscriptions FOR INSERT WITH CHECK (true);
-- CREATE POLICY push_subscriptions_update_policy ON public.push_subscriptions FOR UPDATE USING (true) WITH CHECK (true);
-- CREATE POLICY push_subscriptions_delete_policy ON public.push_subscriptions FOR DELETE USING (true);
-- GRANT EXECUTE ON FUNCTION public.get_user_push_subscriptions(uuid), public.get_salon_push_subscriptions(uuid) TO anon, authenticated;
-- COMMIT;
-- ============================================================================
