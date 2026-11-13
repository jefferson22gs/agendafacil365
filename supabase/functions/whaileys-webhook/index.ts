// Webhook da Whaileys API (conexão "QR Code com botões"). Mesmo destino do webhook da Evolution:
// grava o evento em whatsapp_webhook_events e o inbound-worker responde pelo robô. Ordem:
// 1. assinatura HMAC + janela de 5 min; 2. instância pelo nome configurado (nunca pelo corpo livre);
// 3. dedupe por key.id (índice único do evento); 4. só a conexão escolhida para o robô aciona resposta;
// 5. responde 200 rápido (a resposta ao cliente sai pela fila).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { serviceClient } from "../_shared/whatsapp/auth.ts";
import { jsonResponse, errorResponse, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { isPrivateChat, parseInboxMessage, parseIncoming } from "../_shared/whatsapp/inbound.ts";
import { inboxRow } from "../_shared/whatsapp/inbox.ts";
import { verifyWhaileysSignature, whaileysInstance } from "../_shared/whatsapp/whaileys.ts";

interface Payload { instanceKey?: unknown; me?: { id?: unknown; lid?: unknown } | null; key?: Record<string, unknown>; message?: unknown; pushName?: unknown; media?: { mimetype?: unknown; data?: unknown } | null }

/** Contato só com LID: usa o número real (senderPn/remoteJidAlt) quando o motor conseguiu descobrir. */
export function realKey(key: Record<string, unknown>): Record<string, unknown> | null {
  const jid = String(key.remoteJid ?? "");
  if (/^\d{7,15}@s\.whatsapp\.net$/.test(jid)) return key;
  const pn = [key.senderPn, key.remoteJidAlt].map(v => String(v ?? "")).find(v => /^\d{7,15}@s\.whatsapp\.net$/.test(v));
  return pn ? { ...key, remoteJid: pn } : null;
}

serve(async (req) => {
  const arrived = Date.now();
  try {
    if (req.method !== "POST") throw new WhatsAppError("invalid_request", 405);
    const raw = await req.text();
    if (raw.length > 12_000_000) throw new WhatsAppError("invalid_request", 413);
    // deno-lint-ignore no-explicit-any
    const secret = String((globalThis as any).Deno?.env?.get?.("WHAILEYS_WEBHOOK_SECRET") ?? "");
    if (!await verifyWhaileysSignature(raw, req.headers.get("x-whaileys-timestamp"), req.headers.get("x-whaileys-signature"), secret)) throw new WhatsAppError("unauthorized", 401);
    let body: Payload;
    try { body = JSON.parse(raw); } catch { throw new WhatsAppError("invalid_request", 400); }
    if (body.instanceKey !== whaileysInstance()) return jsonResponse({ ignored: "instance" });

    const db = serviceClient();
    // Uma instância do motor = uma conexão "whaileys" do AgendaFácil (nome da instância gravado na conexão).
    const { data: instance, error } = await db.from("whatsapp_instances").select("id,salon_id,phone_number,status").eq("provider", "whaileys").eq("instance_name", String(body.instanceKey)).maybeSingle();
    if (error) throw new WhatsAppError("persistence_failed", 503);
    if (!instance) return jsonResponse({ ignored: "no_connection" });

    // Número conectado: o motor manda em toda mensagem; mantém a tela de Conexão em dia sem precisar consultar.
    const me = String(body.me?.id ?? "").split("@")[0].split(":")[0].replace(/\D/g, "");
    if (me && (me !== instance.phone_number || instance.status !== "connected")) {
      await db.from("whatsapp_instances").update({ phone_number: me, status: "connected", qrcode: null, updated_at: new Date().toISOString() }).eq("id", instance.id);
    }

    const key = body.key && typeof body.key === "object" ? realKey(body.key) : null;
    if (!key || typeof key.id !== "string" || !/^[A-Za-z0-9._-]{4,160}$/.test(key.id)) return jsonResponse({ ignored: "key" });
    // Mesmo formato que o parser da Evolution já entende (key + message + pushName).
    const entry = { key, message: body.message, pushName: typeof body.pushName === "string" ? body.pushName : undefined, messageTimestamp: Math.floor(arrived / 1000) };
    if (!isPrivateChat(entry)) return jsonResponse({ ignored: "not_private" });

    // Caixa de entrada: recebidas e enviadas pelo próprio celular (fromMe). Duplicatas ignoradas.
    const inbox = parseInboxMessage(entry);
    if (inbox) {
      const { error: inboxError } = await db.from("whatsapp_messages").upsert([inboxRow(instance.salon_id, inbox)], { onConflict: "salon_id,provider_message_id", ignoreDuplicates: true });
      if (inboxError) throw new WhatsAppError("persistence_failed", 503);
    }

    // Robô em UMA conexão: se o dono escolheu outra, a mensagem fica só na Caixa de entrada.
    const { data: botProvider } = await db.rpc("whatsapp_bot_provider", { p_salon_id: instance.salon_id });
    if (botProvider && botProvider !== "whaileys") return jsonResponse({ accepted: 0, reason: "bot_on_other_connection" });
    const message = parseIncoming(entry);
    if (!message || (me && message.phone === `+${me}`)) return jsonResponse({ accepted: 0 });
    // Comprovante (imagem/PDF): o motor já manda o arquivo. Vai para o Storage privado por id da mensagem
    // (idempotente) e o evento guarda só o caminho; o comprovante é lido de lá depois.
    let mediaPath: string | null = null;
    if (message.media && typeof body.media?.data === "string" && body.media.data.length <= 11_200_000) {
      const bytes = Uint8Array.from(atob(body.media.data), c => c.charCodeAt(0));
      const path = `${instance.salon_id}/whaileys-inbound/${message.id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
      const { error: upErr } = await db.storage.from("payment-proofs").upload(path, bytes, { contentType: String(body.media.mimetype ?? "application/octet-stream").slice(0, 100), upsert: true });
      if (upErr) throw new WhatsAppError("persistence_failed", 503);
      mediaPath = path;
    }
    const { error: insertError } = await db.from("whatsapp_webhook_events").upsert({
      salon_id: instance.salon_id, instance_id: instance.id, event_type: "messages.upsert",
      provider_message_id: message.id, sender_phone: message.phone, whatsapp_at: new Date(arrived).toISOString(),
      payload: { text: message.text, name: message.name, quotedMessageId: message.quotedMessageId, selection: message.selection ?? null, media: message.media ?? null, provider: "whaileys", ...(mediaPath ? { mediaPath } : {}) },
    }, { onConflict: "instance_id,event_type,provider_message_id", ignoreDuplicates: true });
    if (insertError) throw new WhatsAppError("persistence_failed", 503);
    return jsonResponse({ accepted: 1 });
  } catch (error) { return errorResponse(error); }
});
