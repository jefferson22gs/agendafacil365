// Disparo inteligente para a Evolution API 2.3.7: botões (/message/sendButtons), listas (/message/sendList),
// equivalentes numéricos no corpo e fallback automático em texto numerado quando a API recusa o interativo.
// Puro quanto ao banco: quem persiste é o outbox; aqui só se monta o payload e se envia.
import { EvolutionClient, privateNumber, sendTyping } from "./evolution.ts";
import { WhatsAppError, objectValue } from "./errors.ts";
import { evolutionBody, numberedText, type Menu } from "./interactive.ts";
import type { GuidedRenderMode } from "./chatbot-domain.ts";
import type { OutMessage } from "./attendant.ts";

/** "Digitando…" antes de cada resposta do fluxo guiado (experiência Typebot). */
export const TYPING_MS = 800;

/**
 * Menu → mensagem do outbox conforme o modo do salão:
 *  - numbered: só texto numerado (100% compatível iOS/Android);
 *  - native: botões/listas sem números no corpo;
 *  - hybrid (padrão): botões/listas com `[1] Opção` no corpo.
 * O `text` é sempre o fallback numerado: o outbox o envia quando a Evolution recusa o interativo.
 */
export function renderMenu(menu: Menu, mode: GuidedRenderMode): OutMessage {
  const text = numberedText(menu);
  if (mode === "numbered") return { type: "text", text };
  const { op, body } = evolutionBody(menu, "", mode === "hybrid");
  delete (body as Record<string, unknown>).number;
  return { type: "interactive", text, payload: { op, body } };
}

/**
 * Envia o interativo; se a Evolution responder com erro HTTP (4xx ou 5xx), manda o card em texto numerado para o
 * cliente nunca ficar sem resposta. Só timeout/queda de rede (a Evolution não respondeu) sobe como incerto.
 */
export async function sendWithFallback(api: EvolutionClient, instance: string, number: string, payload: Record<string, unknown> | null, text: string): Promise<{ response: unknown; fallback: boolean }> {
  const op = payload?.op === "poll" ? "poll" : payload?.op === "buttons" ? "buttons" : payload?.op === "list" ? "list" : null;
  if (op && payload?.body && typeof payload.body === "object") {
    try { return { response: await api.request(op, instance, { ...(payload.body as Record<string, unknown>), number }), fallback: false }; }
    catch (e) {
      const httpError = e instanceof WhatsAppError && (e.code === "provider_rejected" || (e.code === "send_uncertain" && Number((e as { http?: number }).http) >= 500));
      if (!httpError) throw e;
    }
  }
  return { response: await api.request("text", instance, { number, text }), fallback: true };
}

/** Id da mensagem devolvido pela Evolution (key.id), ou null. */
export function providerMessageId(response: unknown): string | null {
  const r = objectValue(response), k = r.key && typeof r.key === "object" ? objectValue(r.key) : null;
  return typeof k?.id === "string" && k.id ? k.id : null;
}

/** Pulso "composing" de TYPING_MS antes da mensagem. Best effort: a presença nunca é aguardada nem bloqueia. */
export async function typingPulse(api: EvolutionClient, instance: string, phone: string, ms = TYPING_MS): Promise<void> {
  if (!privateNumber(phone.replace(/^\+/, ""))) return;
  void sendTyping(api, instance, phone, ms);
  await new Promise(r => setTimeout(r, ms));
}
