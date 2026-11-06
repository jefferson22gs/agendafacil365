import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

// ponytail: tipos gerados anteriores ao schema de produção; remover adaptação ao regenerar Database.
export const whatsappDb = supabase as SupabaseClient;
export function useWhatsAppSalon() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["whatsapp-salon", user?.id], enabled: !!user, queryFn: async () => {
    const { data, error } = await whatsappDb.from("salons").select("id,timezone").eq("owner_id", user!.id).order("created_at").limit(1).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Configure seu estabelecimento primeiro.");
    return data as { id: string; timezone: string };
  }});
}
export async function whatsappCall(name: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = "Não foi possível concluir. Confira a conexão e tente novamente.";
    try { message = (await error.context.json()).error || message; } catch { /* conexão interrompida */ }
    throw new Error(message);
  }
  if (!data?.success) throw new Error(data?.error || "Não foi possível concluir.");
  return data;
}
