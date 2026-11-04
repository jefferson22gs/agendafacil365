// Supabase Edge Function: super-admin-actions
// Ações administrativas para o Super Admin

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAILS = ["jefferson22gs@gmail.com", "admin@syshair.com"];

interface ActionRequest {
    action: string;
    salonId?: string;
    userId?: string;
    data?: any;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Verificar autenticação
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Não autorizado" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user || !SUPER_ADMIN_EMAILS.includes(user.email || "")) {
            return new Response(JSON.stringify({ error: "Acesso negado" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const body: ActionRequest = await req.json();
        const { action, salonId, userId, data } = body;

        let result: any = { success: false };

        switch (action) {
            // ===== AÇÕES DE SALÃO =====
            case "block_salon":
                await supabaseAdmin.from("salons").update({ is_active: false }).eq("id", salonId);
                result = { success: true, message: "Salão bloqueado" };
                break;

            case "unblock_salon":
                await supabaseAdmin.from("salons").update({ is_active: true }).eq("id", salonId);
                result = { success: true, message: "Salão desbloqueado" };
                break;

            case "update_salon":
                await supabaseAdmin.from("salons").update(data).eq("id", salonId);
                result = { success: true, message: "Salão atualizado" };
                break;

            case "delete_salon":
                await supabaseAdmin.from("salons").delete().eq("id", salonId);
                result = { success: true, message: "Salão excluído" };
                break;

            // ===== AÇÕES DE ASSINATURA =====
            case "extend_trial":
                const trialDays = data?.days || 7;
                const newTrialEnd = new Date();
                newTrialEnd.setDate(newTrialEnd.getDate() + trialDays);
                await supabaseAdmin.from("subscriptions").update({
                    trial_ends_at: newTrialEnd.toISOString(),
                    status: "trialing"
                }).eq("salon_id", salonId);
                result = { success: true, message: `Trial estendido por ${trialDays} dias` };
                break;

            case "mark_paid":
                await supabaseAdmin.from("subscriptions").update({
                    status: "active",
                    plan_id: data?.plan || "professional"
                }).eq("salon_id", salonId);
                result = { success: true, message: "Marcado como pago" };
                break;

            case "mark_overdue":
                await supabaseAdmin.from("subscriptions").update({
                    status: "past_due"
                }).eq("salon_id", salonId);
                result = { success: true, message: "Marcado como inadimplente" };
                break;

            case "cancel_subscription":
                await supabaseAdmin.from("subscriptions").update({
                    status: "canceled"
                }).eq("salon_id", salonId);
                result = { success: true, message: "Assinatura cancelada" };
                break;

            // ===== AÇÕES DE USUÁRIO =====
            case "reset_password":
                const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
                    type: "recovery",
                    email: data?.email,
                });
                if (resetError) throw resetError;
                result = { success: true, message: "Link de recuperação gerado" };
                break;

            case "update_email":
                await supabaseAdmin.auth.admin.updateUserById(userId!, { email: data?.newEmail });
                result = { success: true, message: "Email atualizado" };
                break;

            case "force_logout":
                await supabaseAdmin.auth.admin.signOut(userId!, "global");
                result = { success: true, message: "Usuário deslogado" };
                break;

            // ===== COMUNICAÇÃO =====
            case "send_notification":
                // Enviar notificação push para o salão
                const { data: pushSubs } = await supabaseAdmin
                    .from("push_subscriptions")
                    .select("*")
                    .eq("salon_id", salonId);

                // Salvar notificação no banco
                await supabaseAdmin.from("notifications").insert({
                    salon_id: salonId,
                    title: data?.title || "Aviso do Agenda Fácil 365",
                    message: data?.message,
                    type: data?.type || "admin",
                    status: "sent"
                });

                result = { success: true, message: `Notificação enviada`, recipients: pushSubs?.length || 0 };
                break;

            case "broadcast_all":
                // Enviar para todos os salões
                const { data: allSalons } = await supabaseAdmin.from("salons").select("id");
                for (const salon of allSalons || []) {
                    await supabaseAdmin.from("notifications").insert({
                        salon_id: salon.id,
                        title: data?.title || "Comunicado Agenda Fácil 365",
                        message: data?.message,
                        type: "broadcast",
                        status: "sent"
                    });
                }
                result = { success: true, message: `Broadcast enviado`, recipients: allSalons?.length || 0 };
                break;

            // ===== ESTATÍSTICAS =====
            case "get_full_stats":
                const { count: totalSalons } = await supabaseAdmin.from("salons").select("*", { count: "exact", head: true });
                const { count: totalClients } = await supabaseAdmin.from("clients").select("*", { count: "exact", head: true });
                const { count: totalAppointments } = await supabaseAdmin.from("appointments").select("*", { count: "exact", head: true });
                const { count: totalProfessionals } = await supabaseAdmin.from("professionals").select("*", { count: "exact", head: true });

                const { data: recentSalons } = await supabaseAdmin
                    .from("salons")
                    .select("id, name, created_at")
                    .order("created_at", { ascending: false })
                    .limit(10);

                result = {
                    success: true,
                    stats: { totalSalons, totalClients, totalAppointments, totalProfessionals },
                    recentSalons
                };
                break;

            default:
                result = { success: false, error: "Ação não reconhecida" };
        }

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Super Admin Action Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
