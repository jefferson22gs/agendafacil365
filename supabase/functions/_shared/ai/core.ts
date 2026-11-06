// Núcleo puro do gateway de IA (sem Deno, sem rede): testado em tests/rebrand/ai.test.cjs.
// Fontes oficiais (consultadas em 06/11/2026): ai.google.dev/gemini-api/docs/models, /pricing, /function-calling,
// /thinking e a referência REST de generateContent/models.list (aistudio.google.com/llms-full.txt).

export const FEATURES = ["chatbot", "texto", "legenda", "insights", "teste", "simulacao"] as const;
export type Feature = typeof FEATURES[number];

/** Endpoints OpenAI-compatíveis: só para salões no modo legado (chave antiga do chatbot). A plataforma usa só Gemini. */
export const OPENAI_COMPAT: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  grok: "https://api.x.ai/v1/chat/completions",
  perplexity: "https://api.perplexity.ai/chat/completions",
};
export const CENTRAL_PROVIDERS = ["gemini"];
/** Provedores com tool calling no chatbot (Gemini: functionDeclarations/functionCall/functionResponse). */
export const supportsTools = (provider: string) => ["gemini", "openai", "groq", "grok"].includes(provider);

/** Último recurso quando a listagem de modelos falha e não há modelo resolvido. Stable na doc oficial (gemini-2.5-flash está descontinuado). */
export const FALLBACK_MODEL = "gemini-3.6-flash";
export const MODEL_CACHE_MS = 24 * 3600_000;
export type ModelFamily = "flash" | "pro";
export type ThinkingLevel = "LOW" | "MEDIUM" | "HIGH";

export interface QAExample { q: string; a: string }
export interface PlatformConfig {
  enabled: boolean;
  provider: string;
  model_mode: "auto" | "fixed";
  model_family: ModelFamily;
  model: string;
  thinking_level: ThinkingLevel;
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
  price_cache_per_mtok: number | null;
  resolved_model?: string | null;
  resolved_family?: string | null;
  resolved_at?: string | null;
}
/** Usado quando a config central ainda não existe (modo legado): sem limites, só registro de uso. */
export const DEFAULT_CONFIG: PlatformConfig = {
  enabled: true, provider: "gemini", model_mode: "auto", model_family: "flash", model: FALLBACK_MODEL, thinking_level: "LOW",
  temperature: 0.5, max_tokens: 1024,
  base_prompt: "", tone: "", rules: "", knowledge: "", examples: [],
  monthly_budget_usd: null, usd_brl: 5.5, default_salon_monthly_requests: null, default_salon_monthly_tokens: null,
  on_limit: "fallback", fallback_message: "Vou pedir para a equipe do salão responder você em instantes.",
  price_in_per_mtok: null, price_out_per_mtok: null, price_cache_per_mtok: null,
};

// Preço pago, padrão (não batch), US$ por 1M tokens: [prefixo, entrada, saída (inclui thinking), cache, válido até (exclusivo)].
// Conferido em ai.google.dev/gemini-api/docs/pricing em 06/11/2026. Modelo fora da tabela: preço manual no painel.
const PRICES: [string, number, number, number, string?][] = [
  ["gemini-4-argon", 2, 10, 0.1, "2026-12-01"], ["gemini-4-argon", 4, 20, 0.2],
  ["gemini-3.8-flash", 0.75, 3.75, 0.075, "2027-01-01"], ["gemini-3.8-flash", 1.5, 7.5, 0.15],
  ["gemini-3.6-flash", 0.75, 3.75, 0.075, "2027-01-01"], ["gemini-3.6-flash", 1.5, 7.5, 0.15],
  ["gemini-3.5-flash-lite", 0.3, 2.5, 0.03], ["gemini-3.1-flash-lite", 0.25, 1.5, 0.025],
  ["gemini-3.1-pro-preview", 2, 12, 0.2],
  ["gemini-2.5-pro", 1.25, 10, 0.125], ["gemini-2.5-flash-lite", 0.1, 0.4, 0.01], ["gemini-2.5-flash", 0.3, 2.5, 0.03],
  // Legado (chave antiga de salão). Não conferido hoje; mantido como estimativa.
  ["gpt-4o-mini", 0.15, 0.6, 0.15], ["gpt-4o", 2.5, 10, 2.5], ["llama-3.3-70b", 0.59, 0.79, 0.59], ["llama-3.1-8b", 0.05, 0.08, 0.05],
];
/** Modelo desconhecido sem preço manual: o maior preço conhecido, para o orçamento não ficar furado. */
export const UNKNOWN_PRICE: [number, number, number] = [4, 20, 4];

export type PriceCfg = Pick<PlatformConfig, "price_in_per_mtok" | "price_out_per_mtok"> & { price_cache_per_mtok?: number | null };
/** [entrada, saída, cache] em US$/1M tokens. Preço manual do painel vence a tabela. */
export function priceFor(model: string, cfg?: PriceCfg | null, at: Date = new Date()): [number, number, number] {
  if (cfg?.price_in_per_mtok != null && cfg?.price_out_per_mtok != null) {
    const pin = Number(cfg.price_in_per_mtok);
    return [pin, Number(cfg.price_out_per_mtok), cfg.price_cache_per_mtok != null ? Number(cfg.price_cache_per_mtok) : pin];
  }
  const name = model.toLowerCase().split("/").pop() ?? "";
  const day = at.toISOString().slice(0, 10);
  let best: (typeof PRICES)[number] | undefined;
  for (const p of PRICES) {
    if (!name.startsWith(p[0]) || (p[4] && day >= p[4])) continue;
    if (!best || p[0].length > best[0].length) best = p;
  }
  return best ? [best[1], best[2], best[3]] : UNKNOWN_PRICE;
}
export interface Usage { tokensIn: number; tokensOut: number; tokensCached?: number }
/** tokensIn inclui os em cache (cobrados pelo preço de cache); tokensOut inclui thinking (cobrado como saída). */
export function estimateCost(model: string, u: Usage, cfg?: PriceCfg | null, at?: Date): number {
  const [pin, pout, pcache] = priceFor(model, cfg, at);
  const tin = Math.max(0, u.tokensIn), cached = Math.min(tin, Math.max(0, u.tokensCached ?? 0));
  const cost = ((tin - cached) * pin + cached * pcache + Math.max(0, u.tokensOut) * pout) / 1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}
/** Sem `usage` do provedor: ~4 caracteres por token. */
export const roughTokens = (text: string) => Math.ceil((text ?? "").length / 4);

// Limites (orçamento, salão, bloqueio, IA desligada) são decididos atomicamente no banco: public.ai_reserve.

export function maskKey(key: string | null | undefined): string {
  const k = (key ?? "").trim();
  return k.length >= 8 ? `••••${k.slice(-4)}` : k ? "••••" : "";
}

export type AIErrorCode = "invalid_key" | "provider_quota" | "rate_limited" | "invalid_model" | "bad_request" | "timeout" | "unavailable";
export const AI_ERROR_TEXT: Record<string, string> = {
  invalid_key: "A chave foi recusada pelo Google. Confira se foi copiada inteira.",
  provider_quota: "A conta do Google AI está sem crédito ou cota. Verifique o faturamento no Google AI Studio.",
  rate_limited: "O Google limitou a quantidade de chamadas. Aguarde alguns segundos e tente de novo.",
  invalid_model: "O Google não reconheceu este modelo. Use o modo automático ou confira o nome exato.",
  bad_request: "O Google recusou a requisição. Confira modelo e parâmetros.",
  timeout: "A IA demorou demais para responder.",
  unavailable: "A IA está indisponível no momento.",
  quota_exceeded: "O limite de uso de IA foi atingido.",
  persistence_failed: "Não foi possível verificar o limite de uso de IA agora. Tente novamente em instantes.",
  ai_disabled: "A IA está desativada pela plataforma.",
  not_configured: "A IA ainda não foi configurada pela plataforma.",
};
/**
 * Normaliza falhas sem expor corpo bruto (pode ecoar a chave).
 * `charged`: recusa 4xx explícita não gera cobrança (reserva é liberada); timeout/rede/5xx podem ter sido
 * processados e cobrados, então a reserva estimada continua contando no orçamento.
 */
export function normalizeProviderError(status: number | null, body: unknown, aborted = false): { code: AIErrorCode; retryable: boolean; charged: boolean } {
  if (aborted) return { code: "timeout", retryable: true, charged: true };
  if (status == null) return { code: "unavailable", retryable: true, charged: true };
  const text = (typeof body === "string" ? body : JSON.stringify(body ?? "")).toLowerCase();
  if (status === 401 || status === 403 || /api key not valid|invalid api key|incorrect api key|invalid_api_key|api_key_invalid/.test(text)) return { code: "invalid_key", retryable: false, charged: false };
  if (status === 402 || /insufficient_quota|billing|credit|exceeded your current quota/.test(text)) return { code: "provider_quota", retryable: false, charged: false };
  if (status === 429) return { code: "rate_limited", retryable: true, charged: false };
  if (status === 404 || /model.*(not found|does not exist|decommissioned|not supported)|model_not_found/.test(text)) return { code: "invalid_model", retryable: false, charged: false };
  if (status >= 400 && status < 500) return { code: "bad_request", retryable: false, charged: false };
  return { code: "unavailable", retryable: true, charged: true };
}

/** Teto de reserva aceito pelo banco (ai_reserve). */
export const MAX_RESERVED_TOKENS = 2_000_000;
/**
 * Reserva antes da chamada paga: entrada estimada para cima (3 caracteres/token + ferramentas + imagem)
 * e saída = máximo permitido (no Gemini, maxOutputTokens já inclui thinking). É estimativa: o provedor conta diferente.
 */
export function reservationEstimate(model: string, messages: { content?: string | null; image?: unknown; gemini_parts?: unknown }[], maxTokens: number, tools: unknown[] | undefined, cfg?: PriceCfg | null) {
  const chars = messages.reduce((n, m) => n + (m.content?.length ?? 0) + (m.gemini_parts ? JSON.stringify(m.gemini_parts).length : 0), 0) + (tools?.length ? JSON.stringify(tools).length : 0);
  const images = messages.filter(m => m.image).length;
  const tokensIn = Math.ceil(chars / 3) + images * 1500 + messages.length * 8;
  const tokensOut = Math.max(1, Math.round(maxTokens));
  const tokens = Math.min(MAX_RESERVED_TOKENS, tokensIn + tokensOut);
  return { tokens, cost: estimateCost(model, { tokensIn, tokensOut }, cfg) };
}

// Modelos ------------------------------------------------------------------------------------------
const EXCLUDED = /preview|exp|experimental|tts|image|embedding|live|audio|latest|transcribe|banana|omni|robotics|computer|customtools|thinking|aqa|gemma|learnlm/;
export interface GeminiModel { id: string; displayName: string; major: number; minor: number; tier: string; family: ModelFamily | null }
/** Filtra a resposta de models.list: só gemini-<versão>-<tier> estáveis com generateContent, ordenados do mais novo. */
// deno-lint-ignore no-explicit-any
export function pickModels(list: any): { models: GeminiModel[]; flash: string | null; pro: string | null } {
  const models: GeminiModel[] = [];
  for (const m of Array.isArray(list?.models) ? list.models : []) {
    const id = String(m?.name ?? "").replace(/^models\//, "");
    if (!Array.isArray(m?.supportedGenerationMethods) || !m.supportedGenerationMethods.includes("generateContent")) continue;
    if (EXCLUDED.test(id)) continue;
    const v = id.match(/^gemini-(\d+)(?:\.(\d+))?-([a-z]+(?:-[a-z]+)?)$/);
    if (!v) continue; // versões datadas (-001) e nomes fora do padrão ficam de fora
    const tier = v[3];
    const family: ModelFamily | null = tier === "flash" ? "flash" : tier.includes("lite") || tier.includes("flash") ? null : "pro";
    models.push({ id, displayName: String(m.displayName ?? id), major: Number(v[1]), minor: Number(v[2] ?? 0), tier, family });
  }
  models.sort((a, b) => b.major - a.major || b.minor - a.minor || a.id.localeCompare(b.id));
  return { models, flash: models.find(m => m.family === "flash")?.id ?? null, pro: models.find(m => m.family === "pro")?.id ?? null };
}
/** Gemini 3+ ignora temperature (e futuras versões recusam) e usa thinkingLevel; 2.x faz o contrário. */
export const geminiMajor = (model: string) => Number(model.match(/^gemini-(\d+)/)?.[1] ?? 0);
/** Modelo efetivo a partir do cache (sem rede). null = precisa listar. */
export function cachedModel(cfg: PlatformConfig, now = Date.now()): string | null {
  if (cfg.model_mode !== "auto") return cfg.model;
  const at = cfg.resolved_at ? Date.parse(cfg.resolved_at) : NaN;
  return cfg.resolved_model && cfg.resolved_family === cfg.model_family && now - at < MODEL_CACHE_MS ? cfg.resolved_model : null;
}
/** Listagem falhou: último resolvido da mesma família, depois o fallback fixo. */
export const staleModel = (cfg: PlatformConfig) => (cfg.resolved_family === cfg.model_family && cfg.resolved_model) || FALLBACK_MODEL;

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
/** Valida a config vinda do painel (trust boundary). Lança Error em campo inválido. Provedor é sempre Gemini. */
export function sanitizeConfig(input: Record<string, unknown>): PlatformConfig {
  if (input.provider != null && !CENTRAL_PROVIDERS.includes(String(input.provider))) throw new Error("invalid_provider");
  const model = text(input.model ?? FALLBACK_MODEL, 120) || FALLBACK_MODEL;
  if (!/^gemini-[a-z0-9.-]{1,110}$/.test(model)) throw new Error("invalid_model");
  const examples = Array.isArray(input.examples) ? input.examples : [];
  if (examples.length > 20) throw new Error("too_many_examples");
  const fallback = text(input.fallback_message, 500);
  const level = String(input.thinking_level ?? "LOW");
  if (!["LOW", "MEDIUM", "HIGH"].includes(level)) throw new Error("invalid_thinking");
  return {
    enabled: input.enabled !== false,
    provider: "gemini",
    model_mode: input.model_mode === "fixed" ? "fixed" : "auto",
    model_family: input.model_family === "pro" ? "pro" : "flash",
    model,
    thinking_level: level as ThinkingLevel,
    temperature: reqNum(input.temperature ?? 0.5, 0, 1),
    max_tokens: Math.round(reqNum(input.max_tokens ?? 1024, 50, 8192)),
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
    price_cache_per_mtok: optNum(input.price_cache_per_mtok, 0, 1000),
  };
}

// Adapters: só montam/leem JSON; o fetch fica em gateway.ts. Formato interno = OpenAI (tool_calls/tool).
export interface ToolCall { id: string; type: string; function: { name: string; arguments: string }; gemini_id?: string }
export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string;
  image?: { mime: string; data: string };
  /** Partes originais do Gemini (inclui thoughtSignature): devolvidas sem alteração no turno seguinte. */
  gemini_parts?: unknown[];
}
export interface ChatOptions { temperature: number; maxTokens: number; tools?: unknown[]; thinkingLevel?: ThinkingLevel }

type OpenAITool = { function?: { name?: string; description?: string; parameters?: unknown } };
/** Ferramentas no formato OpenAI -> functionDeclarations (parametersJsonSchema aceita JSON Schema com additionalProperties). */
export const geminiTools = (tools: unknown[]) => [{
  functionDeclarations: (tools as OpenAITool[]).filter(t => t?.function?.name).map(t => ({
    name: t.function!.name, description: t.function!.description ?? "", parametersJsonSchema: t.function!.parameters ?? { type: "object", properties: {} },
  })),
}];
const asObject = (content: string | null): Record<string, unknown> => {
  try {
    const v = JSON.parse(content ?? "null");
    return v && typeof v === "object" && !Array.isArray(v) ? v : { result: v };
  } catch { return { result: content ?? "" }; }
};
const parseArgs = (s: string) => { try { const v = JSON.parse(s || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };

/** Histórico interno -> contents do Gemini. Respostas de ferramenta consecutivas viram um único turno com N functionResponse. */
export function toGeminiContents(messages: AIMessage[]) {
  const contents: { role: string; parts: unknown[] }[] = [];
  const calls = new Map<string, { name: string; geminiId?: string }>();
  let lastWasTool = false;
  for (const m of messages) {
    if (m.role === "system") continue;
    if (m.role === "tool") {
      const c = calls.get(m.tool_call_id ?? "");
      const part = { functionResponse: { name: c?.name ?? "unknown", ...(c?.geminiId ? { id: c.geminiId } : {}), response: asObject(m.content) } };
      if (lastWasTool) contents[contents.length - 1].parts.push(part);
      else contents.push({ role: "user", parts: [part] });
      lastWasTool = true;
      continue;
    }
    lastWasTool = false;
    if (m.role === "assistant") {
      for (const tc of m.tool_calls ?? []) calls.set(tc.id, { name: tc.function.name, geminiId: tc.gemini_id });
      const parts = Array.isArray(m.gemini_parts) && m.gemini_parts.length ? m.gemini_parts : [
        ...(m.content ? [{ text: m.content }] : []),
        ...(m.tool_calls ?? []).map(tc => ({ functionCall: { name: tc.function.name, args: parseArgs(tc.function.arguments), ...(tc.gemini_id ? { id: tc.gemini_id } : {}) } })),
      ];
      contents.push({ role: "model", parts: parts.length ? parts : [{ text: "" }] });
      continue;
    }
    contents.push({ role: "user", parts: [{ text: m.content ?? "" }, ...(m.image ? [{ inlineData: { mimeType: m.image.mime, data: m.image.data } }] : [])] });
  }
  return contents;
}

export function buildRequest(provider: string, model: string, key: string, messages: AIMessage[], opt: ChatOptions): { url: string; headers: Record<string, string>; body: unknown } {
  if (provider === "gemini") {
    const system = messages.filter(m => m.role === "system").map(m => m.content).join("\n\n");
    const modern = geminiMajor(model) >= 3;
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: {
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: toGeminiContents(messages),
        ...(opt.tools?.length ? { tools: geminiTools(opt.tools), toolConfig: { functionCallingConfig: { mode: "AUTO" } } } : {}),
        generationConfig: {
          maxOutputTokens: opt.maxTokens,
          ...(modern ? { thinkingConfig: { thinkingLevel: opt.thinkingLevel ?? "LOW" } } : { temperature: opt.temperature }),
        },
      },
    };
  }
  const url = OPENAI_COMPAT[provider];
  if (!url) throw new Error("unknown_provider");
  const msgs = messages.map(({ image, gemini_parts: _g, tool_calls, ...m }) => ({
    ...m,
    ...(tool_calls ? { tool_calls: tool_calls.map(({ gemini_id: _id, ...tc }) => tc) } : {}),
    ...(image ? { content: [{ type: "text", text: m.content ?? "" }, { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.data}` } }] } : {}),
  }));
  return {
    url,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(provider === "openrouter" ? { "HTTP-Referer": "https://agendafacil365.com.br", "X-Title": "Agenda Facil 365" } : {}) },
    body: { model, messages: msgs, temperature: opt.temperature, max_tokens: opt.maxTokens, ...(opt.tools?.length ? { tools: opt.tools, tool_choice: "auto" } : {}) },
  };
}

export interface ChatResult {
  text: string; toolCalls: ToolCall[]; message: AIMessage | null;
  /** tokensIn inclui cache e prompt de ferramentas; tokensOut inclui thinking. */
  tokensIn: number; tokensOut: number; tokensCached: number; tokensThoughts: number; exactUsage: boolean;
}
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
// deno-lint-ignore no-explicit-any
export function parseResponse(provider: string, json: any, promptChars = 0): ChatResult {
  if (provider === "gemini") {
    const parts: Record<string, unknown>[] = Array.isArray(json?.candidates?.[0]?.content?.parts) ? json.candidates[0].content.parts : [];
    const text = parts.filter(p => typeof p.text === "string" && !p.thought).map(p => p.text as string).join("");
    const toolCalls: ToolCall[] = parts.filter(p => p.functionCall && typeof p.functionCall === "object").map((p, i) => {
      const fc = p.functionCall as { name?: string; args?: unknown; id?: string };
      return { id: fc.id || `gemini_call_${i}`, type: "function", function: { name: String(fc.name ?? ""), arguments: JSON.stringify(fc.args ?? {}) }, ...(fc.id ? { gemini_id: fc.id } : {}) };
    });
    const u = json?.usageMetadata ?? {};
    const prompt = num(u.promptTokenCount), toolPrompt = num(u.toolUsePromptTokenCount) ?? 0, total = num(u.totalTokenCount);
    const thoughts = num(u.thoughtsTokenCount) ?? 0, candidates = num(u.candidatesTokenCount);
    const tokensIn = (prompt ?? Math.ceil(promptChars / 4)) + toolPrompt;
    // totalTokenCount = prompt + prompt de ferramentas + thinking + candidatos (doc oficial de UsageMetadata).
    const tokensOut = prompt != null && total != null ? Math.max(0, total - prompt - toolPrompt) : (candidates ?? roughTokens(text)) + thoughts;
    return {
      text, toolCalls, tokensIn, tokensOut, tokensCached: num(u.cachedContentTokenCount) ?? 0, tokensThoughts: thoughts,
      exactUsage: prompt != null && (total != null || candidates != null),
      message: { role: "assistant", content: text || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}), gemini_parts: parts },
    };
  }
  const msg = json?.choices?.[0]?.message ?? null;
  const text = String(msg?.content ?? "");
  return {
    text, toolCalls: Array.isArray(msg?.tool_calls) ? msg.tool_calls : [], message: msg,
    exactUsage: num(json?.usage?.prompt_tokens) != null && num(json?.usage?.completion_tokens) != null,
    tokensIn: json?.usage?.prompt_tokens ?? Math.ceil(promptChars / 4), tokensOut: json?.usage?.completion_tokens ?? roughTokens(text),
    tokensCached: num(json?.usage?.prompt_tokens_details?.cached_tokens) ?? 0, tokensThoughts: num(json?.usage?.completion_tokens_details?.reasoning_tokens) ?? 0,
  };
}
/** Turno do assistente a reenviar após ferramentas, preservando as partes originais do Gemini (thoughtSignature). */
export const assistantTurn = (m: AIMessage | null, calls: ToolCall[]): AIMessage => ({
  role: "assistant", content: m?.content ?? null, tool_calls: calls, ...(m?.gemini_parts ? { gemini_parts: m.gemini_parts } : {}),
});
