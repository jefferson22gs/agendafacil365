// Modos "clicáveis" do fluxo guiado (Evolution API 2.3.7):
//  - poll (recomendado): /message/sendPoll com selectableCount 1. Chega em Android, iPhone e WhatsApp Web; até 9 opções por card.
//  - buttons: /message/sendButtons, até 3 por card. Em conexões Baileys o WhatsApp pode descartar sem aviso.
// Opções além do limite viram páginas com "➡️ Ver mais"; a última página volta ao início.
import { clip, numberedText, type Menu } from "./interactive.ts";
import type { OutMessage } from "./attendant.ts";

/** Limites do WhatsApp: botões de resposta rápida (3 × 20 caracteres) e enquete (2–10 opções × 100, título 255). */
export const MAX_BUTTONS = 3, BUTTON_TEXT = 20, POLL_MAX = 9, POLL_VALUE = 100, POLL_NAME = 255;
const KEYCAP = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

/**
 * Página: até `max` opções cabem inteiras; acima disso, `max - 1` por página + navegação
 * ("➡️ Ver mais"; na última, "🔁 Do início"). `page` fora do intervalo dá a volta (módulo).
 */
export function buttonPage(total: number, page: number, max = MAX_BUTTONS): { start: number; end: number; more: boolean; wrap: boolean; page: number; pages: number } {
  if (total <= 0) return { start: 0, end: 0, more: false, wrap: false, page: 0, pages: 0 };
  if (total <= max) return { start: 0, end: total, more: false, wrap: false, page: 0, pages: 1 };
  const per = max - 1, pages = Math.ceil(total / per);
  const p = ((page % pages) + pages) % pages;
  const more = p < pages - 1;
  return { start: p * per, end: Math.min(total, p * per + per), more, wrap: !more, page: p, pages };
}

/** Card de botões (SendButtonsDto 2.3.7). O `text` (numerado) só sai se a Evolution recusar os botões. */
export function renderButtons(menu: Menu): OutMessage {
  if (menu.rows.length > MAX_BUTTONS) throw new Error("too_many_buttons");
  return {
    type: "interactive", text: numberedText(menu),
    payload: { op: "buttons", body: { title: menu.title, description: menu.body, footer: menu.footer ?? "", buttons: menu.rows.map(r => ({ type: "reply", displayText: clip(r.title, BUTTON_TEXT), id: r.id })) } },
  };
}

const chars = (s: string) => Array.from(s).length;
const cut = (s: string, n: number) => (chars(s) <= n ? s : Array.from(s).slice(0, n - 1).join("").trimEnd() + "…");

/**
 * Acrescenta um texto (resposta da IA, aviso) antes do card. Botões/lista: entra na descrição. Enquete: se ainda couber
 * no título, entra nele; senão vai numa mensagem de texto antes (junta com o texto já existente, se houver).
 */
export function prependIntro(messages: OutMessage[], intro: string): OutMessage[] {
  const [first, ...rest] = messages;
  if (!first) return messages;
  const body = first.type === "interactive" ? first.payload.body as Record<string, unknown> | undefined : undefined;
  if (first.type === "interactive" && first.payload.op === "poll" && body) {
    const name = `${intro}\n\n${String(body.name ?? "")}`;
    if (chars(name) <= POLL_NAME) { body.name = name; first.text = `${intro}\n\n${first.text}`; return messages; }
    return [{ type: "text", text: intro }, ...messages];
  }
  first.text = `${intro}\n\n${first.text}`;
  if (body && typeof body.description === "string") body.description = `${intro}\n\n${body.description}`;
  return [first, ...rest];
}

/**
 * Enquete de escolha única (SendPollDto 2.3.7: name ≤ 255, selectableCount 1, values 2–10 únicos ≤ 100).
 * Cada opção ganha o número (1️⃣, 2️⃣…), o que também a torna única e permite responder digitando.
 * Texto que não cabe no título da enquete vai antes, numa mensagem de texto; a enquete leva só `question`.
 * `payload.options` (id ↔ texto) é o que o webhook usa para transformar o voto em seleção.
 */
export function renderPoll(menu: Menu, question = "👇 Toque na opção desejada:"): OutMessage[] {
  if (menu.rows.length < 2 || menu.rows.length > KEYCAP.length) throw new Error("invalid_poll_size");
  const values = menu.rows.map((r, i) => clip(`${KEYCAP[i]} ${r.title}${r.description ? ` · ${r.description}` : ""}`, POLL_VALUE));
  const full = [menu.body, menu.footer].filter(Boolean).join("\n\n").trim();
  const fits = chars(full) <= POLL_NAME;
  const name = fits ? full : cut(question, POLL_NAME);
  const poll: OutMessage = {
    type: "interactive",
    // Fallback (Evolution recusou a enquete): mesmo card em texto numerado. Com o texto já enviado antes, só a pergunta.
    text: numberedText(fits ? menu : { ...menu, body: question }),
    payload: { op: "poll", body: { name, selectableCount: 1, values }, options: menu.rows.map((r, i) => ({ id: r.id, title: values[i] })) },
  };
  return fits ? [poll] : [{ type: "text", text: menu.body }, poll];
}
