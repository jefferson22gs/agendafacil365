-- WhatsApp oficial (Meta Cloud API) ao lado da Evolution (QR code). Aditiva.
-- Cada salão continua com UMA conexão (whatsapp_instances.salon_id é único); `provider` diz qual.
-- Meta: o número é identificado pelo Phone Number ID; o token fica nos segredos das Edge Functions (META_SYSTEM_TOKEN),
-- nunca no banco. Um token próprio por salão (Cadastro Incorporado) entra depois, em coluna cifrada.
BEGIN;

ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'evolution',
  ADD COLUMN IF NOT EXISTS meta_phone_number_id text,
  ADD COLUMN IF NOT EXISTS meta_waba_id text,
  ADD COLUMN IF NOT EXISTS meta_display_name text,
  ADD COLUMN IF NOT EXISTS meta_quality text;

ALTER TABLE public.whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_provider_check;
ALTER TABLE public.whatsapp_instances ADD CONSTRAINT whatsapp_instances_provider_check CHECK (provider IN ('evolution', 'meta'));
ALTER TABLE public.whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_meta_ids_check;
ALTER TABLE public.whatsapp_instances ADD CONSTRAINT whatsapp_instances_meta_ids_check CHECK (
  provider <> 'meta' OR (meta_phone_number_id ~ '^[0-9]{5,30}$' AND meta_waba_id ~ '^[0-9]{5,30}$'));
-- Um número da Meta pertence a um salão só (o webhook acha o salão pelo Phone Number ID).
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_instances_meta_phone_unique ON public.whatsapp_instances(meta_phone_number_id) WHERE meta_phone_number_id IS NOT NULL;

COMMENT ON COLUMN public.whatsapp_instances.provider IS 'evolution = WhatsApp Web por QR code (Evolution API); meta = API oficial (WhatsApp Cloud API).';

-- Janela de atendimento de 24h da Meta: última mensagem do cliente por conversa (texto livre/interativo só dentro dela).
CREATE OR REPLACE FUNCTION public.whatsapp_service_window_open(p_salon_id uuid, p_phone text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM whatsapp_messages WHERE salon_id = p_salon_id AND phone = p_phone AND direction = 'in' AND created_at > now() - interval '24 hours');
$$;
REVOKE ALL ON FUNCTION public.whatsapp_service_window_open(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_service_window_open(uuid, text) TO service_role;

COMMIT;
