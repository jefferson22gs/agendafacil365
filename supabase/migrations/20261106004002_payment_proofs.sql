BEGIN;
-- Comprovantes de pagamento PIX recebidos pelo WhatsApp. Conferência manual pelo dono/admin.
-- Aditiva e idempotente. Nunca altera appointments.paid. Rollback comentado no fim.

-- Bucket privado: leitura só via signed URL de dono/admin; escrita só service_role (edge function).
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('payment-proofs','payment-proofs',false,5242880,ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','application/pdf'];

DROP POLICY IF EXISTS "Salon managers access proofs" ON storage.objects;
DROP POLICY IF EXISTS "Salon managers read proofs" ON storage.objects;
CREATE POLICY "Salon managers read proofs" ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='payment-proofs' AND CASE WHEN (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN public.whatsapp_can_manage_salon(((storage.foldername(name))[1])::uuid) ELSE false END);

CREATE TABLE IF NOT EXISTS public.appointment_payment_proofs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
 salon_id uuid NOT NULL REFERENCES public.salons(id) ON DELETE CASCADE,
 phone text NOT NULL CHECK(phone ~ '^\+[1-9][0-9]{6,14}$'),
 provider_message_id text NOT NULL CHECK(length(provider_message_id) BETWEEN 1 AND 200),
 media_path text NOT NULL CHECK(media_path ~ '^[0-9a-f-]{36}/payment-proofs/[A-Za-z0-9_-]{1,100}\.(jpg|png|webp|pdf)$'),
 media_mime text NOT NULL CHECK(media_mime IN('image/jpeg','image/png','image/webp','application/pdf')),
 media_name text NOT NULL CHECK(length(media_name) BETWEEN 1 AND 200),
 status text NOT NULL DEFAULT 'enviado' CHECK(status IN('enviado','conferido','recusado')),
 reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 reviewed_at timestamptz,
 notes text CHECK(length(notes)<=500),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT appointment_payment_proofs_tenant_path CHECK(split_part(media_path,'/',1)=salon_id::text)
);
CREATE UNIQUE INDEX IF NOT EXISTS appointment_payment_proofs_message ON public.appointment_payment_proofs(salon_id,provider_message_id);
CREATE INDEX IF NOT EXISTS appointment_payment_proofs_appointment ON public.appointment_payment_proofs(appointment_id);
CREATE INDEX IF NOT EXISTS appointment_payment_proofs_salon_status ON public.appointment_payment_proofs(salon_id,status,created_at DESC);

-- Agendamento precisa ser do mesmo salão (FK simples não garante tenant).
CREATE OR REPLACE FUNCTION public.payment_proof_same_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM appointments WHERE id=NEW.appointment_id AND salon_id=NEW.salon_id) THEN
  RAISE EXCEPTION 'appointment_tenant_mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payment_proof_same_tenant ON public.appointment_payment_proofs;
CREATE TRIGGER payment_proof_same_tenant BEFORE INSERT OR UPDATE OF appointment_id,salon_id ON public.appointment_payment_proofs
 FOR EACH ROW EXECUTE FUNCTION public.payment_proof_same_tenant();

ALTER TABLE public.appointment_payment_proofs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Salon managers read proofs" ON public.appointment_payment_proofs;
CREATE POLICY "Salon managers read proofs" ON public.appointment_payment_proofs FOR SELECT TO authenticated
 USING(public.whatsapp_can_manage_salon(salon_id));
DROP POLICY IF EXISTS "Service role manages proofs" ON public.appointment_payment_proofs;
CREATE POLICY "Service role manages proofs" ON public.appointment_payment_proofs FOR ALL TO service_role
 USING(true) WITH CHECK(true);
REVOKE ALL ON public.appointment_payment_proofs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.appointment_payment_proofs TO authenticated;
GRANT ALL ON public.appointment_payment_proofs TO service_role;

-- RPC de conferência: exige JWT (auth.uid) de dono/admin do salão do comprovante.
CREATE OR REPLACE FUNCTION public.mark_payment_proof_status(p_proof_id uuid, p_status text, p_notes text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_salon uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
 IF p_status IS NULL OR p_status NOT IN('enviado','conferido','recusado') THEN RAISE EXCEPTION 'status_invalid' USING ERRCODE='22023'; END IF;
 IF length(p_notes)>500 THEN RAISE EXCEPTION 'notes_too_long' USING ERRCODE='22023'; END IF;
 SELECT salon_id INTO v_salon FROM appointment_payment_proofs WHERE id=p_proof_id FOR UPDATE;
 IF v_salon IS NULL OR NOT public.whatsapp_can_manage_salon(v_salon) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 UPDATE appointment_payment_proofs
  SET status=p_status,
      reviewed_by=CASE WHEN p_status='enviado' THEN NULL ELSE auth.uid() END,
      reviewed_at=CASE WHEN p_status='enviado' THEN NULL ELSE now() END,
      notes=NULLIF(btrim(p_notes),'')
  WHERE id=p_proof_id AND salon_id=v_salon;
 RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_payment_proof_status(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_payment_proof_status(uuid,text,text) TO authenticated;

-- Notificação ao dono (admin_notifications, type 'payment_proof').
CREATE OR REPLACE FUNCTION public.notify_admin_payment_proof()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
 INSERT INTO admin_notifications(salon_id,appointment_id,type,title,message,client_phone,metadata)
 VALUES(NEW.salon_id,NEW.appointment_id,'payment_proof','Comprovante de pagamento recebido',
  'Um cliente enviou comprovante PIX pelo WhatsApp. Confira antes de marcar como pago.',
  NEW.phone,jsonb_build_object('proof_id',NEW.id,'media_mime',NEW.media_mime));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_admin_payment_proof() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.payment_proof_same_tenant() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS notify_admin_payment_proof ON public.appointment_payment_proofs;
CREATE TRIGGER notify_admin_payment_proof AFTER INSERT ON public.appointment_payment_proofs
 FOR EACH ROW EXECUTE FUNCTION public.notify_admin_payment_proof();

COMMIT;

-- Rollback (manual, não executar junto):
-- BEGIN;
-- DROP TABLE IF EXISTS public.appointment_payment_proofs;
-- DROP FUNCTION IF EXISTS public.notify_admin_payment_proof();
-- DROP FUNCTION IF EXISTS public.payment_proof_same_tenant();
-- DROP FUNCTION IF EXISTS public.mark_payment_proof_status(uuid,text,text);
-- DROP POLICY IF EXISTS "Salon managers read proofs" ON storage.objects;
-- -- bucket: esvaziar pelo dashboard antes de DELETE FROM storage.buckets WHERE id='payment-proofs';
-- COMMIT;
