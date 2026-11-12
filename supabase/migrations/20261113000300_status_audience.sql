-- Público do Status (QR Code): clientes do salão com telefone, sem opt-out de marketing e fora da supressão.
-- A Evolution com `allContacts` varre todos os contatos do aparelho (grupos inclusos) e estoura o tempo; com lista
-- explícita publica em lotes de 10. Limite de 500 (50 lotes) para a publicação caber na janela da função.
CREATE OR REPLACE FUNCTION public.whatsapp_status_audience(p_salon_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(phone ORDER BY phone), '{}')
  FROM (
    SELECT DISTINCT c.phone_normalized AS phone
    FROM clients c
    WHERE c.salon_id = p_salon_id
      AND c.phone_normalized ~ '^\+[1-9][0-9]{7,14}$'
      AND NOT c.marketing_opt_out
      AND NOT EXISTS (SELECT 1 FROM whatsapp_marketing_suppression s WHERE s.salon_id = p_salon_id AND s.phone = c.phone_normalized)
    LIMIT 500
  ) a;
$$;
REVOKE ALL ON FUNCTION public.whatsapp_status_audience(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_status_audience(uuid) TO service_role;
