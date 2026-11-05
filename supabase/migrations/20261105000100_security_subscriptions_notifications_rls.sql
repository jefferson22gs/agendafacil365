-- ============================================================================
-- Agenda Fácil 365 — endurecimento de RLS (auditoria 05/11/2026)
-- APLICADO em produção (ocbwsaydgkiseeardjga) em 05/11/2026 após ensaio em transação revertida.
-- Não apaga nem altera dados; só policies e funções. Rollback no fim do arquivo.
--
-- 1) subscriptions: o cliente podia fazer UPDATE/INSERT livre na própria linha
--    (ex.: status='active', current_period_end='2099-…') e liberar o sistema sem pagar.
--    Agora escrita só por service_role (webhook), super admin e 3 RPCs restritas.
-- 2) notifications: "Anyone can read sent notifications" expunha notificações de
--    TODOS os estabelecimentos para a chave anon. Removida.
-- ============================================================================

BEGIN;

-- ---------- subscriptions ----------
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
-- Mantidas: "Users can view own subscription" (SELECT), "Service role can manage subscriptions",
--           "Super Admins can manage subscriptions".

-- Inicia o teste grátis (21 dias) uma única vez por estabelecimento do próprio usuário.
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
  VALUES (p_salon_id, auth.uid(), 'trial', true, now(), now() + interval '21 days', 'SysHair Premium', 39.90)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- Marca como expirada somente se de fato venceu (nunca reativa).
CREATE OR REPLACE FUNCTION public.expire_own_subscription(p_subscription_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.subscriptions SET status = 'expired', updated_at = now()
  WHERE id = p_subscription_id
    AND user_id = auth.uid()
    AND status IN ('trial', 'active')
    AND ((status = 'trial'  AND trial_end_date     IS NOT NULL AND trial_end_date     <= now())
      OR (status = 'active' AND current_period_end IS NOT NULL AND current_period_end <= now()));
  RETURN FOUND;
END $$;

-- Grava a referência de pagamento: sempre o próprio salon_id, nunca valor arbitrário.
CREATE OR REPLACE FUNCTION public.set_own_payment_reference(p_subscription_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref text;
BEGIN
  UPDATE public.subscriptions s SET mp_external_reference = s.salon_id::text, updated_at = now()
  WHERE s.id = p_subscription_id AND s.user_id = auth.uid()
  RETURNING s.mp_external_reference INTO v_ref;
  RETURN v_ref;
END $$;

REVOKE ALL ON FUNCTION public.start_salon_trial(uuid), public.expire_own_subscription(uuid), public.set_own_payment_reference(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_salon_trial(uuid), public.expire_own_subscription(uuid), public.set_own_payment_reference(uuid) TO authenticated;

-- ---------- notifications ----------
DROP POLICY IF EXISTS "Anyone can read sent notifications" ON public.notifications;
-- Mantidas: "Salon owners can manage notifications", "Super Admins can manage notifications".
-- O worker /sw-push.js legado dependia dessa leitura pública; em produção ele não é mais registrado
-- (worker único /sw.js com FCM), e o FCM envia título/corpo no próprio payload.

COMMIT;

-- ============================================================================
-- ROLLBACK (executar só se necessário):
-- BEGIN;
-- CREATE POLICY "Users can insert own subscription" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users can update own subscription" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);
-- CREATE POLICY "Anyone can read sent notifications" ON public.notifications FOR SELECT USING (status = 'sent');
-- DROP FUNCTION IF EXISTS public.start_salon_trial(uuid), public.expire_own_subscription(uuid), public.set_own_payment_reference(uuid);
-- COMMIT;
-- ============================================================================
