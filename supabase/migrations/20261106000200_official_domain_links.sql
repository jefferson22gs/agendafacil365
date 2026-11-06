-- Links de agendamento gerados pelo banco passam para o domínio oficial (06/11/2026).
-- generate_status_message usava https://syshair.app/agendar/<slug> (domínio e rota inexistentes);
-- post_salon_status_auto usava https://syshair.vercel.app/s/<slug>. Corpo restante idêntico ao de produção.
BEGIN;

CREATE OR REPLACE FUNCTION public.generate_status_message(p_salon_id uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_salon RECORD;
    v_message TEXT;
    v_public_url TEXT;
BEGIN
    -- Buscar dados do salão
    SELECT
        name,
        slug,
        auto_post_message,
        whatsapp
    INTO v_salon
    FROM salons
    WHERE id = p_salon_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Gerar URL pública
    v_public_url := 'https://agendafacil365.com.br/s/' || v_salon.slug;

    -- Usar mensagem personalizada ou padrão
    IF v_salon.auto_post_message IS NOT NULL THEN
        v_message := v_salon.auto_post_message;
    ELSE
        v_message := '🎉 Agende seu horário online! 💇‍♀️✨' || E'\n\n' ||
                     '📱 Acesse nosso link:' || E'\n' ||
                     '👉 ' || v_public_url || E'\n\n' ||
                     '✅ Rápido e fácil' || E'\n' ||
                     '✅ Disponível 24/7' || E'\n' ||
                     '✅ Confirmação instantânea' || E'\n\n' ||
                     'Estamos te esperando! 💖';
    END IF;

    RETURN v_message;
END;
$function$;

CREATE OR REPLACE FUNCTION public.post_salon_status_auto()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_salon RECORD;
    v_last_post TIMESTAMPTZ;
    v_should_post BOOLEAN;
    v_status_text TEXT;
    v_result JSON;
    v_posted_count INTEGER := 0;
BEGIN
    -- Iterar sobre todos os salões com auto status habilitado
    FOR v_salon IN
        SELECT
            s.id,
            s.name,
            s.slug,
            s.auto_status_message,
            s.auto_status_image_url,
            wi.instance_name
        FROM salons s
        LEFT JOIN whatsapp_instances wi ON wi.salon_id = s.id
        WHERE s.auto_status_enabled = true
        AND s.public_booking_enabled = true
        AND wi.instance_name IS NOT NULL
        AND wi.status = 'connected'
    LOOP
        -- Verificar última postagem
        SELECT posted_at INTO v_last_post
        FROM whatsapp_status_posts
        WHERE salon_id = v_salon.id
        AND success = true
        ORDER BY posted_at DESC
        LIMIT 1;

        -- Verificar se já se passaram 24 horas
        v_should_post := (v_last_post IS NULL) OR (NOW() - v_last_post >= INTERVAL '24 hours');

        IF v_should_post THEN
            -- Montar mensagem de status
            v_status_text := COALESCE(
                v_salon.auto_status_message,
                '✨ Agende seu horário online! 💇‍♀️' || E'\n\n' ||
                '📱 Acesse: https://agendafacil365.com.br/s/' || v_salon.slug || E'\n\n' ||
                '🎯 Rápido, fácil e sem complicação!' || E'\n' ||
                '⏰ Disponível 24h por dia'
            );

            -- Registrar postagem (será processada pela Edge Function)
            INSERT INTO whatsapp_status_posts (
                salon_id,
                status_text,
                status_image_url,
                success
            ) VALUES (
                v_salon.id,
                v_status_text,
                v_salon.auto_status_image_url,
                false -- Será atualizado pela Edge Function
            );

            v_posted_count := v_posted_count + 1;
        END IF;
    END LOOP;

    v_result := json_build_object(
        'success', true,
        'salons_processed', v_posted_count,
        'message', 'Status posts scheduled for ' || v_posted_count || ' salon(s)'
    );

    RETURN v_result;
END;
$function$;

COMMIT;
