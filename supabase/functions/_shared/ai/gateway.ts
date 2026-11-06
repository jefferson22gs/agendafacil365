// Gateway único de IA (Edge Functions). Chave só no servidor; cota antes, registro de uso depois de cada chamada.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  AI_ERROR_TEXT, buildRequest, checkQuota, DEFAULT_CONFIG, estimateCost, normalizeProviderError, parseResponse,
  type AIMessage, type ChatResult, type Feature, type PlatformConfig, type QuotaResult,
} from "./core.ts";
import { corsHeaders } from "../whatsapp/errors.ts";

export class AIError extends Error {
  constructor(public code: string, public status = 502) { super(code); }
}
export interface ResolvedAI {
  mode: "central" | "legacy"; cfg: PlatformConfig; provider: string; model: string; key: string; temperature: number; maxTokens: number;
}
export type LegacyAI = { provider: string; model: string; key: string; temperature?: unknown; maxTokens?: unknown } | null;

const clampNum = (v: unknown, min: number, max: number, def: number) => {
  const n = v == null || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
};

/** null = config central ainda não criada (modo legado). */
export async function loadPlatformConfig(db: SupabaseClient): Promise<PlatformConfig | null> {
  const { data, error } = await db.from("ai_platform_config").select("*").eq("id", true).maybeSingle();
  // Tabela ausente (migração não aplicada) também cai no legado para não derrubar produção.
  if (error || !data) return null;
  return { ...DEFAULT_CONFIG, ...data, examples: Array.isArray(data.examples) ? data.examples : [] } as PlatformConfig;
}
export async function platformKey(db: SupabaseClient, provider: string): Promise<string | null> {
  const { data, error } = await db.rpc("ai_platform_secret", { p_provider: provider });
  if (!error && typeof data === "string" && data) return data;
  // Config salva sem chave no banco: aceita segredo de ambiente do mesmo provedor (ex.: GEMINI_API_KEY).
  return Deno.env.get(`${provider.toUpperCase()}_API_KEY`) || null;
}

const LEGACY_MODELS: Record<string, string> = { groq: "llama-3.3-70b-versatile", openai: "gpt-4o-mini", gemini: "gemini-2.5-flash" };
/** Legado (antes da config central): chaves do super admin em ai_provider_keys, depois segredos de ambiente. */
export async function legacyPlatformKey(db: SupabaseClient, order: string[], geminiModel?: string): Promise<LegacyAI> {
  const { data } = await db.from("ai_provider_keys").select("provider,api_key").eq("is_active", true);
  for (const p of order) {
    const row = ((data ?? []) as { provider: string; api_key: string }[]).find(r =>String(r.provider).toLowerCase() === p && r.api_key);
    const key = row?.api_key || Deno.env.get(`${p.toUpperCase()}_API_KEY`);
    if (key) return { provider: p, key, model: p === "gemini" ? (geminiModel || Deno.env.get("GEMINI_MODEL") || LEGACY_MODELS.gemini) : LEGACY_MODELS[p] };
  }
  return null;
}

/** Config central vence sempre; `legacy` só é consultado se a plataforma ainda não foi configurada. */
export async function resolveAI(db: SupabaseClient, legacy: () => Promise<LegacyAI>): Promise<ResolvedAI | null> {
  const cfg = await loadPlatformConfig(db);
  if (cfg) {
    // Desativada: devolve mesmo sem chave para guardQuota registrar o bloqueio e o recurso cair no padrão.
    const key = cfg.enabled ? await platformKey(db, cfg.provider) : "";
    if (cfg.enabled && !key) return null;
    return { mode: "central", cfg, provider: cfg.provider, model: cfg.model, key: key ?? "", temperature: clampNum(cfg.temperature, 0, 1, 0.5), maxTokens: clampNum(cfg.max_tokens, 50, 4000, 500) };
  }
  const l = await legacy();
  if (!l) return null;
  return { mode: "legacy", cfg: DEFAULT_CONFIG, provider: l.provider, model: l.model, key: l.key, temperature: clampNum(l.temperature, 0, 1, 0.5), maxTokens: clampNum(l.maxTokens, 100, 1000, 500) };
}

async function recordUsage(db: SupabaseClient, row: Record<string, unknown>) {
  const { error } = await db.from("ai_usage").insert(row);
  if (error) console.warn("ai_usage_insert_failed", error.code);
}

/** Checa orçamento global + limite do salão. Bloqueio fica registrado (status=blocked) para o painel. */
export async function guardQuota(db: SupabaseClient, ai: ResolvedAI, salonId: string | null, feature: Feature): Promise<QuotaResult> {
  // Legado não tem limites configurados; só a config central impõe cota.
  if (ai.mode === "legacy") return { ok: true };
  let state = null;
  if (ai.cfg.enabled) {
    const { data, error } = await db.rpc("ai_quota_state", { p_salon_id: salonId });
    if (error) { console.warn("ai_quota_state_failed", error.code); return { ok: false, reason: "budget" }; } // falha fechada: sem controle de gasto, sem chamada
    state = data?.[0] ?? null;
  }
  const result = checkQuota(state, ai.cfg, !!salonId);
  if (!result.ok) await recordUsage(db, { salon_id: salonId, feature, provider: ai.provider, model: ai.model, status: "blocked", error_code: result.reason });
  return result;
}

export interface ChatCall { salonId: string | null; feature: Feature; messages: AIMessage[]; tools?: unknown[]; timeoutMs?: number; maxTokens?: number }
/** Uma chamada ao provedor. Lança AIError normalizado; nunca devolve corpo bruto (pode ecoar a chave). */
export async function aiChat(db: SupabaseClient, ai: ResolvedAI, call: ChatCall): Promise<ChatResult> {
  const started = Date.now();
  let req: ReturnType<typeof buildRequest>;
  try { req = buildRequest(ai.provider, ai.model, ai.key, call.messages, { temperature: ai.temperature, maxTokens: call.maxTokens ?? ai.maxTokens, tools: call.tools }); }
  catch { throw new AIError("not_configured", 503); } // provedor legado desconhecido
  const promptChars = call.messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  const base = { salon_id: call.salonId, feature: call.feature, provider: ai.provider, model: ai.model };
  let status: number | null = null, body: unknown = null, aborted = false;
  try {
    const res = await fetch(req.url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(call.timeoutMs ?? 20_000), headers: req.headers, body: JSON.stringify(req.body) });
    status = res.status;
    body = await res.json().catch(() => null);
    if (res.ok) {
      const out = parseResponse(ai.provider, body, promptChars);
      await recordUsage(db, { ...base, status: "ok", tokens_in: out.tokensIn, tokens_out: out.tokensOut, cost_usd: estimateCost(ai.model, out.tokensIn, out.tokensOut, ai.cfg), latency_ms: Date.now() - started });
      return out;
    }
  } catch (e) {
    aborted = e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");
  }
  const err = normalizeProviderError(status, body, aborted);
  await recordUsage(db, { ...base, status: "error", error_code: err.code, latency_ms: Date.now() - started });
  throw new AIError(err.code, err.code === "rate_limited" ? 429 : 502);
}

export function aiErrorResponse(error: unknown) {
  const code = error instanceof AIError ? error.code : "internal_error";
  const status = error instanceof AIError ? error.status : 500;
  console.warn("ai_operation_failed", code);
  return new Response(JSON.stringify({ success: false, code, error: AI_ERROR_TEXT[code] ?? "Não foi possível concluir a operação." }), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
