-- AgendaFácil 365 Pro IA. Aditiva: não modifica o fluxo nem os registros existentes.
BEGIN;
ALTER TABLE public.whatsapp_automation_settings
 ADD COLUMN IF NOT EXISTS manager_assistant_enabled boolean NOT NULL DEFAULT true,
 ADD COLUMN IF NOT EXISTS manager_access_level text NOT NULL DEFAULT 'advanced' CHECK (manager_access_level IN ('basic','intermediate','advanced')),
 ADD COLUMN IF NOT EXISTS authorized_manager_phones text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.manager_expenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), salon_id uuid NOT NULL REFERENCES public.salons(id),
 description text NOT NULL CHECK (length(description) BETWEEN 2 AND 500), supplier text,
 amount numeric(12,2) NOT NULL CHECK (amount > 0), due_date date NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')), paid_at timestamptz,
 receipt_details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manager_expenses_salon_due ON public.manager_expenses(salon_id,due_date);
CREATE TABLE IF NOT EXISTS public.manager_pending_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), salon_id uuid NOT NULL REFERENCES public.salons(id),
 actor text NOT NULL, channel text NOT NULL CHECK(channel IN ('panel','whatsapp')), request_key text NOT NULL,
 action text NOT NULL, arguments jsonb NOT NULL, proposal jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','expired','superseded')),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
 result jsonb, UNIQUE(salon_id,actor,channel,request_key)
);
CREATE INDEX IF NOT EXISTS manager_pending_actor ON public.manager_pending_actions(salon_id,actor,channel,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS manager_one_pending ON public.manager_pending_actions(salon_id,actor,channel) WHERE status='pending';
CREATE TABLE IF NOT EXISTS public.manager_audit_logs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, salon_id uuid NOT NULL REFERENCES public.salons(id), actor text NOT NULL,
 channel text NOT NULL, source text NOT NULL DEFAULT 'AgendaFácil 365 Pro IA', action_id uuid NOT NULL UNIQUE REFERENCES public.manager_pending_actions(id),
 action text NOT NULL, details jsonb NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.manager_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_pending_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY manager_expenses_read ON public.manager_expenses FOR SELECT TO authenticated USING(public.whatsapp_can_manage_salon(salon_id));
CREATE POLICY manager_audit_read ON public.manager_audit_logs FOR SELECT TO authenticated USING(public.whatsapp_can_manage_salon(salon_id));
REVOKE ALL ON public.manager_expenses,public.manager_pending_actions,public.manager_audit_logs FROM anon,authenticated;
GRANT SELECT ON public.manager_expenses,public.manager_audit_logs TO authenticated;
GRANT ALL ON public.manager_expenses,public.manager_pending_actions,public.manager_audit_logs TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.manager_audit_logs_id_seq TO service_role;
-- Áudio não amplia o bucket de comprovantes dos clientes. Objetos privados, escritos/lidos só pelo worker.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('manager-media','manager-media',false,5242880,ARRAY['image/jpeg','image/png','image/webp','application/pdf','audio/ogg','audio/mpeg','audio/mp4','audio/wav'])
 ON CONFLICT(id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.manager_phone(p_value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN d ~ '^55[1-9][0-9]{9,10}$' THEN '+'||d WHEN d ~ '^[1-9][0-9]{9,10}$' THEN '+55'||d
 WHEN p_value ~ '^\+[1-9][0-9]{7,14}$' THEN p_value ELSE NULL END FROM (SELECT regexp_replace(coalesce(p_value,''),'[^0-9]','','g') d) s;
$$;
-- WhatsApp entrega alguns celulares do Brasil sem o 9 extra: compara as duas formas como o mesmo número.
CREATE OR REPLACE FUNCTION public.manager_phone_key(p_value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN p_value ~ '^\+55[1-9][0-9]9[0-9]{8}$' THEN '+55'||substr(p_value,4,2)||substr(p_value,7) ELSE p_value END;
$$;
-- Somente o servidor chama estas RPCs. Identidade do painel vem de getUser; a do WhatsApp do evento assinado.
CREATE OR REPLACE FUNCTION public.manager_authorize(p_salon uuid,p_actor text,p_channel text) RETURNS text
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s salons; cfg whatsapp_automation_settings; lvl text;
BEGIN
 SELECT * INTO s FROM salons WHERE id=p_salon AND is_active;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO cfg FROM whatsapp_automation_settings WHERE salon_id=p_salon;
 IF NOT coalesce(cfg.manager_assistant_enabled,true) THEN RETURN NULL; END IF;
 lvl:=coalesce(cfg.manager_access_level,'advanced');
 IF p_channel='panel' THEN
  IF p_actor !~ '^[0-9a-f-]{36}$' THEN RETURN NULL; END IF;
  IF s.owner_id=p_actor::uuid OR EXISTS(SELECT 1 FROM user_roles WHERE salon_id=p_salon AND user_id=p_actor::uuid AND role='admin') THEN RETURN lvl; END IF;
 ELSIF p_channel='whatsapp' AND p_actor ~ '^\+[1-9][0-9]{7,14}$' THEN
  IF public.manager_phone_key(p_actor)=public.manager_phone_key(public.manager_phone(s.phone))
   OR public.manager_phone_key(p_actor)=ANY(ARRAY(SELECT public.manager_phone_key(x) FROM unnest(coalesce(cfg.authorized_manager_phones,'{}')) x)) THEN RETURN lvl; END IF;
 END IF;
 RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.manager_settings_save(p_salon uuid,p_actor uuid,p_enabled boolean,p_level text,p_phones text[]) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM salons WHERE id=p_salon AND owner_id=p_actor) AND NOT EXISTS(SELECT 1 FROM user_roles WHERE salon_id=p_salon AND user_id=p_actor AND role='admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF p_enabled IS NULL OR p_level IS NULL OR p_level NOT IN ('basic','intermediate','advanced') OR p_phones IS NULL OR cardinality(p_phones)>20 OR EXISTS(SELECT 1 FROM unnest(p_phones) n WHERE n IS NULL OR n !~ '^\+[1-9][0-9]{7,14}$') THEN RAISE EXCEPTION 'invalid_settings'; END IF;
 INSERT INTO whatsapp_automation_settings(salon_id,manager_assistant_enabled,manager_access_level,authorized_manager_phones)
 VALUES(p_salon,p_enabled,p_level,p_phones) ON CONFLICT(salon_id) DO UPDATE SET manager_assistant_enabled=excluded.manager_assistant_enabled,manager_access_level=excluded.manager_access_level,authorized_manager_phones=excluded.authorized_manager_phones,updated_at=now();
 -- Uma mudança de autorização invalida propostas antigas, inclusive as criadas com nível mais alto.
 UPDATE manager_pending_actions SET status='superseded' WHERE salon_id=p_salon AND status='pending';
 RETURN true;
END $$;

-- Proposta canônica: referências sempre filtradas por salão. Nenhum texto gerado pela IA vira SQL.
CREATE OR REPLACE FUNCTION public.manager_plan(p_salon uuid,p_action text,p_args jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a appointments; c clients; sv services; pr professionals; e manager_expenses; o package_orders; r procedure_return_alerts;
 id uuid; d date; t time; original numeric; received numeric; discount numeric; interest numeric; fine numeric; method text; paid numeric; body jsonb; label text;
BEGIN
 IF p_args IS NULL OR jsonb_typeof(p_args)<>'object' OR length(p_args::text)>16000 THEN RAISE EXCEPTION 'invalid_arguments'; END IF;
 IF p_action='expense_create' THEN
  IF length(btrim(coalesce(p_args->>'description',''))) NOT BETWEEN 2 AND 500 THEN RAISE EXCEPTION 'description_required'; END IF;
  received:=(p_args->>'amount')::numeric; d:=(p_args->>'due_date')::date;
  IF received IS NULL OR received<=0 OR received>999999999 OR received<>round(received,2) OR d IS NULL THEN RAISE EXCEPTION 'invalid_amount_or_date'; END IF;
  body:=jsonb_build_object('description',btrim(p_args->>'description'),'supplier',left(p_args->>'supplier',200),'amount',received,'due_date',d,'receipt_details',coalesce(p_args->'receipt_details','{}'::jsonb)); label:='Cadastrar despesa';
 ELSIF p_action='expense_pay' THEN
  SELECT * INTO e FROM manager_expenses WHERE id=(p_args->>'id')::uuid AND salon_id=p_salon FOR UPDATE;
  IF NOT FOUND OR e.status<>'pending' THEN RAISE EXCEPTION 'expense_not_pending'; END IF;
  body:=jsonb_build_object('id',e.id,'description',e.description,'amount',e.amount,'due_date',e.due_date,'version',e.updated_at); label:='Dar baixa em despesa';
 ELSIF p_action='payment_settle' THEN
  discount:=coalesce((p_args->>'discount')::numeric,0); interest:=coalesce((p_args->>'interest')::numeric,0); fine:=coalesce((p_args->>'fine')::numeric,0);
  IF least(discount,interest,fine)<0 OR greatest(discount,interest,fine)>999999999 OR discount<>round(discount,2) OR interest<>round(interest,2) OR fine<>round(fine,2) THEN RAISE EXCEPTION 'invalid_adjustment'; END IF;
  method:=coalesce(p_args->>'method','pix'); IF method NOT IN ('pix','cash','credit_card','debit_card','bank_transfer') THEN RAISE EXCEPTION 'invalid_method'; END IF;
  IF p_args->>'kind'='package' THEN
   SELECT * INTO o FROM package_orders WHERE id=(p_args->>'id')::uuid AND salon_id=p_salon FOR UPDATE;
   IF NOT FOUND OR o.status<>'pending' THEN RAISE EXCEPTION 'package_not_pending'; END IF;
   original:=o.amount_cents/100.0; body:=jsonb_build_object('id',o.id,'kind','package','client',o.client_name,'date',o.created_at::date,'version',o.updated_at);
  ELSIF p_args->>'kind'='appointment' THEN
   SELECT * INTO a FROM appointments WHERE id=(p_args->>'id')::uuid AND salon_id=p_salon FOR UPDATE;
   IF NOT FOUND OR a.status NOT IN ('completed','confirmed','pending') OR a.credit_id IS NOT NULL THEN RAISE EXCEPTION 'appointment_not_payable'; END IF;
   IF EXISTS(SELECT 1 FROM payments WHERE salon_id=p_salon AND appointment_id=a.id AND payment_status IN ('paid','approved','completed') AND metadata->>'manager_settled'='true') THEN RAISE EXCEPTION 'already_paid'; END IF;
   SELECT coalesce(sum(amount),0) INTO paid FROM payments WHERE salon_id=p_salon AND appointment_id=a.id AND payment_status IN ('paid','approved','completed');
   original:=greatest(a.final_price-paid,0); IF original<=0 THEN RAISE EXCEPTION 'already_paid'; END IF;
   body:=jsonb_build_object('id',a.id,'kind','appointment','client',a.client_name,'service',(SELECT name FROM services WHERE id=a.service_id AND salon_id=p_salon),'date',a.date,'version',a.updated_at,'previously_paid',paid);
  ELSE RAISE EXCEPTION 'invalid_payment_kind'; END IF;
  received:=original-discount+interest+fine;
  IF received<0 OR received>999999999 OR (p_args ? 'received' AND (p_args->>'received')::numeric IS DISTINCT FROM received) THEN RAISE EXCEPTION 'amount_mismatch'; END IF;
  body:=body||jsonb_build_object('original',original,'received',received,'discount',discount,'interest',interest,'fine',fine,'method',method); label:='Dar baixa em pagamento';
 ELSIF p_action IN ('appointment_create','appointment_reschedule','appointment_confirm','appointment_cancel') THEN
  IF p_action='appointment_create' THEN
   SELECT * INTO c FROM clients WHERE id=(p_args->>'client_id')::uuid AND salon_id=p_salon;
   IF NOT FOUND THEN RAISE EXCEPTION 'client_not_found'; END IF;
   SELECT * INTO sv FROM services WHERE id=(p_args->>'service_id')::uuid AND salon_id=p_salon AND is_active;
   IF NOT FOUND THEN RAISE EXCEPTION 'service_not_found'; END IF;
   SELECT * INTO pr FROM professionals WHERE id=(p_args->>'professional_id')::uuid AND salon_id=p_salon AND is_active;
   IF NOT FOUND THEN RAISE EXCEPTION 'professional_not_found'; END IF;
   d:=(p_args->>'date')::date; t:=(p_args->>'start')::time;
   body:=jsonb_build_object('client_id',c.id,'client',c.name,'phone',c.phone_normalized,'email',c.email,'service_id',sv.id,'service',sv.name,'professional_id',pr.id,'professional',pr.name,'price',sv.price,'duration',sv.duration_minutes);
  ELSE
   SELECT * INTO a FROM appointments WHERE id=(p_args->>'id')::uuid AND salon_id=p_salon FOR UPDATE;
   IF NOT FOUND OR a.status NOT IN ('pending','confirmed') THEN RAISE EXCEPTION 'appointment_not_active'; END IF;
   SELECT * INTO sv FROM services WHERE id=a.service_id AND salon_id=p_salon;
   SELECT * INTO pr FROM professionals WHERE id=a.professional_id AND salon_id=p_salon;
   body:=jsonb_build_object('id',a.id,'client',a.client_name,'service',sv.name,'professional',pr.name,'version',a.updated_at,'original_date',a.date,'original_start',a.start_time,'duration',sv.duration_minutes,'price',a.final_price);
   IF p_action='appointment_reschedule' THEN d:=(p_args->>'date')::date; t:=(p_args->>'start')::time; ELSE d:=a.date; t:=a.start_time; END IF;
  END IF;
  IF p_action IN ('appointment_create','appointment_reschedule') THEN
   IF d IS NULL OR t IS NULL OR NOT coalesce(to_char(t,'HH24:MI')=ANY(public.get_available_time_slots(p_salon,pr.id,sv.id,d,a.id)),false) OR extract(second FROM t)<>0 THEN RAISE EXCEPTION 'slot_unavailable'; END IF;
  END IF;
  body:=body||jsonb_build_object('date',d,'start',t); label:=CASE p_action WHEN 'appointment_create' THEN 'Criar agendamento' WHEN 'appointment_reschedule' THEN 'Remarcar agendamento' WHEN 'appointment_confirm' THEN 'Confirmar agendamento' ELSE 'Cancelar agendamento' END;
 ELSIF p_action='client_create' THEN
  IF length(btrim(coalesce(p_args->>'name',''))) NOT BETWEEN 2 AND 120 OR public.manager_phone(p_args->>'phone') IS NULL THEN RAISE EXCEPTION 'invalid_client'; END IF;
  IF EXISTS(SELECT 1 FROM clients WHERE salon_id=p_salon AND phone_normalized=public.manager_phone(p_args->>'phone')) THEN RAISE EXCEPTION 'client_exists'; END IF;
  IF nullif(p_args->>'email','') IS NOT NULL AND (length(p_args->>'email')>254 OR p_args->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'invalid_email'; END IF;
  body:=jsonb_build_object('name',btrim(p_args->>'name'),'phone',public.manager_phone(p_args->>'phone'),'email',nullif(p_args->>'email','')); label:='Cadastrar cliente';
 ELSIF p_action='service_create' THEN
  received:=(p_args->>'price')::numeric;
  IF length(btrim(coalesce(p_args->>'name',''))) NOT BETWEEN 2 AND 120 OR received IS NULL OR received<0 OR received>999999999 OR received<>round(received,2) OR coalesce((p_args->>'duration_minutes')::int,0) NOT BETWEEN 5 AND 1440 THEN RAISE EXCEPTION 'invalid_service'; END IF;
  body:=jsonb_build_object('name',btrim(p_args->>'name'),'price',received,'duration_minutes',(p_args->>'duration_minutes')::int); label:='Cadastrar serviço';
 ELSIF p_action='return_send' THEN
  SELECT * INTO r FROM procedure_return_alerts WHERE id=(p_args->>'id')::uuid AND salon_id=p_salon FOR UPDATE;
  IF NOT FOUND OR r.status<>'pending' OR (r.lease_until IS NOT NULL AND r.lease_until>now()) THEN RAISE EXCEPTION 'return_not_pending'; END IF;
  IF EXISTS(SELECT 1 FROM clients WHERE salon_id=p_salon AND id=r.client_id AND marketing_opt_out) THEN RAISE EXCEPTION 'marketing_opt_out'; END IF;
  body:=jsonb_build_object('id',r.id,'client',r.client_name,'procedure',r.procedure_name,'date',r.alert_date,'version',r.updated_at,'whatsapp',r.notify_whatsapp,'email',r.notify_email,'push',r.notify_push); label:='Solicitar envio do aviso de retorno';
 ELSE RAISE EXCEPTION 'unsupported_action'; END IF;
 RETURN jsonb_build_object('title',label,'details',body);
END $$;

CREATE OR REPLACE FUNCTION public.manager_mutation(p_salon uuid,p_actor text,p_channel text,p_request text,p_action text DEFAULT NULL,p_args jsonb DEFAULT '{}',p_pending uuid DEFAULT NULL,p_confirm boolean DEFAULT NULL,p_event uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE lvl text; proposal jsonb; pending manager_pending_actions; payload jsonb; result jsonb; target uuid; a appointments;
BEGIN
 -- A mesma trava serializa nova proposta, cancelamento e confirmação da conversa.
 PERFORM pg_advisory_xact_lock(hashtextextended('manager:'||p_salon||':'||p_actor||':'||p_channel,0));
 lvl:=public.manager_authorize(p_salon,p_actor,p_channel);
 IF lvl IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF lvl='basic' THEN RAISE EXCEPTION 'read_only'; END IF;
 IF p_request IS NULL OR length(p_request) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_request'; END IF;
 IF p_channel='whatsapp' AND NOT EXISTS(SELECT 1 FROM whatsapp_webhook_events WHERE id=p_event AND salon_id=p_salon AND sender_phone=p_actor AND status='processing') THEN RAISE EXCEPTION 'invalid_event'; END IF;
 IF p_confirm IS NULL THEN
  SELECT * INTO pending FROM manager_pending_actions WHERE salon_id=p_salon AND actor=p_actor AND channel=p_channel AND request_key=p_request;
  IF FOUND THEN RETURN to_jsonb(pending); END IF;
  proposal:=public.manager_plan(p_salon,p_action,p_args);
  UPDATE manager_pending_actions SET status='superseded' WHERE salon_id=p_salon AND actor=p_actor AND channel=p_channel AND status='pending';
  INSERT INTO manager_pending_actions(salon_id,actor,channel,request_key,action,arguments,proposal) VALUES(p_salon,p_actor,p_channel,p_request,p_action,p_args,proposal) RETURNING * INTO pending;
  RETURN to_jsonb(pending);
 END IF;
 SELECT * INTO pending FROM manager_pending_actions WHERE id=p_pending AND salon_id=p_salon AND actor=p_actor AND channel=p_channel FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'pending_not_found'; END IF;
 IF pending.status<>'pending' THEN RETURN to_jsonb(pending); END IF;
 IF pending.expires_at<=now() THEN UPDATE manager_pending_actions SET status='expired' WHERE id=pending.id RETURNING * INTO pending; RETURN to_jsonb(pending); END IF;
 -- Não aceitar um evento repetido/anterior à proposta como confirmação de outra operação.
 IF p_channel='whatsapp' AND (pending.request_key=p_event::text OR NOT EXISTS(SELECT 1 FROM whatsapp_webhook_events WHERE id=p_event AND created_at>pending.created_at)) THEN RAISE EXCEPTION 'stale_confirmation'; END IF;
 IF NOT p_confirm THEN UPDATE manager_pending_actions SET status='cancelled' WHERE id=pending.id RETURNING * INTO pending; RETURN to_jsonb(pending); END IF;
 proposal:=public.manager_plan(p_salon,pending.action,pending.arguments);
 IF proposal IS DISTINCT FROM pending.proposal THEN RAISE EXCEPTION 'data_changed_prepare_again'; END IF;
 payload:=proposal->'details';
 CASE pending.action
 WHEN 'expense_create' THEN
  INSERT INTO manager_expenses(salon_id,description,supplier,amount,due_date,receipt_details) VALUES(p_salon,payload->>'description',payload->>'supplier',(payload->>'amount')::numeric,(payload->>'due_date')::date,payload->'receipt_details') RETURNING id INTO target;
 WHEN 'expense_pay' THEN
  UPDATE manager_expenses SET status='paid',paid_at=now(),updated_at=now() WHERE id=(payload->>'id')::uuid AND salon_id=p_salon RETURNING id INTO target;
 WHEN 'payment_settle' THEN
  IF payload->>'kind'='package' THEN
   target:=(payload->>'id')::uuid;
   PERFORM public.package_order_fulfill(target);
   -- O pedido mantém o valor contratado; o recebido real (desconto/juros/multa) fica no pagamento e na auditoria.
   UPDATE payments SET amount=(payload->>'received')::numeric,payment_method=payload->>'method',metadata=coalesce(metadata,'{}')||jsonb_build_object('manager_action',pending.id,'manager_settled',true,'adjustment',payload)
    WHERE salon_id=p_salon AND metadata->>'package_order_id'=target::text AND metadata->>'manager_settled' IS NULL;
  ELSE
   SELECT * INTO a FROM appointments WHERE id=(payload->>'id')::uuid AND salon_id=p_salon FOR UPDATE;
   INSERT INTO payments(salon_id,client_id,appointment_id,amount,payment_method,payment_status,payment_type,paid_at,metadata)
    VALUES(p_salon,a.client_id,a.id,(payload->>'received')::numeric,payload->>'method','paid','appointment',now(),jsonb_build_object('manager_action',pending.id,'manager_settled',true,'adjustment',payload)) RETURNING id INTO target;
   -- Não marca cobrança online como paga: pagamento manual não é liquidação do provedor.
  END IF;
 WHEN 'appointment_create' THEN
  INSERT INTO appointments(salon_id,client_id,client_name,client_phone,client_email,service_id,professional_id,date,start_time,end_time,price,discount,final_price,status,whatsapp_request_key)
   VALUES(p_salon,(payload->>'client_id')::uuid,payload->>'client',payload->>'phone',payload->>'email',(payload->>'service_id')::uuid,(payload->>'professional_id')::uuid,(payload->>'date')::date,(payload->>'start')::time,(payload->>'start')::time+make_interval(mins=>(payload->>'duration')::int),(payload->>'price')::numeric,0,(payload->>'price')::numeric,'confirmed','manager:'||pending.id) RETURNING id INTO target;
 WHEN 'appointment_reschedule' THEN
  UPDATE appointments SET date=(payload->>'date')::date,start_time=(payload->>'start')::time,end_time=(payload->>'start')::time+make_interval(mins=>(payload->>'duration')::int) WHERE id=(payload->>'id')::uuid AND salon_id=p_salon RETURNING id INTO target;
 WHEN 'appointment_confirm' THEN UPDATE appointments SET status='confirmed' WHERE id=(payload->>'id')::uuid AND salon_id=p_salon RETURNING id INTO target;
 WHEN 'appointment_cancel' THEN UPDATE appointments SET status='cancelled',cancelled_by='admin' WHERE id=(payload->>'id')::uuid AND salon_id=p_salon RETURNING id INTO target;
 WHEN 'client_create' THEN INSERT INTO clients(salon_id,name,phone,phone_normalized,email) VALUES(p_salon,payload->>'name',payload->>'phone',payload->>'phone',payload->>'email') RETURNING id INTO target;
 WHEN 'service_create' THEN INSERT INTO services(salon_id,name,price,duration_minutes) VALUES(p_salon,payload->>'name',(payload->>'price')::numeric,(payload->>'duration_minutes')::int) RETURNING id INTO target;
 WHEN 'return_send' THEN
  target:=(payload->>'id')::uuid;
  UPDATE procedure_return_alerts SET alert_date=least(alert_date,(now() AT TIME ZONE coalesce((SELECT timezone FROM salons WHERE id=p_salon),'America/Sao_Paulo'))::date),next_attempt_at=now(),updated_at=now() WHERE id=target AND salon_id=p_salon;
 ELSE RAISE EXCEPTION 'unsupported_action';
 END CASE;
 result:=jsonb_build_object('id',target,'action',pending.action,'message',CASE WHEN pending.action='return_send' THEN 'Aviso disponibilizado para processamento pelo worker; envio ainda não confirmado.' ELSE 'Operação concluída.' END);
 INSERT INTO manager_audit_logs(salon_id,actor,channel,action_id,action,details,result) VALUES(p_salon,p_actor,p_channel,pending.id,pending.action,proposal,result);
 UPDATE manager_pending_actions SET status='confirmed',result=manager_mutation.result WHERE id=pending.id RETURNING * INTO pending;
 RETURN to_jsonb(pending);
END $$;

-- Consultas agregam no PostgreSQL: a soma nunca depende do limite de linhas do PostgREST.
CREATE OR REPLACE FUNCTION public.manager_query(p_salon uuid,p_actor text,p_channel text,p_tool text,p_args jsonb DEFAULT '{}') RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE today date; start_date date; end_date date; tz text; result jsonb; needle text;
BEGIN
 IF public.manager_authorize(p_salon,p_actor,p_channel) IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT coalesce(timezone,'America/Sao_Paulo') INTO tz FROM salons WHERE id=p_salon;
 today:=(now() AT TIME ZONE tz)::date;
 IF p_tool='get_operation_report' THEN
  IF coalesce(p_args->>'period','month') NOT IN ('month','3months','6months','year') THEN RAISE EXCEPTION 'invalid_period'; END IF;
  start_date:=CASE p_args->>'period' WHEN 'year' THEN date_trunc('year',today)::date WHEN '3months' THEN (date_trunc('month',today)-interval '2 months')::date WHEN '6months' THEN (date_trunc('month',today)-interval '5 months')::date ELSE date_trunc('month',today)::date END;
  end_date:=today+1;
  WITH receipts AS (SELECT * FROM payments WHERE salon_id=p_salon AND payment_status IN ('paid','approved','completed') AND (paid_at AT TIME ZONE tz)::date>=start_date AND (paid_at AT TIME ZONE tz)::date<end_date),
  done AS (SELECT a.*,pr.name professional,sv.name service,coalesce(pr.commission_rate,0) commission FROM appointments a LEFT JOIN professionals pr ON pr.id=a.professional_id AND pr.salon_id=p_salon LEFT JOIN services sv ON sv.id=a.service_id AND sv.salon_id=p_salon WHERE a.salon_id=p_salon AND a.status='completed' AND a.date>=start_date AND a.date<end_date),
  totals AS (SELECT coalesce((SELECT sum(amount) FROM receipts),0) revenue,coalesce((SELECT sum(amount) FROM manager_expenses WHERE salon_id=p_salon AND status='paid' AND (paid_at AT TIME ZONE tz)::date>=start_date AND (paid_at AT TIME ZONE tz)::date<end_date),0) expenses)
  SELECT jsonb_build_object('start',start_date,'end_exclusive',end_date,'basis','Caixa: somente pagamentos registrados e despesas pagas. Não é apuração fiscal. Não inclui custos não cadastrados.',
   'gross_revenue',revenue,'expenses',expenses,'net_cash',revenue-expenses,'services_completed_value',coalesce((SELECT sum(final_price) FROM done),0),
   'estimated_commissions',coalesce((SELECT sum(final_price*commission/100) FROM done),0),
   'professionals',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT professional name,count(*) appointments,sum(final_price) production_value FROM done GROUP BY professional ORDER BY sum(final_price) DESC) x),'[]'),
   'services',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT service name,count(*) appointments,sum(final_price) production_value FROM done GROUP BY service ORDER BY sum(final_price) DESC) x),'[]'),
   'note','Rankings são produção concluída; comissões estimadas são informadas separadamente, não descontadas duas vezes do caixa.') INTO result FROM totals;
  RETURN result;
 ELSIF p_tool='get_overdue_receivables' THEN
  WITH unpaid AS (
   SELECT a.id,'appointment' kind,a.client_name client,sv.name service,a.date due_date,greatest(today-a.date,0) overdue_days,
    greatest(a.final_price-coalesce((SELECT sum(p.amount) FROM payments p WHERE p.salon_id=p_salon AND p.appointment_id=a.id AND p.payment_status IN ('paid','approved','completed')),0),0) amount
    FROM appointments a LEFT JOIN services sv ON sv.id=a.service_id AND sv.salon_id=p_salon
    WHERE a.salon_id=p_salon AND a.status='completed' AND a.credit_id IS NULL AND NOT EXISTS(SELECT 1 FROM payments p WHERE p.salon_id=p_salon AND p.appointment_id=a.id AND p.metadata->>'manager_settled'='true' AND p.payment_status IN ('paid','approved','completed'))
   UNION ALL SELECT o.id,'package',o.client_name,sp.name,(o.created_at AT TIME ZONE tz)::date,greatest(today-(o.created_at AT TIME ZONE tz)::date,0),o.amount_cents/100.0 FROM package_orders o LEFT JOIN service_packages sp ON sp.id=o.package_id AND sp.salon_id=p_salon WHERE o.salon_id=p_salon AND o.status='pending'
  ) SELECT jsonb_build_object('count',count(*),'total',coalesce(sum(amount),0),'items',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM unpaid WHERE amount>0 ORDER BY due_date LIMIT 50) x),'[]'),'limit',50,'note','Sem registro de pagamento não comprova inadimplência. Confira recebimentos externos; pacotes usam a data do pedido, não um vencimento contratual.') INTO result FROM unpaid WHERE amount>0;
  RETURN result;
 ELSIF p_tool='get_maintenance_and_returns' THEN
  SELECT jsonb_build_object('count',count(*),'items',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,client_name,procedure_name,alert_date,status FROM procedure_return_alerts WHERE salon_id=p_salon AND status IN ('pending','notified') AND alert_date<=today ORDER BY alert_date LIMIT 50) x),'[]'),'limit',50) INTO result FROM procedure_return_alerts WHERE salon_id=p_salon AND status IN ('pending','notified') AND alert_date<=today;
  RETURN result;
 ELSIF p_tool='get_daily_overview_and_pendencies' THEN
  end_date:=today+CASE WHEN p_args->>'period'='week' THEN 7 ELSE 1 END;
  SELECT jsonb_build_object('start',today,'end_exclusive',end_date,'appointments_count',count(*),'appointments',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT a.id,a.date,a.start_time,a.client_name,a.status,sv.name service,pr.name professional FROM appointments a LEFT JOIN services sv ON sv.id=a.service_id AND sv.salon_id=p_salon LEFT JOIN professionals pr ON pr.id=a.professional_id AND pr.salon_id=p_salon WHERE a.salon_id=p_salon AND a.date>=today AND a.date<end_date ORDER BY a.date,a.start_time LIMIT 50) x),'[]'),
   'receivables',public.manager_query(p_salon,p_actor,p_channel,'get_overdue_receivables','{}'),
   'returns',public.manager_query(p_salon,p_actor,p_channel,'get_maintenance_and_returns','{}'),
   'expenses',jsonb_build_object('overdue',coalesce((SELECT sum(amount) FROM manager_expenses WHERE salon_id=p_salon AND status='pending' AND due_date<today),0),'due_today',coalesce((SELECT sum(amount) FROM manager_expenses WHERE salon_id=p_salon AND status='pending' AND due_date=today),0),'upcoming',coalesce((SELECT sum(amount) FROM manager_expenses WHERE salon_id=p_salon AND status='pending' AND due_date>today),0),'items',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,description,amount,due_date FROM manager_expenses WHERE salon_id=p_salon AND status='pending' ORDER BY due_date LIMIT 50) x),'[]')),'limit',50) INTO result FROM appointments WHERE salon_id=p_salon AND date>=today AND date<end_date;
  RETURN result;
 ELSIF p_tool='lookup_records' THEN
  needle:=left(coalesce(p_args->>'search',''),120);
  IF length(needle)<2 AND p_args->>'entity' NOT IN ('services','professionals','expenses') THEN RAISE EXCEPTION 'search_required'; END IF;
  CASE p_args->>'entity'
   WHEN 'clients' THEN SELECT jsonb_agg(to_jsonb(x)) INTO result FROM (SELECT id,name,phone_normalized phone FROM clients WHERE salon_id=p_salon AND (strpos(lower(name),lower(needle))>0 OR id::text=needle) ORDER BY name LIMIT 20) x;
   WHEN 'services' THEN SELECT jsonb_agg(to_jsonb(x)) INTO result FROM (SELECT id,name,price,duration_minutes FROM services WHERE salon_id=p_salon AND is_active AND (strpos(lower(name),lower(needle))>0 OR id::text=needle) ORDER BY name LIMIT 20) x;
   WHEN 'professionals' THEN SELECT jsonb_agg(to_jsonb(x)) INTO result FROM (SELECT id,name FROM professionals WHERE salon_id=p_salon AND is_active AND (strpos(lower(name),lower(needle))>0 OR id::text=needle) ORDER BY name LIMIT 20) x;
   WHEN 'appointments' THEN SELECT jsonb_agg(to_jsonb(x)) INTO result FROM (SELECT a.id,a.client_name,a.date,a.start_time,a.final_price,a.status,sv.name service,pr.name professional FROM appointments a LEFT JOIN services sv ON sv.id=a.service_id AND sv.salon_id=p_salon LEFT JOIN professionals pr ON pr.id=a.professional_id AND pr.salon_id=p_salon WHERE a.salon_id=p_salon AND (strpos(lower(a.client_name),lower(needle))>0 OR a.id::text=needle) ORDER BY a.date DESC LIMIT 20) x;
   WHEN 'expenses' THEN SELECT jsonb_agg(to_jsonb(x)) INTO result FROM (SELECT id,description,amount,due_date,status FROM manager_expenses WHERE salon_id=p_salon AND (strpos(lower(description),lower(needle))>0 OR id::text=needle) ORDER BY due_date DESC LIMIT 20) x;
   ELSE RAISE EXCEPTION 'invalid_entity';
  END CASE;
  RETURN jsonb_build_object('items',coalesce(result,'[]'),'limit',20);
 ELSIF p_tool='available_slots' THEN
  RETURN jsonb_build_object('slots',public.get_available_time_slots(p_salon,(p_args->>'professional_id')::uuid,(p_args->>'service_id')::uuid,(p_args->>'date')::date));
 END IF;
 RAISE EXCEPTION 'unsupported_query';
END $$;

REVOKE ALL ON FUNCTION public.manager_phone_key(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manager_phone_key(text) TO service_role;
REVOKE ALL ON FUNCTION public.manager_authorize(uuid,text,text),public.manager_settings_save(uuid,uuid,boolean,text,text[]),public.manager_plan(uuid,text,jsonb),public.manager_mutation(uuid,text,text,text,text,jsonb,uuid,boolean,uuid),public.manager_query(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manager_authorize(uuid,text,text),public.manager_settings_save(uuid,uuid,boolean,text,text[]),public.manager_plan(uuid,text,jsonb),public.manager_mutation(uuid,text,text,text,text,jsonb,uuid,boolean,uuid),public.manager_query(uuid,text,text,text,jsonb) TO service_role;
COMMIT;
