-- Pacotes no link público: o cliente compra um pacote (Pix manual ou provedor do salão) e usa os créditos ao agendar.
-- Pedido nasce pelo servidor (preço do banco, nunca do navegador). Pagou pelo provedor: créditos liberados sozinhos.
-- Pix manual: o dono confirma no painel (Pacotes > Pedidos). Créditos são consultados e usados só pelo telefone do pedido.
BEGIN;

CREATE TABLE IF NOT EXISTS public.package_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.service_packages(id) ON DELETE RESTRICT,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL CHECK (length(btrim(client_name)) BETWEEN 2 AND 120),
  client_phone text NOT NULL CHECK (client_phone ~ '^\+[1-9][0-9]{7,14}$'),
  amount_cents integer NOT NULL CHECK (amount_cents >= 100),
  method text NOT NULL CHECK (method IN ('pix_manual', 'pix', 'card', 'link')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'expired')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS package_orders_salon ON public.package_orders(salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS package_orders_phone ON public.package_orders(salon_id, client_phone);
ALTER TABLE public.package_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read package orders" ON public.package_orders;
CREATE POLICY "Owners read package orders" ON public.package_orders FOR SELECT TO authenticated USING (public.whatsapp_can_manage_salon(salon_id));
REVOKE ALL ON public.package_orders FROM anon, authenticated;
GRANT SELECT ON public.package_orders TO authenticated;
GRANT ALL ON public.package_orders TO service_role;

-- Cobrança pode ser de agendamento OU de pacote.
ALTER TABLE public.payment_charges ALTER COLUMN appointment_id DROP NOT NULL;
ALTER TABLE public.payment_charges ADD COLUMN IF NOT EXISTS package_order_id uuid REFERENCES public.package_orders(id) ON DELETE CASCADE;
ALTER TABLE public.payment_charges DROP CONSTRAINT IF EXISTS payment_charges_target_check;
ALTER TABLE public.payment_charges ADD CONSTRAINT payment_charges_target_check CHECK ((appointment_id IS NULL) <> (package_order_id IS NULL));

-- Créditos: de qual pedido vieram (idempotência) e uso por agendamento.
ALTER TABLE public.client_credits ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.package_orders(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS client_credits_order_service ON public.client_credits(order_id, service_id) WHERE order_id IS NOT NULL;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS credit_id uuid REFERENCES public.client_credits(id) ON DELETE SET NULL;

-- Libera os créditos do pedido (uma vez só). Usado pelo provedor (payment_mark_paid) e pelo dono (Pix manual).
CREATE OR REPLACE FUNCTION public.package_order_fulfill(p_order_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o package_orders; pk service_packages; v_client uuid; v_inst uuid; v_value text;
BEGIN
  SELECT * INTO o FROM package_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF o.status = 'paid' THEN RETURN true; END IF;
  IF o.status <> 'pending' THEN RAISE EXCEPTION 'order_closed'; END IF;
  SELECT * INTO pk FROM service_packages WHERE id = o.package_id;
  v_client := o.client_id;
  IF v_client IS NULL THEN SELECT id INTO v_client FROM clients WHERE salon_id = o.salon_id AND portal_phone_key(coalesce(phone_normalized, phone)) = portal_phone_key(o.client_phone) ORDER BY created_at LIMIT 1; END IF;
  IF v_client IS NULL THEN
    INSERT INTO clients(salon_id, name, phone, phone_normalized) VALUES (o.salon_id, o.client_name, o.client_phone, o.client_phone) RETURNING id INTO v_client;
  END IF;
  INSERT INTO client_credits(client_id, salon_id, package_id, service_id, remaining_uses, total_uses, expires_at, order_id)
  SELECT v_client, o.salon_id, o.package_id, i.service_id, i.quantity, i.quantity,
         CASE WHEN pk.validity_days > 0 THEN now() + make_interval(days => pk.validity_days) END, o.id
  FROM service_package_items i WHERE i.package_id = o.package_id
  ON CONFLICT (order_id, service_id) WHERE order_id IS NOT NULL DO NOTHING;
  UPDATE package_orders SET status = 'paid', paid_at = now(), client_id = v_client, updated_at = now() WHERE id = o.id;
  INSERT INTO payments(salon_id, client_id, package_id, amount, payment_method, payment_status, payment_type, metadata, paid_at)
  VALUES (o.salon_id, v_client, o.package_id, o.amount_cents / 100.0, CASE o.method WHEN 'card' THEN 'credit_card' WHEN 'link' THEN 'online' ELSE 'pix' END,
          'paid', 'package', jsonb_build_object('package_order_id', o.id), now());
  v_value := replace(to_char(o.amount_cents / 100.0, 'FM999999990.00'), '.', ',');
  INSERT INTO admin_notifications(salon_id, type, title, message, client_name, client_phone, metadata)
  VALUES (o.salon_id, 'package_sold', '🎁 Pacote vendido', format('%s comprou o pacote %s (R$ %s). Créditos liberados.', o.client_name, pk.name, v_value), o.client_name, o.client_phone, jsonb_build_object('package_order_id', o.id));
  SELECT id INTO v_inst FROM whatsapp_instances WHERE salon_id = o.salon_id;
  IF v_inst IS NOT NULL THEN
    INSERT INTO whatsapp_outbox(salon_id, instance_id, idempotency_key, category, recipient_phone, content_type, text_content)
    VALUES (o.salon_id, v_inst, 'package:' || o.id::text, 'transactional', o.client_phone, 'text',
      format(E'🎁 *Pacote %s liberado!*\n\nPagamento de R$ %s confirmado. Seus créditos já podem ser usados: ao agendar pelo link, responda que é assinante e informe este número.%s',
        pk.name, v_value, CASE WHEN pk.validity_days > 0 THEN format(E'\nValidade: %s dias.', pk.validity_days) ELSE '' END))
    ON CONFLICT (salon_id, idempotency_key) DO NOTHING;
  END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.package_order_fulfill(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.package_order_fulfill(uuid) TO service_role;

-- Dono confirma Pix manual (ou cancela) pelo painel.
CREATE OR REPLACE FUNCTION public.package_order_owner_action(p_order_id uuid, p_action text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o package_orders;
BEGIN
  SELECT * INTO o FROM package_orders WHERE id = p_order_id;
  IF NOT FOUND OR NOT public.whatsapp_can_manage_salon(o.salon_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_action = 'paid' THEN RETURN public.package_order_fulfill(o.id); END IF;
  IF p_action = 'cancel' THEN UPDATE package_orders SET status = 'cancelled', updated_at = now() WHERE id = o.id AND status = 'pending'; RETURN FOUND; END IF;
  RAISE EXCEPTION 'invalid_action';
END $$;
REVOKE ALL ON FUNCTION public.package_order_owner_action(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.package_order_owner_action(uuid, text) TO authenticated;

-- Pagamento de cobrança: agendamento (como antes) ou pacote.
CREATE OR REPLACE FUNCTION public.payment_mark_paid(p_charge_id uuid, p_paid_cents integer, p_method text DEFAULT NULL, p_external_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ch payment_charges; a appointments; v_inst uuid; v_value text; v_method text;
BEGIN
  SELECT * INTO ch FROM payment_charges WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF ch.status = 'paid' THEN RETURN true; END IF;
  IF p_paid_cents IS NULL OR p_paid_cents < ch.amount_cents THEN RAISE EXCEPTION 'amount_mismatch'; END IF;
  v_method := CASE WHEN p_method IN ('pix','card') THEN p_method WHEN ch.method = 'link' THEN 'link' ELSE ch.method END;
  UPDATE payment_charges SET status = 'paid', paid_at = now(), paid_amount_cents = p_paid_cents, paid_method = v_method,
    external_id = coalesce(external_id, p_external_id), updated_at = now(), last_checked_at = now() WHERE id = ch.id;
  IF ch.package_order_id IS NOT NULL THEN
    UPDATE package_orders SET method = v_method WHERE id = ch.package_order_id AND status = 'pending';
    RETURN public.package_order_fulfill(ch.package_order_id);
  END IF;
  SELECT * INTO a FROM appointments WHERE id = ch.appointment_id AND salon_id = ch.salon_id;
  IF NOT FOUND THEN RETURN true; END IF;
  INSERT INTO payments(salon_id, client_id, appointment_id, amount, payment_method, payment_status, payment_type, transaction_id, metadata, paid_at)
  VALUES (ch.salon_id, a.client_id, a.id, p_paid_cents / 100.0, CASE v_method WHEN 'card' THEN 'credit_card' WHEN 'link' THEN 'online' ELSE 'pix' END,
    'paid', 'appointment', coalesce(p_external_id, ch.external_id), jsonb_build_object('provider', ch.provider, 'charge_id', ch.id, 'channel', 'whatsapp'), now());
  UPDATE appointments SET status = 'confirmed' WHERE id = a.id AND status = 'pending';
  v_value := replace(to_char(p_paid_cents / 100.0, 'FM999999990.00'), '.', ',');
  INSERT INTO admin_notifications(salon_id, appointment_id, type, title, message, client_name, client_phone, appointment_date, appointment_time, metadata)
  VALUES (ch.salon_id, a.id, 'payment_received', '💰 Pagamento recebido',
    format('%s pagou R$ %s pelo WhatsApp (%s). Horário: %s às %s.', coalesce(nullif(a.client_name, ''), 'Cliente'), v_value, ch.provider, to_char(a.date, 'DD/MM'), to_char(a.start_time, 'HH24:MI')),
    a.client_name, a.client_phone, a.date, a.start_time, jsonb_build_object('charge_id', ch.id, 'provider', ch.provider));
  SELECT id INTO v_inst FROM whatsapp_instances WHERE salon_id = ch.salon_id;
  IF v_inst IS NOT NULL AND a.client_phone ~ '^\+[1-9][0-9]{6,14}$' THEN
    INSERT INTO whatsapp_outbox(salon_id, instance_id, idempotency_key, category, recipient_phone, content_type, text_content)
    VALUES (ch.salon_id, v_inst, 'payment:' || ch.id::text, 'transactional', a.client_phone, 'text',
      format(E'✅ *Pagamento de R$ %s recebido!*\n\nSeu horário de %s às %s está garantido. Obrigado! 💜\n\nDigite *0* para o menu.', v_value, to_char(a.date, 'DD/MM'), to_char(a.start_time, 'HH24:MI')))
    ON CONFLICT (salon_id, idempotency_key) DO NOTHING;
  END IF;
  RETURN true;
END $$;

-- Créditos ativos de um telefone neste salão (link público). Mostra só serviço, saldo e validade.
CREATE OR REPLACE FUNCTION public.public_client_credits(p_salon_id uuid, p_phone text)
RETURNS TABLE(credit_id uuid, service_id uuid, service text, package text, remaining integer, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cc.id, cc.service_id, s.name, p.name, cc.remaining_uses, cc.expires_at
  FROM client_credits cc JOIN clients c ON c.id = cc.client_id AND c.salon_id = p_salon_id
  JOIN services s ON s.id = cc.service_id LEFT JOIN service_packages p ON p.id = cc.package_id
  WHERE cc.salon_id = p_salon_id AND cc.remaining_uses > 0 AND (cc.expires_at IS NULL OR cc.expires_at > now())
    AND length(public.portal_phone_key(p_phone)) BETWEEN 10 AND 13
    AND public.portal_phone_key(coalesce(c.phone_normalized, c.phone)) = public.portal_phone_key(p_phone)
  ORDER BY cc.expires_at NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.public_client_credits(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_client_credits(uuid, text) TO anon, authenticated, service_role;

-- Uso do crédito ao agendar: o agendamento recém-criado (link público) informa credit_id; aqui o banco confere
-- telefone, serviço, saldo e validade, desconta 1 uso e zera o valor daquele serviço. Cancelado devolve o uso.
CREATE OR REPLACE FUNCTION public.appointments_apply_credit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cc client_credits; v_phone text; v_price numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.credit_id IS NULL THEN RETURN NEW; END IF;
    SELECT cc2.* INTO cc FROM client_credits cc2 WHERE cc2.id = NEW.credit_id FOR UPDATE;
    SELECT coalesce(phone_normalized, phone) INTO v_phone FROM clients WHERE id = cc.client_id;
    IF cc.id IS NULL OR cc.salon_id <> NEW.salon_id OR cc.service_id <> NEW.service_id OR cc.remaining_uses < 1
       OR (cc.expires_at IS NOT NULL AND cc.expires_at <= now())
       OR public.portal_phone_key(v_phone) <> public.portal_phone_key(NEW.client_phone) THEN
      RAISE EXCEPTION 'invalid_credit';
    END IF;
    UPDATE client_credits SET remaining_uses = remaining_uses - 1 WHERE id = cc.id;
    SELECT price INTO v_price FROM services WHERE id = NEW.service_id;
    NEW.client_id := coalesce(NEW.client_id, cc.client_id);
    NEW.final_price := greatest(0, coalesce(NEW.final_price, NEW.price, 0) - coalesce(v_price, 0));
    NEW.notes := concat_ws(' | ', NEW.notes, '🎁 Usou 1 crédito do pacote');
    RETURN NEW;
  END IF;
  -- UPDATE: cancelado/faltou devolve o crédito uma vez.
  IF NEW.credit_id IS NOT NULL AND NEW.status::text IN ('cancelled') AND OLD.status::text NOT IN ('cancelled') THEN
    UPDATE client_credits SET remaining_uses = least(total_uses, remaining_uses + 1) WHERE id = NEW.credit_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS appointments_apply_credit ON public.appointments;
CREATE TRIGGER appointments_apply_credit BEFORE INSERT OR UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.appointments_apply_credit();

COMMIT;

-- Rollback:
-- DROP TRIGGER IF EXISTS appointments_apply_credit ON public.appointments;
-- DROP FUNCTION IF EXISTS public.appointments_apply_credit(), public.public_client_credits(uuid,text), public.package_order_owner_action(uuid,text), public.package_order_fulfill(uuid);
-- ALTER TABLE public.appointments DROP COLUMN IF EXISTS credit_id; ALTER TABLE public.client_credits DROP COLUMN IF EXISTS order_id;
-- ALTER TABLE public.payment_charges DROP CONSTRAINT IF EXISTS payment_charges_target_check; ALTER TABLE public.payment_charges DROP COLUMN IF EXISTS package_order_id;
-- DROP TABLE IF EXISTS public.package_orders;
