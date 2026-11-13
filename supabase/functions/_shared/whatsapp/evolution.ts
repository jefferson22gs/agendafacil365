import { requiredEnv } from "./auth.ts";
import { WhatsAppError } from "./errors.ts";

// Rotas verificadas no código oficial Evolution 2.3.7. Nenhum path arbitrário do frontend.
const operations = {
  create: ["POST", "/instance/create"],
  connect: ["GET", "/instance/connect/"],
  state: ["GET", "/instance/connectionState/"],
  fetch: ["GET", "/instance/fetchInstances?instanceName="],
  disconnect: ["DELETE", "/instance/logout/"],
  delete: ["DELETE", "/instance/delete/"],
  webhook: ["POST", "/webhook/set/"],
  contacts: ["POST", "/chat/findContacts/"],
  chats: ["POST", "/chat/findChats/"],
  messages: ["POST", "/chat/findMessages/"],
  text: ["POST", "/message/sendText/"],
  media: ["POST", "/message/sendMedia/"],
  status: ["POST", "/message/sendStatus/"],
  // Atendente: lista/botões (SendListDto/SendButtonsDto) e download de mídia recebida (getBase64FromMediaMessageDto), Evolution 2.3.7.
  list: ["POST", "/message/sendList/"],
  buttons: ["POST", "/message/sendButtons/"],
  poll: ["POST", "/message/sendPoll/"],
  settingsFind: ["GET", "/settings/find/"],
  settingsSet: ["POST", "/settings/set/"],
  mediaBase64: ["POST", "/chat/getBase64FromMediaMessage/"],
  // "Digitando…": SendPresenceDto { number, presence: "composing", delay } (presenceSchema exige os três).
  // A Evolution segura a requisição por `delay` ms e depois manda "paused"; nunca aguardar no caminho crítico.
  presence: ["POST", "/chat/sendPresence/"],
} as const;
export type EvolutionOperation = keyof typeof operations;
export type HttpTransport = typeof fetch;
export class EvolutionClient {
  private base: string;
  constructor(private key: string, base: string, private transport: HttpTransport = fetch) {
    const url = new URL(base);
    // URL somente de configuração servidor. Sem credenciais na URL ou destino de rede local.
    const host = url.hostname;
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[|0\.)/.test(host) || host.endsWith(".local")) throw new WhatsAppError("configuration_missing", 503);
    this.base = url.origin + url.pathname.replace(/\/$/, "");
  }
  async request(op: EvolutionOperation, instance: string, body?: Record<string, unknown>): Promise<unknown> {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(instance)) throw new WhatsAppError("invalid_request");
    const [method, prefix] = operations[op];
    const sending = op === "text" || op === "media" || op === "status" || op === "list" || op === "buttons" || op === "poll";
    let response: Response;
    try {
      response = await this.transport(this.base + prefix + (op === "create" ? "" : encodeURIComponent(instance)), {
        // Status: a Evolution publica em lotes de 10 contatos e só responde no fim (~40 s para poucos clientes).
        method, redirect: "error", signal: AbortSignal.timeout(op === "status" ? 120_000 : 20_000),
        headers: { apikey: this.key, "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      });
    } catch { throw new WhatsAppError(sending ? "send_uncertain" : "provider_unavailable", 503); }
    if (!response.ok) {
      // Erro de servidor após receber a requisição também pode ter ocorrido depois do envio.
      // `http` distingue resposta 5xx (a Evolution respondeu) de timeout/rede (não respondeu).
      if (sending && response.status >= 500) throw Object.assign(new WhatsAppError("send_uncertain", 503), { http: response.status });
      if (response.status === 429) throw new WhatsAppError("provider_rate_limited", 429);
      throw new WhatsAppError("provider_rejected", response.status === 404 ? 404 : 502);
    }
    try { return await response.json(); }
    catch { throw new WhatsAppError(sending ? "send_uncertain" : "provider_unavailable", 502); }
  }
}
/** Cliente da Evolution (QR Code). A conexão com botões usa a Whaileys API (whaileys.ts), com outro contrato. */
export function evolutionClient(provider: string = "evolution") {
  if (provider !== "evolution") throw new WhatsAppError("configuration_missing", 503);
  return new EvolutionClient(requiredEnv("EVOLUTION_API_KEY"), requiredEnv("EVOLUTION_API_URL"));
}
/** Número aceito para envio individual: só dígitos, 8–15 (nunca JID de grupo/canal). */
export const privateNumber = (n: unknown): n is string => typeof n === "string" && /^[1-9]\d{7,14}$/.test(n);
/**
 * "Digitando…" enquanto o atendente prepara a resposta. Best effort: qualquer falha é ignorada e
 * nunca atrasa nem bloqueia a resposta (a promessa nunca rejeita).
 */
export function sendTyping(api: EvolutionClient, instance: string, phone: string, delayMs = 8_000): Promise<void> {
  const number = phone.replace(/^\+/, "");
  if (!privateNumber(number)) return Promise.resolve();
  return api.request("presence", instance, { number, presence: "composing", delay: delayMs }).then(() => undefined, () => undefined);
}
