-- Ensaio da migração 20261109000300_whatsapp_premium.sql (rodar DEPOIS de aplicá-la). Nada persiste, nada é enviado.
--   psql -v ON_ERROR_STOP=1 -f tests/rebrand/premium.sql      Espera: NOTICE 'premium: OK' e ROLLBACK no fim.
-- Por que nada sai: tudo numa transação revertida; envio só existe nas Edge Functions (não chamadas aqui);
-- invoke_edge_function vira stub (CREATE OR REPLACE dentro da transação, revertido). pg_net só dispara após COMMIT.
-- Cobre: (F) confirmação manual/automática + mensagem única + conflito continua barrando; (C) reserva v2 com status
-- real, cupom inválido e pente-fino de pgcrypto; (A) status honesto + reenvio idempotente; (D) métrica v2.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE OR REPLACE FUNCTION public.invoke_edge_function(p_function text, p_body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN RETURN 0; END $$;

-- Primeiro horário livre (grade oficial) a partir de amanhã para o profissional/serviço.
CREATE FUNCTION pg_temp.free_slot(p_salon uuid, p_pro uuid, p_svc uuid, OUT d date, OUT t time) LANGUAGE plpgsql AS $$
DECLARE i int; s text[]; BEGIN
 FOR i IN 2..40 LOOP
  d := current_date + i; s := public.get_available_time_slots(p_salon, p_pro, p_svc, d);
  IF cardinality(s) > 0 THEN t := s[1]::time; RETURN; END IF;
 END LOOP;
 RAISE EXCEPTION 'fixture_sem_horario_livre';
END $$;

DO $$
DECLARE
  sal public.salons; svc public.services; pro uuid; inst uuid; d date; t time;
  a public.appointments; b public.appointments; n int; txt text; ev uuid; r jsonb; ob uuid; msg uuid; st text;
  anon_claims text := '{"role":"anon"}';
BEGIN
  SELECT s.* INTO sal FROM public.salons s WHERE s.owner_id IS NOT NULL
   AND EXISTS(SELECT 1 FROM public.services x WHERE x.salon_id=s.id AND coalesce(x.is_active,true) AND x.duration_minutes>0)
   AND EXISTS(SELECT 1 FROM public.professionals p WHERE p.salon_id=s.id AND coalesce(p.is_active,true))
   ORDER BY s.created_at LIMIT 1;
  IF sal.id IS NULL THEN RAISE EXCEPTION 'fixture_salon_required'; END IF;
  SELECT * INTO svc FROM public.services WHERE salon_id=sal.id AND coalesce(is_active,true) AND duration_minutes>0 ORDER BY created_at LIMIT 1;
  SELECT id INTO pro FROM public.professionals WHERE salon_id=sal.id AND coalesce(is_active,true) ORDER BY created_at LIMIT 1;
  SELECT id INTO inst FROM public.whatsapp_instances WHERE salon_id=sal.id;
  IF inst IS NULL THEN
   inst := gen_random_uuid();
   INSERT INTO public.whatsapp_instances(id,salon_id,instance_name,status) VALUES(inst,sal.id,'ensaio_premium','connected');
  END IF;
  INSERT INTO public.whatsapp_automation_settings(salon_id,confirmation_enabled,chatbot_booking_enabled) VALUES(sal.id,true,true)
   ON CONFLICT(salon_id) DO UPDATE SET confirmation_enabled=true,chatbot_booking_enabled=true;

  -- 0) Migração: padrão manual; função morta removida.
  IF (SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='salons' AND column_name='auto_confirm_appointments') NOT ILIKE 'false%'
   THEN RAISE EXCEPTION 'default_auto_confirm_nao_false'; END IF;
  IF to_regprocedure('public.trigger_appointment_confirmation()') IS NOT NULL THEN RAISE EXCEPTION 'funcao_morta_existe'; END IF;

  -- 1) MANUAL: pedido do cliente (link/WhatsApp, sem gestor logado) nasce pending + "aguarda confirmação".
  UPDATE public.salons SET auto_confirm_appointments=false WHERE id=sal.id;
  PERFORM set_config('request.jwt.claims', anon_claims, true);
  SELECT * INTO d, t FROM pg_temp.free_slot(sal.id, pro, svc.id);
  INSERT INTO public.appointments(salon_id,service_id,professional_id,date,start_time,end_time,client_name,client_phone,status,price,final_price)
   VALUES(sal.id,svc.id,pro,d,t,t+make_interval(mins=>svc.duration_minutes),'Ensaio Manual','+5511999990001','pending',svc.price,svc.price) RETURNING * INTO a;
  IF a.status::text<>'pending' THEN RAISE EXCEPTION 'manual_deveria_ser_pending (%)', a.status; END IF;
  SELECT string_agg(text_content,' | '), count(*) INTO txt, n FROM public.whatsapp_outbox WHERE appointment_id=a.id;
  IF n<>1 OR txt NOT LIKE '%aguarda confirmação do salão%' THEN RAISE EXCEPTION 'manual_msg (%: %)', n, txt; END IF;
  IF EXISTS(SELECT 1 FROM public.push_outbox WHERE dedupe_key='appointment:'||a.id AND title<>'Agendamento aguardando sua confirmação')
   THEN RAISE EXCEPTION 'push_manual_titulo'; END IF;

  -- 2) Dono confirma pelo painel → "confirmado".
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','authenticated','sub',sal.owner_id)::text, true);
  UPDATE public.appointments SET status='confirmed' WHERE id=a.id;
  IF NOT EXISTS(SELECT 1 FROM public.whatsapp_outbox WHERE appointment_id=a.id AND idempotency_key LIKE '%:confirmed:%' AND text_content LIKE '%está confirmado ✅%')
   THEN RAISE EXCEPTION 'confirmacao_do_dono_sem_msg'; END IF;

  -- 3) AUTOMÁTICO: pedido do cliente nasce confirmed, UMA mensagem só ("confirmado", nunca "aguarda").
  UPDATE public.salons SET auto_confirm_appointments=true WHERE id=sal.id;
  PERFORM set_config('request.jwt.claims', anon_claims, true);
  SELECT * INTO d, t FROM pg_temp.free_slot(sal.id, pro, svc.id);
  INSERT INTO public.appointments(salon_id,service_id,professional_id,date,start_time,end_time,client_name,client_phone,status,price,final_price)
   VALUES(sal.id,svc.id,pro,d,t,t+make_interval(mins=>svc.duration_minutes),'Ensaio Auto','+5511999990002','pending',svc.price,svc.price) RETURNING * INTO b;
  IF b.status::text<>'confirmed' THEN RAISE EXCEPTION 'auto_deveria_ser_confirmed (%)', b.status; END IF;
  SELECT string_agg(text_content,' | '), count(*) INTO txt, n FROM public.whatsapp_outbox WHERE appointment_id=b.id;
  IF n<>1 OR txt NOT LIKE '%está confirmado ✅%' OR txt LIKE '%aguarda%' THEN RAISE EXCEPTION 'auto_msg (%: %)', n, txt; END IF;
  IF EXISTS(SELECT 1 FROM public.push_outbox WHERE dedupe_key='appointment:'||b.id AND title<>'Novo agendamento confirmado')
   THEN RAISE EXCEPTION 'push_auto_titulo'; END IF;

  -- 4) AUTOMÁTICO não fura validação: mesmo horário/profissional continua barrado.
  BEGIN
   INSERT INTO public.appointments(salon_id,service_id,professional_id,date,start_time,end_time,client_name,client_phone,status,price,final_price)
    VALUES(sal.id,svc.id,pro,b.date,b.start_time,b.end_time,'Ensaio Conflito','+5511999990003','pending',svc.price,svc.price);
   RAISE EXCEPTION 'conflito_aceito_no_modo_auto';
  EXCEPTION WHEN raise_exception THEN
   IF SQLERRM NOT IN('slot_conflict','slot_unavailable') THEN RAISE; END IF;
  END;

  -- 5) Painel do dono no modo automático: o que ele escolheu é mantido (pending continua pending).
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','authenticated','sub',sal.owner_id)::text, true);
  SELECT * INTO d, t FROM pg_temp.free_slot(sal.id, pro, svc.id);
  INSERT INTO public.appointments(salon_id,service_id,professional_id,date,start_time,end_time,client_name,client_phone,status,price,final_price)
   VALUES(sal.id,svc.id,pro,d,t,t+make_interval(mins=>svc.duration_minutes),'Ensaio Painel',NULL,'pending',svc.price,svc.price) RETURNING status::text INTO st;
  IF st<>'pending' THEN RAISE EXCEPTION 'painel_alterado_pelo_auto (%)', st; END IF;

  -- 6) Reserva v2 (WhatsApp): devolve status real; cupom inválido barra; gen_random_bytes OK com search_path=public.
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  INSERT INTO public.whatsapp_webhook_events(salon_id,instance_id,event_type,provider_message_id,sender_phone,payload,status)
   VALUES(sal.id,inst,'messages.upsert','ENSAIO-PREMIUM-1','+5511999990004','{"text":"confirmar"}','processing') RETURNING id INTO ev;
  SELECT * INTO d, t FROM pg_temp.free_slot(sal.id, pro, svc.id);
  BEGIN
   PERFORM public.whatsapp_book_appointment_v2(ev,svc.id,pro,d,t,'Ensaio Cupom','+5511999990004',NULL,'NAO-EXISTE-XYZ','ensaio-premium-cupom');
   RAISE EXCEPTION 'cupom_invalido_aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'invalid_coupon' THEN RAISE; END IF; END;
  r := public.whatsapp_book_appointment_v2(ev,svc.id,pro,d,t,'Ensaio Whats','+5511999990004',NULL,NULL,'ensaio-premium-0001');
  IF r->>'status'<>'confirmed' THEN RAISE EXCEPTION 'v2_status (%)', r; END IF;
  IF (public.whatsapp_book_appointment_v2(ev,svc.id,pro,d,t,'Ensaio Whats','+5511999990004',NULL,NULL,'ensaio-premium-0001')->>'duplicate')::boolean IS NOT TRUE
   THEN RAISE EXCEPTION 'v2_idempotencia'; END IF;
  BEGIN
   PERFORM public.whatsapp_book_appointment_v2(ev,svc.id,pro,d,t,'Ensaio Ocupado','+5511999990004',NULL,NULL,'ensaio-premium-0002');
   RAISE EXCEPTION 'v2_horario_ocupado_aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT IN('slot_conflict','slot_unavailable') THEN RAISE; END IF; END;
  txt := current_setting('search_path');
  PERFORM set_config('search_path', 'public', true); -- mesmo contexto das RPCs SECURITY DEFINER
  IF length(public.generate_cancellation_token())<>64 THEN RAISE EXCEPTION 'token_cancelamento'; END IF;
  PERFORM set_config('search_path', txt, true);
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.prokind='f' AND NOT EXISTS(SELECT 1 FROM pg_depend x WHERE x.objid=p.oid AND x.deptype='e')
     AND p.prosrc ~* '(^|[^.[:alnum:]_])(gen_random_bytes|digest|crypt|gen_salt|hmac|uuid_generate_v[14]|pgp_sym_encrypt|pgp_sym_decrypt)[[:space:]]*\('
     AND NOT EXISTS(SELECT 1 FROM unnest(coalesce(p.proconfig,'{}')) c WHERE c ILIKE 'search_path=%extensions%');
  IF n>0 THEN RAISE EXCEPTION 'funcoes_pgcrypto_sem_esquema %', n; END IF;

  -- 7) Status honesto: fila → enviada (1 tique) → entregue; aceite atrasado não rebaixa; reenvio idempotente.
  INSERT INTO public.whatsapp_outbox(salon_id,instance_id,idempotency_key,category,recipient_phone,text_content)
   VALUES(sal.id,inst,'ensaio-premium-status','chatbot','+5511999990005','oi') RETURNING id INTO ob;
  SELECT id, status INTO msg, st FROM public.whatsapp_messages WHERE outbox_id=ob;
  IF st IS DISTINCT FROM 'queued' THEN RAISE EXCEPTION 'fila (%)', st; END IF;
  UPDATE public.whatsapp_outbox SET status='accepted',remote_message_id='ENSAIOPREMIUM01' WHERE id=ob;
  IF (SELECT status FROM public.whatsapp_messages WHERE id=msg)<>'sent' THEN RAISE EXCEPTION 'aceito_deveria_ser_sent'; END IF;
  PERFORM public.whatsapp_record_delivery(sal.id,inst,'ENSAIOPREMIUM01','delivered');
  IF (SELECT status FROM public.whatsapp_messages WHERE id=msg)<>'delivered' THEN RAISE EXCEPTION 'entregue'; END IF;
  UPDATE public.whatsapp_outbox SET status='accepted' WHERE id=ob; -- já era delivered no outbox: força transição
  UPDATE public.whatsapp_outbox SET status='failed',error_code='ensaio' WHERE id=ob;
  IF (SELECT status FROM public.whatsapp_messages WHERE id=msg)<>'delivered' THEN RAISE EXCEPTION 'rebaixou_entregue'; END IF;
  INSERT INTO public.whatsapp_outbox(salon_id,instance_id,idempotency_key,category,recipient_phone,text_content)
   VALUES(sal.id,inst,'ensaio-premium-falha','chatbot','+5511999990005','falhou') RETURNING id INTO ob;
  UPDATE public.whatsapp_outbox SET status='failed',error_code='provider_rejected' WHERE id=ob;
  SELECT id INTO msg FROM public.whatsapp_messages WHERE outbox_id=ob;
  IF NOT public.whatsapp_retry_outbox(sal.id,msg) THEN RAISE EXCEPTION 'reenvio'; END IF;
  IF public.whatsapp_retry_outbox(sal.id,msg) THEN RAISE EXCEPTION 'reenvio_duplicado'; END IF;
  IF (SELECT status FROM public.whatsapp_outbox WHERE id=ob)<>'pending' OR (SELECT status FROM public.whatsapp_messages WHERE id=msg)<>'queued'
   THEN RAISE EXCEPTION 'reenvio_status'; END IF;
  IF public.whatsapp_retry_outbox(gen_random_uuid(),msg) THEN RAISE EXCEPTION 'reenvio_outro_salao'; END IF;
  PERFORM * FROM public.whatsapp_delivery_candidates(5);

  -- 8) Métrica v2: chaves novas presentes.
  r := public.whatsapp_reply_latency_v2(now()-interval '7 days', now());
  IF NOT (r ? 'evolution_p95_ms' AND r ? 'phone_to_reply_p95_ms' AND r ? 'evolution_samples') THEN RAISE EXCEPTION 'latencia_v2 %', r; END IF;

  RAISE NOTICE 'premium: OK';
END $$;
ROLLBACK;
