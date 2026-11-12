-- Duas conexões por salão: API oficial (Meta) para o atendimento/bot com botões e Evolution (QR Code) para
-- Disparador e Status (a Meta não publica Status e cobra/limita mensagens de marketing fora da janela de 24 h).
-- Regra única de escolha: whatsapp_instance_for(salão, finalidade). Antes: uma conexão por salão (UNIQUE salon_id).
BEGIN;

ALTER TABLE public.whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_salon_id_key;
-- No máximo uma conexão de cada tipo por salão.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_instances_salon_provider ON public.whatsapp_instances(salon_id, provider);
CREATE INDEX IF NOT EXISTS whatsapp_instances_salon ON public.whatsapp_instances(salon_id);

-- Finalidade:
--  'chat'      atendimento, bot, confirmações, lembretes, avaliações, pagamentos → oficial se houver; senão Evolution.
--  'marketing' disparador e campanhas → Evolution se houver (sem custo/limite de modelo); senão oficial.
--  'status'    publicação de Status → somente Evolution.
-- Preferência por conexão conectada; sem nenhuma conectada, devolve a existente (a fila espera reconectar).
CREATE OR REPLACE FUNCTION public.whatsapp_instance_for(p_salon_id uuid, p_purpose text DEFAULT 'chat')
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM whatsapp_instances
  WHERE salon_id = p_salon_id AND (p_purpose <> 'status' OR provider = 'evolution')
  ORDER BY (status = 'connected') DESC,
    CASE WHEN p_purpose = 'chat' THEN (provider = 'meta') ELSE (provider = 'evolution') END DESC,
    created_at
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.whatsapp_instance_for(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_instance_for(uuid, text) TO authenticated, service_role;

-- Reescreve as funções que liam "a" conexão do salão (SELECT id INTO … FROM whatsapp_instances WHERE salon_id=…).
DO $$
DECLARE f record; def text; purpose text;
BEGIN
  FOR f IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('package_order_fulfill','payment_mark_paid','procedure_return_prepare','whatsapp_bridge_notifications',
      'whatsapp_create_campaign','whatsapp_enqueue_appointment_event','whatsapp_enqueue_confirmation','whatsapp_enqueue_due_status',
      'whatsapp_enqueue_review_request','whatsapp_bridge_legacy_status')
  LOOP
    purpose := CASE WHEN f.proname = 'whatsapp_create_campaign' THEN 'marketing'
                    WHEN f.proname IN ('whatsapp_enqueue_due_status','whatsapp_bridge_legacy_status') THEN 'status' ELSE 'chat' END;
    def := pg_get_functiondef(f.oid);
    def := regexp_replace(def,
      'SELECT\s+id\s+INTO\s+(\w+)\s+FROM\s+whatsapp_instances\s+WHERE\s+salon_id\s*=\s*([\w.]+)(\s+LIMIT\s+1)?',
      'SELECT public.whatsapp_instance_for(\2, ''' || purpose || ''') INTO \1', 'gi');
    EXECUTE def;
  END LOOP;
END $$;

-- Lembretes e aniversários: uma linha por salão (antes o JOIN duplicaria com duas conexões).
DO $$
DECLARE f record; def text;
BEGIN
  FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('whatsapp_enqueue_reminders','whatsapp_enqueue_birthdays')
  LOOP
    def := pg_get_functiondef(f.oid);
    def := regexp_replace(def, 'JOIN\s+whatsapp_instances\s+w\s+ON\s+w\.salon_id\s*=\s*(\w+)\.(\w+)',
      'JOIN whatsapp_instances w ON w.id = public.whatsapp_instance_for(\1.\2, ''chat'')', 'gi');
    EXECUTE def;
  END LOOP;
END $$;

-- Consulta de entrega (Evolution): a própria conexão que enviou, não "qualquer uma do salão".
CREATE OR REPLACE FUNCTION public.whatsapp_delivery_candidates(p_limit integer DEFAULT 20)
RETURNS TABLE(salon_id uuid, instance_id uuid, instance_name text, provider_message_id text)
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
 SELECT u.salon_id, w.id, w.instance_name, u.provider_message_id FROM u
 LEFT JOIN whatsapp_outbox o ON o.id = u.outbox_id
 JOIN whatsapp_instances w ON w.id = coalesce(o.instance_id, public.whatsapp_instance_for(u.salon_id, 'marketing'))
 WHERE w.status = 'connected' AND w.provider = 'evolution';
END $$;

COMMIT;
