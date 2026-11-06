// Núcleo puro do gateway de IA (sem Deno, sem rede): testado em tests/rebrand/ai.test.cjs.

export const FEATURES = ["chatbot", "texto", "legenda", "insights", "teste", "simulacao"] as const;
export type Feature = typeof FEATURES[number];

/** Endpoints OpenAI-compatíveis. grok/perplexity só existem para salões legados (config antiga do chatbot). */
export const OPENAI_COMPAT: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  grok: "https://api.x.ai/v1/chat/completions",
  perplexity: "https://api.perplexity.ai/chat/completions",
};
export const CENTRAL_PROVIDERS = ["gemini", "openai", "groq", "openrouter"];
/** Provedores com tool calling comprovado no chatbot. */
export const supportsTools = (provider: string) => ["openai", "groq", "grok"].includes(provider);

export interface QAExample { q: string; a: string }
export interface PlatformConfig {
  enabled: boolean;
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
  base_prompt: string;
  tone: string;
  rules: string;
  knowledge: string;
  examples: QAExample[];
  monthly_budget_usd: number | null;
  usd_brl: number;
  default_salon_monthly_requests: number | null;
  default_salon_monthly_tokens: number | null;
  on_limit: "fallback" | "handoff";
  fallback_message: string;
  price_in_per_mtok: number | null;
  price_out_per_mtok: number | null;
}
/** Usado quando a config central ainda não existe (modo legado): sem limites, só registro de uso. */
export const DEFAULT_CONFIG: PlatformConfig = {
  enabled: true, provider: "gemini", model: "gemini-2.5-flash", temperature: 0.5, max_tokens: 500,
  base_prompt: "", tone: "", rules: "", knowledge: "", examples: [],
  monthly_budget_usd: null, usd_brl: 5.5, default_salon_monthly_requests: null, default_salon_monthly_tokens: null,
  on_limit: "fallback", fallback_message: "Vou pedir para a equipe do salão responder você em instantes.",
  price_in_per_mtok: null, price_out_per_mtok: null,
};

// ponytail: tabela estática de preço (US$/1M tokens, out/2026, estimativa). Modelo novo: preencher preço manual na config.
const PRICES: [string, number, number][] = [
  ["gpt-4o-mini", 0.15, 0.6], ["gpt-4o", 2.5, 10], ["gpt-4.1-nano", 0.1, 0.4], ["gpt-4.1-mini", 0.4, 1.6], ["gpt-4.1", 2, 8],
  ["gpt-5-nano", 0.05, 0.4], ["gpt-5-mini", 0.25, 2],
  ["gemini-2.0-flash-lite", 0.075, 0.3], ["gemini-2.0-flash", 0.1, 0.4], ["gemini-2.5-flash-lite", 0.1, 0.4], ["gemini-2.5-flash", 0.3, 2.5], ["gemini-2.5-pro", 1.25, 10],
  ["llama-3.1-8b", 0.05, 0.08], ["llama-3.3-70b", 0.59, 0.79],
];
/** Modelo desconhecido sem preço manual: estimativa conservadora para o orçamento não ficar furado. */
export const UNKNOWN_PRICE: [number, number] = [1, 4];

export function priceFor(model: string, cfg?: Pick<PlatformConfig, "price_in_per_mtok" | "price_out_per_mtok"> | null): [number, number] {
  if (cfg?.price_in_per_mtok != null && cfg?.price_out_per_mtok != null) return [Number(cfg.price_in_per_mtok), Number(cfg.price_out_per_mtok)];
  const name = model.toLowerCase().split("/").pop() ?? "";
  let best: [string, number, number] | undefined;
  for (const p of PRICES) if (name.startsWith(p[0]) && (!best || p[0].length > best[0].length)) best = p;
  return best ? [best[1], best[2]] : UNKNOWN_PRICE;
}
export function estimateCost(model: string, tokensIn: number, tokensOut: number, cfg?: Parameters<typeof priceFor>[1]): number {
  const [pin, pout] = priceFor(model, cfg);
  const cost = (Math.max(0, tokensIn) * pin + Math.max(0, tokensOut) * pout) / 1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}
/** Sem `usage` do provedor: ~4 caracteres por token. */
export const roughTokens = (text: string) => Math.ceil((text ?? "").length / 4);

export interface QuotaState {
  salon_requests: number; salon_tokens: number; month_cost_usd: number;
  limit_requests: number | null; limit_tokens: number | null; blocked: boolean;
}
export type QuotaResult = { ok: true } | { ok: false; reason: "disabled" | "budget" | "salon_blocked" | "salon_requests" | "salon_tokens" };
/** Exceção do salão (limit_*) vence o padrão da plataforma; null = sem limite. */
export function checkQuota(state: QuotaState | null, cfg: PlatformConfig, hasSalon: boolean): QuotaResult {
  if (!cfg.enabled) return { ok: false, reason: "disabled" };
  const s = state ?? { salon_requests: 0, salon_tokens: 0, month_cost_usd: 0, limit_requests: null, limit_tokens: null, blocked: false };
  if (cfg.monthly_budget_usd != null && Number(s.month_cost_usd) >= Number(cfg.monthly_budget_usd)) return { ok: false, reason: "budget" };
  if (!hasSalon) return { ok: true };
  if (s.blocked) return { ok: false, reason: "salon_blocked" };
  const maxReq = s.limit_requests ?? cfg.default_salon_monthly_requests;
  if (maxReq != null && Number(s.salon_requests) >= Number(maxReq)) return { ok: false, reason: "salon_requests" };
  const maxTok = s.limit_tokens ?? cfg.default_salon_monthly_tokens;
  if (maxTok != null && Number(s.salon_tokens) >= Number(maxTok)) return { ok: false, reason: "salon_tokens" };
  return { ok: true };
}

export function maskKey(key: string | null | undefined): string {
  const k = (key ?? "").trim();
  return k.length >= 8 ? `••••${k.slice(-4)}` : k ? "••••" : "";
}

export type AIErrorCode = "invalid_key" | "provider_quota" | "rate_limited" | "invalid_model" | "bad_request" | "timeout" | "unavailable";
export const AI_ERROR_TEXT: Record<string, string> = {
  invalid_key: "A chave foi recusada pelo provedor. Confira se foi copiada inteira e se pertence ao provedor escolhido.",
  provider_quota: "A conta do provedor está sem crédito ou cota. Verifique o faturamento no painel do provedor.",
  rate_limited: "O provedor limitou a quantidade de chamadas. Aguarde alguns segundos e tente de novo.",
  invalid_model: "O provedor não reconheceu este modelo. Confira o nome exato do modelo.",
  bad_request: "O provedor recusou a requisição. Confira modelo e parâmetros.",
  timeout: "O provedor demorou demais para responder.",
  unavailable: "O provedor de IA está indisponível no momento.",
  quota_exceeded: "O limite de uso de IA foi atingido.",
  ai_disabled: "A IA está desativada pela plataforma.",
  not_configured: "A IA ainda não foi configurada pela plataforma.",
};
/** Normaliza falhas de OpenAI/Groq/OpenRouter/Gemini sem expor corpo bruto (pode ecoar a chave). */
export function normalizeProviderError(status: number | null, body: unknown, aborted = false): { code: AIErrorCode; retryable: boolean } {
  if (aborted) return { code: "timeout", retryable: true };
  if (status == null) return { code: "unavailable", retryable: true };
  const text = (typeof body === "string" ? body : JSON.stringify(body ?? "")).toLowerCase();
  if (status === 401 || status === 403 || /api key not valid|invalid api key|incorrect api key|invalid_api_key|api_key_invalid/.test(text)) return { code: "invalid_key", retryable: false };
  if (status === 402 || /insufficient_quota|billing|credit|exceeded your current quota/.test(text)) return { code: "provider_quota", retryable: false };
  if (status === 429) return { code: "rate_limited", retryable: true };
  if (status === 404 || /model.*(not found|does not exist|decommissioned|not supported)|model_not_found/.test(text)) return { code: "invalid_model", retryable: false };
  if (status >= 400 && status < 500) return { code: "bad_request", retryable: false };
  return { code: "unavailable", retryable: true };
}

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
/**
 * Prompt final = treinamento da plataforma (super admin) + instruções do salão.
 * Chatbot/simulação recebem tudo; demais recursos (texto/legenda) só tom e regras globais.
 */
export function composeSystemPrompt(cfg: PlatformConfig, salonPrompt: string, feature: Feature): string {
  const full = feature === "chatbot" || feature === "simulacao" || feature === "teste";
  const parts: string[] = [];
  if (full && clip(cfg.base_prompt, 4000)) parts.push(clip(cfg.base_prompt, 4000));
  if (clip(cfg.tone, 500)) parts.push(`Tom de voz: ${clip(cfg.tone, 500)}`);
  if (clip(cfg.rules, 4000)) parts.push(`Regras obrigatórias da plataforma:\n${clip(cfg.rules, 4000)}`);
  if (full && clip(cfg.knowledge, 8000)) parts.push(`Base de conhecimento da plataforma:\n${clip(cfg.knowledge, 8000)}`);
  const ex = full ? (cfg.examples ?? []).filter(e => clip(e?.q, 500) && clip(e?.a, 1000)).slice(0, 20) : [];
  if (ex.length) parts.push(`Exemplos de perguntas e respostas (siga o estilo, não copie dados):\n${ex.map(e => `P: ${clip(e.q, 500)}\nR: ${clip(e.a, 1000)}`).join("\n\n")}`);
  const platform = parts.length ? `[Plataforma]\n${parts.join("\n\n")}` : "";
  const salon = clip(salonPrompt, 20000);
  return [platform, salon && (platform ? `[Estabelecimento]\n${salon}` : salon)].filter(Boolean).join("\n\n");
}

const optNum = (v: unknown, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error("invalid_number");
  return n;
};
const reqNum = (v: unknown, min: number, max: number) => {
  const n = optNum(v, min, max);
  if (n === null) throw new Error("invalid_number");
  return n;
};
const text = (v: unknown, max: number) => {
  if (v == null) return "";
  if (typeof v !== "string" || v.length > max) throw new Error("invalid_text");
  return v.trim();
};
/** Valida a config vinda do painel (trust boundary). Lança Error em campo inválido. */
export function sanitizeConfig(input: Record<string, unknown>): PlatformConfig {
  if (!CENTRAL_PROVIDERS.includes(String(input.provider))) throw new Error("invalid_provider");
  const model = text(input.model, 120);
  if (!/^[A-Za-z0-9._:/-]{1,120}$/.test(model)) throw new Error("invalid_model");
  const examples = Array.isArray(input.examples) ? input.examples : [];
  if (examples.length > 20) throw new Error("too_many_examples");
  const fallback = text(input.fallback_message, 500);
  return {
    enabled: input.enabled !== false,
    provider: String(input.provider), model,
    temperature: reqNum(input.temperature ?? 0.5, 0, 1),
    max_tokens: Math.round(reqNum(input.max_tokens ?? 500, 50, 4000)),
    base_prompt: text(input.base_prompt, 4000), tone: text(input.tone, 500), rules: text(input.rules, 4000), knowledge: text(input.knowledge, 8000),
    examples: examples.map(e => ({ q: text((e as QAExample)?.q, 500), a: text((e as QAExample)?.a, 1000) })).filter(e => e.q && e.a),
    monthly_budget_usd: optNum(input.monthly_budget_usd, 0, 1_000_000),
    usd_brl: reqNum(input.usd_brl ?? 5.5, 0.01, 100),
    default_salon_monthly_requests: optNum(input.default_salon_monthly_requests, 0, 10_000_000),
    default_salon_monthly_tokens: optNum(input.default_salon_monthly_tokens, 0, 10_000_000_000),
    on_limit: input.on_limit === "handoff" ? "handoff" : "fallback",
    fallback_message: fallback || DEFAULT_CONFIG.fallback_message,
    price_in_per_mtok: optNum(input.price_in_per_mtok, 0, 1000),
    price_out_per_mtok: optNum(input.price_out_per_mtok, 0, 1000),
  };
}

// Adapters: só montam/leem JSON; o fetch fica em gateway.ts.
export interface AIMessage { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: unknown[]; tool_call_id?: string; image?: { mime: string; data: string } }
export interface ChatOptions { temperature: number; maxTokens: number; tools?: unknown[] }
export function buildRequest(provider: string, model: string, key: string, messages: AIMessage[], opt: ChatOptions): { url: string; headers: Record<string, string>; body: unknown } {
  if (provider === "gemini") {
    const system = messages.filter(m => m.role === "system").map(m => m.content).join("\n\n");
    const contents = messages.filter(m => m.role === "user" || m.role === "assistant").map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content ?? "" }, ...(m.image ? [{ inline_data: { mime_type: m.image.mime, data: m.image.data } }] : [])],
    }));
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: { ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents, generationConfig: { temperature: opt.temperature, maxOutputTokens: opt.maxTokens } },
    };
  }
  const url = OPENAI_COMPAT[provider];
  if (!url) throw new Error("unknown_provider");
  const msgs = messages.map(({ image, ...m }) => image
    ? { ...m, content: [{ type: "text", text: m.content ?? "" }, { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.data}` } }] }
    : m);
  return {
    url,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(provider === "openrouter" ? { "HTTP-Referer": "https://agendafacil365.com.br", "X-Title": "Agenda Facil 365" } : {}) },
    body: { model, messages: msgs, temperature: opt.temperature, max_tokens: opt.maxTokens, ...(opt.tools?.length ? { tools: opt.tools, tool_choice: "auto" } : {}) },
  };
}
export interface ChatResult { text: string; toolCalls: { id: string; type: string; function: { name: string; arguments: string } }[]; message: AIMessage | null; tokensIn: number; tokensOut: number }
// deno-lint-ignore no-explicit-any
export function parseResponse(provider: string, json: any, promptChars = 0): ChatResult {
  if (provider === "gemini") {
    const text = (json?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    const u = json?.usageMetadata;
    return { text, toolCalls: [], message: { role: "assistant", content: text }, tokensIn: u?.promptTokenCount ?? Math.ceil(promptChars / 4), tokensOut: u?.candidatesTokenCount ?? roughTokens(text) };
  }
  const msg = json?.choices?.[0]?.message ?? null;
  const text = String(msg?.content ?? "");
  return {
    text, toolCalls: Array.isArray(msg?.tool_calls) ? msg.tool_calls : [], message: msg,
    tokensIn: json?.usage?.prompt_tokens ?? Math.ceil(promptChars / 4), tokensOut: json?.usage?.completion_tokens ?? roughTokens(text),
  };
}
