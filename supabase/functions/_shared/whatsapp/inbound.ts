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
const PRIVATE_JID = /^\d{7,15}@s\.whatsapp\.net$/;
const filled = (v: unknown) => typeof v === "string" ? v.trim() !== "" : v != null && v !== false;
/**
 * Algum contextInfo do envelope indica grupo/comunidade/anúncio. contextInfo.participant NÃO conta:
 * em conversa 1:1 ele aparece ao citar uma mensagem (autor da citada).
 */
function groupContext(ctx: Record<string, unknown> | null): boolean {
  return !!ctx && (ctx.isGroup === true || filled(ctx.groupSubject) || filled(ctx.parentGroupJid));
}
/**
 * Conversa individual (1:1) inequívoca. O atendente NUNCA responde grupo, comunidade, anúncio de comunidade,
 * status, canal (@newsletter), chamada ou LID sem número. Na dúvida, rejeita (fail-closed).
 * Evolution 2.3.7 troca remoteJid @lid por remoteJidAlt quando resolve o número; se ainda for @lid, não há número.
 */
export function isPrivateChat(data: unknown): boolean {
  const row = recordOf(data), key = recordOf(row?.key), message = recordOf(row?.message);
  if (!row || !key) return false;
  const jid = typeof key.remoteJid === "string" ? key.remoteJid.trim().toLowerCase() : "";
  if (!jid || /@(g\.us|broadcast|newsletter|lid|call)$/.test(jid) || jid.includes("-") || !PRIVATE_JID.test(jid)) return false;
  // Mensagem com participante = enviada dentro de grupo/comunidade.
  if (filled(key.participant) || filled(key.participantAlt) || filled(row.participant) || filled(row.participantAlt)) return false;
  if (row.isGroup === true || key.isGroup === true) return false;
  if (message && (message.groupInviteMessage || message.senderKeyDistributionMessage || message.fastRatchetKeySenderKeyDistributionMessage)) return false;
  const contexts: (Record<string, unknown> | null)[] = [recordOf(row.contextInfo), recordOf(message?.messageContextInfo)];
  for (const v of Object.values(message ?? {})) contexts.push(recordOf(recordOf(v)?.contextInfo));
  return !contexts.some(groupContext);
}
export function parseIncoming(data: unknown): IncomingMessage | null {
  // Defesa em profundidade: grupos/comunidades/canais/status nunca viram comando do atendente.
  if (!isPrivateChat(data)) return null;
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
/** `<nonce>.<n>` (menus dinâmicos) ou id fixo do fluxo guiado (`menu_book`, `confirm_yes`…). */
const SELECTION_ID = /^(?:[a-z0-9]{1,12}\.[a-z0-9]{1,8}|[a-z][a-z0-9_]{2,30})$/;
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
export type DeliveryStatus = "sent" | "delivered" | "read";
export function deliveryStatus(value: unknown): DeliveryStatus | null {
  const s = String(value ?? "").toUpperCase();
  return ["4", "5", "READ", "PLAYED"].includes(s) ? "read" : ["3", "DELIVERY_ACK"].includes(s) ? "delivered" : ["2", "SERVER_ACK"].includes(s) ? "sent" : null;
}
export function deliveryUpdates(value: unknown): { id: string; status: DeliveryStatus }[] {
  return (Array.isArray(value) ? value : [value]).flatMap(v => {
    const r = recordOf(v), key = recordOf(r?.key), u = recordOf(r?.update);
    const id = key?.id ?? r?.keyId;
    if (key?.fromMe === false || r?.fromMe === false || typeof id !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(id)) return [];
    const statuses = [u?.status, r?.status, ...(Array.isArray(r?.MessageUpdate) ? r.MessageUpdate.map(v => recordOf(v)?.status) : [])].map(deliveryStatus);
    const status = statuses.includes("read") ? "read" : statuses.includes("delivered") ? "delivered" : statuses.includes("sent") ? "sent" : null;
    return status ? [{ id, status }] : [];
  });
}
export function whatsappTimestamp(value: unknown, arrived = Date.now()): string | null {
  const raw = recordOf(value)?.low ?? value, n = Number(raw), ms = n > 1e12 ? n : n * 1000;
  // Relógio futuro/inválido não entra nos percentis como atraso negativo.
  return Number.isFinite(ms) && ms >= 1e12 && ms <= arrived ? new Date(ms).toISOString() : null;
}
export interface PollVote { pollId: string; phone: string; option: string; voteId?: string }
/** 2.3.7: upsert descriptografado contém selectedOptions (nomes); update contém {name,voters}. Nunca interpreta bytes cifrados. */
export function pollVotes(value: unknown): PollVote[] {
  const r = recordOf(value), key = recordOf(r?.key), msg = recordOf(r?.message), poll = recordOf(msg?.pollUpdateMessage);
  if (!r) return [];
  if (poll && isPrivateChat(r) && key?.fromMe === false) {
    const origin = recordOf(poll.pollCreationMessageKey), vote = recordOf(poll.vote);
    const selected = vote?.selectedOptions;
    // A enquete é validada depois pelo id enviado por NÓS para este mesmo telefone (whatsapp_outbox).
    if (typeof origin?.id !== "string" || !Array.isArray(selected) || selected.length !== 1 || typeof selected[0] !== "string") return [];
    return [{ pollId: origin.id, phone: `+${String(key?.remoteJid).split("@")[0]}`, option: selected[0], voteId: typeof key?.id === "string" ? key.id : undefined }];
  }
  const pollId = key?.id ?? r.keyId, remote = key?.remoteJid ?? r.remoteJid;
  if (typeof pollId !== "string" || typeof remote !== "string" || !PRIVATE_JID.test(remote) || r.participant || key?.participant) return [];
  const updates = recordOf(r.update)?.pollUpdates ?? r.pollUpdates;
  if (!Array.isArray(updates)) return [];
  const selected = updates.filter(v => typeof v?.name === "string" && Array.isArray(v.voters) && v.voters.includes(remote));
  return selected.length === 1 ? [{ pollId, phone: `+${remote.split("@")[0]}`, option: selected[0].name }] : [];
}
export function pollSelection(payload: unknown, option: string): string | null {
  const p = recordOf(payload);
  if (p?.op !== "poll" || !Array.isArray(p.options)) return null;
  const matches = p.options.filter(v => recordOf(v)?.title === option);
  const id = recordOf(matches.length === 1 ? matches[0] : null)?.id;
  return typeof id === "string" && SELECTION_ID.test(id) ? id : null;
}

export function eventName(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase().replaceAll("_", ".") : "";
}
