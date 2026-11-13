-- Terceira conexão: QR Code com botões (serviço whaileys, mesmo contrato HTTP da Evolution).
--  meta      = API oficial: botões e listas; sem Status.
--  evolution = QR Code: texto numerado/enquete; Disparador e Status.
--  whaileys  = QR Code com botões e listas (recurso não oficial; pode parar se o WhatsApp mudar); Disparador e Status.
-- O robô continua em UMA conexão por vez (whatsapp_set_bot_provider). Aditiva: nada existente muda de comportamento.
BEGIN;

ALTER TABLE public.whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_provider_check;
ALTER TABLE public.whatsapp_instances ADD CONSTRAINT whatsapp_instances_provider_check CHECK (provider IN ('evolution', 'meta', 'whaileys'));
ALTER TABLE public.whatsapp_automation_settings DROP CONSTRAINT IF EXISTS whatsapp_automation_settings_bot_provider_check;
ALTER TABLE public.whatsapp_automation_settings ADD CONSTRAINT whatsapp_automation_settings_bot_provider_check
  CHECK (bot_provider IS NULL OR bot_provider IN ('meta', 'evolution', 'whaileys'));

-- Conexões por QR Code (Evolution ou botões) publicam Status e fazem Disparador; a oficial não.
CREATE OR REPLACE FUNCTION public.whatsapp_instance_for(p_salon_id uuid, p_purpose text DEFAULT 'chat')
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM whatsapp_instances
  WHERE salon_id = p_salon_id AND (p_purpose <> 'status' OR provider IN ('evolution', 'whaileys'))
  ORDER BY
    CASE WHEN p_purpose = 'chat' THEN (provider = public.whatsapp_bot_provider(p_salon_id)) ELSE false END DESC,
    (status = 'connected') DESC,
    CASE WHEN p_purpose = 'chat' THEN (provider = 'meta') ELSE (provider IN ('evolution', 'whaileys')) END DESC,
    -- Entre os dois QR Code, a Evolution (estável) vem antes para Disparador e Status.
    (provider = 'evolution') DESC,
    created_at
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_set_bot_provider(p_salon_id uuid, p_provider text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.whatsapp_can_manage_salon(p_salon_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_provider NOT IN ('meta', 'evolution', 'whaileys') THEN RAISE EXCEPTION 'invalid_provider'; END IF;
  IF NOT EXISTS (SELECT 1 FROM whatsapp_instances WHERE salon_id = p_salon_id AND provider = p_provider) THEN RAISE EXCEPTION 'connection_missing'; END IF;
  INSERT INTO whatsapp_automation_settings(salon_id, bot_provider) VALUES (p_salon_id, p_provider)
  ON CONFLICT (salon_id) DO UPDATE SET bot_provider = EXCLUDED.bot_provider, updated_at = now();
  -- Conversas em andamento recomeçam no menu da nova conexão (estado de botões não vale para números e vice-versa).
  UPDATE whatsapp_chatbot_sessions SET current_step = 'IDLE', session_data = '{}'::jsonb WHERE salon_id = p_salon_id AND current_step NOT IN ('IDLE', 'HUMAN_HANDOFF');
  RETURN p_provider;
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_set_bot_provider(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_set_bot_provider(uuid, text) TO authenticated;

-- Consulta ativa de entrega: vale para as duas conexões por QR Code e diz qual delas consultar (`provider`).
DROP FUNCTION IF EXISTS public.whatsapp_delivery_candidates(integer);
CREATE FUNCTION public.whatsapp_delivery_candidates(p_limit integer DEFAULT 20)
RETURNS TABLE(salon_id uuid, instance_id uuid, instance_name text, provider_message_id text, provider text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 RETURN QUERY
 WITH c AS (
  SELECT m.id FROM whatsapp_messages m
  WHERE m.direction='out' AND m.status='sent' AND m.provider_message_id IS NOT NULL AND m.provider_message_id NOT LIKE 'wamid.%'
   AND m.created_at BETWEEN now()-interval '24 hours' AND now()-interval '30 seconds'
   AND coalesce(m.delivery_next_check_at,'-infinity'::timestamptz)<=now()
  ORDER BY m.created_at DESC LIMIT least(greatest(coalesce(p_limit,20),1),50) FOR UPDATE SKIP LOCKED
 ), u AS (
  UPDATE whatsapp_messages m SET delivery_checks=m.delivery_checks+1,
   delivery_next_check_at=now()+least(interval '30 minutes',make_interval(secs=>30*power(2,least(m.delivery_checks,6))::integer))
  FROM c WHERE m.id=c.id RETURNING m.salon_id, m.provider_message_id, m.outbox_id
 )
 SELECT u.salon_id, w.id, w.instance_name, u.provider_message_id, w.provider FROM u
 LEFT JOIN whatsapp_outbox o ON o.id = u.outbox_id
 JOIN whatsapp_instances w ON w.id = coalesce(o.instance_id, public.whatsapp_instance_for(u.salon_id, 'marketing'))
 WHERE w.status = 'connected' AND w.provider IN ('evolution', 'whaileys');
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_delivery_candidates(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_delivery_candidates(integer) TO service_role;

COMMIT;

-- Rollback: reaplicar whatsapp_instance_for e whatsapp_set_bot_provider de 20261113000200, as CHECKs sem 'whaileys'
-- (só depois de apagar instâncias whaileys) e whatsapp_delivery_candidates de 20261113000100.
