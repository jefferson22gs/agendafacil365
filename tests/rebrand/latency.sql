-- Ensaio da latência do atendente (20261109000100_whatsapp_reply_latency.sql). Nada é enviado, nada persiste.
-- Rodar no banco real com a migração aplicada, SEMPRE assim:  psql -v ON_ERROR_STOP=1 -f tests/rebrand/latency.sql
-- Espera: NOTICE 'latency: OK' e ROLLBACK no fim.
--
-- Por que nada sai para o WhatsApp:
--  * Tudo roda numa transação revertida; o envio só existe na Edge Function (Evolution), que não é chamada aqui.
--  * O trigger de kick chama pg_net, que só dispara a requisição após COMMIT. Com ROLLBACK, a fila do pg_net
--    também é descartada. Além disso, invoke_edge_function é trocada por um stub que só conta as chamadas
--    (CREATE OR REPLACE na transação: revertido no ROLLBACK; outras sessões continuam vendo a original).
--  * Nenhuma Edge Function de envio roda; status 'accepted' é gravado à mão só para exercitar o gate.
-- Efeitos colaterais (todos revertidos): pendências reais da fila ficam "canceladas" durante o ensaio (para o
-- claim global só ver os itens do ensaio) e o passo 7 remove por instantes a CHECK de telefone de
-- whatsapp_webhook_events (bloqueia a tabela até o ROLLBACK, milissegundos). Rode fora de horário de pico.

BEGIN;
SET LOCAL lock_timeout = '5s';

-- Stub: conta chamadas em vez de chamar pg_net (revertido pelo ROLLBACK).
CREATE TEMP TABLE kick_calls(fn text, at timestamptz DEFAULT clock_timestamp()) ON COMMIT DROP;
CREATE OR REPLACE FUNCTION public.invoke_edge_function(p_function text, p_body jsonb DEFAULT '{}'::jsonb)
RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN INSERT INTO kick_calls(fn) VALUES(p_function); RETURN 0; END $$;

DO $$
DECLARE
  sal uuid; inst uuid; r public.whatsapp_outbox; e public.whatsapp_webhook_events;
  ev1 uuid; ev2 uuid; ev3 uuid; evg uuid; n integer; claim uuid; ok boolean; v jsonb;
BEGIN
  SELECT id INTO sal FROM public.salons ORDER BY id LIMIT 1;
  IF sal IS NULL THEN RAISE EXCEPTION 'fixture_salon_required'; END IF;
  -- Instância fictícia: whatsapp_instances.salon_id pode ser UNIQUE; usa a existente se houver.
  SELECT id INTO inst FROM public.whatsapp_instances WHERE salon_id=sal;
  IF inst IS NULL THEN
    inst := gen_random_uuid();
    INSERT INTO public.whatsapp_instances(id,salon_id,instance_name,status) VALUES(inst,sal,'ensaio_latencia','disconnected');
  END IF;
  -- Isola o ensaio da fila real (tudo revertido no fim).
  UPDATE public.whatsapp_outbox SET status='cancelled' WHERE status IN('pending','processing');
  UPDATE public.whatsapp_webhook_events SET status='ignored' WHERE status IN('pending','processing');
  DELETE FROM whatsapp_private.instance_dispatch WHERE instance_id=inst;

  -- 1) Kick: 1 chamada por conversa nova; rajada da mesma conversa não duplica; reentrega (ON CONFLICT) não chama.
  -- now() é fixo na transação: created_at explícito para ordem determinística.
  INSERT INTO public.whatsapp_webhook_events(salon_id,instance_id,event_type,provider_message_id,sender_phone,payload,created_at)
   VALUES(sal,inst,'messages.upsert','ENSAIO-1','+5511900000001','{"text":"oi"}',now()-interval '3 seconds') RETURNING id INTO ev1;
  INSERT INTO public.whatsapp_webhook_events(salon_id,instance_id,event_type,provider_message_id,sender_phone,payload,created_at)
   VALUES(sal,inst,'messages.upsert','ENSAIO-2','+5511900000001','{"text":"quero agendar"}',now()-interval '2 seconds') RETURNING id INTO ev2;
  INSERT INTO public.whatsapp_webhook_events(salon_id,instance_id,event_type,provider_message_id,sender_phone,payload,created_at)
   VALUES(sal,inst,'messages.upsert','ENSAIO-3','+5511900000002','{"text":"preço?"}',now()-interval '1 second') RETURNING id INTO ev3;
  INSERT INTO public.whatsapp_webhook_events(salon_id,instance_id,event_type,provider_message_id,sender_phone,payload)
   VALUES(sal,inst,'messages.upsert','ENSAIO-1','+5511900000001','{"text":"oi"}') ON CONFLICT DO NOTHING;
  SELECT count(*) INTO n FROM kick_calls WHERE fn='whatsapp-inbound-worker';
  IF n<>2 THEN RAISE EXCEPTION 'kick esperado 2 (1 por conversa), veio %', n; END IF;

  -- 2) Claim inbound por conversa: ev1 primeiro; com ev1 em processamento, ev2 (mesma conversa) espera e ev3 segue.
  SELECT * INTO e FROM public.whatsapp_claim_inbound();
  IF e.id IS DISTINCT FROM ev1 THEN RAISE EXCEPTION 'claim 1 esperado ev1'; END IF;
  SELECT * INTO e FROM public.whatsapp_claim_inbound();
  IF e.id IS DISTINCT FROM ev3 THEN RAISE EXCEPTION 'claim 2 esperado ev3 (outra conversa), veio %', e.id; END IF;
  SELECT * INTO e FROM public.whatsapp_claim_inbound();
  IF e.id IS NOT NULL THEN RAISE EXCEPTION 'ev2 não pode ser pego com ev1 em processamento'; END IF;

  -- 3) Finalização: resposta com 3 mensagens -> 3 itens chatbot em ordem, sem espera de 2 s entre eles.
  SELECT claim_token INTO claim FROM public.whatsapp_webhook_events WHERE id=ev1;
  ok := public.whatsapp_finish_inbound_v2(ev1,claim,'[{"type":"text","text":"a"},{"type":"text","text":"b"},{"type":"text","text":"c"}]'::jsonb,'deterministic','ensaio');
  IF NOT ok THEN RAISE EXCEPTION 'finish_v2 falhou'; END IF;
  SELECT count(*) INTO n FROM public.whatsapp_outbox WHERE source_event_id=ev1 AND category='chatbot';
  IF n<>3 THEN RAISE EXCEPTION 'esperado 3 itens, veio %', n; END IF;
  IF (SELECT max(scheduled_for)-min(scheduled_for) FROM public.whatsapp_outbox WHERE source_event_id=ev1) > interval '1 second' THEN
    RAISE EXCEPTION 'itens ainda espaçados artificialmente';
  END IF;
  -- now() é fixo na transação: recua os itens (+1 ms entre eles) para já estarem devidos, mantendo a ordem.
  UPDATE public.whatsapp_outbox SET scheduled_for=scheduled_for-interval '1 minute' WHERE source_event_id=ev1;
  -- Idempotência: finalizar de novo com o mesmo claim não duplica.
  ok := public.whatsapp_finish_inbound_v2(ev1,claim,'[{"type":"text","text":"a"}]'::jsonb,'deterministic','ensaio');
  IF ok THEN RAISE EXCEPTION 'segunda finalização deveria ser recusada'; END IF;
  SELECT count(*) INTO n FROM public.whatsapp_outbox WHERE source_event_id=ev1;
  IF n<>3 THEN RAISE EXCEPTION 'duplicou outbox'; END IF;
  -- Agora ev2 (mesma conversa) é liberado.
  SELECT * INTO e FROM public.whatsapp_claim_inbound();
  IF e.id IS DISTINCT FROM ev2 THEN RAISE EXCEPTION 'ev2 deveria ser liberado após ev1'; END IF;

  -- 4) Prioridade: campanha mais antiga na fila, mas a conversa sai antes.
  INSERT INTO public.whatsapp_outbox(salon_id,instance_id,idempotency_key,category,recipient_phone,text_content,scheduled_for,created_at)
   VALUES(sal,inst,'ensaio-mkt-1','marketing','+5511900000009','promo',now()-interval '10 minutes',now()-interval '10 minutes');
  SELECT * INTO r FROM public.whatsapp_claim_outbox();
  IF r.category<>'chatbot' OR r.text_content<>'a' THEN RAISE EXCEPTION 'claim deveria pegar a 1ª mensagem da conversa, veio % %', r.category, r.text_content; END IF;
  -- Mesma instância em voo: nada mais sai.
  IF EXISTS(SELECT 1 FROM public.whatsapp_claim_outbox()) THEN RAISE EXCEPTION 'dois itens da mesma instância em voo'; END IF;
  ok := public.whatsapp_finish_outbox(r.id,r.claim_token,'accepted','ENSAIO-MSG-A',NULL);

  -- 5) Gate por categoria: conversa espera 1 s (não 3 s); campanha continua 3 s.
  SELECT * INTO r FROM public.whatsapp_claim_outbox();
  IF r.id IS NOT NULL THEN RAISE EXCEPTION 'gate de 1 s não respeitado'; END IF;
  UPDATE whatsapp_private.instance_dispatch SET last_claim_at=now()-interval '1.2 seconds', next_available_at=now()+interval '1.8 seconds' WHERE instance_id=inst;
  SELECT * INTO r FROM public.whatsapp_claim_outbox();
  IF r.category IS DISTINCT FROM 'chatbot' OR r.text_content<>'b' THEN RAISE EXCEPTION 'conversa deveria sair após 1 s (ordem b), veio %', r.text_content; END IF;
  ok := public.whatsapp_finish_outbox(r.id,r.claim_token,'accepted','ENSAIO-MSG-B',NULL);
  UPDATE whatsapp_private.instance_dispatch SET last_claim_at=now()-interval '1.2 seconds', next_available_at=now()+interval '1.8 seconds' WHERE instance_id=inst;
  SELECT * INTO r FROM public.whatsapp_claim_outbox();
  IF r.text_content IS DISTINCT FROM 'c' THEN RAISE EXCEPTION 'ordem da resposta quebrada'; END IF;
  ok := public.whatsapp_finish_outbox(r.id,r.claim_token,'accepted','ENSAIO-MSG-C',NULL);
  -- Só a campanha resta: com 1,2 s desde o último claim ela NÃO sai (precisa de 3 s).
  UPDATE whatsapp_private.instance_dispatch SET last_claim_at=now()-interval '1.2 seconds', next_available_at=now()+interval '1.8 seconds' WHERE instance_id=inst;
  IF EXISTS(SELECT 1 FROM public.whatsapp_claim_outbox()) THEN RAISE EXCEPTION 'campanha furou o gate de 3 s'; END IF;
  -- Pausa (desconectado/limite = +5 min) também segura a conversa.
  INSERT INTO public.whatsapp_outbox(salon_id,instance_id,idempotency_key,category,recipient_phone,text_content)
   VALUES(sal,inst,'ensaio-chat-pausa','chatbot','+5511900000001','oi de novo');
  UPDATE whatsapp_private.instance_dispatch SET last_claim_at=now()-interval '10 seconds', next_available_at=now()+interval '5 minutes' WHERE instance_id=inst;
  IF EXISTS(SELECT 1 FROM public.whatsapp_claim_outbox()) THEN RAISE EXCEPTION 'conversa furou a pausa da instância'; END IF;
  UPDATE whatsapp_private.instance_dispatch SET next_available_at=now()-interval '1 second' WHERE instance_id=inst;
  SELECT * INTO r FROM public.whatsapp_claim_outbox();
  IF r.idempotency_key<>'ensaio-chat-pausa' THEN RAISE EXCEPTION 'após a pausa a conversa ainda vem primeiro'; END IF;
  ok := public.whatsapp_finish_outbox(r.id,r.claim_token,'cancelled',NULL,'ensaio');
  UPDATE whatsapp_private.instance_dispatch SET next_available_at=now()-interval '1 second' WHERE instance_id=inst;
  SELECT * INTO r FROM public.whatsapp_claim_outbox();
  IF r.category<>'marketing' THEN RAISE EXCEPTION 'campanha deveria sair com o gate livre'; END IF;
  ok := public.whatsapp_finish_outbox(r.id,r.claim_token,'cancelled',NULL,'ensaio');

  -- 6) Envio imediato (filtro por evento) não pega item de outro evento.
  SELECT claim_token INTO claim FROM public.whatsapp_webhook_events WHERE id=ev3;
  ok := public.whatsapp_finish_inbound(ev3,claim,'resposta','deterministic','ensaio');
  UPDATE whatsapp_private.instance_dispatch SET next_available_at=now()-interval '1 second' WHERE instance_id=inst;
  IF EXISTS(SELECT 1 FROM public.whatsapp_claim_outbox_v2(ev1,false)) THEN RAISE EXCEPTION 'filtro por evento pegou item de outro evento'; END IF;
  SELECT * INTO r FROM public.whatsapp_claim_outbox_v2(ev3,false);
  IF r.source_event_id IS DISTINCT FROM ev3 THEN RAISE EXCEPTION 'filtro por evento não pegou o item dele'; END IF;
  ok := public.whatsapp_finish_outbox(r.id,r.claim_token,'cancelled',NULL,'ensaio');

  -- 7) Nunca grupo: evento com telefone fora do E.164 (simulado sem a CHECK da tabela) é ignorado, nada vai ao outbox.
  BEGIN
    -- Remove (só nesta transação) a CHECK de telefone da tabela de eventos, para simular um envelope de grupo que escapasse do webhook.
    FOR v IN SELECT to_jsonb(conname) FROM pg_constraint WHERE conrelid='public.whatsapp_webhook_events'::regclass AND contype='c'
      AND pg_get_constraintdef(oid) ILIKE '%sender_phone%' LOOP
      EXECUTE format('ALTER TABLE public.whatsapp_webhook_events DROP CONSTRAINT %I', v #>> '{}');
    END LOOP;
    INSERT INTO public.whatsapp_webhook_events(salon_id,instance_id,event_type,provider_message_id,sender_phone,payload,status,claim_token,lease_until,attempts)
     VALUES(sal,inst,'messages.upsert','ENSAIO-GRUPO','120363025246125123@g.us','{"text":"quero agendar"}','processing',gen_random_uuid(),now()+interval '1 minute',1)
     RETURNING id,claim_token INTO evg,claim;
    ok := public.whatsapp_finish_inbound(evg,claim,'Olá!','deterministic','ensaio');
    IF NOT ok OR (SELECT status FROM public.whatsapp_webhook_events WHERE id=evg)<>'ignored' THEN RAISE EXCEPTION 'evento de grupo deveria ficar ignored'; END IF;
    UPDATE public.whatsapp_webhook_events SET status='processing',claim_token=claim,lease_until=now()+interval '1 minute' WHERE id=evg;
    ok := public.whatsapp_finish_inbound_v2(evg,claim,'[{"type":"text","text":"Olá!"}]'::jsonb,'deterministic','ensaio');
    IF (SELECT count(*) FROM public.whatsapp_outbox WHERE source_event_id=evg)<>0 THEN RAISE EXCEPTION 'resposta para grupo foi ao outbox'; END IF;
  END;
  -- CHECK do outbox recusa chatbot sem destino individual.
  BEGIN
    INSERT INTO public.whatsapp_outbox(salon_id,instance_id,idempotency_key,category,recipient_phone,text_content)
     VALUES(sal,inst,'ensaio-chat-sem-destino','chatbot',NULL,'x');
    RAISE EXCEPTION 'CHECK whatsapp_outbox_chatbot_private não barrou';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- 8) Métrica responde (valores reais do período; só confere o formato).
  v := public.whatsapp_reply_latency(now()-interval '7 days', now()+interval '1 minute');
  IF NOT (v ? 'p50_ms' AND v ? 'p95_ms' AND v ? 'replies') THEN RAISE EXCEPTION 'métrica sem campos'; END IF;
  RAISE NOTICE 'métrica (inclui itens do ensaio): %', v;

  RAISE NOTICE 'latency: OK';
END $$;

ROLLBACK;

-- Consulta avulsa (somente leitura) do tempo de resposta real dos últimos 7 dias:
--   SELECT public.whatsapp_reply_latency(now()-interval '7 days', now());
