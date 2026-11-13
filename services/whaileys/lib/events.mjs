// Eventos da whaileys → envelope que o webhook do AgendaFácil (evolution-webhook) já entende.
// O webhook lê: body.instance, body.event, body.data (lista ou objeto) e body.sender.

/** JID de conversa individual com número real; LID (@lid) só passa se a mensagem trouxer o número (senderPn). */
export function realJid(key) {
  const jid = String(key?.remoteJid ?? "");
  if (/^\d{7,15}@s\.whatsapp\.net$/.test(jid)) return jid;
  const pn = String(key?.senderPn ?? key?.remoteJidAlt ?? "");
  return /^\d{7,15}@s\.whatsapp\.net$/.test(pn) ? pn : null;
}

/** Converte mensagens recebidas/enviadas (messages.upsert) mantendo o formato do Baileys que o parser já usa. */
export function upsertEnvelope(instance, messages, ownerJid) {
  const data = [];
  for (const m of messages ?? []) {
    if (!m?.key || !m.message) continue;
    const jid = realJid(m.key);
    if (!jid) continue;
    data.push({
      key: { remoteJid: jid, fromMe: !!m.key.fromMe, id: m.key.id },
      pushName: typeof m.pushName === "string" ? m.pushName.slice(0, 120) : undefined,
      message: m.message,
      messageTimestamp: Number(m.messageTimestamp?.low ?? m.messageTimestamp ?? 0) || undefined,
    });
  }
  return data.length ? { instance, event: "messages.upsert", data, sender: ownerJid ?? undefined } : null;
}

/** Recibos de entrega/leitura (messages.update) no formato que deliveryUpdates() lê: { key, update: { status } }. */
export function updateEnvelope(instance, updates) {
  const data = (updates ?? [])
    .filter((u) => u?.key?.fromMe && typeof u.key.id === "string" && u.update && u.update.status != null)
    .map((u) => ({ key: { id: u.key.id, fromMe: true, remoteJid: u.key.remoteJid }, update: { status: u.update.status } }));
  return data.length ? { instance, event: "messages.update", data } : null;
}

/** connection.update → { state: open|connecting|close }, como a Evolution manda. */
export function connectionEnvelope(instance, state) {
  return { instance, event: "connection.update", data: { state } };
}
