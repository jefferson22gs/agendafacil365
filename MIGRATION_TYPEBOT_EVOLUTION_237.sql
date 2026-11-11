-- =============================================================================================
-- Fluxo guiado estilo Typebot para WhatsApp (Evolution API 2.3.7)
-- Aditiva e idempotente. Roda depois de 20261106004001_whatsapp_automations.sql.
--  1) Colunas de configuração do fluxo guiado em whatsapp_automation_settings.
--  2) Tabela whatsapp_chatbot_sessions: etapa atual e dados da conversa por salão + telefone.
--  3) RLS: dono lê; só o worker (service_role) escreve.
-- =============================================================================================
BEGIN;

ALTER TABLE public.whatsapp_automation_settings
  ADD COLUMN IF NOT EXISTS guided_flow_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guided_render_mode text NOT NULL DEFAULT 'buttons',
  ADD COLUMN IF NOT EXISTS guided_welcome_message text,
  ADD COLUMN IF NOT EXISTS guided_confirmation_message text,
  ADD COLUMN IF NOT EXISTS guided_info_text text,
  ADD COLUMN IF NOT EXISTS guided_handoff_hours integer NOT NULL DEFAULT 2;

ALTER TABLE public.whatsapp_automation_settings DROP CONSTRAINT IF EXISTS whatsapp_automation_settings_guided_render_mode_check;
ALTER TABLE public.whatsapp_automation_settings ADD CONSTRAINT whatsapp_automation_settings_guided_render_mode_check
  CHECK (guided_render_mode IN ('buttons', 'hybrid', 'numbered', 'native'));
-- Padrão: 100% botões clicáveis (até 3 por mensagem, "Ver mais" e filtro por turno).
ALTER TABLE public.whatsapp_automation_settings ALTER COLUMN guided_render_mode SET DEFAULT 'buttons';
ALTER TABLE public.whatsapp_automation_settings DROP CONSTRAINT IF EXISTS whatsapp_automation_settings_guided_handoff_hours_check;
ALTER TABLE public.whatsapp_automation_settings ADD CONSTRAINT whatsapp_automation_settings_guided_handoff_hours_check
  CHECK (guided_handoff_hours BETWEEN 1 AND 72);
ALTER TABLE public.whatsapp_automation_settings DROP CONSTRAINT IF EXISTS whatsapp_automation_settings_guided_texts_check;
ALTER TABLE public.whatsapp_automation_settings ADD CONSTRAINT whatsapp_automation_settings_guided_texts_check
  CHECK (length(coalesce(guided_welcome_message, '')) <= 1000 AND length(coalesce(guided_confirmation_message, '')) <= 1000 AND length(coalesce(guided_info_text, '')) <= 1500);

COMMENT ON COLUMN public.whatsapp_automation_settings.guided_flow_enabled IS 'Fluxo guiado por menus (Typebot): menu principal, agendamento passo a passo, meus agendamentos, transbordo.';
COMMENT ON COLUMN public.whatsapp_automation_settings.guided_render_mode IS 'buttons = só botões (3 por card, Ver mais, turnos); hybrid = botões/listas + números no texto; numbered = só texto numerado; native = botões/listas sem números no texto.';
COMMENT ON COLUMN public.whatsapp_automation_settings.guided_handoff_hours IS 'Horas que o atendente fica pausado quando o cliente pede uma pessoa.';

-- Sessão da conversa (uma por salão + telefone). session_data guarda o fluxo de reserva (serviço, profissional,
-- data, horário, nome…), o menu mostrado (options_map: posição 1..n → valor real do banco) e a pilha para "voltar".
CREATE TABLE IF NOT EXISTS public.whatsapp_chatbot_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  client_phone text NOT NULL CHECK (client_phone ~ '^\+[1-9][0-9]{6,14}$'),
  client_name text CHECK (length(client_name) <= 120),
  current_step text NOT NULL DEFAULT 'IDLE',
  session_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(session_data) = 'object' AND length(session_data::text) <= 16000),
  human_takeover_until timestamptz,
  last_interaction_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, client_phone)
);
ALTER TABLE public.whatsapp_chatbot_sessions DROP CONSTRAINT IF EXISTS whatsapp_chatbot_sessions_current_step_check;
ALTER TABLE public.whatsapp_chatbot_sessions ADD CONSTRAINT whatsapp_chatbot_sessions_current_step_check CHECK (current_step IN (
  'IDLE', 'MAIN_MENU', 'SELECT_SERVICE', 'SELECT_PROFESSIONAL', 'SELECT_DATE', 'SELECT_TIME', 'CONFIRM_NAME', 'CONFIRM_BOOKING',
  'MY_APPOINTMENTS', 'APPOINTMENT_ACTIONS', 'CONFIRM_CANCEL_APPOINTMENT', 'RESCHEDULE_SELECT_DATE', 'RESCHEDULE_SELECT_TIME', 'HUMAN_HANDOFF'));

-- Busca por conversa (claim do worker) e limpeza/relatórios por atividade.
CREATE INDEX IF NOT EXISTS whatsapp_chatbot_sessions_salon_phone_idx ON public.whatsapp_chatbot_sessions (salon_id, client_phone);
CREATE INDEX IF NOT EXISTS whatsapp_chatbot_sessions_activity_idx ON public.whatsapp_chatbot_sessions (salon_id, last_interaction_at DESC);

CREATE OR REPLACE FUNCTION public.whatsapp_chatbot_sessions_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS whatsapp_chatbot_sessions_touch ON public.whatsapp_chatbot_sessions;
CREATE TRIGGER whatsapp_chatbot_sessions_touch BEFORE UPDATE ON public.whatsapp_chatbot_sessions
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_chatbot_sessions_touch();

ALTER TABLE public.whatsapp_chatbot_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Salon admins read chatbot sessions" ON public.whatsapp_chatbot_sessions;
CREATE POLICY "Salon admins read chatbot sessions" ON public.whatsapp_chatbot_sessions
  FOR SELECT TO authenticated USING (public.user_belongs_to_salon(salon_id));
DROP POLICY IF EXISTS "Workers manage chatbot sessions" ON public.whatsapp_chatbot_sessions;
CREATE POLICY "Workers manage chatbot sessions" ON public.whatsapp_chatbot_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON public.whatsapp_chatbot_sessions FROM anon, authenticated;
GRANT SELECT ON public.whatsapp_chatbot_sessions TO authenticated;
GRANT ALL ON public.whatsapp_chatbot_sessions TO service_role;

COMMIT;
