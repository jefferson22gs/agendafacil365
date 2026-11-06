// Painel de IA do super admin: config central, chave (nunca devolvida), limites, consumo, teste e simulação.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requiredEnv, serviceClient, validUuid } from "../_shared/whatsapp/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, readRequest, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { aiChat, AIError, aiErrorResponse, loadPlatformConfig, platformKey, type ResolvedAI } from "../_shared/ai/gateway.ts";
import { CENTRAL_PROVIDERS, composeSystemPrompt, DEFAULT_CONFIG, sanitizeConfig, type AIMessage, type PlatformConfig } from "../_shared/ai/core.ts";

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
function draftConfig(value: unknown, saved: PlatformConfig | null): PlatformConfig {
  if (!value || typeof value !== "object") return saved ?? DEFAULT_CONFIG;
  try { return sanitizeConfig(value as Record<string, unknown>); } catch { throw new WhatsAppError("invalid_request"); }
}
async function resolveFor(db: SupabaseClient, cfg: PlatformConfig): Promise<ResolvedAI> {
  const key = await platformKey(db, cfg.provider);
  if (!key) throw new AIError("not_configured", 409);
  return { mode: "central", cfg, provider: cfg.provider, model: cfg.model, key, temperature: Number(cfg.temperature), maxTokens: Number(cfg.max_tokens) };
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
          db.rpc("ai_usage_summary", { p_days: 30 }),
          db.from("salons").select("id,name").order("name").limit(1000),
        ]);
        return jsonResponse({
          success: true, configured: !!must(config), config: must(config) ?? DEFAULT_CONFIG,
          keys: must(hints) ?? [], limits: must(limits) ?? [], usage: must(usage), salons: must(salons) ?? [],
          envFallback: { gemini: !!Deno.env.get("GEMINI_API_KEY") },
        });
      }
      case "save_config": {
        if (!body.config || typeof body.config !== "object") throw new WhatsAppError("invalid_request");
        const cfg = draftConfig(body.config, null);
        must(await db.from("ai_platform_config").upsert({ id: true, ...cfg, updated_at: new Date().toISOString(), updated_by: userId }));
        return jsonResponse({ success: true });
      }
      case "save_key": {
        const provider = String(body.provider), key = typeof body.key === "string" ? body.key.trim() : "";
        if (!CENTRAL_PROVIDERS.includes(provider) || key.length < 8 || key.length > 500 || /\s/.test(key)) throw new WhatsAppError("invalid_request");
        must(await db.rpc("ai_save_platform_secret", { p_provider: provider, p_api_key: key }));
        return jsonResponse({ success: true, last4: key.slice(-4) });
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
        // Chamada real e curta com a config em edição (ou a salva). Não passa pela cota, mas é registrada.
        const ai = await resolveFor(db, draftConfig(body.config, await loadPlatformConfig(db)));
        const started = Date.now();
        const out = await aiChat(db, ai, { salonId: null, feature: "teste", maxTokens: 50, timeoutMs: 15_000, messages: [{ role: "user", content: "Responda apenas: OK" }] });
        return jsonResponse({ success: true, text: out.text.slice(0, 200), provider: ai.provider, model: ai.model, latencyMs: Date.now() - started, tokens: out.tokensIn + out.tokensOut });
      }
      case "simulate": {
        // Conversa simulada com o treinamento em edição + um salão fictício. Sem ferramentas, sem dados reais.
        const ai = await resolveFor(db, draftConfig(body.config, await loadPlatformConfig(db)));
        const history = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
        const msgs: AIMessage[] = history.map(m => {
          const role = (m as { role?: string })?.role === "assistant" ? "assistant" : "user";
          const content = String((m as { content?: unknown })?.content ?? "").slice(0, 2000);
          return { role, content } as AIMessage;
        }).filter(m => m.content);
        if (!msgs.length || msgs[msgs.length - 1].role !== "user") throw new WhatsAppError("invalid_request");
        const salon = "Você é a recepção do Studio Exemplo (salão fictício para teste). Serviços: Corte feminino R$ 80 (1h), Escova R$ 50 (40min), Manicure R$ 35 (40min). Horário: seg a sáb, 9h às 19h. Fale português brasileiro. Não invente horários disponíveis: diga que vai consultar a agenda.";
        const out = await aiChat(db, ai, { salonId: null, feature: "simulacao", messages: [{ role: "system", content: composeSystemPrompt(ai.cfg, salon, "simulacao") }, ...msgs] });
        return jsonResponse({ success: true, text: out.text.slice(0, 4096), tokens: out.tokensIn + out.tokensOut });
      }
      default: throw new WhatsAppError("invalid_request");
    }
  } catch (error) {
    return error instanceof AIError ? aiErrorResponse(error) : errorResponse(error);
  }
});
