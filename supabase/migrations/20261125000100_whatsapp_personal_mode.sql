-- Salões existentes mantêm o menu e a pausa com prazo atuais.
ALTER TABLE public.whatsapp_automation_settings
  ADD COLUMN IF NOT EXISTS guided_personal_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guided_owner_name text CHECK (char_length(guided_owner_name) <= 40);
