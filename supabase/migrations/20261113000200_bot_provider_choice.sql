-- O dono escolhe qual conexão atende o robô (fluxo guiado/IA): nunca as duas.
--  meta      = API oficial: botões e listas; sem Status e sem disparo livre (só 24 h / modelos pagos).
--  evolution = QR Code: atende 100% (opções numeradas/enquete, sem botões) e faz Disparador e Status.
-- A escolhida atende; a outra não responde automaticamente (mensagens ficam na Caixa de entrada).
BEGIN;

ALTER TABLE public.whatsapp_automation_settings ADD COLUMN IF NOT EXISTS bot_provider text
  CHECK (bot_provider IS NULL OR bot_provider IN ('meta', 'evolution'));
COMMENT ON COLUMN public.whatsapp_automation_settings.bot_provider IS 'Conexão que atende o robô. NULL = automático (oficial se houver).';

-- Escolha atual: definida pelo dono; sem escolha, a oficial (se conectada) senão o QR Code.
CREATE OR REPLACE FUNCTION public.whatsapp_bot_provider(p_salon_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT s.bot_provider FROM whatsapp_automation_settings s WHERE s.salon_id = p_salon_id
       AND EXISTS (SELECT 1 FROM whatsapp_instances i WHERE i.salon_id = p_salon_id AND i.provider = s.bot_provider)),
    (SELECT provider FROM whatsapp_instances WHERE salon_id = p_salon_id ORDER BY (status = 'connected') DESC, (provider = 'meta') DESC, created_at LIMIT 1));
$$;

-- 'chat' agora segue a escolha do dono (confirmações, lembretes e o robô saem pela mesma conexão do atendimento).
CREATE OR REPLACE FUNCTION public.whatsapp_instance_for(p_salon_id uuid, p_purpose text DEFAULT 'chat')
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM whatsapp_instances
  WHERE salon_id = p_salon_id AND (p_purpose <> 'status' OR provider = 'evolution')
  ORDER BY
    CASE WHEN p_purpose = 'chat' THEN (provider = public.whatsapp_bot_provider(p_salon_id)) ELSE false END DESC,
    (status = 'connected') DESC,
    CASE WHEN p_purpose = 'chat' THEN (provider = 'meta') ELSE (provider = 'evolution') END DESC,
    created_at
  LIMIT 1;
$$;

-- Troca pelo painel (dono/admin). Valida que a conexão escolhida existe.
CREATE OR REPLACE FUNCTION public.whatsapp_set_bot_provider(p_salon_id uuid, p_provider text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.whatsapp_can_manage_salon(p_salon_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_provider NOT IN ('meta', 'evolution') THEN RAISE EXCEPTION 'invalid_provider'; END IF;
  IF NOT EXISTS (SELECT 1 FROM whatsapp_instances WHERE salon_id = p_salon_id AND provider = p_provider) THEN RAISE EXCEPTION 'connection_missing'; END IF;
  INSERT INTO whatsapp_automation_settings(salon_id, bot_provider) VALUES (p_salon_id, p_provider)
  ON CONFLICT (salon_id) DO UPDATE SET bot_provider = EXCLUDED.bot_provider, updated_at = now();
  -- Conversas em andamento recomeçam no menu da nova conexão (estado de botões não vale para números e vice-versa).
  UPDATE whatsapp_chatbot_sessions SET current_step = 'IDLE', session_data = '{}'::jsonb WHERE salon_id = p_salon_id AND current_step NOT IN ('IDLE', 'HUMAN_HANDOFF');
  RETURN p_provider;
END $$;

REVOKE ALL ON FUNCTION public.whatsapp_bot_provider(uuid), public.whatsapp_set_bot_provider(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_bot_provider(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_set_bot_provider(uuid, text) TO authenticated;

-- Quem já usava a oficial continua nela.
UPDATE whatsapp_automation_settings s SET bot_provider = 'meta'
WHERE bot_provider IS NULL AND EXISTS (SELECT 1 FROM whatsapp_instances i WHERE i.salon_id = s.salon_id AND i.provider = 'meta');

COMMIT;
