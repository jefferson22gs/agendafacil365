// Núcleo puro do atendente (sem Deno/rede/banco): menus clicáveis, fallback numerado, parsers de cadastro.
// Testado em tests/rebrand/atendente.test.cjs.

/** Limites do WhatsApp para listas (Evolution 2.3.x repassa direto ao Baileys). */
export const LIST_ROWS = 10, TITLE_MAX = 24, DESC_MAX = 72, BUTTONS_MAX = 3, BUTTON_TEXT_MAX = 20;

export interface Option { title: string; description?: string; value: Record<string, unknown> }
export interface MenuRow { id: string; title: string; description?: string }
export interface Menu { kind: "list" | "buttons"; title: string; body: string; button: string; rows: MenuRow[] }
/** O que fica salvo no servidor: o id da linha só aponta para cá (não carrega valores do cliente). */
export interface StoredMenu { nonce: string; step: string; options: Record<string, unknown>[]; page: number; hasMore: boolean; labels?: string[] }

const oneLine = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();
/** Corta em n caracteres com reticências (contagem por code point para não quebrar acento/emoji). */
export function clip(s: unknown, n: number): string {
  const chars = Array.from(oneLine(s));
  return chars.length <= n ? chars.join("") : chars.slice(0, n - 1).join("").trimEnd() + "…";
}
export const MORE = "more";

/**
 * Monta uma página de opções. Até 3 opções sem descrição viram botões; senão lista.
 * Ids: `<nonce>.<n>` (n = posição 1..) e `<nonce>.more`. O valor real nunca sai do servidor.
 */
export function buildMenu(nonce: string, step: string, title: string, body: string, all: Option[], page = 0, perPage = LIST_ROWS - 1): { menu: Menu; stored: StoredMenu } {
  if (!/^[a-z0-9]{4,12}$/.test(nonce)) throw new Error("invalid_nonce");
  const size = Math.max(1, Math.min(perPage, LIST_ROWS - 1));
  const slice = all.slice(page * size, page * size + size);
  const hasMore = all.length > (page + 1) * size;
  const rows: MenuRow[] = slice.map((o, i) => ({ id: `${nonce}.${i + 1}`, title: clip(o.title, TITLE_MAX), ...(o.description ? { description: clip(o.description, DESC_MAX) } : {}) }));
  if (hasMore) rows.push({ id: `${nonce}.${MORE}`, title: "Ver mais opções" });
  const buttons = rows.length <= BUTTONS_MAX && rows.every(r => !r.description && Array.from(r.title).length <= BUTTON_TEXT_MAX);
  return {
    menu: { kind: buttons ? "buttons" : "list", title: clip(title, 60), body: oneLine(body).slice(0, 1000), button: "Ver opções", rows },
    stored: { nonce, step, options: slice.map(o => o.value), labels: slice.map(o => oneLine(o.title)), page, hasMore },
  };
}

/** Fallback em texto (sempre enviado quando o interativo falha ou está desligado). */
export function numberedText(menu: Menu): string {
  const lines = menu.rows.map((r, i) => r.id.endsWith(`.${MORE}`) ? `${i + 1}. ${r.title}` : `${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ""}`);
  const n = menu.rows.length;
  const hint = n === 1 ? "Responda 1." : `Responda com o número (1 a ${n}).`;
  return `${menu.body}\n\n${lines.join("\n")}\n\n${hint}`;
}

/** Corpo exato de POST /message/sendList e /message/sendButtons (Evolution 2.3.7, src/api/dto/sendMessage.dto.ts). */
export function evolutionBody(menu: Menu, number: string): { op: "list" | "buttons"; body: Record<string, unknown> } {
  if (menu.kind === "buttons") {
    return { op: "buttons", body: { number, title: menu.title, description: menu.body, footer: "", buttons: menu.rows.map(r => ({ type: "reply", displayText: r.title, id: r.id })) } };
  }
  return { op: "list", body: { number, title: menu.title, description: menu.body, buttonText: menu.button, footerText: "", sections: [{ title: clip(menu.title, TITLE_MAX), rows: menu.rows.map(r => ({ title: r.title, description: r.description ?? " ", rowId: r.id })) }] } };
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
/**
 * Resolve a escolha: id clicado (`nonce.n`), número digitado ("2", "opção 2", "2️⃣") ou título exato.
 * Retorna índice 0-based, "more" ou null. Id de menu antigo (nonce diferente) é ignorado.
 */
export function resolveChoice(stored: StoredMenu | null | undefined, text: string, selection?: string | null): number | "more" | null {
  if (!stored) return null;
  const total = stored.options.length + (stored.hasMore ? 1 : 0);
  const pick = (n: number) => (n >= 1 && n <= stored.options.length ? n - 1 : stored.hasMore && n === total ? "more" as const : null);
  if (selection) {
    const m = selection.match(/^([a-z0-9]{4,12})\.(\d{1,2}|more)$/);
    if (!m || m[1] !== stored.nonce) return null;
    return m[2] === MORE ? (stored.hasMore ? "more" : null) : pick(Number(m[2]));
  }
  const t = fold(text).replace(/[⃣️]/g, "");
  const num = t.match(/^(?:op(?:cao|ção)?\s*|n[ºo°]?\s*)?(\d{1,2})[.)]?$/);
  if (num) return pick(Number(num[1]));
  if (/^(ver mais|mais|mais opcoes|mais horarios|proxim[ao]s?)$/.test(t)) return stored.hasMore ? "more" : null;
  const matches = (stored.labels ?? []).map((label, i) => fold(label) === t ? i : -1).filter(i => i >= 0);
  return matches.length === 1 ? matches[0] : null;
}

/** Evolution 2.3.7 message.schema.ts: 2–10 opções (não 12), únicas. Uma opção usa texto. */
export function premiumPoll(menu: Menu, salon = ""): Record<string, unknown> | null {
  if (menu.rows.length < 2 || menu.rows.length > 10) return null;
  const values = menu.rows.map((r, i) => clip(`${i + 1}. ${r.id.endsWith(".more") && /horários/i.test(menu.title) ? "Ver mais horários" : r.title}${r.description ? ` · ${r.description}` : ""}`, 100));
  const footer = salon ? `\n${clip(salon, 50)}` : "";
  const heading = clip(menu.title, 40);
  const name = `${heading}\n${clip(menu.body, 255 - heading.length - footer.length - 1)}${footer}`;
  return { op: "poll", body: { name, selectableCount: 1, values }, options: menu.rows.map((r, i) => ({ id: r.id, title: values[i] })) };
}

/** Nome completo: ao menos nome + sobrenome, só letras/espaço/apóstrofo/hífen, 5–120 caracteres. */
export function fullName(value: unknown): string | null {
  const s = oneLine(value).replace(/^(meu nome (e|é)|me chamo|sou (o|a)?)\s+/i, "");
  if (s.length < 5 || s.length > 120 || !/^[\p{L}][\p{L}'’ -]*$/u.test(s)) return null;
  const parts = s.split(" ").filter(p => p.replace(/['’-]/g, "").length >= 2);
  if (parts.length < 2) return null;
  const lower = new Set(["da", "de", "do", "das", "dos", "e"]);
  return s.split(" ").map((p, i) => i > 0 && lower.has(p.toLowerCase()) ? p.toLowerCase() : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1).toLocaleLowerCase("pt-BR")).join(" ");
}

const MONTHS: Record<string, number> = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12, jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
export type BirthResult = { ok: true; date: string | null; partial: boolean } | { ok: false; refused: boolean };
/**
 * Data de nascimento: dd/mm/aaaa, dd-mm-aa, dd/mm (sem ano: grava ano 1904 = ano desconhecido, bissexto para aceitar 29/02),
 * "12 de março de 1990", "12 de marco". Recusa ("prefiro não informar", "pular") é aceita: o campo é opcional.
 * `today` = data local do salão (YYYY-MM-DD) para rejeitar futuro e idade > 120.
 */
export function parseBirthDate(value: unknown, today: string): BirthResult {
  const t = fold(String(value ?? "")).replace(/[,.]/g, " ").replace(/\s+/g, " ").trim();
  if (/^(nao|n|pular|pula|prefiro nao( informar| dizer)?|nao quero( informar| dizer)?|sem data|depois)$/.test(t)) return { ok: false, refused: true };
  let d: number, m: number, y: number | null = null;
  let mt = t.match(/^(\d{1,2})\s*[/.\- ]\s*(\d{1,2})(?:\s*[/.\- ]\s*(\d{2}|\d{4}))?$/);
  if (mt) { d = +mt[1]; m = +mt[2]; y = mt[3] ? +mt[3] : null; }
  else {
    mt = t.match(/^(?:dia\s+)?(\d{1,2})\s+(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(\d{4}|\d{2}))?$/);
    if (!mt || !MONTHS[mt[2]]) return { ok: false, refused: false };
    d = +mt[1]; m = MONTHS[mt[2]]; y = mt[3] ? +mt[3] : null;
  }
  const [ty] = today.split("-").map(Number);
  if (y !== null && y < 100) y = y + 2000 > ty ? 1900 + y : 2000 + y;
  const partial = y === null;
  const year = y ?? 1904;
  const iso = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const check = new Date(`${iso}T12:00:00Z`);
  if (m < 1 || m > 12 || d < 1 || Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== iso) return { ok: false, refused: false };
  if (!partial && (iso > today || year < ty - 120)) return { ok: false, refused: false };
  return { ok: true, date: iso, partial };
}

/** Telefone digitado pelo cliente → E.164. Sem DDI assume Brasil (+55) só quando tem DDD (10–11 dígitos). */
export function brazilPhone(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return digits.length >= 8 && digits.length <= 15 && digits[0] !== "0" ? `+${digits}` : null;
  const local = digits.replace(/^0+/, "");
  if (local.length === 10 || local.length === 11) {
    if (!/^[1-9][1-9]/.test(local) || (local.length === 11 && local[2] !== "9")) return null;
    return `+55${local}`;
  }
  if ((local.length === 12 || local.length === 13) && local.startsWith("55")) return `+${local}`;
  return null;
}

export const brl = (v: unknown) => `R$ ${Number(v ?? 0).toFixed(2).replace(".", ",")}`;
export const dateBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const weekday = (iso: string) => WEEK[new Date(`${iso}T12:00:00Z`).getUTCDay()];

/** Sim/não curtos em respostas livres. */
export function yesNo(text: string): boolean | null {
  const t = fold(text).replace(/[!.]/g, "");
  if (/^(sim|s|isso|e sim|e esse|esse mesmo|correto|certo|pode ser|ok|confirmo|uhum|aham|1)$/.test(t)) return true;
  if (/^(nao|n|outro|e outro|nao e|2)$/.test(t)) return false;
  return null;
}

/** Desconto de cupom igual ao link público: percentual sobre o total ou valor fixo limitado ao total. */
export function couponDiscount(c: { type: string; value: number; min_purchase?: number | null }, total: number): number {
  if (c.min_purchase && total < Number(c.min_purchase)) return 0;
  const raw = c.type === "percentage" ? total * (Number(c.value) / 100) : Math.min(Number(c.value), total);
  return Math.round(Math.max(0, Math.min(raw, total)) * 100) / 100;
}

/** Instantes UTC dos lembretes (espelho do SQL whatsapp_enqueue_reminders): só futuros e não repetidos. */
export function reminderInstants(apptUtcMs: number, minutes: number[], nowMs: number): { minutes: number; at: number }[] {
  return [...new Set(minutes)].filter(m => [15, 30, 60, 120, 180, 360, 720, 1440, 2880].includes(m))
    .map(m => ({ minutes: m, at: apptUtcMs - m * 60_000 })).filter(r => r.at > nowMs).sort((a, b) => a.at - b.at);
}
