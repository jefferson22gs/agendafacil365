// Whaileys API própria (https://copilot.tubaraoemprestimo.com.br): WhatsApp com botões e listas, instância do AgendaFácil.
// Uma instância por sistema (WHAILEYS_INSTANCE); o token só opera essa instância. Secrets só no Supabase:
// WHAILEYS_API_URL, WHAILEYS_INSTANCE, WHAILEYS_TOKEN, WHAILEYS_WEBHOOK_SECRET.
// Limites do motor: envia texto, botões (até 3) e listas; recebe texto, cliques, áudio, imagem e PDF.
// Não envia mídia nem publica Status: isso continua na Evolution.
import { WhatsAppError } from "./errors.ts";

export interface WhaileysStatus { state: "open" | "connecting" | "closed" | "disconnected"; qr: string | null; pairingCode: string | null; me: { id: string | null; lid: string | null } | null }
export interface WhaileysCard { text: string; footer?: string; title?: string; buttons?: { id: string; title: string }[]; buttonText?: string; sections?: { title: string; rows: { id: string; title: string; description?: string }[] }[] }

// deno-lint-ignore no-explicit-any
const env = (k: string): string => String((globalThis as any).Deno?.env?.get?.(k) ?? "");
export const whaileysInstance = () => env("WHAILEYS_INSTANCE");
/** Configurado = URL, instância, token e segredo do webhook cadastrados no Supabase. */
export const whaileysConfigured = () => !!(env("WHAILEYS_API_URL") && whaileysInstance() && env("WHAILEYS_TOKEN") && env("WHAILEYS_WEBHOOK_SECRET"));

export class WhaileysClient {
  private base: string;
  constructor(private token: string, base: string, private instance: string, private transport: typeof fetch = fetch) {
    const u = new URL(base);
    if (u.protocol !== "https:" || u.username || u.password) throw new WhatsAppError("configuration_missing", 503);
    if (!/^[a-z0-9][a-z0-9_-]{2,62}$/.test(instance)) throw new WhatsAppError("configuration_missing", 503);
    this.base = u.origin + u.pathname.replace(/\/+$/, "");
  }
  private async call<T>(path: string, init: RequestInit = {}, sending = false): Promise<T> {
    let res: Response;
    try {
      res = await this.transport(`${this.base}/sessions/${this.instance}${path}`, {
        ...init, redirect: "error", signal: AbortSignal.timeout(20_000),
        headers: { "x-api-key": this.token, "content-type": "application/json" },
      });
    } catch { throw new WhatsAppError(sending ? "send_uncertain" : "provider_unavailable", 503); }
    const json = await res.json().catch(() => ({})) as T & { error?: string };
    if (res.ok) return json;
    if (res.status === 409) throw new WhatsAppError("disconnected", 409);
    if (res.status === 429) throw new WhatsAppError("provider_rate_limited", 429);
    if (sending && res.status >= 500) throw Object.assign(new WhatsAppError("send_uncertain", 503), { http: res.status });
    throw new WhatsAppError(res.status >= 500 ? "provider_unavailable" : "provider_rejected", res.status >= 500 ? 503 : 502);
  }
  status() { return this.call<WhaileysStatus>(""); }
  connect(phone?: string) { return this.call<WhaileysStatus>("/connect", { method: "POST", body: JSON.stringify(phone ? { phone } : {}) }); }
  logout() { return this.call<{ ok: boolean }>("", { method: "DELETE" }); }
  /** Telefones conhecidos: o motor usa para descobrir o número real de contatos que chegam só com LID. */
  knownPhones(phones: string[]) { return this.call<{ ok: boolean }>("/known-phones", { method: "POST", body: JSON.stringify({ phones }) }); }
  /** `to`: número E.164 sem "+" ou JID (@s.whatsapp.net / @lid). */
  async send(to: string, card: WhaileysCard): Promise<string> {
    const r = await this.call<{ messageId?: string }>("/send", { method: "POST", body: JSON.stringify({ to, ...card }) }, true);
    if (typeof r.messageId !== "string" || !r.messageId) throw new WhatsAppError("send_uncertain", 502);
    return r.messageId;
  }
}
export function whaileysClient(): WhaileysClient {
  if (!whaileysConfigured()) throw new WhatsAppError("configuration_missing", 503);
  return new WhaileysClient(env("WHAILEYS_TOKEN"), env("WHAILEYS_API_URL"), whaileysInstance());
}

/** Estado do motor → status gravado em whatsapp_instances. */
export const whaileysStatusOf = (s: WhaileysStatus | null) =>
  s?.state === "open" ? "connected" : s?.state === "connecting" ? (s.qr ? "qrcode" : "connecting") : "disconnected";
/** "5511…:12@s.whatsapp.net" → "5511…". */
export const whaileysPhone = (s: WhaileysStatus | null) => String(s?.me?.id ?? "").split("@")[0].split(":")[0].replace(/\D/g, "") || null;

/**
 * Menu do robô (payload no formato da Evolution: op "buttons" | "list" | "poll") → cartão do motor.
 * O texto numerado vai sempre junto: se o aparelho não mostrar os botões, o cliente responde o número.
 */
export function whaileysCard(payload: Record<string, unknown> | null, numberedText: string): WhaileysCard {
  const body = payload?.body && typeof payload.body === "object" ? payload.body as Record<string, unknown> : null;
  const text = numberedText.slice(0, 4000);
  if (!body) return { text };
  const footer = typeof body.footer === "string" && body.footer ? body.footer.slice(0, 60) : typeof body.footerText === "string" && body.footerText ? body.footerText.slice(0, 60) : undefined;
  if (payload?.op === "buttons" && Array.isArray(body.buttons)) {
    const buttons = (body.buttons as Record<string, unknown>[]).slice(0, 3).map(b => ({ id: String(b.id ?? ""), title: String(b.displayText ?? b.title ?? "").slice(0, 20) })).filter(b => b.id && b.title);
    return buttons.length ? { text, footer, buttons } : { text };
  }
  if (payload?.op === "list" && Array.isArray(body.sections)) {
    const sections = (body.sections as Record<string, unknown>[]).slice(0, 10).map(s => ({
      title: String(s.title ?? "").slice(0, 24),
      rows: (Array.isArray(s.rows) ? s.rows as Record<string, unknown>[] : []).slice(0, 10).map(r => ({ id: String(r.rowId ?? r.id ?? ""), title: String(r.title ?? "").slice(0, 24), ...(r.description ? { description: String(r.description).slice(0, 72) } : {}) })).filter(r => r.id && r.title),
    })).filter(s => s.rows.length);
    return sections.length ? { text, footer, title: typeof body.title === "string" ? body.title.slice(0, 60) : undefined, buttonText: String(body.buttonText ?? "Ver opções").slice(0, 20), sections } : { text };
  }
  // Enquete não existe no motor: vai o texto numerado.
  return { text };
}

/** Assinatura do webhook: HMAC-SHA256 hex de `${timestamp}.${corpo}`, janela de 5 minutos, comparação em tempo constante. */
export async function verifyWhaileysSignature(raw: string, timestamp: string | null, signature: string | null, secret: string, now = Date.now()): Promise<boolean> {
  if (!secret || !timestamp || !signature || !/^\d{13}$/.test(timestamp) || !/^[0-9a-f]{64}$/.test(signature)) return false;
  if (Math.abs(now - Number(timestamp)) > 300_000) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${raw}`)));
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= mac[i] ^ parseInt(signature.slice(i * 2, i * 2 + 2), 16);
  return diff === 0;
}
