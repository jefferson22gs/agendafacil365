// Webhook da API oficial do WhatsApp (Meta Cloud API).
// GET: verificação (hub.challenge) com META_WEBHOOK_VERIFY_TOKEN. POST: assinatura X-Hub-Signature-256 com META_APP_SECRET.
// Mesmo pipeline durável da Evolution: grava whatsapp_webhook_events (o trigger aciona o whatsapp-inbound-worker),
// histórico em whatsapp_messages e status de entrega. Responde 200 rápido; nada de IA ou envio aqui.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { requiredEnv, safeEqual, serviceClient } from "../_shared/whatsapp/auth.ts";
import { errorResponse, jsonResponse, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { inboxRow } from "../_shared/whatsapp/inbox.ts";
import { parseMetaWebhook, validMetaSignature } from "../_shared/whatsapp/meta.ts";

const MAX_BODY = 1_000_000;

serve(async req => {
  try {
    const url = new URL(req.url);
    if (req.method === "GET") {
      const token = url.searchParams.get("hub.verify_token") ?? "", challenge = url.searchParams.get("hub.challenge") ?? "";
      if (url.searchParams.get("hub.mode") === "subscribe" && token && safeEqual(token, requiredEnv("META_WEBHOOK_VERIFY_TOKEN")) && /^[A-Za-z0-9_-]{1,200}$/.test(challenge)) {
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      return new Response("forbidden", { status: 403 });
    }
    if (req.method !== "POST") throw new WhatsAppError("invalid_request", 405);
    const raw = new Uint8Array(await req.arrayBuffer());
    if (raw.byteLength > MAX_BODY) throw new WhatsAppError("invalid_request", 413);
    if (!await validMetaSignature(raw, req.headers.get("x-hub-signature-256"), requiredEnv("META_APP_SECRET"))) throw new WhatsAppError("unauthorized", 401);
    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(raw)); } catch { throw new WhatsAppError("invalid_request"); }

    const db = serviceClient();
    let accepted = 0;
    for (const change of parseMetaWebhook(body)) {
      // O salão vem do Phone Number ID registrado no banco, nunca do corpo além disso.
      const { data: instance, error } = await db.from("whatsapp_instances").select("id,salon_id,phone_number").eq("provider", "meta").eq("meta_phone_number_id", change.phoneNumberId).maybeSingle();
      if (error) throw new WhatsAppError("persistence_failed", 503);
      if (!instance) continue; // número de outro app/ainda não vinculado: ignora (200 para a Meta não reenviar)
      const own = instance.phone_number ? `+${String(instance.phone_number).replace(/\D/g, "")}` : null;

      for (const s of change.statuses) {
        if (s.status === "delivered" || s.status === "read") {
          const { error: e } = await db.rpc("whatsapp_record_delivery", { p_salon_id: instance.salon_id, p_instance_id: instance.id, p_message_id: s.id, p_status: s.status });
          if (e) throw new WhatsAppError("persistence_failed", 503);
        } else if (s.status === "failed") {
          // Recusado depois de aceito (ex.: 131047 fora da janela, 131026 sem WhatsApp): aparece como falha na Central.
          const code = `meta_${s.error ?? "failed"}`;
          await db.from("whatsapp_outbox").update({ status: "failed", error_code: code }).eq("salon_id", instance.salon_id).eq("remote_message_id", s.id).in("status", ["accepted", "uncertain"]);
          await db.from("whatsapp_messages").update({ status: "failed", error_code: code }).eq("salon_id", instance.salon_id).eq("provider_message_id", s.id).eq("direction", "out");
        }
      }
      const inbox = change.inbox.filter(m => m.phone !== own).map(m => inboxRow(instance.salon_id, m));
      if (inbox.length) {
        const { error: e } = await db.from("whatsapp_messages").upsert(inbox, { onConflict: "salon_id,provider_message_id", ignoreDuplicates: true });
        if (e) throw new WhatsAppError("persistence_failed", 503);
      }
      for (const m of change.incoming) {
        if (m.phone === own) continue;
        const { error: e } = await db.from("whatsapp_webhook_events").upsert({
          salon_id: instance.salon_id, instance_id: instance.id, event_type: "messages.upsert",
          provider_message_id: m.id, sender_phone: m.phone, whatsapp_at: m.timestamp,
          payload: { text: m.text, name: m.name, quotedMessageId: m.quotedMessageId, selection: m.selection ?? null, media: m.media ?? null, mediaId: m.mediaId ?? null, provider: "meta" },
        }, { onConflict: "instance_id,event_type,provider_message_id", ignoreDuplicates: true });
        if (e) throw new WhatsAppError("persistence_failed", 503);
        accepted++;
      }
    }
    return jsonResponse({ accepted });
  } catch (error) { return errorResponse(error); }
});
