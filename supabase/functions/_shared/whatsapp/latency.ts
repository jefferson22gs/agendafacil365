// Núcleo puro da latência do atendente (sem Deno/rede/banco). Testado em tests/rebrand/latency.test.cjs.
// Espelha as regras SQL de 20261109000100_whatsapp_reply_latency.sql (gate, prioridade, coalescência do kick).

/** Espaço mínimo entre envios na mesma instância: conversa 1 s; campanhas e demais 3 s (inalterado). */
export const CHATBOT_GAP_MS = 1_000, DEFAULT_GAP_MS = 3_000;

/**
 * Gate por instância (igual a whatsapp_claim_outbox_v2). `nextAvailableAt` = último claim + 3 s, ou pausa
 * (desconectado/limite: +5 min). Conversa só precisa de 1 s desde o último claim, mas nunca fura pausa.
 */
export function gateOpen(category: string, nextAvailableAt: number, lastClaimAt: number | null, now: number): boolean {
  if (nextAvailableAt <= now) return true;
  if (category !== "chatbot" || lastClaimAt == null) return false;
  return lastClaimAt <= now - CHATBOT_GAP_MS && nextAvailableAt <= lastClaimAt + DEFAULT_GAP_MS;
}

export interface QueueItem { id: string; category: string; scheduledFor: number; createdAt: number }
/** Ordem do claim: conversa primeiro; dentro de cada grupo, scheduled_for e created_at. */
export function claimOrder(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => Number(b.category === "chatbot") - Number(a.category === "chatbot") || a.scheduledFor - b.scheduledFor || a.createdAt - b.createdAt);
}

export interface EventRow { id: string; salonId: string; phone: string; status: string; attempts: number; nextAttemptAt: number; createdAt: number; leaseUntil?: number | null }
/**
 * Coalescência do kick (igual ao trigger whatsapp_kick_inbound): não aciona outro worker se a mesma conversa já
 * tem evento recém-chegado ainda não pego (esse kick já está a caminho e drena a conversa em ordem).
 */
export function shouldKick(ev: EventRow, others: EventRow[], now: number): boolean {
  return !others.some(b => b.id !== ev.id && b.salonId === ev.salonId && b.phone === ev.phone
    && b.status === "pending" && b.attempts === 0 && b.nextAttemptAt <= now && b.createdAt > now - 30_000);
}
/** Claim inbound por conversa (igual a whatsapp_claim_inbound): o mais antigo elegível cuja conversa está livre. */
export function claimInbound(events: EventRow[], now: number): EventRow | null {
  const due = (e: EventRow) => e.status === "pending" && e.nextAttemptAt <= now && e.attempts < 3;
  const blocked = (e: EventRow) => events.some(b => b.id !== e.id && b.salonId === e.salonId && b.phone === e.phone
    && ((b.status === "processing" && (b.leaseUntil ?? 0) > now) || (due(b) && (b.createdAt < e.createdAt || (b.createdAt === e.createdAt && b.id < e.id)))));
  return [...events].filter(due).sort((a, b) => a.createdAt - b.createdAt).find(e => !blocked(e)) ?? null;
}

/** Itens que whatsapp_finish_inbound(_v2) grava no outbox (texto vazio é pulado; imagem sempre vai). */
export function expectedSends(reply: { text: string; messages?: { type: string; text: string }[] }): number {
  if (reply.messages?.length) return reply.messages.filter(m => m.type === "image" || m.text.length > 0).length;
  return reply.text.length > 0 ? 1 : 0;
}
/** Tempo máximo esperando o gate para enviar a resposta na mesma invocação; depois disso o cron assume. */
export function drainBudgetMs(expected: number): number {
  return Math.min(12_000, 2_500 + expected * (CHATBOT_GAP_MS + 500));
}

/** Quantos dias consultar em paralelo sem passar de ~`maxConcurrent` RPCs simultâneas. */
export function dayChunk(professionals: number, maxConcurrent = 24): number {
  return Math.max(1, Math.floor(maxConcurrent / Math.max(1, professionals)));
}
/**
 * Primeiros `want` itens (em ordem) que passam em `test`, avaliando `chunk` por vez em paralelo.
 * Mesmo resultado do laço sequencial com break; só muda o tempo.
 */
export async function firstMatches<T>(items: T[], test: (item: T) => Promise<boolean>, want: number, chunk: number): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < items.length && out.length < want; i += chunk) {
    const slice = items.slice(i, i + chunk);
    const ok = await Promise.all(slice.map(test));
    for (let j = 0; j < slice.length && out.length < want; j++) if (ok[j]) out.push(slice[j]);
  }
  return out;
}

export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
