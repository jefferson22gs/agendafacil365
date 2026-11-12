-- Pedido de avaliação pelo WhatsApp "preso na fila":
-- 1) saía só 15 min depois de Concluído (aparecia "Na fila" esse tempo todo) → agora sai na hora;
-- 2) a fila geral soltava 1 mensagem por minuto por conexão (o envio parava na espera de 3 s do gate) → o envio passa
--    a esperar o gate reabrir (whatsapp_outbox_wait_ms) e segue;
-- 3) com dois pedidos abertos para o mesmo cliente, a nota ia para o mais recente, não para o que foi clicado →
--    a mensagem respondida (id do WhatsApp) define o atendimento.
BEGIN;

DO $$
DECLARE def text := pg_get_functiondef('public.whatsapp_enqueue_review_request()'::regprocedure);
BEGIN
  EXECUTE replace(def, 'now() + interval ''15 minutes'')', 'now())');
END $$;

-- Milissegundos até a próxima mensagem vencida poder sair (gate da conexão). NULL = nada vencido na fila.
CREATE OR REPLACE FUNCTION public.whatsapp_outbox_wait_ms()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, whatsapp_private AS $$
  SELECT ceil(extract(epoch FROM min(greatest(gate.next_available_at, now())) - now()) * 1000)::integer
  FROM whatsapp_outbox o JOIN whatsapp_private.instance_dispatch gate ON gate.instance_id = o.instance_id
  WHERE o.status = 'pending' AND o.scheduled_for <= now() AND o.attempts < o.max_attempts;
$$;
REVOKE ALL ON FUNCTION public.whatsapp_outbox_wait_ms() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_outbox_wait_ms() TO service_role;

DROP FUNCTION IF EXISTS public.whatsapp_open_review_request(uuid, text);
CREATE OR REPLACE FUNCTION public.whatsapp_open_review_request(p_salon_id uuid, p_phone text, p_message_id text DEFAULT NULL)
RETURNS TABLE(appointment_id uuid, sent_at timestamptz, service text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.appointment_id, o.completed_at, sv.name FROM whatsapp_review_requests r
  JOIN whatsapp_outbox o ON o.salon_id = r.salon_id AND o.idempotency_key = 'review:' || r.appointment_id::text
  LEFT JOIN appointments a ON a.id = r.appointment_id LEFT JOIN services sv ON sv.id = a.service_id
  WHERE r.salon_id = p_salon_id AND r.phone = p_phone AND r.review_id IS NULL AND o.status IN ('accepted','delivered','read') AND o.completed_at > now() - interval '2 days'
  ORDER BY (p_message_id IS NOT NULL AND o.remote_message_id = p_message_id) DESC, r.requested_at DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.whatsapp_open_review_request(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_open_review_request(uuid, text, text) TO service_role;

COMMIT;
