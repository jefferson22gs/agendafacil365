-- Confirmação atômica: pedido + assinatura + recibo, ou nada.
-- Aplicar antes do webhook que chama esta RPC. Somente service_role pode executá-la.
BEGIN;
CREATE OR REPLACE FUNCTION public.confirm_infinitepay_order(
  p_order_nsu text, p_transaction_nsu text, p_invoice_slug text,
  p_paid_amount_cents integer, p_capture_method text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.infinitepay_orders;
  s public.subscriptions;
  v_end timestamptz;
  v_now timestamptz := now();
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF coalesce(length(p_transaction_nsu), 0) NOT BETWEEN 1 AND 200
    OR coalesce(length(p_invoice_slug), 0) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid_payment_identifiers';
  END IF;

  SELECT * INTO o FROM public.infinitepay_orders WHERE order_nsu = p_order_nsu FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_order'; END IF;
  IF o.status = 'paid' THEN
    IF o.transaction_nsu IS DISTINCT FROM p_transaction_nsu THEN RAISE EXCEPTION 'transaction_mismatch'; END IF;
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;
  IF o.status <> 'pending' OR p_paid_amount_cents IS NULL OR p_paid_amount_cents < o.amount_cents THEN
    RAISE EXCEPTION 'invalid_payment';
  END IF;

  -- Serializa pedidos diferentes do mesmo estabelecimento, inclusive quando ainda não há assinatura.
  PERFORM 1 FROM public.salons WHERE id = o.salon_id AND owner_id = o.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'owner_changed'; END IF;
  SELECT * INTO s FROM public.subscriptions WHERE salon_id = o.salon_id
    ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE;
  -- Teste grátis não é período pago: só prolongar a assinatura ativa e não-trial.
  v_end := greatest(v_now, CASE WHEN s.status = 'active' AND NOT coalesce(s.is_trial, false)
    THEN s.current_period_end ELSE v_now END)
    + CASE WHEN o.plan = 'annual' THEN interval '12 months' ELSE interval '1 month' END;

  IF s.id IS NULL THEN
    INSERT INTO public.subscriptions (salon_id, user_id, plan_name, status, is_trial, payment_provider,
      plan_type, amount, current_period_start, current_period_end, next_payment_date, last_payment_date)
    VALUES (o.salon_id, o.user_id, 'SysHair Premium', 'active', false, 'infinitepay',
      o.plan, o.amount_cents / 100.0, v_now, v_end, v_end, v_now) RETURNING * INTO s;
  ELSE
    UPDATE public.subscriptions SET status = 'active', is_trial = false, payment_provider = 'infinitepay',
      plan_type = o.plan, amount = o.amount_cents / 100.0, current_period_start = v_now,
      current_period_end = v_end, next_payment_date = v_end, last_payment_date = v_now, updated_at = v_now
    WHERE id = s.id;
  END IF;
  INSERT INTO public.subscription_payments (subscription_id, salon_id, provider, provider_payment_id,
    mp_status, amount, currency, payment_method, paid_at)
  VALUES (s.id, o.salon_id, 'infinitepay', p_transaction_nsu, 'approved',
    p_paid_amount_cents / 100.0, 'BRL', p_capture_method, v_now);

  UPDATE public.infinitepay_orders SET status = 'paid', subscription_id = s.id,
    transaction_nsu = p_transaction_nsu, invoice_slug = p_invoice_slug,
    capture_method = p_capture_method, paid_amount_cents = p_paid_amount_cents,
    paid_at = v_now, updated_at = v_now WHERE order_nsu = o.order_nsu;
  RETURN jsonb_build_object('success', true, 'already_processed', false);
END $$;
REVOKE ALL ON FUNCTION public.confirm_infinitepay_order(text,text,text,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_infinitepay_order(text,text,text,integer,text) TO service_role;
COMMIT;
-- Rollback: restaurar o webhook anterior ANTES de remover esta função.
