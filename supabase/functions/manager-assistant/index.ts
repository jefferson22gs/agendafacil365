import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeSalon, serviceClient, validUuid } from "../_shared/whatsapp/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, objectValue, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { managerReply } from "../_shared/whatsapp/managerAssistant.ts";

const MAX_BODY = 7_200_000;
async function body(req: Request): Promise<Record<string, unknown>> {
  if (req.method !== "POST") throw new WhatsAppError("invalid_request", 405);
  if (!req.headers.get("content-type")?.includes("application/json") || !req.body) throw new WhatsAppError("invalid_request", 415);
  const reader = req.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw new WhatsAppError("invalid_request", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
  try { return objectValue(JSON.parse(new TextDecoder().decode(bytes))); } catch { throw new WhatsAppError("invalid_request"); }
}
const phoneOf = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return /^55[1-9]\d{9,10}$/.test(d) ? `+${d}` : /^[1-9]\d{9,10}$/.test(d) ? `+55${d}` : null;
};

serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const input = await body(req), db = serviceClient();
    const actor = await authorizeSalon(req, db, input.salonId);
    const salonId = input.salonId as string;
    if (input.action === "settings") {
      const [{ data, error }, { data: salon, error: se }] = await Promise.all([
        db.from("whatsapp_automation_settings").select("manager_assistant_enabled,manager_access_level,authorized_manager_phones").eq("salon_id", salonId).maybeSingle(),
        db.from("salons").select("phone").eq("id", salonId).single(),
      ]);
      if (error || se) throw new WhatsAppError("persistence_failed", 503);
      return jsonResponse({ success: true, settings: { manager_assistant_enabled: data?.manager_assistant_enabled ?? true, manager_access_level: data?.manager_access_level ?? "advanced", authorized_manager_phones: data?.authorized_manager_phones ?? [] }, profilePhone: phoneOf(salon.phone) });
    }
    if (input.action === "save_settings") {
      const s = objectValue(input.settings);
      const phones = Array.isArray(s.authorized_manager_phones) ? s.authorized_manager_phones.map(phoneOf) : null;
      if (typeof s.manager_assistant_enabled !== "boolean" || !["basic", "intermediate", "advanced"].includes(String(s.manager_access_level)) || !phones || phones.length > 20 || phones.some(p => !p)) throw new WhatsAppError("invalid_request");
      const { error } = await db.rpc("manager_settings_save", { p_salon: salonId, p_actor: actor, p_enabled: s.manager_assistant_enabled, p_level: s.manager_access_level, p_phones: [...new Set(phones)] });
      if (error) throw new WhatsAppError(String(error.message).includes("forbidden") ? "forbidden" : "invalid_request", String(error.message).includes("forbidden") ? 403 : 400);
      return jsonResponse({ success: true });
    }
    if (input.action !== "chat" || typeof input.text !== "string" || input.text.length > 4000 || !validUuid(input.requestId)) throw new WhatsAppError("invalid_request");
    const attachment = input.attachment === undefined || input.attachment === null ? null : objectValue(input.attachment);
    if (attachment && (typeof attachment.data !== "string" || typeof attachment.mime !== "string" || attachment.data.length > 7_000_000)) throw new WhatsAppError("invalid_request");
    if (!input.text.trim() && !attachment && typeof input.selection !== "string") throw new WhatsAppError("invalid_request");
    const selection = typeof input.selection === "string" && /^mgr_confirm_(yes|no)$/.test(input.selection) ? input.selection : null;
    const reply = await managerReply({ db, salonId, actor, channel: "panel", requestId: input.requestId as string },
      { text: input.text, selection, pendingId: validUuid(input.pendingId) ? input.pendingId : null, attachment: attachment as { data: string; mime: string; name?: string } | null });
    return jsonResponse({ success: true, text: reply.text, messages: reply.messages ?? null, pendingId: reply.pendingId ?? null, expiresAt: reply.expiresAt ?? null });
  } catch (error) { return errorResponse(error); }
});
