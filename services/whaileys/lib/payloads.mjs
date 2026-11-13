// Conversão do contrato HTTP da Evolution 2.3.7 (o que o AgendaFácil já envia) para mensagens da whaileys.
// Puro: sem rede e sem socket. Validação rígida porque o corpo vem de fora.

const MAX_TEXT = 4096;
const ID = /^[A-Za-z0-9._-]{1,100}$/;
const fail = (code) => { const e = new Error(code); e.status = 400; e.code = code; throw e; };
const str = (v, max, name) => {
  if (typeof v !== "string") fail(`${name}_required`);
  const s = v.trim();
  if (!s || s.length > max) fail(`${name}_invalid`);
  return s;
};
const opt = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

/** Número individual (8–15 dígitos) → JID. Grupo, canal, lista de transmissão e LID nunca. */
export function jidOf(number) {
  const digits = String(number ?? "").replace(/^\+/, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) fail("number_invalid");
  return `${digits}@s.whatsapp.net`;
}

export function textMessage(body) {
  return { jid: jidOf(body.number), content: { text: str(body.text, MAX_TEXT, "text") } };
}

/**
 * Botões (SendButtonsDto da Evolution): { title, description, footer, buttons:[{type:"reply", displayText, id}] }.
 * Até 3 botões de resposta, como o WhatsApp aceita. Com `image` (URL), vira botões com imagem.
 */
export function buttonsMessage(body) {
  const buttons = Array.isArray(body.buttons) ? body.buttons : fail("buttons_required");
  if (!buttons.length || buttons.length > 3) fail("buttons_count");
  const mapped = buttons.map((b) => ({
    buttonId: ID.test(String(b?.id ?? "")) ? String(b.id) : fail("button_id_invalid"),
    buttonText: { displayText: str(b?.displayText, 20, "button_text") },
    type: 1,
  }));
  const title = opt(body.title, 60), description = opt(body.description, MAX_TEXT) ?? "";
  const text = [title ? `*${title}*` : "", description].filter(Boolean).join("\n\n") || fail("text_required");
  const footer = opt(body.footer, 60);
  const image = opt(body.image, 2048);
  const content = image
    ? { image: { url: image }, caption: text, buttons: mapped, ...(footer ? { footer } : {}), headerType: 4 }
    : { text, buttons: mapped, ...(footer ? { footer } : {}) };
  return { jid: jidOf(body.number), content, mediaUrl: image };
}

/** Lista (SendListDto): { title, description, buttonText, footerText, sections:[{ title, rows:[{ title, description, rowId }] }] }. Até 10 linhas. */
export function listMessage(body) {
  const sections = Array.isArray(body.sections) ? body.sections : fail("sections_required");
  let rows = 0;
  const mapped = sections.map((s) => {
    const r = Array.isArray(s?.rows) ? s.rows : fail("rows_required");
    rows += r.length;
    return {
      title: opt(s.title, 24) ?? "",
      rows: r.map((row) => ({
        rowId: ID.test(String(row?.rowId ?? "")) ? String(row.rowId) : fail("row_id_invalid"),
        title: str(row?.title, 24, "row_title"),
        ...(opt(row?.description, 72) ? { description: opt(row.description, 72) } : {}),
      })),
    };
  });
  if (!rows || rows > 10) fail("rows_count");
  return {
    jid: jidOf(body.number),
    content: {
      text: str(body.description ?? body.title, MAX_TEXT, "text"),
      title: opt(body.title, 60) ?? "",
      buttonText: opt(body.buttonText, 20) ?? "Ver opções",
      footer: opt(body.footerText, 60) ?? "",
      sections: mapped,
    },
  };
}

/** Enquete (SendPollDto): { name, values:[...], selectableCount }. Mantida para o modo "enquete" do robô. */
export function pollMessage(body) {
  const values = Array.isArray(body.values) ? body.values.map((v) => str(v, 100, "poll_value")) : fail("values_required");
  if (values.length < 2 || values.length > 12) fail("values_count");
  return { jid: jidOf(body.number), content: { poll: { name: str(body.name, 255, "poll_name"), values, selectableCount: Math.min(Math.max(Number(body.selectableCount) || 1, 1), values.length) } } };
}

const MEDIA_TYPES = { image: "image", video: "video", document: "document", audio: "audio" };
/** Mídia (SendMediaDto): { mediatype, media (URL https), mimetype, caption, fileName }. */
export function mediaMessage(body) {
  const kind = MEDIA_TYPES[body.mediatype] ?? fail("mediatype_invalid");
  const url = str(body.media, 2048, "media");
  const caption = opt(body.caption, 1024);
  const content = { [kind]: { url }, ...(caption && kind !== "audio" ? { caption } : {}) };
  if (kind === "document") { content.mimetype = opt(body.mimetype, 100) ?? "application/octet-stream"; content.fileName = opt(body.fileName, 120) ?? "arquivo"; }
  else if (opt(body.mimetype, 100)) content.mimetype = opt(body.mimetype, 100);
  return { jid: jidOf(body.number), content, mediaUrl: url };
}

/** Status (SendStatusDto): { type: text|image|video, content, caption, backgroundColor, font, statusJidList }. */
export function statusMessage(body) {
  const list = Array.isArray(body.statusJidList) ? body.statusJidList : fail("status_list_required");
  // Lista explícita (clientes do salão). "allContacts" não é aceito: varrer a agenda inteira estoura o tempo.
  const jids = [...new Set(list.map((j) => jidOf(String(j).split("@")[0])))];
  if (!jids.length || jids.length > 2000) fail("status_list_count");
  if (body.type === "text") {
    const color = /^#[0-9a-f]{6}$/i.test(String(body.backgroundColor ?? "")) ? body.backgroundColor : "#2563EB";
    return { jids, content: { text: str(body.content, 700, "content") }, options: { backgroundColor: color, font: Math.min(Math.max(Number(body.font) || 1, 0), 5) } };
  }
  const kind = body.type === "video" ? "video" : body.type === "image" ? "image" : fail("status_type_invalid");
  const url = str(body.content, 2048, "content");
  const caption = opt(body.caption, 700);
  return { jids, content: { [kind]: { url }, ...(caption ? { caption } : {}) }, options: {}, mediaUrl: url };
}

/** Presença "digitando" (SendPresenceDto): { number, presence, delay }. */
export function presenceOf(body) {
  const presence = ["composing", "recording", "paused", "available", "unavailable"].includes(body.presence) ? body.presence : "composing";
  return { jid: jidOf(body.number), presence, delay: Math.min(Math.max(Number(body.delay) || 0, 0), 15_000) };
}
