// Modo "100% botões" do fluxo guiado (Evolution API 2.3.7 /message/sendButtons): nunca lista, no máximo 3 botões
// por mensagem. Opções além disso viram páginas com "➡️ Ver mais"; a última página volta ao início.
import { clip, numberedText, type Menu } from "./interactive.ts";
import type { OutMessage } from "./attendant.ts";

/** Limites do WhatsApp para botões de resposta rápida. */
export const MAX_BUTTONS = 3, BUTTON_TEXT = 20;

/**
 * Página de botões: até 3 opções cabem inteiras; acima disso, 2 opções por página + 3º botão de navegação
 * ("➡️ Ver mais"; na última, "🔁 Do início"). `page` fora do intervalo dá a volta (módulo).
 */
export function buttonPage(total: number, page: number): { start: number; end: number; more: boolean; wrap: boolean; page: number; pages: number } {
  if (total <= 0) return { start: 0, end: 0, more: false, wrap: false, page: 0, pages: 0 };
  if (total <= MAX_BUTTONS) return { start: 0, end: total, more: false, wrap: false, page: 0, pages: 1 };
  const per = MAX_BUTTONS - 1, pages = Math.ceil(total / per);
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
