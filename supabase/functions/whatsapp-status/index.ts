import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeSalon, serviceClient, salonInstance, validUuid } from "../_shared/whatsapp/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, readRequest, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { Temporal } from "npm:@js-temporal/polyfill@0.5.1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await readRequest(req), db = serviceClient();
    const userId = await authorizeSalon(req, db, body.salonId);
    const salonId = body.salonId as string;
    // Status só existe na conexão QR Code (a API oficial da Meta não publica Status).
    const instance = await salonInstance(db, salonId, "status");
    if (instance.status !== "connected") throw new WhatsAppError("disconnected", 409);
    if (body.action !== "save" || !["text", "image", "video"].includes(String(body.contentType)) || typeof body.text !== "string" || body.text.length > 4096 || typeof body.localDateTime !== "string") throw new WhatsAppError("invalid_request");
    // Fuso do salão é a fonte da verdade, não o navegador de quem agendou.
    const { data: salon, error: salonError } = await db.from("salons").select("timezone").eq("id", salonId).single();
    if (salonError) throw new WhatsAppError("persistence_failed", 503);
    const timezone = String(salon.timezone || "America/Sao_Paulo");
    const local = Temporal.PlainDateTime.from(body.localDateTime);
    const at = local.toZonedDateTime(timezone, { disambiguation: "reject" }).toInstant();
    if (Temporal.Instant.compare(at, Temporal.Now.instant()) <= 0) throw new WhatsAppError("invalid_request");
    const recurrence = body.recurrenceType ?? "once";
    const days = body.recurrenceDays ?? [];
    if (!["once", "daily", "weekly", "monthly"].includes(String(recurrence)) || !Array.isArray(days) || days.length > 7 || days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new WhatsAppError("invalid_request");
    const end = body.endDate ? Temporal.PlainDate.from(String(body.endDate)) : null;
    if (end && Temporal.PlainDate.compare(end, local.toPlainDate()) < 0) throw new WhatsAppError("invalid_request");
    let mediaPath: string | null = null, mime: string | null = null;
    if (body.contentType === "text") {
      if (!body.text.trim()) throw new WhatsAppError("invalid_request");
    } else {
      if (typeof body.mediaPath !== "string" || !body.mediaPath.startsWith(`${salonId}/`) || body.mediaPath.includes("..")) throw new WhatsAppError("invalid_request");
      const { data: info, error } = await db.storage.from("whatsapp-media").info(body.mediaPath);
      if (error || !info) throw new WhatsAppError("invalid_request");
      const metadata = info.metadata as Record<string, unknown>;
      mime = String(metadata.mimetype);
      const allowed = body.contentType === "video" ? ["video/mp4"] : ["image/jpeg", "image/png", "image/webp"];
      const maxSize = body.contentType === "video" ? 16 * 1024 * 1024 : 5 * 1024 * 1024;
      if (!allowed.includes(mime) || Number(metadata.size) > maxSize) throw new WhatsAppError("invalid_request");
      mediaPath = body.mediaPath;
    }
    const row = {
      salon_id: salonId, content_type: body.contentType, text_content: body.text.trim(), media_path: mediaPath, media_mime: mime,
      media_url: null, media_filename: typeof body.mediaFilename === "string" ? body.mediaFilename.slice(0, 120) : null,
      scheduled_at: at.toString(), timezone, local_time: local.toPlainTime().toString(), anchor_day: local.day,
      recurrence_type: recurrence, recurrence_days: [...new Set(days)], recurrence_end_date: end?.toString() ?? null,
      status: "scheduled", created_by: userId,
    };
    if (!validUuid(body.id)) throw new WhatsAppError("invalid_request");
    const { data: existing, error: lookupError } = await db.from("scheduled_posts").select("id,status").eq("id", body.id).eq("salon_id", salonId).maybeSingle();
    if (lookupError) throw new WhatsAppError("persistence_failed", 503);
    if (existing && existing.status !== "scheduled") throw new WhatsAppError("post_not_editable", 409);
    const result = existing
      ? await db.from("scheduled_posts").update(row).eq("id", body.id).eq("salon_id", salonId).eq("status", "scheduled").select("id").maybeSingle()
      : await db.from("scheduled_posts").insert({ ...row, id: body.id }).select("id").single();
    if (result.error || !result.data) throw new WhatsAppError("persistence_failed", 503);
    return jsonResponse({ success: true, id: result.data.id, scheduledAt: at.toString(), timezone });
  } catch (error) { return errorResponse(error instanceof WhatsAppError ? error : new WhatsAppError("invalid_request")); }
});
