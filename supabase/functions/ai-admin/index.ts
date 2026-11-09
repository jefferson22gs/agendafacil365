// Painel de IA do super admin: config central (Gemini), chave (nunca devolvida), modelos, limites, consumo, teste e simulação.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requiredEnv, serviceClient, validUuid } from "../_shared/whatsapp/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, readRequest, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { aiChat, AIError, aiErrorResponse, effectiveModel, listGeminiModels, loadPlatformConfig, platformKey, type ResolvedAI } from "../_shared/ai/gateway.ts";
import { cachedModel, composeSystemPrompt, DEFAULT_CONFIG, sanitizeConfig, staleModel, type AIMessage, type PlatformConfig } from "../_shared/ai/core.ts";

async function requireSuperAdmin(req: Request, db: SupabaseClient): Promise<string> {
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) throw new WhatsAppError("unauthorized", 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new WhatsAppError("unauthorized", 401);
  // is_super_admin() depende de auth.uid(): roda com o JWT do próprio usuário.
  const asUser = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: ok, error: rpcError } = await asUser.rpc("is_super_admin");
  if (rpcError) throw new WhatsAppError("persistence_failed", 503);
  if (ok !== true) throw new WhatsAppError("forbidden", 403);
  return data.user.id;
}
const must = <T>(r: { data: T; error: unknown }) => { if (r.error) throw new WhatsAppError("persistence_failed", 503); return r.data; };
/** Config em edição (validada) herdando o cache de modelo da salva. */
function draftConfig(value: unknown, saved: PlatformConfig | null): PlatformConfig {
  if (!value || typeof value !== "object") return saved ?? DEFAULT_CONFIG;
  try {
    const cfg = sanitizeConfig(value as Record<string, unknown>);
    return { ...cfg, resolved_model: saved?.resolved_model, resolved_family: saved?.resolved_family, resolved_at: saved?.resolved_at };
  } catch { throw new WhatsAppError("invalid_request"); }
}
async function resolveFor(db: SupabaseClient, cfg: PlatformConfig, persist: boolean): Promise<ResolvedAI> {
  const key = await platformKey(db, "gemini");
  if (!key) throw new AIError("not_configured", 409);
  // Config ainda não salva: resolve o modelo sem gravar cache (não há linha para atualizar).
  const model = persist ? await effectiveModel(db, cfg, key) : cachedModel(cfg) ?? (await listGeminiModels(key).then(p => (cfg.model_family === "pro" ? p.pro ?? p.flash : p.flash)).catch(() => null)) ?? staleModel(cfg);
  return { mode: "central", cfg, provider: "gemini", model, key, temperature: Number(cfg.temperature), maxTokens: Number(cfg.max_tokens) };
}
const SP = "America/Sao_Paulo";
/** Datas YYYY-MM-DD no fuso de Brasília -> intervalo [from, to+1 dia). */
function period(from: unknown, to: unknown): [string, string] {
  const d = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  const a = d(from), b = d(to);
  if (!a || !b || a > b) throw new WhatsAppError("invalid_request");
  const next = new Date(`${b}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  // Brasil sem horário de verão desde 2019: -03:00 fixo.
  return [`${a}T00:00:00-03:00`, `${next.toISOString().slice(0, 10)}T00:00:00-03:00`];
}

serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await readRequest(req), db = serviceClient();
    const userId = await requireSuperAdmin(req, db);
    switch (body.action) {
      case "get": {
        const [config, hints, limits, usage, salons] = await Promise.all([
          db.from("ai_platform_config").select("*").eq("id", true).maybeSingle(),
          db.rpc("ai_platform_key_hints"),
          db.from("ai_salon_limits").select("*"),
          db.rpc("ai_usage_summary"),
          db.from("salons").select("id,name").order("name").limit(1000),
        ]);
        const cfg = must(config) as PlatformConfig | null;
        return jsonResponse({
          success: true, configured: !!cfg, config: cfg ?? DEFAULT_CONFIG,
          effectiveModel: cfg ? cachedModel(cfg) ?? staleModel(cfg) : DEFAULT_CONFIG.model,
          keys: must(hints) ?? [], limits: must(limits) ?? [], usage: must(usage), salons: must(salons) ?? [],
          envFallback: { gemini: !!Deno.env.get("GEMINI_API_KEY") }, timezone: SP,
        });
      }
      case "save_config": {
        if (!body.config || typeof body.config !== "object") throw new WhatsAppError("invalid_request");
        const saved = await loadPlatformConfig(db);
        const cfg = draftConfig(body.config, saved);
        // Mudou família/modo: invalida o cache para resolver de novo.
        const keepCache = saved && saved.model_family === cfg.model_family && cfg.model_mode === "auto";
        must(await db.from("ai_platform_config").upsert({
          id: true, ...cfg, resolved_model: keepCache ? saved.resolved_model : null, resolved_family: keepCache ? saved.resolved_family : null,
          resolved_at: keepCache ? saved.resolved_at : null, updated_at: new Date().toISOString(), updated_by: userId,
        }));
        return jsonResponse({ success: true });
      }
      case "save_key": {
        const key = typeof body.key === "string" ? body.key.trim() : "";
        if (key.length < 8 || key.length > 500 || /\s/.test(key)) throw new WhatsAppError("invalid_request");
        must(await db.rpc("ai_save_platform_secret", { p_provider: "gemini", p_api_key: key }));
        return jsonResponse({ success: true, last4: key.slice(-4) });
      }
      case "list_models": {
        // Leitura de metadados (sem custo de tokens). Grava o cache se a config já existe.
        const key = await platformKey(db, "gemini");
        if (!key) throw new AIError("not_configured", 409);
        const picked = await listGeminiModels(key);
        const saved = await loadPlatformConfig(db);
        if (saved?.model_mode === "auto") {
          const model = saved.model_family === "pro" ? picked.pro ?? picked.flash : picked.flash;
          if (model) must(await db.from("ai_platform_config").update({ resolved_model: model, resolved_family: saved.model_family, resolved_at: new Date().toISOString() }).eq("id", true));
        }
        return jsonResponse({ success: true, models: picked.models.map(m => ({ id: m.id, displayName: m.displayName, family: m.family })), latest: { flash: picked.flash, pro: picked.pro } });
      }
      case "usage_report": {
        const [from, to] = period(body.from, body.to);
        const group = ["day", "week", "month"].includes(String(body.group)) ? String(body.group) : "day";
        if (body.salonId != null && !validUuid(body.salonId)) throw new WhatsAppError("invalid_request");
        const report = must(await db.rpc("ai_usage_report", { p_from: from, p_to: to, p_group: group, p_salon_id: body.salonId ?? null }));
        return jsonResponse({ success: true, report });
      }
      case "reply_latency": {
        // Tempo de resposta do atendente WhatsApp (recebimento -> envio aceito), últimos 7 dias, todos os salões.
        // v2 inclui atraso da Evolution (horário da mensagem no WhatsApp -> chegada no webhook) e tempo total do cliente.
        const to = new Date(), from = new Date(to.getTime() - 7 * 86_400_000);
        let latency = (await db.rpc("whatsapp_reply_latency_v2", { p_from: from.toISOString(), p_to: to.toISOString() })).data;
        if (!latency) latency = must(await db.rpc("whatsapp_reply_latency", { p_from: from.toISOString(), p_to: to.toISOString() }));
        return jsonResponse({ success: true, latency });
      }
      case "save_limit": {
        if (!validUuid(body.salonId)) throw new WhatsAppError("invalid_request");
        const num = (v: unknown, max: number) => {
          if (v === null || v === undefined || v === "") return null;
          const n = Number(v);
          if (!Number.isInteger(n) || n < 0 || n > max) throw new WhatsAppError("invalid_request");
          return n;
        };
        const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : null;
        must(await db.from("ai_salon_limits").upsert({ salon_id: body.salonId, monthly_requests: num(body.monthlyRequests, 10_000_000), monthly_tokens: num(body.monthlyTokens, 10_000_000_000), blocked: body.blocked === true, note: note || null, updated_at: new Date().toISOString() }));
        return jsonResponse({ success: true });
      }
      case "delete_limit": {
        if (!validUuid(body.salonId)) throw new WhatsAppError("invalid_request");
        must(await db.from("ai_salon_limits").delete().eq("salon_id", body.salonId));
        return jsonResponse({ success: true });
      }
      case "test": {
        // Chamada real e curta. Passa pela reserva (conta no orçamento); funciona com a IA desligada (exceção limitada no banco).
        const saved = await loadPlatformConfig(db);
        const ai = await resolveFor(db, draftConfig(body.config, saved), !!saved);
        const started = Date.now();
        const out = await aiChat(db, ai, { salonId: null, feature: "teste", maxTokens: 256, timeoutMs: 20_000, messages: [{ role: "user", content: "Responda apenas: OK" }] });
        return jsonResponse({ success: true, text: out.text.slice(0, 200), provider: ai.provider, model: ai.model, latencyMs: Date.now() - started, tokens: out.tokensIn + out.tokensOut });
      }
      case "simulate": {
        // Conversa simulada com o treinamento em edição + um salão fictício. Sem ferramentas, sem dados reais. Passa pela reserva.
        const saved = await loadPlatformConfig(db);
        const ai = await resolveFor(db, draftConfig(body.config, saved), !!saved);
        const history = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
        const msgs: AIMessage[] = history.map(m => {
          const role = (m as { role?: string })?.role === "assistant" ? "assistant" : "user";
          const content = String((m as { content?: unknown })?.content ?? "").slice(0, 2000);
          return { role, content } as AIMessage;
        }).filter(m => m.content);
        if (!msgs.length || msgs[msgs.length - 1].role !== "user") throw new WhatsAppError("invalid_request");
        const salon = "Você é a recepção do Studio Exemplo (salão fictício para teste). Serviços: Corte feminino R$ 80 (1h), Escova R$ 50 (40min), Manicure R$ 35 (40min). Horário: seg a sáb, 9h às 19h. Fale português brasileiro. Não invente horários disponíveis: diga que vai consultar a agenda.";
        const out = await aiChat(db, ai, { salonId: null, feature: "simulacao", messages: [{ role: "system", content: composeSystemPrompt(ai.cfg, salon, "simulacao") }, ...msgs] });
        return jsonResponse({ success: true, text: out.text.slice(0, 4096), tokens: out.tokensIn + out.tokensOut, model: ai.model });
      }
      default: throw new WhatsAppError("invalid_request");
    }
  } catch (error) {
    return error instanceof AIError ? aiErrorResponse(error) : errorResponse(error);
  }
});
