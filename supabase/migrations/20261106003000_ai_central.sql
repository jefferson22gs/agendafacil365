-- ============================================================================
-- Agenda Fácil 365 — IA central da plataforma (super admin). Provedor único: Google Gemini.
-- Chave só no servidor (schema privado, sem acesso de anon/authenticated).
-- Config/limites escritos apenas pela Edge Function ai-admin (service role).
-- Cada chamada paga: ai_reserve (atômica, sob trava) -> provedor -> ai_settle.
-- Aditiva e idempotente. Não apaga dados nem colunas existentes. Rollback no fim.
-- Teste (ROLLBACK, sem rede): tests/rebrand/ai-reserve.sql
-- ============================================================================
BEGIN;

CREATE SCHEMA IF NOT EXISTS ai_private;
REVOKE ALL ON SCHEMA ai_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA ai_private TO service_role;

CREATE TABLE IF NOT EXISTS ai_private.platform_keys(
  provider text PRIMARY KEY CHECK (provider = 'gemini'),
  api_key text NOT NULL CHECK (length(api_key) BETWEEN 8 AND 500),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON ai_private.platform_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON ai_private.platform_keys TO service_role;

-- Linha única. Ausência da linha = modo legado (chaves antigas/segredos de ambiente, sem limites).
CREATE TABLE IF NOT EXISTS public.ai_platform_config(
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  provider text NOT NULL DEFAULT 'gemini' CHECK (provider = 'gemini'),
  model_mode text NOT NULL DEFAULT 'auto' CHECK (model_mode IN ('auto','fixed')),
  model_family text NOT NULL DEFAULT 'flash' CHECK (model_family IN ('flash','pro')),
  model text NOT NULL DEFAULT 'gemini-3.6-flash' CHECK (length(model) BETWEEN 8 AND 120 AND model ~ '^gemini-[a-z0-9.-]+$'),
  thinking_level text NOT NULL DEFAULT 'LOW' CHECK (thinking_level IN ('LOW','MEDIUM','HIGH')),
  temperature numeric NOT NULL DEFAULT 0.5 CHECK (temperature BETWEEN 0 AND 1), -- só Gemini 2.x (3+ ignora)
  max_tokens integer NOT NULL DEFAULT 1024 CHECK (max_tokens BETWEEN 50 AND 8192), -- inclui tokens de raciocínio
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
  price_cache_per_mtok numeric CHECK (price_cache_per_mtok IS NULL OR price_cache_per_mtok >= 0),
  -- Cache da resolução automática (models.list, ~24h). Escrito só pelas Edge Functions.
  resolved_model text,
  resolved_family text,
  resolved_at timestamptz,
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

-- Uma linha por chamada paga (ou bloqueio). model = modelo efetivamente usado.
CREATE TABLE IF NOT EXISTS public.ai_usage(
  id bigserial PRIMARY KEY,
  salon_id uuid REFERENCES public.salons(id) ON DELETE SET NULL,
  feature text NOT NULL CHECK (feature IN ('chatbot','texto','legenda','insights','teste','simulacao')),
  provider text NOT NULL,
  model text NOT NULL,
  tokens_in integer NOT NULL DEFAULT 0,       -- inclui tokens em cache e prompt de ferramentas
  tokens_out integer NOT NULL DEFAULT 0,      -- inclui tokens de raciocínio (cobrados como saída)
  tokens_cached integer NOT NULL DEFAULT 0,   -- parte de tokens_in cobrada pelo preço de cache
  tokens_thoughts integer NOT NULL DEFAULT 0, -- parte de tokens_out que foi raciocínio
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  -- reserved = chamada em andamento (conta no orçamento pela estimativa até ser liquidada).
  status text NOT NULL CHECK (status IN ('reserved','ok','error','blocked')),
  billable boolean NOT NULL DEFAULT true, -- false: bloqueada ou recusada pelo provedor sem cobrança
  error_code text,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON public.ai_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_salon_created ON public.ai_usage(salon_id, created_at);

-- Respostas do chatbot, com e sem IA (contagem sem custo; não entra em ai_usage para não inflar gasto).
-- Uma linha por evento de entrada respondido; idempotente por evento (reprocessamento não duplica).
CREATE TABLE IF NOT EXISTS public.ai_reply_log(
  id bigserial PRIMARY KEY,
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  source_event_id uuid NOT NULL UNIQUE,
  with_ai boolean NOT NULL,
  kind text NOT NULL CHECK (length(kind) BETWEEN 1 AND 60), -- modelo Gemini, ou motivo determinístico (booking, out_of_hours...)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_reply_log_created ON public.ai_reply_log(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_reply_log_salon_created ON public.ai_reply_log(salon_id, created_at);
-- Automações (lembrete, aniversário, confirmação, PIX, campanhas) já ficam em whatsapp_outbox: o relatório conta de lá.
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_created ON public.whatsapp_outbox(created_at);

ALTER TABLE public.ai_platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_salon_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reply_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_platform_config, public.ai_salon_limits, public.ai_usage, public.ai_reply_log FROM anon, authenticated;
GRANT SELECT ON public.ai_platform_config, public.ai_salon_limits, public.ai_usage, public.ai_reply_log TO authenticated;
GRANT ALL ON public.ai_platform_config, public.ai_salon_limits, public.ai_usage, public.ai_reply_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ai_usage_id_seq, public.ai_reply_log_id_seq TO service_role;
DROP POLICY IF EXISTS "Super admin reads ai config" ON public.ai_platform_config;
CREATE POLICY "Super admin reads ai config" ON public.ai_platform_config FOR SELECT TO authenticated USING (public.is_super_admin());
DROP POLICY IF EXISTS "Super admin reads ai limits" ON public.ai_salon_limits;
CREATE POLICY "Super admin reads ai limits" ON public.ai_salon_limits FOR SELECT TO authenticated USING (public.is_super_admin());
DROP POLICY IF EXISTS "Super admin reads ai usage" ON public.ai_usage;
CREATE POLICY "Super admin reads ai usage" ON public.ai_usage FOR SELECT TO authenticated USING (public.is_super_admin());
DROP POLICY IF EXISTS "Super admin reads ai replies" ON public.ai_reply_log;
CREATE POLICY "Super admin reads ai replies" ON public.ai_reply_log FOR SELECT TO authenticated USING (public.is_super_admin());
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

-- Reserva atômica antes de CADA chamada paga (inclui turnos de ferramenta, teste e simulação).
-- Trava global serializa reservas: duas chamadas simultâneas não enxergam o mesmo saldo.
-- Custo/tokens reservados são ESTIMATIVA (entrada aproximada + saída máxima): o teto não é exato.
-- ponytail: soma do mês em ai_usage sob trava global; com volume alto, trocar por tabela de contadores mensais.
CREATE OR REPLACE FUNCTION public.ai_reserve(p_salon_id uuid, p_feature text, p_provider text, p_model text, p_tokens integer, p_cost numeric)
RETURNS TABLE(reservation_id bigint, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c ai_platform_config;
  l ai_salon_limits;
  v_month timestamptz := ai_month_start();
  v_reason text;
  v_cost numeric;
  v_req bigint;
  v_tok bigint;
  v_max_req bigint;
  v_max_tok bigint;
  v_id bigint;
BEGIN
  IF p_tokens IS NULL OR p_tokens < 1 OR p_tokens > 2000000 OR p_cost IS NULL OR p_cost < 0 OR p_cost > 100 THEN
    RAISE EXCEPTION 'invalid_reservation';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ai-usage-reserve', 0));
  SELECT * INTO c FROM ai_platform_config WHERE id;
  IF FOUND THEN -- sem linha = modo legado: só registra, sem limites
    -- Exceção limitada: teste/simulação do super admin funcionam com a IA desligada (ainda contam no orçamento).
    IF NOT c.enabled AND p_feature NOT IN ('teste', 'simulacao') THEN v_reason := 'disabled'; END IF;
    IF v_reason IS NULL AND c.monthly_budget_usd IS NOT NULL THEN
      SELECT coalesce(sum(u.cost_usd), 0) INTO v_cost FROM ai_usage u WHERE u.created_at >= v_month;
      IF v_cost + p_cost > c.monthly_budget_usd THEN v_reason := 'budget'; END IF;
    END IF;
    IF v_reason IS NULL AND p_salon_id IS NOT NULL THEN
      SELECT * INTO l FROM ai_salon_limits WHERE salon_id = p_salon_id;
      IF coalesce(l.blocked, false) THEN v_reason := 'salon_blocked'; END IF;
      v_max_req := coalesce(l.monthly_requests, c.default_salon_monthly_requests);
      v_max_tok := coalesce(l.monthly_tokens, c.default_salon_monthly_tokens);
      IF v_reason IS NULL AND (v_max_req IS NOT NULL OR v_max_tok IS NOT NULL) THEN
        SELECT count(*) FILTER (WHERE u.billable), coalesce(sum(u.tokens_in + u.tokens_out), 0) INTO v_req, v_tok
          FROM ai_usage u WHERE u.salon_id = p_salon_id AND u.created_at >= v_month;
        IF v_max_req IS NOT NULL AND v_req + 1 > v_max_req THEN v_reason := 'salon_requests';
        ELSIF v_max_tok IS NOT NULL AND v_tok + p_tokens > v_max_tok THEN v_reason := 'salon_tokens';
        END IF;
      END IF;
    END IF;
  END IF;
  IF v_reason IS NOT NULL THEN
    INSERT INTO ai_usage(salon_id, feature, provider, model, status, error_code, billable, settled_at)
    VALUES (p_salon_id, p_feature, p_provider, p_model, 'blocked', v_reason, false, now());
    RETURN QUERY SELECT NULL::bigint, v_reason;
    RETURN;
  END IF;
  INSERT INTO ai_usage(salon_id, feature, provider, model, tokens_in, tokens_out, cost_usd, status)
  VALUES (p_salon_id, p_feature, p_provider, p_model, p_tokens, 0, p_cost, 'reserved')
  RETURNING id INTO v_id;
  RETURN QUERY SELECT v_id, NULL::text;
END $$;

-- Liquidação: só a partir de 'reserved' (idempotente; segunda liquidação devolve false).
-- ok + uso informado pelo provedor (p_exact): valor real, pode liberar sobra da reserva.
-- ok sem uso informado: mantém o maior entre reserva e estimativa.
-- erro cobrável/incerto (timeout, rede, 5xx: p_charged): mantém a reserva inteira.
-- erro recusado pelo provedor (4xx): zera, não conta requisição.
-- Reserva nunca liquidada (processo morreu) continua contando: falha fechada.
CREATE OR REPLACE FUNCTION public.ai_settle(p_id bigint, p_status text, p_tokens_in integer, p_tokens_out integer,
  p_tokens_cached integer, p_tokens_thoughts integer, p_cost numeric, p_exact boolean, p_charged boolean, p_error_code text, p_latency_ms integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_in integer := greatest(coalesce(p_tokens_in, 0), 0);
  v_out integer := greatest(coalesce(p_tokens_out, 0), 0);
  v_cost numeric := greatest(coalesce(p_cost, 0), 0);
BEGIN
  IF p_status NOT IN ('ok', 'error') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  UPDATE ai_usage u SET
    status = p_status,
    error_code = left(p_error_code, 40),
    latency_ms = p_latency_ms,
    settled_at = now(),
    billable = (p_status = 'ok' OR p_charged),
    tokens_cached = CASE WHEN p_status = 'ok' THEN least(greatest(coalesce(p_tokens_cached, 0), 0), v_in) ELSE 0 END,
    tokens_thoughts = CASE WHEN p_status = 'ok' THEN least(greatest(coalesce(p_tokens_thoughts, 0), 0), v_out) ELSE 0 END,
    tokens_in = CASE
      WHEN p_status = 'ok' AND (p_exact OR v_in + v_out > u.tokens_in + u.tokens_out) THEN v_in
      WHEN p_status = 'ok' OR p_charged THEN u.tokens_in ELSE 0 END,
    tokens_out = CASE
      WHEN p_status = 'ok' AND (p_exact OR v_in + v_out > u.tokens_in + u.tokens_out) THEN v_out
      WHEN p_status = 'ok' OR p_charged THEN u.tokens_out ELSE 0 END,
    cost_usd = CASE
      WHEN p_status = 'ok' AND p_exact THEN v_cost
      WHEN p_status = 'ok' THEN greatest(v_cost, u.cost_usd)
      WHEN p_charged THEN u.cost_usd ELSE 0 END
  WHERE u.id = p_id AND u.status = 'reserved';
  RETURN FOUND;
END $$;

-- Status do painel (mês atual, últimas 24h, última falha, uso do mês por salão para a aba de limites).
CREATE OR REPLACE FUNCTION public.ai_usage_summary()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH m AS (SELECT * FROM ai_usage WHERE created_at >= ai_month_start())
  SELECT jsonb_build_object(
    'month', (SELECT jsonb_build_object('requests', count(*) FILTER (WHERE billable), 'tokens', coalesce(sum(tokens_in + tokens_out), 0),
      'cost_usd', coalesce(sum(cost_usd), 0), 'errors', count(*) FILTER (WHERE status = 'error'), 'blocked', count(*) FILTER (WHERE status = 'blocked'),
      'stuck', count(*) FILTER (WHERE status = 'reserved' AND created_at < now() - interval '5 minutes')) FROM m),
    'by_salon', coalesce((SELECT jsonb_agg(x) FROM (
      SELECT salon_id, count(*) FILTER (WHERE billable) AS requests, sum(tokens_in + tokens_out) AS tokens
      FROM m WHERE salon_id IS NOT NULL GROUP BY 1) x), '[]'::jsonb),
    'last_24h', (SELECT jsonb_build_object('requests', count(*) FILTER (WHERE billable), 'errors', count(*) FILTER (WHERE status = 'error'))
      FROM ai_usage WHERE created_at >= now() - interval '24 hours'),
    'last_error', (SELECT jsonb_build_object('created_at', created_at, 'feature', feature, 'provider', provider, 'model', model, 'error_code', error_code)
      FROM ai_usage WHERE status = 'error' ORDER BY created_at DESC LIMIT 1)
  )
$$;

-- Relatório de consumo por período (fuso America/Sao_Paulo; semana começa na segunda, padrão ISO do date_trunc).
-- p_from inclusivo, p_to exclusivo, no máximo 400 dias. p_salon_id filtra série/recursos/mensagens de um salão.
-- "Conversa" = resposta do chatbot gerada com IA (ai_reply_log.with_ai); custo médio = custo do chatbot / respostas com IA.
CREATE OR REPLACE FUNCTION public.ai_usage_report(p_from timestamptz, p_to timestamptz, p_group text DEFAULT 'day', p_salon_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_unit text := CASE p_group WHEN 'week' THEN 'week' WHEN 'month' THEN 'month' ELSE 'day' END;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to - p_from > interval '400 days' THEN RAISE EXCEPTION 'invalid_period'; END IF;
  RETURN (
  WITH u AS (SELECT * FROM ai_usage WHERE created_at >= p_from AND created_at < p_to AND (p_salon_id IS NULL OR salon_id = p_salon_id)),
  r AS (SELECT * FROM ai_reply_log WHERE created_at >= p_from AND created_at < p_to AND (p_salon_id IS NULL OR salon_id = p_salon_id)),
  o AS (SELECT category FROM whatsapp_outbox WHERE created_at >= p_from AND created_at < p_to AND (p_salon_id IS NULL OR salon_id = p_salon_id)
        AND category <> 'chatbot' AND status IN ('accepted','delivered','read')),
  tot AS (SELECT coalesce(sum(cost_usd), 0) AS cost FROM u),
  per_salon AS (
    SELECT u.salon_id, count(*) FILTER (WHERE u.billable) AS requests, coalesce(sum(u.tokens_in), 0) AS tokens_in, coalesce(sum(u.tokens_out), 0) AS tokens_out,
      coalesce(sum(u.cost_usd), 0) AS cost_usd, coalesce(sum(u.cost_usd) FILTER (WHERE u.feature = 'chatbot'), 0) AS chatbot_cost,
      count(*) FILTER (WHERE u.status = 'error') AS errors, count(*) FILTER (WHERE u.status = 'blocked') AS blocked
    FROM u WHERE u.salon_id IS NOT NULL GROUP BY 1),
  replies AS (SELECT salon_id, count(*) FILTER (WHERE with_ai) AS ai_replies, count(*) FILTER (WHERE NOT with_ai) AS plain_replies FROM r GROUP BY 1)
  SELECT jsonb_build_object(
    'from', p_from, 'to', p_to, 'group', v_unit,
    'totals', (SELECT jsonb_build_object('requests', count(*) FILTER (WHERE billable), 'tokens_in', coalesce(sum(tokens_in), 0), 'tokens_out', coalesce(sum(tokens_out), 0),
      'tokens_cached', coalesce(sum(tokens_cached), 0), 'tokens_thoughts', coalesce(sum(tokens_thoughts), 0), 'cost_usd', coalesce(sum(cost_usd), 0),
      'errors', count(*) FILTER (WHERE status = 'error'), 'blocked', count(*) FILTER (WHERE status = 'blocked'), 'pending', count(*) FILTER (WHERE status = 'reserved')) FROM u),
    'series', coalesce((SELECT jsonb_agg(x ORDER BY x.bucket) FROM (
      SELECT to_char(date_trunc(v_unit, created_at AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS bucket,
        count(*) FILTER (WHERE billable) AS requests, coalesce(sum(tokens_in), 0) AS tokens_in, coalesce(sum(tokens_out), 0) AS tokens_out,
        coalesce(sum(cost_usd), 0) AS cost_usd, count(*) FILTER (WHERE status = 'error') AS errors
      FROM u GROUP BY 1) x), '[]'::jsonb),
    'by_feature', coalesce((SELECT jsonb_agg(x ORDER BY x.cost_usd DESC) FROM (
      SELECT feature, count(*) FILTER (WHERE billable) AS requests, coalesce(sum(tokens_in), 0) AS tokens_in, coalesce(sum(tokens_out), 0) AS tokens_out,
        coalesce(sum(cost_usd), 0) AS cost_usd, count(*) FILTER (WHERE status = 'error') AS errors FROM u GROUP BY 1) x), '[]'::jsonb),
    'by_model', coalesce((SELECT jsonb_agg(x ORDER BY x.cost_usd DESC) FROM (
      SELECT model, count(*) FILTER (WHERE billable) AS requests, coalesce(sum(cost_usd), 0) AS cost_usd FROM u WHERE status <> 'blocked' GROUP BY 1) x), '[]'::jsonb),
    'ranking', coalesce((SELECT jsonb_agg(x ORDER BY x.cost_usd DESC, x.requests DESC) FROM (
      SELECT p.salon_id, s.name, p.requests, p.tokens_in, p.tokens_out, p.cost_usd, p.errors, p.blocked,
        CASE WHEN t.cost > 0 THEN round(p.cost_usd / t.cost * 100, 2) ELSE 0 END AS pct_cost,
        coalesce(rp.ai_replies, 0) AS ai_replies, coalesce(rp.plain_replies, 0) AS plain_replies,
        CASE WHEN coalesce(rp.ai_replies, 0) > 0 THEN round(p.chatbot_cost / rp.ai_replies, 6) END AS avg_cost_per_conversation
      FROM per_salon p JOIN salons s ON s.id = p.salon_id CROSS JOIN tot t LEFT JOIN replies rp ON rp.salon_id = p.salon_id
      ORDER BY p.cost_usd DESC LIMIT 500) x), '[]'::jsonb),
    'messages', jsonb_build_object(
      'chatbot_ai', (SELECT count(*) FROM r WHERE with_ai),
      'chatbot_plain', (SELECT count(*) FROM r WHERE NOT with_ai),
      'chatbot_plain_by_kind', coalesce((SELECT jsonb_object_agg(kind, n) FROM (SELECT kind, count(*) AS n FROM r WHERE NOT with_ai GROUP BY 1) k), '{}'::jsonb),
      'automations_by_category', coalesce((SELECT jsonb_object_agg(category, n) FROM (SELECT category, count(*) AS n FROM o GROUP BY 1) k), '{}'::jsonb))
  ));
END $$;

-- Registro de resposta do chatbot (com/sem IA). Idempotente por evento.
CREATE OR REPLACE FUNCTION public.ai_log_reply(p_salon_id uuid, p_event_id uuid, p_with_ai boolean, p_kind text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ INSERT INTO ai_reply_log(salon_id, source_event_id, with_ai, kind) VALUES (p_salon_id, p_event_id, p_with_ai, left(coalesce(nullif(p_kind, ''), 'desconhecido'), 60))
  ON CONFLICT (source_event_id) DO NOTHING $$;

-- Dono do salão: só agregado do mês dos próprios salões (sem custo da plataforma).
CREATE OR REPLACE FUNCTION public.get_my_ai_usage()
RETURNS TABLE(salon_id uuid, requests bigint, tokens bigint, limit_requests integer, limit_tokens bigint, blocked boolean, by_feature jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id,
    (SELECT count(*) FROM ai_usage u WHERE u.salon_id = s.id AND u.created_at >= ai_month_start() AND u.billable),
    (SELECT coalesce(sum(u.tokens_in + u.tokens_out), 0) FROM ai_usage u WHERE u.salon_id = s.id AND u.created_at >= ai_month_start()),
    coalesce(l.monthly_requests, c.default_salon_monthly_requests),
    coalesce(l.monthly_tokens, c.default_salon_monthly_tokens),
    coalesce(l.blocked, false),
    coalesce((SELECT jsonb_object_agg(f.feature, f.n) FROM (SELECT u.feature, count(*) AS n FROM ai_usage u
      WHERE u.salon_id = s.id AND u.created_at >= ai_month_start() AND u.billable GROUP BY 1) f), '{}'::jsonb)
  FROM salons s
  LEFT JOIN ai_salon_limits l ON l.salon_id = s.id
  LEFT JOIN ai_platform_config c ON true
  WHERE s.owner_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.ai_platform_secret(text), public.ai_save_platform_secret(text, text), public.ai_platform_key_hints(),
  public.ai_reserve(uuid, text, text, text, integer, numeric),
  public.ai_settle(bigint, text, integer, integer, integer, integer, numeric, boolean, boolean, text, integer),
  public.ai_usage_summary(), public.ai_usage_report(timestamptz, timestamptz, text, uuid), public.ai_log_reply(uuid, uuid, boolean, text),
  public.get_my_ai_usage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_platform_secret(text), public.ai_save_platform_secret(text, text), public.ai_platform_key_hints(),
  public.ai_reserve(uuid, text, text, text, integer, numeric),
  public.ai_settle(bigint, text, integer, integer, integer, integer, numeric, boolean, boolean, text, integer),
  public.ai_usage_summary(), public.ai_usage_report(timestamptz, timestamptz, text, uuid), public.ai_log_reply(uuid, uuid, boolean, text) TO service_role;
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
-- DROP FUNCTION IF EXISTS public.get_my_ai_usage(), public.ai_usage_summary(), public.ai_usage_report(timestamptz, timestamptz, text, uuid),
--   public.ai_log_reply(uuid, uuid, boolean, text), public.ai_reserve(uuid, text, text, text, integer, numeric),
--   public.ai_settle(bigint, text, integer, integer, integer, integer, numeric, boolean, boolean, text, integer),
--   public.ai_platform_key_hints(), public.ai_save_platform_secret(text, text), public.ai_platform_secret(text), public.ai_month_start();
-- DROP INDEX IF EXISTS public.idx_whatsapp_outbox_created;
-- DROP TABLE IF EXISTS public.ai_reply_log, public.ai_usage, public.ai_salon_limits, public.ai_platform_config;
-- DROP TABLE IF EXISTS ai_private.platform_keys; DROP SCHEMA IF EXISTS ai_private;
-- COMMIT;
