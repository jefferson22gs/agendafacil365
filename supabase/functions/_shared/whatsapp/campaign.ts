import { authorizeSalon, serviceClient, salonInstance, validUuid } from "./auth.ts";
import { readRequest, jsonResponse, errorResponse, corsHeaders, WhatsAppError, objectValue } from "./errors.ts";
import { internationalPhone, campaignText } from "./phone.ts";

export async function campaignHandler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await readRequest(req), db = serviceClient();
    let tenant = body.salonId;
    if (body.broadcastId) {
      if (!validUuid(body.broadcastId)) throw new WhatsAppError("invalid_request");
      const { data, error } = await db.from("broadcasts").select("salon_id").eq("id", body.broadcastId).maybeSingle();
      if (error) throw new WhatsAppError("persistence_failed", 503);
      tenant = data?.salon_id;
    }
    await authorizeSalon(req, db, tenant);
    const salonId = tenant as string;
    if (body.action === "stop_broadcast") {
      const { data, error } = await db.rpc("whatsapp_cancel_campaign", { p_campaign_id: body.broadcastId, p_salon_id: salonId });
      if (error) throw new WhatsAppError("persistence_failed", 503);
      return jsonResponse({ success: true, cancelledPending: data, message: "Itens pendentes cancelados. Mensagens já aceitas não podem ser recolhidas." });
    }
    if (body.action === "get_status") {
      const { data, error } = await db.from("broadcasts").select("id,status,total_recipients,sent_count,failed_count,progress_percent,scheduled_for,completed_at").eq("id", body.broadcastId).eq("salon_id", salonId).single();
      if (error) throw new WhatsAppError("persistence_failed", 503);
      return jsonResponse({ success: true, broadcast: data });
    }
    if (body.action !== "create_broadcast" || !validUuid(body.submissionId) || body.confirmed !== true || body.consentAcknowledged !== true) throw new WhatsAppError("invalid_request");
    // Disparos saem pela conexão QR Code (Evolution) quando existir; a oficial fica para o atendimento.
    const instance = await salonInstance(db, salonId, "marketing");
    if (instance.status !== "connected") throw new WhatsAppError("disconnected", 409);
    if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 4096 || !Array.isArray(body.recipients) || !body.recipients.length || body.recipients.length > 1000) throw new WhatsAppError("invalid_request");
    const recipients = Array.from(new Map(body.recipients.map((value) => {
      const r = objectValue(value), phone = internationalPhone(r.phone), name = typeof r.name === "string" ? r.name.slice(0, 120) : "";
      return [phone, { phone, name, text: campaignText(body.message as string, name) }] as const;
    })).values());
    const scheduled = body.scheduledFor === undefined ? new Date() : typeof body.scheduledFor === "string" ? new Date(body.scheduledFor) : new Date(NaN);
    if (!Number.isFinite(scheduled.getTime()) || scheduled.getTime() < Date.now() - 30_000 || scheduled.getTime() > Date.now() + 366 * 86400000) throw new WhatsAppError("invalid_request");
    const type = body.contentType ?? "text";
    if (!["text", "image", "video", "document"].includes(String(type))) throw new WhatsAppError("invalid_request");
    if (type !== "text") {
      if (typeof body.mediaPath !== "string" || !body.mediaPath.startsWith(`${salonId}/`) || body.mediaPath.includes("..") || !["image/jpeg", "image/png", "image/webp", "video/mp4", "application/pdf"].includes(String(body.mediaMime))) throw new WhatsAppError("invalid_request");
      const { data: info, error } = await db.storage.from("whatsapp-media").info(body.mediaPath);
      if (error || !info) throw new WhatsAppError("invalid_request");
      const metadata = info.metadata as Record<string, unknown> | null;
      if (Number(metadata?.size ?? 0) > 16 * 1024 * 1024 || metadata?.mimetype !== body.mediaMime) throw new WhatsAppError("invalid_request");
    }
    const { data: campaign, error } = await db.rpc("whatsapp_create_campaign", {
      p_salon_id: salonId, p_submission: body.submissionId, p_message: body.message.trim(), p_recipients: recipients,
      p_scheduled_for: scheduled.toISOString(), p_content_type: type, p_media_path: body.mediaPath ?? null,
      p_media_mime: body.mediaMime ?? null, p_media_filename: typeof body.mediaFilename === "string" ? body.mediaFilename.slice(0, 120) : null,
    });
    if (error) throw new WhatsAppError("persistence_failed", 503);
    return jsonResponse({ success: true, broadcastId: campaign, message: "Campanha registrada na fila.", estimatedTime: "Acompanhe pelo histórico; envio depende da conexão." });
  } catch (error) { return errorResponse(error); }
}
