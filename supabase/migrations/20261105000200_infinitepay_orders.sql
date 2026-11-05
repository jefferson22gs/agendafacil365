-- ============================================================================
-- Agenda Fácil 365 — pedidos de assinatura via InfinitePay (link de pagamento).
-- APLICADO em produção (ocbwsaydgkiseeardjga) em 05/11/2026 após ensaio em transação revertida.
-- Só cria tabela nova + colunas opcionais; não altera dados existentes. Rollback no fim.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.infinitepay_orders (
  order_nsu        text PRIMARY KEY,                       -- gerado pelo servidor (uuid), enviado à InfinitePay
  subscription_id  uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  salon_id         uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan             text NOT NULL CHECK (plan IN ('monthly', 'annual')),
  amount_cents     integer NOT NULL CHECK (amount_cents > 0),
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  checkout_url     text,
  transaction_nsu  text,
  invoice_slug     text,
  capture_method   text,                                    -- credit_card | pix
  receipt_url      text,
  paid_amount_cents integer,
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_infinitepay_orders_salon ON public.infinitepay_orders(salon_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_infinitepay_orders_tx ON public.infinitepay_orders(transaction_nsu) WHERE transaction_nsu IS NOT NULL;

ALTER TABLE public.infinitepay_orders ENABLE ROW LEVEL SECURITY;
-- Dono só LÊ os próprios pedidos; escrita apenas pelas Functions (service role).
DROP POLICY IF EXISTS "Owner reads own infinitepay orders" ON public.infinitepay_orders;
CREATE POLICY "Owner reads own infinitepay orders" ON public.infinitepay_orders
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Super Admins read infinitepay orders" ON public.infinitepay_orders;
CREATE POLICY "Super Admins read infinitepay orders" ON public.infinitepay_orders
  FOR SELECT TO authenticated USING (public.is_super_admin());

-- Identifica o provedor do pagamento (Mercado Pago continua funcionando como antes).
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS provider text DEFAULT 'mercadopago';
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS provider_payment_id text;

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP TABLE IF EXISTS public.infinitepay_orders;
-- ALTER TABLE public.subscription_payments DROP COLUMN IF EXISTS provider_payment_id;
-- ALTER TABLE public.subscription_payments DROP COLUMN IF EXISTS provider;
-- ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS payment_provider;
-- COMMIT;
