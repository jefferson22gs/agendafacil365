/** Regras puras do envelope Evolution 2.3.7; nenhum acesso ao banco/modelo. */
export interface IncomingMessage {
  id: string;
  phone: string;
  jid: string;
  text: string;
  name: string;
  quotedMessageId: string | null;
  /** Id da linha/botão clicado (lista, botões, template). Só o servidor interpreta. */
  selection?: string | null;
  /** Imagem/documento recebido (comprovante de PIX). Sem URL: o servidor baixa via getBase64FromMediaMessage. */
  media?: { type: "image" | "document"; mime: string | null; name: string | null; url: string | null } | null;
}
export function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
export function parseIncoming(data: unknown): IncomingMessage | null {
  const row = recordOf(data), key = recordOf(row?.key), message = recordOf(row?.message);
  // Somente inbound inequívoco. Edit/revoke/protocol/status/grupo/LID não resolvido não são comandos.
  if (!row || key?.fromMe !== false || !message || message.protocolMessage || message.editedMessage) return null;
  const jid = key.remoteJid, id = key.id;
  if (typeof jid !== "string" || !/^\d{7,15}@s\.whatsapp\.net$/.test(jid) || typeof id !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) return null;
  const extended = recordOf(message.extendedTextMessage);
  const base = { id, jid, phone: `+${jid.split("@")[0]}`, name: typeof row.pushName === "string" ? row.pushName.slice(0, 120) : "Cliente" };
  // Atendente: resposta de lista/botão chega como id selecionado; o texto visível vai junto como fallback.
  const choice = selectionOf(message);
  if (choice) return { ...base, text: choice.text || choice.id, quotedMessageId: null, selection: choice.id, media: null };
  const media = mediaOf(message);
  if (media) return { ...base, text: media.caption, quotedMessageId: null, selection: null, media: media.media };
  const text = message.conversation ?? extended?.text;
  if (typeof text !== "string" || !text.trim() || text.length > 8_000) return null;
  const context = recordOf(extended?.contextInfo);
  return { ...base, text: text.trim(), quotedMessageId: typeof context?.stanzaId === "string" ? context.stanzaId : null };
}
const SELECTION_ID = /^[a-z0-9]{1,12}\.[a-z0-9]{1,8}$/;
/** listResponseMessage.singleSelectReply.selectedRowId | buttonsResponseMessage.selectedButtonId | templateButtonReplyMessage.selectedId | interactiveResponseMessage (nativeFlow paramsJson.id). */
export function selectionOf(message: Record<string, unknown>): { id: string; text: string } | null {
  const list = recordOf(message.listResponseMessage), buttons = recordOf(message.buttonsResponseMessage), template = recordOf(message.templateButtonReplyMessage);
  const interactive = recordOf(message.interactiveResponseMessage);
  let id: unknown = recordOf(list?.singleSelectReply)?.selectedRowId ?? buttons?.selectedButtonId ?? template?.selectedId;
  let text: unknown = list?.title ?? buttons?.selectedDisplayText ?? template?.selectedDisplayText;
  if (!id && interactive) {
    try { id = JSON.parse(String(recordOf(interactive.nativeFlowResponseMessage)?.paramsJson ?? "{}"))?.id; } catch { id = null; }
    text = recordOf(interactive.body)?.text;
  }
  if (typeof id !== "string" || !SELECTION_ID.test(id)) return null;
  return { id, text: typeof text === "string" ? text.trim().slice(0, 200) : "" };
}
function mediaOf(message: Record<string, unknown>): { caption: string; media: NonNullable<IncomingMessage["media"]> } | null {
  const doc = recordOf(message.documentMessage) ?? recordOf(recordOf(recordOf(message.documentWithCaptionMessage)?.message)?.documentMessage);
  const img = recordOf(message.imageMessage);
  const m = img ?? doc;
  if (!m) return null;
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);
  const url = str(m.url, 2000);
  return {
    caption: (str(m.caption, 1000) ?? "").trim(),
    media: { type: img ? "image" : "document", mime: str(m.mimetype, 100), name: str(m.fileName, 200), url: url && /^https:\/\//.test(url) && !/whatsapp\.net/.test(new URL(url).hostname) ? url : null },
  };
}
/** Mensagem para a caixa de entrada (Conversas): entrada e saída, texto e mídia. Só contatos individuais com número. */
export interface InboxMessage {
  id: string;
  phone: string;
  direction: "in" | "out";
  kind: "text" | "interactive" | "media";
  type: string;
  body: string;
  mediaUrl: string | null;
  mediaMime: string | null;
  mediaName: string | null;
  name: string | null;
  createdAt: string | null;
}
const MEDIA_TYPES: Record<string, string> = {
  imageMessage: "image", videoMessage: "video", audioMessage: "audio", documentMessage: "document", stickerMessage: "sticker",
  locationMessage: "location", liveLocationMessage: "location", contactMessage: "contact", contactsArrayMessage: "contact",
  pollCreationMessage: "poll", pollCreationMessageV3: "poll",
};
// Só exibição no inbox (texto visível); a interpretação da escolha pertence ao chatbot.
const INTERACTIVE_TYPES: Record<string, string> = {
  listMessage: "list", buttonsMessage: "buttons", interactiveMessage: "interactive", templateMessage: "buttons",
  listResponseMessage: "list_reply", buttonsResponseMessage: "buttons_reply", templateButtonReplyMessage: "buttons_reply", interactiveResponseMessage: "interactive_reply",
};
const str = (v: unknown) => (typeof v === "string" ? v : "");
function interactiveText(m: Record<string, unknown> | null): string {
  if (!m) return "";
  const single = recordOf(m.singleSelectReply), body = recordOf(m.body);
  return str(m.title) || str(m.selectedDisplayText) || str(m.description) || str(m.contentText) || str(m.text) || str(body?.text) || str(single?.selectedRowId);
}
function safeMediaUrl(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v !== "string" || v.length > 2000) continue;
    try {
      const u = new URL(v);
      // URL do CDN do WhatsApp é criptografada (.enc) e inútil no navegador; só links de armazenamento próprio.
      if (u.protocol === "https:" && !u.hostname.endsWith("whatsapp.net")) return u.toString();
    } catch { /* ignora */ }
  }
  return null;
}
export function parseInboxMessage(data: unknown): InboxMessage | null {
  const row = recordOf(data), key = recordOf(row?.key);
  let message = recordOf(row?.message);
  if (!row || !key || !message || typeof key.fromMe !== "boolean") return null;
  if (message.protocolMessage || message.editedMessage || message.reactionMessage) return null;
  const jid = key.remoteJid, id = key.id;
  if (typeof jid !== "string" || !/^\d{7,15}@s\.whatsapp\.net$/.test(jid) || typeof id !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) return null;
  const wrapped = recordOf(recordOf(message.documentWithCaptionMessage)?.message) ?? recordOf(recordOf(message.ephemeralMessage)?.message) ?? recordOf(recordOf(message.viewOnceMessage)?.message);
  if (wrapped) message = wrapped;
  const mediaKey = Object.keys(MEDIA_TYPES).find(k => recordOf(message![k]));
  const interactiveKey = mediaKey ? undefined : Object.keys(INTERACTIVE_TYPES).find(k => recordOf(message![k]));
  const media = mediaKey ? recordOf(message[mediaKey]) : null;
  const type = mediaKey ? MEDIA_TYPES[mediaKey] : interactiveKey ? INTERACTIVE_TYPES[interactiveKey] : "text";
  const kind = mediaKey ? "media" : interactiveKey ? "interactive" : "text";
  const body = (kind === "text" ? str(message.conversation) || str(recordOf(message.extendedTextMessage)?.text)
    : kind === "interactive" ? interactiveText(recordOf(message[interactiveKey!]))
    : str(media?.caption) || str(media?.name) || str(media?.displayName) || str(media?.address) || str(media?.fileName)).trim().slice(0, 8000);
  if (kind !== "media" && !body) return null;
  const ts = Number(row.messageTimestamp);
  return {
    id, phone: `+${jid.split("@")[0]}`, direction: key.fromMe ? "out" : "in", kind, type, body,
    mediaUrl: media ? safeMediaUrl(message.mediaUrl, row.mediaUrl, media.url) : null,
    mediaMime: media && typeof media.mimetype === "string" ? media.mimetype.slice(0, 100) : null,
    mediaName: media && typeof media.fileName === "string" ? media.fileName.slice(0, 200) : null,
    name: !key.fromMe && typeof row.pushName === "string" && row.pushName.trim() ? row.pushName.trim().slice(0, 120) : null,
    createdAt: Number.isFinite(ts) && ts > 1_000_000_000 ? new Date((ts > 1e12 ? ts : ts * 1000)).toISOString() : null,
  };
}
/** Registros de /chat/findMessages (Evolution v2 devolve { messages: { records } }; versões antigas, array). */
export function messageRecords(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const root = recordOf(value), inner = recordOf(root?.messages);
  const records = inner?.records ?? root?.records ?? root?.messages;
  return Array.isArray(records) ? records : [];
}
export interface EvolutionContact { jid: string; phone: string; name: string }
export interface ContactExclusions { group: number; broadcast: number; lid: number; invalid: number }
/** Filtra /chat/findContacts e /chat/findChats: só pessoas com número; grupos, listas, canais e @lid são contados à parte. */
export function evolutionContacts(list: unknown[], max = 10_000): { contacts: EvolutionContact[]; excluded: ContactExclusions } {
  const excluded: ContactExclusions = { group: 0, broadcast: 0, lid: 0, invalid: 0 };
  const seen = new Set<string>();
  const contacts: EvolutionContact[] = [];
  for (const entry of list.slice(0, max)) {
    const c = recordOf(entry);
    const jid = str(c?.remoteJid) || str(c?.id);
    if (jid.endsWith("@g.us")) { excluded.group++; continue; }
    if (jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) { excluded.broadcast++; continue; }
    if (jid.endsWith("@lid")) { excluded.lid++; continue; }
    if (!/^\d{7,15}@s\.whatsapp\.net$/.test(jid)) { excluded.invalid++; continue; }
    if (seen.has(jid)) continue;
    seen.add(jid);
    const name = (str(c?.name) || str(c?.pushName) || str(c?.verifiedName)).trim().slice(0, 120);
    contacts.push({ jid, phone: `+${jid.split("@")[0]}`, name: name || "Contato do WhatsApp" });
  }
  return { contacts, excluded };
}
export function eventName(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase().replaceAll("_", ".") : "";
}
