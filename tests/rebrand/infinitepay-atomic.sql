-- Ensaio manual: executar APÓS definir confirm_infinitepay_order, dentro de BEGIN/ROLLBACK.
-- Nenhum pagamento externo; todas as alterações são revertidas pelo chamador.
DO $$
DECLARE
  sal public.salons;
  sub public.subscriptions;
  v_order text := gen_random_uuid()::text;
  v_tx text := 'audit-' || gen_random_uuid()::text;
  first_end timestamptz;
  second_end timestamptz;
  before_receipts bigint;
  result jsonb;
BEGIN
  SELECT * INTO sal FROM public.salons WHERE owner_id IS NOT NULL ORDER BY id LIMIT 1;
  IF sal.id IS NULL THEN RAISE EXCEPTION 'fixture_owner_required'; END IF;
  SELECT * INTO sub FROM public.subscriptions WHERE salon_id = sal.id ORDER BY created_at DESC, id DESC LIMIT 1;
  INSERT INTO public.infinitepay_orders(order_nsu, subscription_id, salon_id, user_id, plan, amount_cents)
  VALUES(v_order, sub.id, sal.id, sal.owner_id, 'annual', 40000);
  SELECT count(*) INTO before_receipts FROM public.subscription_payments;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','service_role')::text, true);

  BEGIN
    PERFORM public.confirm_infinitepay_order(v_order, v_tx, 'audit', 39999, 'pix');
    RAISE EXCEPTION 'underpayment_was_accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid_payment' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM public.infinitepay_orders WHERE order_nsu=v_order) <> 'pending' THEN
    RAISE EXCEPTION 'underpayment_changed_order';
  END IF;

  result := public.confirm_infinitepay_order(v_order, v_tx, 'audit', 40000, 'pix');
  IF result->>'success' <> 'true' THEN RAISE EXCEPTION 'payment_not_confirmed'; END IF;
  SELECT current_period_end INTO first_end FROM public.subscriptions
    WHERE id=(SELECT subscription_id FROM public.infinitepay_orders WHERE order_nsu=v_order);
  IF first_end < now() + interval '12 months' THEN RAISE EXCEPTION 'annual_period_incorrect'; END IF;
  PERFORM public.confirm_infinitepay_order(v_order, v_tx, 'audit', 40000, 'pix');
  SELECT current_period_end INTO second_end FROM public.subscriptions
    WHERE id=(SELECT subscription_id FROM public.infinitepay_orders WHERE order_nsu=v_order);
  IF first_end IS DISTINCT FROM second_end THEN RAISE EXCEPTION 'duplicate_extended_period'; END IF;
  IF (SELECT count(*) FROM public.subscription_payments) <> before_receipts + 1 THEN
    RAISE EXCEPTION 'duplicate_receipt';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','authenticated','sub',sal.owner_id)::text, true);
  BEGIN
    PERFORM public.confirm_infinitepay_order(v_order, v_tx, 'audit', 40000, 'pix');
    RAISE EXCEPTION 'user_was_allowed_to_confirm';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT 'PASS: valor, período anual, duplicação e autorização; alterações serão revertidas' AS result;
