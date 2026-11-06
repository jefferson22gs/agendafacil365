import type { InboxMessage } from "./inbound.ts";

/** Linha de whatsapp_messages a partir de um envelope Evolution. Saída sem outbox = enviada pelo celular do salão. */
export function inboxRow(salonId: string, m: InboxMessage) {
  return {
    salon_id: salonId, phone: m.phone, direction: m.direction,
    author: m.direction === "in" ? "contact" : "human", source: m.direction === "in" ? "contact" : "phone",
    body: m.body, kind: m.kind, message_type: m.type, media_url: m.mediaUrl, media_mime: m.mediaMime, media_name: m.mediaName,
    contact_name: m.name, provider_message_id: m.id, status: m.direction === "in" ? "received" : "sent",
    ...(m.createdAt ? { created_at: m.createdAt } : {}),
  };
}

/** Texto de resposta manual: obrigatório, até 4096 caracteres (limite do outbox/Evolution). */
export function replyText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n?/g, "\n").trim();
  return text && text.length <= 4096 ? text : null;
}
