-- ============================================================================
-- Agenda Fácil 365 — IA central da plataforma (super admin).
-- Chave da IA fica só no servidor (schema privado, sem acesso de anon/authenticated).
-- Config/limites são escritos apenas pela Edge Function ai-admin (service role).
-- Aditiva e idempotente. Não apaga dados nem colunas. Rollback no fim.
-- ============================================================================
BEGIN;

CREATE SCHEMA IF NOT EXISTS ai_private;
REVOKE ALL ON SCHEMA ai_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ai_private TO service_role;

-- Uma chave por provedor (trocar de provedor e voltar não perde a chave).
CREATE TABLE IF NOT EXISTS ai_private.platform_keys(
  provider text PRIMARY KEY CHECK (provider IN ('gemini','openai','groq','openrouter')),
  api_key text NOT NULL CHECK (length(api_key) BETWEEN 8 AND 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ai_private.platform_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON ai_private.platform_keys TO service_role;

-- Linha única. Ausência da linha = modo legado (chaves antigas/segredos de ambiente, sem limites).
CREATE TABLE IF NOT EXISTS public.ai_platform_config(
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  provider text NOT NULL DEFAULT 'gemini' CHECK (provider IN ('gemini','openai','groq','openrouter')),
  model text NOT NULL DEFAULT 'gemini-2.5-flash' CHECK (length(model) BETWEEN 1 AND 120),
  temperature numeric NOT NULL DEFAULT 0.5 CHECK (temperature BETWEEN 0 AND 1),
  max_tokens integer NOT NULL DEFAULT 500 CHECK (max_tokens BETWEEN 50 AND 4000),
  base_prompt text NOT NULL DEFAULT '' CHECK (length(base_prompt) <= 4000),
  tone text NOT NULL DEFAULT '' CHECK (length(tone) <= 500),
  rules text NOT NULL DEFAULT '' CHECK (length(rules) <= 4000),
  knowledge text NOT NULL DEFAULT '' CHECK (length(knowledge) <= 8000),
  examples jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(examples) = 'array' AND jsonb_array_length(examples) <= 20),
  monthly_budget_usd numeric CHECK (monthly_budget_usd IS NULL OR monthly_budget_usd >= 0),
  usd_brl numeric NOT NULL DEFAULT 5.5 CHECK (usd_brl > 0),
  default_salon_monthly_requests integer CHECK (default_salon_monthly_requests IS NULL OR default_salon_monthly_requests >= 0),
  default_salon_monthly_tokens bigint CHECK (default_salon_monthly_tokens IS NULL OR default_salon_monthly_tokens >= 0),
  on_limit text NOT NULL DEFAULT 'fallback' CHECK (on_limit IN ('fallback','handoff')),
  fallback_message text NOT NULL DEFAULT 'Vou pedir para a equipe do salão responder você em instantes.' CHECK (length(fallback_message) BETWEEN 1 AND 500),
  price_in_per_mtok numeric CHECK (price_in_per_mtok IS NULL OR price_in_per_mtok >= 0),
  price_out_per_mtok numeric CHECK (price_out_per_mtok IS NULL OR price_out_per_mtok >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Exceções por salão (sem linha = padrão da plataforma).
CREATE TABLE IF NOT EXISTS public.ai_salon_limits(
  salon_id uuid PRIMARY KEY REFERENCES public.salons(id) ON DELETE CASCADE,
  monthly_requests integer CHECK (monthly_requests IS NULL OR monthly_requests >= 0),
  monthly_tokens bigint CHECK (monthly_tokens IS NULL OR monthly_tokens >= 0),
  blocked boolean NOT NULL DEFAULT false,
  note text CHECK (note IS NULL OR length(note) <= 300),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_usage(
  id bigserial PRIMARY KEY,
  salon_id uuid REFERENCES public.salons(id) ON DELETE SET NULL,
  feature text NOT NULL CHECK (feature IN ('chatbot','texto','legenda','insights','teste','simulacao')),
  provider text NOT NULL,
  model text NOT NULL,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('ok','error','blocked')),
  error_code text,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON public.ai_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_salon_created ON public.ai_usage(salon_id, created_at);

ALTER TABLE public.ai_platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_salon_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_platform_config, public.ai_salon_limits, public.ai_usage FROM anon, authenticated;
GRANT SELECT ON public.ai_platform_config, public.ai_salon_limits, public.ai_usage TO authenticated;
GRANT ALL ON public.ai_platform_config, public.ai_salon_limits, public.ai_usage TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ai_usage_id_seq TO service_role;
DROP POLICY IF EXISTS "Super admin reads ai config" ON public.ai_platform_config;
CREATE POLICY "Super admin reads ai config" ON public.ai_platform_config FOR SELECT TO authenticated USING (public.is_super_admin());
DROP POLICY IF EXISTS "Super admin reads ai limits" ON public.ai_salon_limits;
CREATE POLICY "Super admin reads ai limits" ON public.ai_salon_limits FOR SELECT TO authenticated USING (public.is_super_admin());
DROP POLICY IF EXISTS "Super admin reads ai usage" ON public.ai_usage;
CREATE POLICY "Super admin reads ai usage" ON public.ai_usage FOR SELECT TO authenticated USING (public.is_super_admin());
-- Dono do salão não lê linhas cruas: só o agregado via get_my_ai_usage().

-- Início do mês no fuso do Brasil (cotas e orçamento são mensais).
CREATE OR REPLACE FUNCTION public.ai_month_start() RETURNS timestamptz LANGUAGE sql STABLE
AS $$ SELECT date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo' $$;

-- Chave: só service role (Edge Functions). Nunca exposta ao navegador.
CREATE OR REPLACE FUNCTION public.ai_platform_secret(p_provider text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, ai_private
AS $$ SELECT api_key FROM ai_private.platform_keys WHERE provider = p_provider $$;
CREATE OR REPLACE FUNCTION public.ai_save_platform_secret(p_provider text, p_api_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, ai_private
AS $$ BEGIN
  INSERT INTO ai_private.platform_keys(provider, api_key) VALUES (p_provider, p_api_key)
  ON CONFLICT (provider) DO UPDATE SET api_key = EXCLUDED.api_key, updated_at = now();
END $$;
-- Só os 4 últimos caracteres, para o painel.
CREATE OR REPLACE FUNCTION public.ai_platform_key_hints()
RETURNS TABLE(provider text, last4 text, updated_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, ai_private
AS $$ SELECT provider, right(api_key, 4), updated_at FROM ai_private.platform_keys $$;

-- Estado de cota do mês: uso do salão, custo global e limite efetivo da exceção.
CREATE OR REPLACE FUNCTION public.ai_quota_state(p_salon_id uuid)
RETURNS TABLE(salon_requests bigint, salon_tokens bigint, month_cost_usd numeric, limit_requests integer, limit_tokens bigint, blocked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM ai_usage u WHERE u.salon_id = p_salon_id AND u.created_at >= ai_month_start() AND u.status <> 'blocked'),
    (SELECT coalesce(sum(u.tokens_in + u.tokens_out), 0) FROM ai_usage u WHERE u.salon_id = p_salon_id AND u.created_at >= ai_month_start()),
    (SELECT coalesce(sum(u.cost_usd), 0) FROM ai_usage u WHERE u.created_at >= ai_month_start()),
    l.monthly_requests, l.monthly_tokens, coalesce(l.blocked, false)
  FROM (SELECT 1) one LEFT JOIN ai_salon_limits l ON l.salon_id = p_salon_id
$$;

-- Painel do super admin (chamado pela ai-admin após validar super admin).
CREATE OR REPLACE FUNCTION public.ai_usage_summary(p_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH m AS (SELECT * FROM ai_usage WHERE created_at >= ai_month_start()),
  d AS (SELECT * FROM ai_usage WHERE created_at >= now() - make_interval(days => least(greatest(p_days, 1), 90)))
  SELECT jsonb_build_object(
    'month', (SELECT jsonb_build_object('requests', count(*) FILTER (WHERE status <> 'blocked'), 'tokens', coalesce(sum(tokens_in + tokens_out), 0),
      'cost_usd', coalesce(sum(cost_usd), 0), 'errors', count(*) FILTER (WHERE status = 'error'), 'blocked', count(*) FILTER (WHERE status = 'blocked')) FROM m),
    'by_day', coalesce((SELECT jsonb_agg(x ORDER BY x.day) FROM (
      SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, count(*) FILTER (WHERE status <> 'blocked') AS requests,
        sum(cost_usd) AS cost_usd, count(*) FILTER (WHERE status = 'error') AS errors FROM d GROUP BY 1) x), '[]'::jsonb),
    'by_feature', coalesce((SELECT jsonb_agg(x ORDER BY x.cost_usd DESC) FROM (
      SELECT feature, count(*) FILTER (WHERE status <> 'blocked') AS requests, sum(tokens_in + tokens_out) AS tokens, sum(cost_usd) AS cost_usd FROM m GROUP BY 1) x), '[]'::jsonb),
    'by_salon', coalesce((SELECT jsonb_agg(x ORDER BY x.cost_usd DESC) FROM (
      SELECT m.salon_id, s.name, count(*) FILTER (WHERE m.status <> 'blocked') AS requests, sum(m.tokens_in + m.tokens_out) AS tokens,
        sum(m.cost_usd) AS cost_usd, count(*) FILTER (WHERE m.status = 'error') AS errors, count(*) FILTER (WHERE m.status = 'blocked') AS blocked
      FROM m JOIN salons s ON s.id = m.salon_id GROUP BY 1, 2 ORDER BY sum(m.cost_usd) DESC LIMIT 50) x), '[]'::jsonb),
    'last_24h', (SELECT jsonb_build_object('requests', count(*) FILTER (WHERE status <> 'blocked'), 'errors', count(*) FILTER (WHERE status = 'error'))
      FROM ai_usage WHERE created_at >= now() - interval '24 hours'),
    'last_error', (SELECT jsonb_build_object('created_at', created_at, 'feature', feature, 'provider', provider, 'model', model, 'error_code', error_code)
      FROM ai_usage WHERE status = 'error' ORDER BY created_at DESC LIMIT 1)
  )
$$;

-- Dono do salão: só agregado do mês dos próprios salões (sem custo da plataforma).
CREATE OR REPLACE FUNCTION public.get_my_ai_usage()
RETURNS TABLE(salon_id uuid, requests bigint, tokens bigint, limit_requests integer, limit_tokens bigint, blocked boolean, by_feature jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id,
    (SELECT count(*) FROM ai_usage u WHERE u.salon_id = s.id AND u.created_at >= ai_month_start() AND u.status <> 'blocked'),
    (SELECT coalesce(sum(u.tokens_in + u.tokens_out), 0) FROM ai_usage u WHERE u.salon_id = s.id AND u.created_at >= ai_month_start()),
    coalesce(l.monthly_requests, c.default_salon_monthly_requests),
    coalesce(l.monthly_tokens, c.default_salon_monthly_tokens),
    coalesce(l.blocked, false),
    coalesce((SELECT jsonb_object_agg(f.feature, f.n) FROM (SELECT u.feature, count(*) AS n FROM ai_usage u
      WHERE u.salon_id = s.id AND u.created_at >= ai_month_start() AND u.status <> 'blocked' GROUP BY 1) f), '{}'::jsonb)
  FROM salons s
  LEFT JOIN ai_salon_limits l ON l.salon_id = s.id
  LEFT JOIN ai_platform_config c ON true
  WHERE s.owner_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.ai_platform_secret(text), public.ai_save_platform_secret(text, text), public.ai_platform_key_hints(),
  public.ai_quota_state(uuid), public.ai_usage_summary(integer), public.get_my_ai_usage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_platform_secret(text), public.ai_save_platform_secret(text, text), public.ai_platform_key_hints(),
  public.ai_quota_state(uuid), public.ai_usage_summary(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_ai_usage() TO authenticated;

-- Chaves legadas fora do navegador: só Edge Functions (service role) leem.
-- ai_provider_keys (5 linhas) e salon_ai_configs (0 linhas) não são mais lidas pelo frontend.
-- Dados preservados; a policy por e-mail continua, mas sem GRANT o navegador não lê nem do super admin.
REVOKE ALL ON public.ai_provider_keys FROM anon, authenticated;
REVOKE ALL ON public.salon_ai_configs FROM anon, authenticated;

-- chatbot_settings.api_key: já esvaziada por 20261009001000 (chave foi para whatsapp_private.chatbot_secrets,
-- trigger bloqueia nova escrita). Defensivo: copia o que restar e só então zera. Não há perda de dado.
-- Não revogamos SELECT por coluna: a tela do chatbot usa select('*') e quebraria.
INSERT INTO whatsapp_private.chatbot_secrets(salon_id, api_key)
SELECT salon_id, api_key FROM public.chatbot_settings
WHERE api_key IS NOT NULL AND length(api_key) BETWEEN 1 AND 500
ON CONFLICT (salon_id) DO NOTHING;
UPDATE public.chatbot_settings c SET api_key = NULL
WHERE c.api_key IS NOT NULL AND EXISTS (SELECT 1 FROM whatsapp_private.chatbot_secrets s WHERE s.salon_id = c.salon_id);

COMMIT;

-- Rollback (manual):
-- BEGIN;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_provider_keys, public.salon_ai_configs TO authenticated;
-- DROP FUNCTION IF EXISTS public.get_my_ai_usage(), public.ai_usage_summary(integer), public.ai_quota_state(uuid),
--   public.ai_platform_key_hints(), public.ai_save_platform_secret(text, text), public.ai_platform_secret(text), public.ai_month_start();
-- DROP TABLE IF EXISTS public.ai_usage, public.ai_salon_limits, public.ai_platform_config;
-- DROP TABLE IF EXISTS ai_private.platform_keys; DROP SCHEMA IF EXISTS ai_private;
-- COMMIT;
