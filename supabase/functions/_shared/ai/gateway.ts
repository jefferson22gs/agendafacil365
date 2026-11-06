// Gateway único de IA (Edge Functions). Chave só no servidor. Plataforma: só Gemini.
// Cada chamada paga: reserva atômica (ai_reserve) -> provedor -> liquidação (ai_settle). Falhas de banco fecham.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AI_ERROR_TEXT, buildRequest, cachedModel, DEFAULT_CONFIG, estimateCost, FALLBACK_MODEL, normalizeProviderError, parseResponse, pickModels,
  reservationEstimate, staleModel, type AIMessage, type ChatResult, type Feature, type GeminiModel, type PlatformConfig,
} from "./core.ts";
import { corsHeaders } from "../whatsapp/errors.ts";

export class AIError extends Error {
  constructor(public code: string, public status = 502, public reason?: string) { super(code); }
}
export interface ResolvedAI {
  mode: "central" | "legacy"; cfg: PlatformConfig; provider: string; model: string; key: string; temperature: number; maxTokens: number;
}
export type LegacyAI = { provider: string; model: string; key: string; temperature?: unknown; maxTokens?: unknown } | null;
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

const clampNum = (v: unknown, min: number, max: number, def: number) => {
  const n = v == null || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
};
const dbFailure = (where: string, code?: string) => {
  console.warn("ai_db_failed", where, code ?? "");
  return new AIError("persistence_failed", 503);
};

// Únicas ausências legítimas: tabela/função ainda não criada (migração não aplicada). Qualquer outro erro fecha.
const MISSING_RELATION = new Set(["42P01", "PGRST205"]);

/** null = config central inexistente (tabela ausente ou linha não criada): modo legado. Erro de banco lança AIError. */
export async function loadPlatformConfig(db: SupabaseClient): Promise<PlatformConfig | null> {
  const { data, error } = await db.from("ai_platform_config").select("*").eq("id", true).maybeSingle();
  if (error) {
    if (MISSING_RELATION.has(String(error.code))) return null;
    throw dbFailure("config", error.code);
  }
  if (!data) return null;
  return { ...DEFAULT_CONFIG, ...data, examples: Array.isArray(data.examples) ? data.examples : [] } as PlatformConfig;
}
/** Chave Gemini da plataforma. Sem linha: segredo GEMINI_API_KEY. Erro de banco lança. */
export async function platformKey(db: SupabaseClient, provider = "gemini"): Promise<string | null> {
  const { data, error } = await db.rpc("ai_platform_secret", { p_provider: provider });
  if (error) throw dbFailure("key", error.code);
  if (typeof data === "string" && data) return data;
  return Deno.env.get(`${provider.toUpperCase()}_API_KEY`) || null;
}

const LEGACY_MODELS: Record<string, string> = { groq: "llama-3.3-70b-versatile", openai: "gpt-4o-mini", gemini: FALLBACK_MODEL };
/** Legado (antes da config central): chaves do super admin em ai_provider_keys, depois segredos de ambiente. */
export async function legacyPlatformKey(db: SupabaseClient, order: string[], geminiModel?: string): Promise<LegacyAI> {
  const { data, error } = await db.from("ai_provider_keys").select("provider,api_key").eq("is_active", true);
  if (error && !MISSING_RELATION.has(String(error.code))) throw dbFailure("legacy_keys", error.code);
  for (const p of order) {
    const row = ((data ?? []) as { provider: string; api_key: string }[]).find(r => String(r.provider).toLowerCase() === p && r.api_key);
    const key = row?.api_key || Deno.env.get(`${p.toUpperCase()}_API_KEY`);
    if (key) return { provider: p, key, model: p === "gemini" ? (geminiModel || Deno.env.get("GEMINI_MODEL") || LEGACY_MODELS.gemini) : LEGACY_MODELS[p] };
  }
  return null;
}

/** GET models.list com a chave (header, nunca na URL). Lança AIError normalizado. */
export async function listGeminiModels(key: string, doFetch: FetchLike = fetch): Promise<ReturnType<typeof pickModels>> {
  let status: number | null = null, body: unknown = null, aborted = false;
  try {
    const res = await doFetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { method: "GET", redirect: "error", signal: AbortSignal.timeout(10_000), headers: { "x-goog-api-key": key } });
    status = res.status;
    body = await res.json().catch(() => null);
  } catch (e) { aborted = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError"); }
  if (status != null && status >= 200 && status < 300) return pickModels(body);
  throw new AIError(normalizeProviderError(status, body, aborted).code, 502);
}

/**
 * Modelo concreto. Fixo: o escolhido. Automático: cache (24h) -> models.list (grava cache) -> último resolvido -> FALLBACK_MODEL.
 * Falha ao gravar o cache só gera aviso: não envolve gasto, e a próxima chamada lista de novo.
 */
export async function effectiveModel(db: SupabaseClient, cfg: PlatformConfig, key: string, doFetch: FetchLike = fetch): Promise<string> {
  const cached = cachedModel(cfg);
  if (cached) return cached;
  try {
    const picked = await listGeminiModels(key, doFetch);
    const model = cfg.model_family === "pro" ? (picked.pro ?? picked.flash) : picked.flash;
    if (!model) return staleModel(cfg);
    const resolved_at = new Date().toISOString();
    const { error } = await db.from("ai_platform_config").update({ resolved_model: model, resolved_family: cfg.model_family, resolved_at }).eq("id", true);
    if (error) console.warn("ai_model_cache_failed", error.code);
    Object.assign(cfg, { resolved_model: model, resolved_family: cfg.model_family, resolved_at });
    return model;
  } catch (e) {
    console.warn("ai_model_list_failed", e instanceof AIError ? e.code : "internal");
    return staleModel(cfg);
  }
}

/**
 * Config central vence sempre; `legacy` só roda se a config central não existe.
 * null = nenhuma chave disponível. IA desligada não é null: a reserva registra o bloqueio e o recurso cai no padrão.
 */
export async function resolveAI(db: SupabaseClient, legacy: () => Promise<LegacyAI>, doFetch: FetchLike = fetch): Promise<ResolvedAI | null> {
  const cfg = await loadPlatformConfig(db);
  if (cfg) {
    const key = await platformKey(db, "gemini");
    if (!key) return cfg.enabled ? null : { mode: "central", cfg, provider: "gemini", model: cachedModel(cfg) ?? staleModel(cfg), key: "", temperature: 0.5, maxTokens: 1024 };
    const model = cfg.enabled ? await effectiveModel(db, cfg, key, doFetch) : (cachedModel(cfg) ?? staleModel(cfg));
    return { mode: "central", cfg, provider: "gemini", model, key, temperature: clampNum(cfg.temperature, 0, 1, 0.5), maxTokens: clampNum(cfg.max_tokens, 50, 8192, 1024) };
  }
  const l = await legacy();
  if (!l) return null;
  return { mode: "legacy", cfg: DEFAULT_CONFIG, provider: l.provider, model: l.model, key: l.key, temperature: clampNum(l.temperature, 0, 1, 0.5), maxTokens: clampNum(l.maxTokens, 100, 1000, 500) };
}

export interface ChatCall { salonId: string | null; feature: Feature; messages: AIMessage[]; tools?: unknown[]; timeoutMs?: number; maxTokens?: number }

/**
 * Uma chamada paga. Antes: reserva atômica (bloqueio vira AIError "quota_exceeded" com `reason`).
 * Depois: liquidação. Falha de persistência em qualquer ponto lança AIError "persistence_failed";
 * se a liquidação falhar após a resposta do provedor, a reserva estimada continua contando (nunca libera orçamento incerto).
 * Nunca devolve corpo bruto do provedor (pode ecoar a chave).
 */
export async function aiChat(db: SupabaseClient, ai: ResolvedAI, call: ChatCall, doFetch: FetchLike = fetch): Promise<ChatResult> {
  const maxTokens = call.maxTokens ?? ai.maxTokens;
  let req: ReturnType<typeof buildRequest>;
  try { req = buildRequest(ai.provider, ai.model, ai.key, call.messages, { temperature: ai.temperature, maxTokens, tools: call.tools, thinkingLevel: ai.cfg.thinking_level }); }
  catch { throw new AIError("not_configured", 503); } // provedor legado desconhecido

  const est = reservationEstimate(ai.model, call.messages, maxTokens, call.tools, ai.cfg);
  const { data: rows, error: reserveError } = await db.rpc("ai_reserve", {
    p_salon_id: call.salonId, p_feature: call.feature, p_provider: ai.provider, p_model: ai.model, p_tokens: est.tokens, p_cost: est.cost,
  });
  // Inclusive no legado: sem reserva persistida, nenhuma chamada paga.
  if (reserveError) throw dbFailure("reserve", reserveError.code);
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (row?.reason) throw new AIError("quota_exceeded", 429, String(row.reason));
  const reservationId = row?.reservation_id;
  if (reservationId == null) throw dbFailure("reserve_empty");
  const started = Date.now();
  const settle = async (p: Record<string, unknown>) => {
    const { data, error } = await db.rpc("ai_settle", { p_id: reservationId, p_latency_ms: Date.now() - started, ...p });
    // Sem liquidação a reserva fica "reserved" e segue contando no orçamento pelo valor estimado.
    if (error || data !== true) throw dbFailure("settle", error?.code);
  };
  const refuse = { p_status: "error", p_tokens_in: 0, p_tokens_out: 0, p_tokens_cached: 0, p_tokens_thoughts: 0, p_cost: 0, p_exact: false };
  if (!ai.key) { // nada foi enviado ao provedor: devolve a reserva
    await settle({ ...refuse, p_charged: false, p_error_code: "not_configured" });
    throw new AIError("not_configured", 503);
  }

  const promptChars = call.messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  let status: number | null = null, body: unknown = null, aborted = false;
  try {
    const res = await doFetch(req.url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(call.timeoutMs ?? 25_000), headers: req.headers, body: JSON.stringify(req.body) });
    status = res.status;
    body = await res.json().catch(() => null);
  } catch (e) {
    aborted = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
  }
  if (status != null && status >= 200 && status < 300) {
    const out = parseResponse(ai.provider, body, promptChars);
    await settle({
      p_status: "ok", p_tokens_in: out.tokensIn, p_tokens_out: out.tokensOut, p_tokens_cached: out.tokensCached, p_tokens_thoughts: out.tokensThoughts,
      p_cost: estimateCost(ai.model, out, ai.cfg), p_exact: out.exactUsage, p_charged: true, p_error_code: null,
    });
    return out;
  }
  const err = normalizeProviderError(status, body, aborted);
  await settle({ ...refuse, p_charged: err.charged, p_error_code: err.code });
  throw new AIError(err.code, err.code === "rate_limited" ? 429 : 502);
}

export const isQuotaError = (e: unknown): e is AIError => e instanceof AIError && e.code === "quota_exceeded";
export type { GeminiModel };

export function aiErrorResponse(error: unknown) {
  const code = error instanceof AIError ? (isQuotaError(error) && error.reason === "disabled" ? "ai_disabled" : error.code) : "internal_error";
  const status = error instanceof AIError ? error.status : 500;
  console.warn("ai_operation_failed", code);
  return new Response(JSON.stringify({ success: false, code, error: AI_ERROR_TEXT[code] ?? "Não foi possível concluir a operação." }), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
