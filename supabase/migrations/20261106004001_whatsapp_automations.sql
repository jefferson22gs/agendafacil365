-- Automações WhatsApp: lembretes (cron por minuto), aniversário às 9h locais com cupom opcional, flags novas.
-- Roda depois de 20261106004000 (atendente), que também cria review_enabled/interactive_enabled com os mesmos nomes/defaults.
-- Rollback (manual):
--   SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('whatsapp-reminders-minute','whatsapp-birthdays-hourly');
--   SELECT cron.schedule('birthday-messages-daily','0 9 * * *',$c$SELECT public.invoke_edge_function('auto-birthday-messages')$c$);
--   ALTER TABLE public.whatsapp_automation_settings ALTER COLUMN reminder_minutes SET DEFAULT ARRAY[1440,120],
--     DROP COLUMN birthday_coupon_enabled, DROP COLUMN birthday_coupon_validity_days;
--   Restaurar whatsapp_enqueue_reminders/whatsapp_enqueue_birthdays da definição anterior (prod-functions).
BEGIN;

-- Só novas linhas: salões existentes mantêm a escolha atual (sem ativação/alteração silenciosa).
ALTER TABLE public.whatsapp_automation_settings
  ALTER COLUMN reminder_minutes SET DEFAULT ARRAY[1440,120,30,15],
  ADD COLUMN IF NOT EXISTS review_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interactive_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS birthday_coupon_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS birthday_coupon_validity_days integer NOT NULL DEFAULT 30
    CHECK (birthday_coupon_validity_days BETWEEN 1 AND 365);

-- Lembretes: chave por agendamento + horário + minutos (independe de updated_at).
-- Mudança de status/dados sem mudar horário atualiza a linha ainda pendente (ou reativa a cancelada por
-- appointment_changed) em vez de duplicar; já enviada nunca reenvia. Remarcação gera chave nova; a antiga
-- é cancelada pelo worker (expected_appointment_version diverge).
CREATE OR REPLACE FUNCTION public.whatsapp_enqueue_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE a record; m integer; n integer := 0; c integer; v_at timestamptz; v_text text; BEGIN
 FOR a IN SELECT ap.id, ap.salon_id, ap.date, ap.start_time, ap.status, ap.client_phone, ap.updated_at,
   s.timezone, s.name AS salon_name, nullif(concat_ws(', ', nullif(btrim(s.address), ''), nullif(btrim(s.city), ''), nullif(btrim(s.state), '')), '') AS salon_address,
   sv.name AS service_name, p.name AS professional_name, w.id AS instance_id, cfg.reminder_minutes
  FROM appointments ap JOIN salons s ON s.id = ap.salon_id
  JOIN services sv ON sv.id = ap.service_id AND sv.salon_id = ap.salon_id
  LEFT JOIN professionals p ON p.id = ap.professional_id AND p.salon_id = ap.salon_id
  JOIN whatsapp_instances w ON w.salon_id = ap.salon_id
  JOIN whatsapp_automation_settings cfg ON cfg.salon_id = ap.salon_id AND cfg.reminders_enabled
  WHERE ap.status IN ('pending','confirmed') AND ap.client_phone ~ '^\+[1-9][0-9]{6,14}$'
  AND (ap.date + ap.start_time) AT TIME ZONE s.timezone > now()
  AND (ap.date + ap.start_time) AT TIME ZONE s.timezone <= now() + interval '2 days' LOOP
  v_text := concat('Lembrete: ', a.service_name,
    CASE WHEN a.professional_name IS NOT NULL THEN ' com ' || a.professional_name END,
    ' no ', a.salon_name, ' em ', to_char(a.date, 'DD/MM/YYYY'), ' às ', to_char(a.start_time, 'HH24:MI'), '.',
    CASE WHEN a.salon_address IS NOT NULL THEN E'\nEndereço: ' || a.salon_address END,
    CASE WHEN a.status = 'pending' THEN E'\nSolicitação ainda pendente de confirmação.' ELSE E'\nAté breve!' END);
  FOREACH m IN ARRAY a.reminder_minutes LOOP
   v_at := ((a.date + a.start_time) AT TIME ZONE a.timezone) - make_interval(mins => m);
   -- Agendamento criado dentro da janela: lembrete já vencido não dispara.
   CONTINUE WHEN v_at <= now();
   INSERT INTO whatsapp_outbox AS o (salon_id, instance_id, appointment_id, idempotency_key, category, recipient_phone, text_content, scheduled_for, expected_appointment_version)
   VALUES (a.salon_id, a.instance_id, a.id, 'reminder:' || a.id::text || ':' || (a.date + a.start_time)::text || ':' || m::text,
    'transactional', a.client_phone, v_text, v_at, a.updated_at)
   ON CONFLICT (salon_id, idempotency_key) DO UPDATE SET
    text_content = EXCLUDED.text_content, recipient_phone = EXCLUDED.recipient_phone, instance_id = EXCLUDED.instance_id,
    expected_appointment_version = EXCLUDED.expected_appointment_version,
    status = 'pending', error_code = NULL, attempts = CASE WHEN o.status = 'cancelled' THEN 0 ELSE o.attempts END, completed_at = NULL, claim_token = NULL, lease_until = NULL, send_started_at = NULL
   WHERE o.expected_appointment_version IS DISTINCT FROM EXCLUDED.expected_appointment_version
    AND (o.status = 'pending' OR (o.status = 'cancelled' AND o.error_code = 'appointment_changed'));
   GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  END LOOP;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_enqueue_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_enqueue_reminders() TO service_role;

-- Aniversário: a partir das 9h no fuso do salão, no máximo 1 por cliente/ano (chave birthday:<cliente>:<ano>).
-- 29/02 em ano não bissexto envia em 28/02. Opt-out: clients.marketing_opt_out + whatsapp_marketing_suppression
-- (o worker revalida ambos no envio). Cupom individual de uso único (max_uses=1) só com birthday_coupon_enabled.
CREATE OR REPLACE FUNCTION public.whatsapp_enqueue_birthdays()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE c record; n integer := 0; v_outbox uuid; v_code text; v_coupon boolean; v_text text; BEGIN
 FOR c IN SELECT cl.id, cl.name, cl.phone_normalized, cl.salon_id, s.name AS salon_name, w.id AS instance_id,
   (now() AT TIME ZONE s.timezone) AS local_now, cfg.birthday_coupon_enabled, cfg.birthday_coupon_validity_days,
   s.birthday_discount_percent
  FROM clients cl JOIN salons s ON s.id = cl.salon_id JOIN whatsapp_instances w ON w.salon_id = s.id
  JOIN whatsapp_automation_settings cfg ON cfg.salon_id = s.id AND cfg.birthday_enabled
  WHERE cl.birth_date IS NOT NULL AND cl.phone_normalized IS NOT NULL AND NOT coalesce(cl.marketing_opt_out, false)
  AND extract(hour FROM now() AT TIME ZONE s.timezone) >= 9
  AND (to_char(cl.birth_date, 'MM-DD') = to_char(now() AT TIME ZONE s.timezone, 'MM-DD')
   OR (to_char(cl.birth_date, 'MM-DD') = '02-29' AND to_char(now() AT TIME ZONE s.timezone, 'MM-DD') = '02-28'
    AND extract(day FROM make_date(extract(year FROM now() AT TIME ZONE s.timezone)::int, 3, 1) - 1) = 28))
  AND NOT EXISTS (SELECT 1 FROM whatsapp_marketing_suppression b WHERE b.salon_id = cl.salon_id AND b.phone = cl.phone_normalized)
  -- Compatível com a chave diária anterior: não repete no dia da implantação.
  AND NOT EXISTS (SELECT 1 FROM whatsapp_outbox o WHERE o.salon_id = cl.salon_id
   AND o.idempotency_key = 'birthday:' || cl.id::text || ':' || (now() AT TIME ZONE s.timezone)::date::text) LOOP
  v_coupon := c.birthday_coupon_enabled AND coalesce(c.birthday_discount_percent, 0) BETWEEN 1 AND 100;
  -- Código aleatório: cupons ativos são legíveis publicamente por policy, então não pode ser adivinhável.
  v_code := CASE WHEN v_coupon THEN 'NIVER' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)) END;
  v_text := concat('Olá, ', c.name, '! O ', c.salon_name, ' deseja um feliz aniversário!',
    CASE WHEN v_coupon THEN format(E'\nPresente: %s%% de desconto com o cupom %s, uso único, válido por %s dias.',
      c.birthday_discount_percent, v_code, c.birthday_coupon_validity_days) END);
  v_outbox := NULL;
  INSERT INTO whatsapp_outbox (salon_id, instance_id, idempotency_key, category, recipient_phone, text_content)
  VALUES (c.salon_id, c.instance_id, 'birthday:' || c.id::text || ':' || extract(year FROM c.local_now)::int::text,
   'marketing', c.phone_normalized, v_text)
  ON CONFLICT (salon_id, idempotency_key) DO NOTHING RETURNING id INTO v_outbox;
  CONTINUE WHEN v_outbox IS NULL; -- já enviado/enfileirado este ano: sem novo cupom.
  IF v_coupon THEN
   INSERT INTO coupons (salon_id, code, type, value, max_uses, uses_count, valid_from, valid_until, is_new_clients_only, is_active)
   VALUES (c.salon_id, v_code, 'percentage', c.birthday_discount_percent, 1, 0, now(),
    now() + make_interval(days => c.birthday_coupon_validity_days), false, true);
  END IF;
  n := n + 1;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.whatsapp_enqueue_birthdays() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_enqueue_birthdays() TO service_role;

-- Crons idempotentes. birthday-messages-daily (09h UTC = 06h SP) é substituído pelo horário local via hourly.
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN ('whatsapp-reminders-minute', 'whatsapp-birthdays-hourly', 'birthday-messages-daily');
  PERFORM cron.schedule('whatsapp-reminders-minute', '* * * * *', $c$SELECT public.whatsapp_enqueue_reminders()$c$);
  PERFORM cron.schedule('whatsapp-birthdays-hourly', '5 * * * *', $c$SELECT public.whatsapp_enqueue_birthdays()$c$);
END $$;

COMMIT;
