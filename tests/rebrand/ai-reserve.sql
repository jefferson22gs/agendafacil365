-- Ensaio manual da reserva atômica de IA (20261106003000_ai_central.sql). Sem rede, sem chamadas pagas.
-- Rodar num banco com a migração aplicada (ou aplicada dentro da mesma transação), SEMPRE em BEGIN ... ROLLBACK.
--
-- PARTE A (uma sessão):   psql -v ON_ERROR_STOP=1 -f tests/rebrand/ai-reserve.sql
--   Espera: NOTICE 'ai_reserve: OK' e nenhum dado persistido (ROLLBACK no fim).
--
-- PARTE B (concorrência, duas sessões; roteiro manual no fim do arquivo).

BEGIN;
DO $$
DECLARE
  sal uuid;
  r record;
  v_id bigint;
  v_ok boolean;
  v_cnt bigint;
BEGIN
  SELECT id INTO sal FROM public.salons ORDER BY id LIMIT 1;
  IF sal IS NULL THEN RAISE EXCEPTION 'fixture_salon_required'; END IF;
  DELETE FROM public.ai_usage WHERE created_at >= public.ai_month_start(); -- revertido pelo ROLLBACK
  DELETE FROM public.ai_salon_limits WHERE salon_id = sal;

  -- 1) Modo legado (sem linha de config): reserva sem limites.
  DELETE FROM public.ai_platform_config;
  SELECT * INTO r FROM public.ai_reserve(sal, 'chatbot', 'gemini', 'gemini-3.6-flash', 1000, 0.01);
  IF r.reservation_id IS NULL OR r.reason IS NOT NULL THEN RAISE EXCEPTION 'legacy_should_reserve'; END IF;
  PERFORM public.ai_settle(r.reservation_id, 'ok', 10, 5, 0, 0, 0.0001, true, true, NULL, 10);

  -- 2) Central desligada: bloqueia produção, permite teste/simulação (exceção limitada).
  INSERT INTO public.ai_platform_config(id, enabled, monthly_budget_usd, default_salon_monthly_requests) VALUES (true, false, 1, 3);
  SELECT * INTO r FROM public.ai_reserve(sal, 'chatbot', 'gemini', 'm', 10, 0.001);
  IF r.reason IS DISTINCT FROM 'disabled' OR r.reservation_id IS NOT NULL THEN RAISE EXCEPTION 'disabled_not_blocked'; END IF;
  SELECT * INTO r FROM public.ai_reserve(NULL, 'teste', 'gemini', 'm', 10, 0.001);
  IF r.reservation_id IS NULL THEN RAISE EXCEPTION 'test_should_pass_when_disabled'; END IF;
  PERFORM public.ai_settle(r.reservation_id, 'error', 0, 0, 0, 0, 0, false, false, 'bad_request', 5);

  -- 3) Limite de requisições do salão: 3 por mês (o item 1 já contou 1).
  UPDATE public.ai_platform_config SET enabled = true;
  SELECT * INTO r FROM public.ai_reserve(sal, 'chatbot', 'gemini', 'm', 10, 0.001); v_id := r.reservation_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'second_should_pass'; END IF;
  SELECT * INTO r FROM public.ai_reserve(sal, 'chatbot', 'gemini', 'm', 10, 0.001);
  IF r.reservation_id IS NULL THEN RAISE EXCEPTION 'third_should_pass'; END IF;
  SELECT * INTO r FROM public.ai_reserve(sal, 'chatbot', 'gemini', 'm', 10, 0.001);
  IF r.reason IS DISTINCT FROM 'salon_requests' THEN RAISE EXCEPTION 'fourth_should_block_requests: %', r.reason; END IF;

  -- 4) Recusa 4xx (sem cobrança) devolve a vaga; erro incerto (timeout) NÃO devolve.
  v_ok := public.ai_settle(v_id, 'error', 0, 0, 0, 0, 0, false, false, 'invalid_key', 5);
  IF NOT v_ok THEN RAISE EXCEPTION 'settle_failed'; END IF;
  IF public.ai_settle(v_id, 'ok', 1, 1, 0, 0, 1, true, true, NULL, 1) THEN RAISE EXCEPTION 'double_settle_allowed'; END IF;
  SELECT * INTO r FROM public.ai_reserve(sal, 'chatbot', 'gemini', 'm', 10, 0.001);
  IF r.reservation_id IS NULL THEN RAISE EXCEPTION 'refund_not_released'; END IF;
  PERFORM public.ai_settle(r.reservation_id, 'error', 0, 0, 0, 0, 0, false, true, 'timeout', 20000);
  SELECT * INTO r FROM public.ai_reserve(sal, 'chatbot', 'gemini', 'm', 10, 0.001);
  IF r.reason IS DISTINCT FROM 'salon_requests' THEN RAISE EXCEPTION 'uncertain_failure_released_quota'; END IF;

  -- 5) Orçamento global US$ 1: reserva que ultrapassa é recusada antes da chamada (inclusive sem salão).
  UPDATE public.ai_platform_config SET default_salon_monthly_requests = NULL;
  SELECT * INTO r FROM public.ai_reserve(NULL, 'teste', 'gemini', 'm', 10, 0.99);
  IF r.reason IS DISTINCT FROM 'budget' THEN RAISE EXCEPTION 'budget_not_enforced: %', r.reason; END IF;

  -- 6) Limite de tokens com exceção do salão e bloqueio.
  INSERT INTO public.ai_salon_limits(salon_id, monthly_tokens) VALUES (sal, 100);
  SELECT * INTO r FROM public.ai_reserve(sal, 'chatbot', 'gemini', 'm', 500, 0.0001);
  IF r.reason IS DISTINCT FROM 'salon_tokens' THEN RAISE EXCEPTION 'tokens_not_enforced: %', r.reason; END IF;
  UPDATE public.ai_salon_limits SET blocked = true, monthly_tokens = NULL WHERE salon_id = sal;
  SELECT * INTO r FROM public.ai_reserve(sal, 'chatbot', 'gemini', 'm', 1, 0);
  IF r.reason IS DISTINCT FROM 'salon_blocked' THEN RAISE EXCEPTION 'block_not_enforced'; END IF;

  -- 7) Liquidação ok exata pode liberar sobra; sem uso exato mantém o maior valor.
  UPDATE public.ai_salon_limits SET blocked = false WHERE salon_id = sal;
  UPDATE public.ai_platform_config SET monthly_budget_usd = NULL;
  SELECT * INTO r FROM public.ai_reserve(sal, 'texto', 'gemini', 'm', 1, 0.5);
  PERFORM public.ai_settle(r.reservation_id, 'ok', 100, 50, 20, 30, 0.002, false, true, NULL, 100);
  IF (SELECT cost_usd FROM public.ai_usage WHERE id = r.reservation_id) <> 0.5 THEN RAISE EXCEPTION 'inexact_settle_lowered_cost'; END IF;
  IF (SELECT tokens_cached FROM public.ai_usage WHERE id = r.reservation_id) <> 20 THEN RAISE EXCEPTION 'cached_not_recorded'; END IF;

  -- 8) Entradas inválidas.
  BEGIN PERFORM public.ai_reserve(sal, 'chatbot', 'gemini', 'm', 0, 0); RAISE EXCEPTION 'zero_tokens_accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'invalid_reservation' THEN RAISE; END IF; END;

  -- 9) Relatório e log de respostas (idempotente por evento).
  PERFORM public.ai_log_reply(sal, '00000000-0000-4000-8000-0000000000aa', false, 'booking');
  PERFORM public.ai_log_reply(sal, '00000000-0000-4000-8000-0000000000aa', true, 'gemini-3.6-flash');
  SELECT count(*) INTO v_cnt FROM public.ai_reply_log WHERE source_event_id = '00000000-0000-4000-8000-0000000000aa' AND NOT with_ai;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'reply_log_not_idempotent'; END IF;
  IF public.ai_usage_report(now() - interval '1 day', now() + interval '1 minute', 'week', NULL)->'totals'->>'requests' IS NULL THEN RAISE EXCEPTION 'report_empty'; END IF;
  BEGIN PERFORM public.ai_usage_report(now(), now() - interval '1 day', 'day', NULL); RAISE EXCEPTION 'bad_period_accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'invalid_period' THEN RAISE; END IF; END;

  -- 10) Navegador não executa reserva, nem lê chave.
  IF has_function_privilege('authenticated', 'public.ai_reserve(uuid, text, text, text, integer, numeric)', 'EXECUTE') THEN RAISE EXCEPTION 'authenticated_can_reserve'; END IF;
  IF has_function_privilege('anon', 'public.ai_platform_secret(text)', 'EXECUTE') THEN RAISE EXCEPTION 'anon_can_read_key'; END IF;
  IF has_table_privilege('authenticated', 'ai_private.platform_keys', 'SELECT') THEN RAISE EXCEPTION 'authenticated_reads_keys'; END IF;

  RAISE NOTICE 'ai_reserve: OK';
END $$;
ROLLBACK;

-- PARTE B — concorrência (duas sessões psql, banco com a migração aplicada; tudo revertido):
-- Sessão 1:
--   BEGIN;
--   INSERT INTO ai_platform_config(id, default_salon_monthly_requests) VALUES (true, 1)
--     ON CONFLICT (id) DO UPDATE SET default_salon_monthly_requests = 1, enabled = true;
--   DELETE FROM ai_usage WHERE salon_id = '<SALAO>' AND created_at >= ai_month_start();
--   SELECT * FROM ai_reserve('<SALAO>', 'chatbot', 'gemini', 'm', 10, 0.001);   -- reserva concedida, trava presa
-- Sessão 2 (enquanto a 1 não termina):
--   BEGIN;
--   SELECT * FROM ai_reserve('<SALAO>', 'chatbot', 'gemini', 'm', 10, 0.001);   -- FICA ESPERANDO a trava
-- Sessão 1:
--   COMMIT;   (ou, para não persistir: use um banco descartável; com ROLLBACK a sessão 2 vê o saldo antigo e reserva)
-- Esperado na sessão 2 após o COMMIT da 1: reason = 'salon_requests' (não dupla reserva). Depois: ROLLBACK na 2 e
-- limpe a linha de teste da sessão 1 (DELETE FROM ai_usage WHERE id = <id>; DELETE/restaure ai_platform_config).
