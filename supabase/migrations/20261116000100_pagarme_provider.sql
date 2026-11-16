-- Stone (Pagar.me): quinto provedor de cobrança com a conta do próprio salão. Aditiva: só amplia as listas de provedores.
-- O Ton (maquininha) não tem API pública de cobrança online; o gateway online do grupo Stone é a Pagar.me.
BEGIN;

ALTER TABLE public.salon_payment_settings DROP CONSTRAINT IF EXISTS salon_payment_settings_provider_check;
ALTER TABLE public.salon_payment_settings ADD CONSTRAINT salon_payment_settings_provider_check
  CHECK (provider IN ('pix_manual','mercadopago','asaas','pagbank','infinitepay','pagarme'));
ALTER TABLE payment_private.gateway_secrets DROP CONSTRAINT IF EXISTS gateway_secrets_provider_check;
ALTER TABLE payment_private.gateway_secrets ADD CONSTRAINT gateway_secrets_provider_check
  CHECK (provider IN ('mercadopago','asaas','pagbank','infinitepay','pagarme'));
ALTER TABLE public.payment_charges DROP CONSTRAINT IF EXISTS payment_charges_provider_check;
ALTER TABLE public.payment_charges ADD CONSTRAINT payment_charges_provider_check
  CHECK (provider IN ('mercadopago','asaas','pagbank','infinitepay','pagarme'));

COMMIT;

-- Rollback (só sem linhas 'pagarme'): recriar as três CHECKs sem 'pagarme', como em 20261112000200_payments_reviews.sql.
