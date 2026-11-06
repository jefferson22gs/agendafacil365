-- Teste grátis passa de 21 para 30 dias (06/11/2026). Só afeta novos testes; linhas existentes não mudam.
-- Rollback: trocar '30 days' por '21 days' na função e '7 days' no default.
BEGIN;

CREATE OR REPLACE FUNCTION public.start_salon_trial(p_salon_id uuid)
RETURNS public.subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.subscriptions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.salons WHERE id = p_salon_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE salon_id = p_salon_id) THEN
    RAISE EXCEPTION 'subscription_exists' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.subscriptions (salon_id, user_id, status, is_trial, trial_start_date, trial_end_date, plan_name, amount)
  VALUES (p_salon_id, auth.uid(), 'trial', true, now(), now() + interval '30 days', 'SysHair Premium', 39.90)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

ALTER TABLE public.subscriptions ALTER COLUMN trial_end_date SET DEFAULT (now() + interval '30 days');

COMMIT;
