-- Avaliação pelo link público (/avaliar/:appointmentId), sem login.
-- Antes: INSERT direto em reviews exigia clients.user_id = auth.uid() (cliente logado) e client_id NOT NULL;
-- quem abre o link do WhatsApp é anônimo e o agendamento pode não ter client_id, então sempre falhava (RLS).
-- Agora: RPC SECURITY DEFINER valida o agendamento (concluído, até 30 dias) e grava uma avaliação por agendamento.
BEGIN;

-- Uma avaliação por agendamento (também protege contra duplo envio).
CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_appointment ON public.reviews(appointment_id) WHERE appointment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.submit_public_review(p_appointment_id uuid, p_rating integer, p_comment text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a appointments; v_client uuid; v_review uuid; v_comment text;
BEGIN
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'invalid_rating'; END IF;
  v_comment := nullif(btrim(left(coalesce(p_comment, ''), 1000)), '');
  SELECT * INTO a FROM appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'appointment_not_found'; END IF;
  IF a.status::text <> 'completed' THEN RAISE EXCEPTION 'appointment_not_completed'; END IF;
  IF a.date < current_date - 30 THEN RAISE EXCEPTION 'review_expired'; END IF;
  IF a.professional_id IS NULL THEN RAISE EXCEPTION 'appointment_without_professional'; END IF;

  SELECT id INTO v_review FROM reviews WHERE appointment_id = a.id;
  IF v_review IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'duplicate', true); END IF;

  -- Cliente do agendamento; sem vínculo, pelo telefone; sem cadastro, cria (mesma regra do WhatsApp).
  v_client := a.client_id;
  IF v_client IS NULL AND a.client_phone IS NOT NULL THEN
    SELECT id INTO v_client FROM clients WHERE salon_id = a.salon_id AND phone_normalized = a.client_phone ORDER BY created_at LIMIT 1;
  END IF;
  IF v_client IS NULL THEN
    INSERT INTO clients(salon_id, name, phone, phone_normalized)
    VALUES (a.salon_id, coalesce(nullif(a.client_name, ''), 'Cliente'), a.client_phone, a.client_phone) RETURNING id INTO v_client;
  END IF;

  INSERT INTO reviews(salon_id, client_id, professional_id, appointment_id, rating, comment, is_public)
  VALUES (a.salon_id, v_client, a.professional_id, a.id, p_rating, v_comment, true)
  ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_review;
  IF v_review IS NULL THEN RETURN jsonb_build_object('ok', true, 'duplicate', true); END IF;

  -- Pedido de avaliação do WhatsApp fica respondido (não cobra de novo).
  UPDATE whatsapp_review_requests SET review_id = v_review WHERE appointment_id = a.id AND review_id IS NULL;
  RETURN jsonb_build_object('ok', true, 'duplicate', false);
END $$;

REVOKE ALL ON FUNCTION public.submit_public_review(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_review(uuid, integer, text) TO anon, authenticated;

COMMIT;
