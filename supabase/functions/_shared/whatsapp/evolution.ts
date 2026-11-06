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
    const sending = op === "text" || op === "media" || op === "status";
    let response: Response;
    try {
      response = await this.transport(this.base + prefix + (op === "create" ? "" : encodeURIComponent(instance)), {
        method, redirect: "error", signal: AbortSignal.timeout(20_000),
        headers: { apikey: this.key, "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      });
    } catch { throw new WhatsAppError(sending ? "send_uncertain" : "provider_unavailable", 503); }
    if (!response.ok) {
      // Erro de servidor após receber a requisição também pode ter ocorrido depois do envio.
      if (sending && response.status >= 500) throw new WhatsAppError("send_uncertain", 503);
      if (response.status === 429) throw new WhatsAppError("provider_rate_limited", 429);
      throw new WhatsAppError("provider_rejected", response.status === 404 ? 404 : 502);
    }
    try { return await response.json(); }
    catch { throw new WhatsAppError(sending ? "send_uncertain" : "provider_unavailable", 502); }
  }
}
export function evolutionClient() {
  return new EvolutionClient(requiredEnv("EVOLUTION_API_KEY"), requiredEnv("EVOLUTION_API_URL"));
}
