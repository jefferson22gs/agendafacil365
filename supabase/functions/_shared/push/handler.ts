// Handler único de envio (send-push-fcm e o alias send-push).
// Chamador: dono/admin do salão (JWT validado no servidor) ou chamada interna com chave secreta do projeto.
import { authorizeSalon, authorizeWorker, serviceClient } from "../whatsapp/auth.ts";
import { corsHeaders, jsonResponse, readRequest, WhatsAppError } from "../whatsapp/errors.ts";
import { cleanText, isUuid, parseAudience, selectTargets, type Subscription } from "./core.ts";
import { deliver, pushConfigured, PushError } from "./fcm.ts";

const messages: Record<string, string> = {
  push_not_configured: "As notificações ainda não foram ativadas pela plataforma.",
  unauthorized: "Entre novamente para continuar.",
  forbidden: "Você não tem permissão para este salão.",
  invalid_request: "Confira o título e a mensagem.",
  persistence_failed: "Não foi possível consultar os dispositivos. Tente novamente.",
};
export function pushError(error: unknown) {
  const code = error instanceof PushError || error instanceof WhatsAppError ? error.code : "internal_error";
  const status = error instanceof PushError || error instanceof WhatsAppError ? error.status : 500;
  console.warn("push_operation_failed", code);
  return jsonResponse({ success: false, code, error: messages[code] ?? "Não foi possível enviar a notificação." }, status);
}

function internalCall(req: Request): boolean {
  try { authorizeWorker(req); return true; } catch { return false; }
}

export async function handleSend(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await readRequest(req);
    const salonId = body.salon_id;
    if (!isUuid(salonId)) throw new WhatsAppError("invalid_request");
    const db = serviceClient();
    if (!internalCall(req)) await authorizeSalon(req, db, salonId);

    const audience = parseAudience(body.audience);
    const title = cleanText(body.title, 100), text = cleanText(body.body, 300);
    if (!title || !text) throw new WhatsAppError("invalid_request");

    const { data: salon, error: salonError } = await db.from("salons").select("id,owner_id,slug,name,logo_url,pwa_icon_url").eq("id", salonId).maybeSingle();
    if (salonError) throw new WhatsAppError("persistence_failed", 503);
    if (!salon?.slug) throw new WhatsAppError("forbidden", 403);

    // Avaliação: destino é o cliente do agendamento DESTE salão; sem vínculo, ninguém recebe.
    let clientIds: unknown = body.client_ids;
    let url: unknown = body.url;
    if (body.type === "rating_request") {
      if (!isUuid(body.appointment_id)) throw new WhatsAppError("invalid_request");
      const { data: appt } = await db.from("appointments").select("id,client_id").eq("id", body.appointment_id).eq("salon_id", salonId).maybeSingle();
      clientIds = appt?.client_id ? [appt.client_id] : [];
      url = `/avaliar/${body.appointment_id}`;
    }
    if (audience === "clients" && (!Array.isArray(clientIds) || clientIds.length === 0)) {
      return jsonResponse({ success: true, total: 0, sent: 0, failed: 0 });
    }
    if (!pushConfigured()) throw new PushError("push_not_configured", 503);

    let query = db.from("push_subscriptions").select("id,user_id,client_id,fcm_token")
      .eq("salon_id", salonId).eq("is_active", true).not("fcm_token", "is", null).limit(2000);
    if (audience === "owner") query = query.eq("user_id", salon.owner_id);
    else if (audience === "clients") query = query.in("client_id", (clientIds as unknown[]).filter(isUuid).slice(0, 1000));
    const { data: subs, error } = await query;
    if (error) throw new WhatsAppError("persistence_failed", 503);

    const targets = selectTargets((subs ?? []) as Subscription[], { audience, ownerId: salon.owner_id, clientIds });
    const result = await deliver(db, targets, {
      title, body: text, url, type: body.type ?? (audience === "owner" ? "owner" : "marketing"),
      icon: salon.pwa_icon_url || salon.logo_url, salonSlug: salon.slug,
    });
    return jsonResponse({ success: true, ...result });
  } catch (error) {
    return pushError(error);
  }
}
