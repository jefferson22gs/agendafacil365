-- Ensaio do push completo no banco real. Rodar DEPOIS de aplicar 20261109000200_web_push.sql, sempre assim:
--   BEGIN;
--   \i tests/rebrand/push-full.sql
--   ROLLBACK;
-- Nada persiste e nenhum serviço de push é chamado (o kick via pg_net só sairia no COMMIT).
-- Usa o primeiro salão ativo com dono, serviço e profissional. Falha = RAISE EXCEPTION com o nome do cenário.
-- Claims usados: anon (visitante), authenticated+sub=dono (painel), service_role sem sub (cliente pelo link/WhatsApp:
-- passa na validação de agenda como o bot e não é gestor, então o aviso vai para o dono).

DO $$
DECLARE
  sal public.salons;
  v_service uuid; v_prof uuid; v_tz text;
  ep_owner text := 'https://fcm.googleapis.com/fcm/send/ensaio-owner-' || gen_random_uuid();
  ep_client text := 'https://updates.push.services.mozilla.com/wpush/v2/ensaio-client-' || gen_random_uuid();
  ep_other text := 'https://web.push.apple.com/ensaio-other-' || gen_random_uuid();
  k_p256 text := 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
  k_auth text := 'BTBZMqHH6r4Tts7J_aSIgg';
  sub_owner uuid; sub_client uuid; sub_other uuid;
  appt public.appointments; appt2 public.appointments;
  t0 timestamp; n integer; j jsonb; v_job uuid;
BEGIN
  SELECT s.* INTO sal FROM public.salons s
   WHERE s.owner_id IS NOT NULL AND s.slug IS NOT NULL AND coalesce(s.is_active, true) AND coalesce(s.pwa_enabled, true)
     AND EXISTS (SELECT 1 FROM public.services sv WHERE sv.salon_id = s.id) AND EXISTS (SELECT 1 FROM public.professionals p WHERE p.salon_id = s.id)
   ORDER BY s.created_at LIMIT 1;
  IF sal.id IS NULL THEN RAISE EXCEPTION 'fixture_salon_required'; END IF;
  SELECT id INTO v_service FROM public.services WHERE salon_id = sal.id ORDER BY created_at LIMIT 1;
  SELECT id INTO v_prof FROM public.professionals WHERE salon_id = sal.id ORDER BY created_at LIMIT 1;
  v_tz := coalesce(sal.timezone, 'America/Sao_Paulo');
  DELETE FROM public.push_preferences WHERE salon_id = sal.id; -- dentro do ROLLBACK: parte do padrão (tudo ligado)

  -- 1) Visitante (anon): validação no registro; nenhuma leitura de tabela/fila; RPC FCM antiga desativada.
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.register_web_push(sal.slug, 'https://evil.com/push/' || repeat('x', 30), k_p256, k_auth); RAISE EXCEPTION 'endpoint_ssrf_aceito';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN PERFORM public.register_web_push(sal.slug, ep_client, 'curta', k_auth); RAISE EXCEPTION 'chave_invalida_aceita';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  sub_client := public.register_web_push(sal.slug, ep_client, k_p256, k_auth, '{"platform":"android","evil":"x"}');
  sub_other := public.register_web_push(sal.slug, ep_other, k_p256, k_auth);
  IF (public.web_push_status(sal.slug, ep_client) ->> 'subscribed')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'status_anon'; END IF;
  IF (public.web_push_status(sal.slug, ep_owner) ->> 'subscribed')::boolean IS TRUE THEN RAISE EXCEPTION 'status_de_outro_endpoint'; END IF;
  BEGIN PERFORM 1 FROM public.push_subscriptions LIMIT 1; RAISE EXCEPTION 'anon_le_inscricoes';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM public.push_outbox LIMIT 1; RAISE EXCEPTION 'anon_le_fila';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM 1 FROM public.push_appointment_links LIMIT 1; RAISE EXCEPTION 'anon_le_vinculos';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.push_overview(sal.id); RAISE EXCEPTION 'anon_overview';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.push_claim_outbox(1); RAISE EXCEPTION 'anon_claim';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.push_enqueue_campaign(sal.id, 'x', 'y'); RAISE EXCEPTION 'anon_campanha';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.register_push_subscription(sal.slug, repeat('a', 40)); RAISE EXCEPTION 'rpc_fcm_antiga_ativa';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'client_outdated' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'postgres', true);
  IF (SELECT user_id FROM public.push_subscriptions WHERE id = sub_client) IS NOT NULL THEN RAISE EXCEPTION 'anon_com_user'; END IF;
  IF (SELECT device_info ? 'evil' FROM public.push_subscriptions WHERE id = sub_client) THEN RAISE EXCEPTION 'device_info_livre'; END IF;
  IF EXISTS (SELECT 1 FROM public.push_subscriptions WHERE is_active AND web_endpoint IS NULL) THEN RAISE EXCEPTION 'fcm_legado_ainda_ativo'; END IF;

  -- 2) Dono logado: aparelho fica com user_id do dono; painel nunca lê endpoint/chaves; contagens.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', sal.owner_id)::text, true);
  PERFORM set_config('role', 'authenticated', true);
  sub_owner := public.register_web_push(sal.slug, ep_owner, k_p256, k_auth);
  BEGIN PERFORM p256dh FROM public.push_subscriptions LIMIT 1; RAISE EXCEPTION 'dono_le_chave';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM web_endpoint FROM public.push_subscriptions LIMIT 1; RAISE EXCEPTION 'dono_le_endpoint';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  j := public.push_overview(sal.id);
  IF (j ->> 'my_devices')::int < 1 OR (j ->> 'client_devices')::int < 2 THEN RAISE EXCEPTION 'overview_contagem %', j; END IF;
  BEGIN PERFORM public.push_health(); EXCEPTION WHEN insufficient_privilege THEN NULL; END; -- só super admin (dono comum: negado)
  PERFORM set_config('role', 'postgres', true);
  IF (SELECT user_id FROM public.push_subscriptions WHERE id = sub_owner) IS DISTINCT FROM sal.owner_id THEN RAISE EXCEPTION 'dono_sem_vinculo'; END IF;

  -- 3) Novo agendamento → 1 item "owner" idempotente; destino só o aparelho do dono; sino sem duplicata.
  t0 := date_trunc('day', now() AT TIME ZONE v_tz) + interval '20 days 5 hours 7 minutes';
  INSERT INTO public.appointments (salon_id, service_id, professional_id, date, start_time, end_time, client_name, client_phone, status, price, final_price)
  VALUES (sal.id, v_service, v_prof, t0::date, t0::time, (t0 + interval '30 minutes')::time, 'Ensaio Push', '+5511999990000', 'pending', 0, 0)
  RETURNING * INTO appt;
  SELECT id INTO v_job FROM public.push_outbox WHERE dedupe_key = 'appointment:' || appt.id AND audience = 'owner' AND kind = 'new_appointment';
  IF v_job IS NULL THEN RAISE EXCEPTION 'novo_agendamento_fila'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.push_job_targets(v_job) t WHERE t.id = sub_owner)
     OR EXISTS (SELECT 1 FROM public.push_job_targets(v_job) t WHERE t.id IN (sub_client, sub_other)) THEN RAISE EXCEPTION 'alvo_owner_errado'; END IF;
  SELECT count(*) INTO n FROM public.admin_notifications WHERE appointment_id = appt.id AND type = 'new_appointment';
  IF n > 1 THEN RAISE EXCEPTION 'sino_duplicado %', n; END IF;

  -- 4) Vínculo aparelho ↔ agendamento exige o cancellation_token (prova de posse); não aceita id nem chute.
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('role', 'anon', true);
  IF public.link_web_push_appointment(ep_client, 'chute' || repeat('x', 40)) THEN RAISE EXCEPTION 'vinculo_sem_posse'; END IF;
  IF public.link_web_push_appointment(ep_client, appt.id::text) THEN RAISE EXCEPTION 'vinculo_por_id'; END IF;
  IF NOT public.link_web_push_appointment(ep_client, appt.cancellation_token) THEN RAISE EXCEPTION 'vinculo_com_posse_falhou'; END IF;
  PERFORM set_config('role', 'postgres', true);

  -- 5) Dono confirma pelo painel → aviso ao CLIENTE, só o aparelho vinculado.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', sal.owner_id)::text, true);
  UPDATE public.appointments SET status = 'confirmed' WHERE id = appt.id;
  SELECT id INTO v_job FROM public.push_outbox WHERE dedupe_key = 'client_confirmed:' || appt.id AND audience = 'appointment';
  IF v_job IS NULL THEN RAISE EXCEPTION 'confirmacao_cliente'; END IF;
  IF (SELECT array_agg(t.id) FROM public.push_job_targets(v_job) t) IS DISTINCT FROM ARRAY[sub_client] THEN RAISE EXCEPTION 'confirmacao_alvo'; END IF;

  -- 6) Cliente remarca pelo link (sem gestor) → aviso ao DONO. Preferência desligada → nada.
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.appointments SET start_time = (t0 + interval '1 hour')::time, end_time = (t0 + interval '90 minutes')::time WHERE id = appt.id;
  IF NOT EXISTS (SELECT 1 FROM public.push_outbox WHERE dedupe_key LIKE 'appointment_rescheduled:' || appt.id || ':%' AND audience = 'owner') THEN RAISE EXCEPTION 'remarcacao_dono'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', sal.owner_id)::text, true);
  PERFORM set_config('role', 'authenticated', true);
  j := public.push_set_preferences(sal.id, '{"appointment_cancelled": false, "reminder_minutes": 1440, "lixo": true}');
  IF (j ->> 'appointment_cancelled')::boolean OR (j ->> 'reminder_minutes')::int <> 1440 OR j ? 'lixo' THEN RAISE EXCEPTION 'pref_salvar %', j; END IF;
  BEGIN PERFORM public.push_set_preferences(sal.id, '{"reminder_minutes": 5}'); RAISE EXCEPTION 'pref_minutos_invalidos';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.appointments SET status = 'cancelled' WHERE id = appt.id;
  IF EXISTS (SELECT 1 FROM public.push_outbox WHERE dedupe_key = 'appointment_cancelled:' || appt.id) THEN RAISE EXCEPTION 'preferencia_ignorada'; END IF;

  -- 7) Concluído → pedido de avaliação 1 h depois, URL /avaliar/:id, só o aparelho vinculado.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', sal.owner_id)::text, true);
  UPDATE public.appointments SET status = 'completed' WHERE id = appt.id;
  IF NOT EXISTS (SELECT 1 FROM public.push_outbox WHERE dedupe_key = 'review_request:' || appt.id AND audience = 'appointment'
                   AND next_attempt_at > now() + interval '50 minutes' AND url = '/avaliar/' || appt.id) THEN RAISE EXCEPTION 'pedido_avaliacao'; END IF;
  IF EXISTS (SELECT 1 FROM public.push_claim_outbox(100) c WHERE c.dedupe_key = 'review_request:' || appt.id) THEN RAISE EXCEPTION 'avaliacao_saiu_antes'; END IF;

  -- 8) Lembrete (janela 1440 min): enfileira 1 vez; atrasado expira e não sai.
  t0 := date_trunc('hour', now() AT TIME ZONE v_tz) + interval '2 hours 13 minutes';
  IF (t0 + interval '30 minutes')::date <> t0::date THEN t0 := t0 - interval '1 hour'; END IF;
  INSERT INTO public.appointments (salon_id, service_id, professional_id, date, start_time, end_time, client_name, client_phone, status, price, final_price)
  VALUES (sal.id, v_service, v_prof, t0::date, t0::time, (t0 + interval '30 minutes')::time, 'Ensaio Lembrete', '+5511999990001', 'confirmed', 0, 0)
  RETURNING * INTO appt2;
  PERFORM set_config('role', 'anon', true);
  PERFORM public.link_web_push_appointment(ep_client, appt2.cancellation_token);
  PERFORM set_config('role', 'postgres', true);
  PERFORM public.push_enqueue_reminders(); PERFORM public.push_enqueue_reminders();
  SELECT count(*) INTO n FROM public.push_outbox WHERE dedupe_key LIKE 'client_reminder:' || appt2.id || ':%';
  IF n <> 1 THEN RAISE EXCEPTION 'lembrete_quantidade %', n; END IF;
  UPDATE public.push_outbox SET expires_at = now() - interval '1 minute' WHERE dedupe_key LIKE 'client_reminder:' || appt2.id || ':%';
  PERFORM public.push_claim_outbox(100);
  IF (SELECT status FROM public.push_outbox WHERE dedupe_key LIKE 'client_reminder:' || appt2.id || ':%') <> 'expired' THEN RAISE EXCEPTION 'lembrete_atrasado_saiu'; END IF;

  -- 9) Campanha: opt-out respeitado no alvo; limite de 3 por 24 h.
  PERFORM set_config('role', 'anon', true);
  IF NOT public.web_push_set_marketing(sal.slug, ep_other, false) THEN RAISE EXCEPTION 'optout_falhou'; END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', sal.owner_id)::text, true);
  PERFORM set_config('role', 'authenticated', true);
  FOR n IN 1..3 LOOP
    BEGIN PERFORM public.push_enqueue_campaign(sal.id, 'Ensaio', 'Campanha ' || n);
    EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'rate_limited' THEN RAISE; END IF; END; -- salão real pode já ter campanhas hoje
  END LOOP;
  BEGIN PERFORM public.push_enqueue_campaign(sal.id, 'Ensaio', 'Quarta'); RAISE EXCEPTION 'limite_campanha_ignorado';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'rate_limited' THEN RAISE; END IF; END;
  PERFORM set_config('role', 'postgres', true);
  SELECT id INTO v_job FROM public.push_outbox WHERE salon_id = sal.id AND kind = 'marketing' ORDER BY created_at DESC LIMIT 1;
  IF v_job IS NOT NULL AND EXISTS (SELECT 1 FROM public.push_job_targets(v_job) t WHERE t.id IN (sub_other, sub_owner)) THEN RAISE EXCEPTION 'campanha_alvo_errado'; END IF;

  -- 10) WhatsApp: mensagem do cliente com atendimento humano → 1 aviso por 10 min; IA pedindo ajuda → aviso.
  INSERT INTO public.whatsapp_conversation_state (salon_id, phone, human_takeover, taken_over_by, taken_over_at)
  VALUES (sal.id, '+5511988887777', true, NULL, now())
  ON CONFLICT (salon_id, phone) DO UPDATE SET human_takeover = true, taken_over_by = NULL, taken_over_at = now();
  IF NOT EXISTS (SELECT 1 FROM public.push_outbox WHERE salon_id = sal.id AND kind = 'whatsapp_handoff' AND url LIKE '%tel=%2B5511988887777') THEN RAISE EXCEPTION 'handoff'; END IF;
  INSERT INTO public.whatsapp_messages (salon_id, phone, direction, author, body) VALUES (sal.id, '+5511988887777', 'in', 'contact', 'oi');
  INSERT INTO public.whatsapp_messages (salon_id, phone, direction, author, body) VALUES (sal.id, '+5511988887777', 'in', 'contact', 'oi de novo');
  SELECT count(*) INTO n FROM public.push_outbox WHERE salon_id = sal.id AND kind = 'whatsapp_human' AND dedupe_key LIKE 'whatsapp_human:' || sal.id || ':+5511988887777:%';
  IF n <> 1 THEN RAISE EXCEPTION 'whatsapp_humano_quantidade %', n; END IF;

  -- 11) Avaliação recebida → aviso ao dono.
  IF appt.client_id IS NOT NULL THEN
    INSERT INTO public.reviews (salon_id, client_id, professional_id, appointment_id, rating) VALUES (sal.id, appt.client_id, v_prof, appt.id, 5);
    IF NOT EXISTS (SELECT 1 FROM public.push_outbox WHERE salon_id = sal.id AND kind = 'new_review' AND url = '/admin/reviews') THEN RAISE EXCEPTION 'avaliacao_dono'; END IF;
  ELSE
    RAISE NOTICE 'cenário 11 pulado: agendamento de ensaio sem client_id (reviews.client_id é obrigatório)';
  END IF;

  -- 12) Endpoint morto (o worker grava 'gone') sai dos alvos.
  UPDATE public.push_subscriptions SET is_active = false, deactivated_reason = 'gone' WHERE id = sub_client;
  IF EXISTS (SELECT 1 FROM public.push_job_targets((SELECT id FROM public.push_outbox WHERE dedupe_key = 'review_request:' || appt.id)) t) THEN RAISE EXCEPTION 'inativo_ainda_alvo'; END IF;

  RAISE NOTICE 'push-full.sql: todos os cenários passaram (salão %)', sal.slug;
END $$;
