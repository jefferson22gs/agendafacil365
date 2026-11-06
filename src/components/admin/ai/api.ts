import { supabase } from "@/integrations/supabase/client";

export interface QA { q: string; a: string }
export interface AIConfig {
  enabled: boolean;
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
  base_prompt: string;
  tone: string;
  rules: string;
  knowledge: string;
  examples: QA[];
  monthly_budget_usd: number | null;
  usd_brl: number;
  default_salon_monthly_requests: number | null;
  default_salon_monthly_tokens: number | null;
  on_limit: "fallback" | "handoff";
  fallback_message: string;
  price_in_per_mtok: number | null;
  price_out_per_mtok: number | null;
}
export interface SalonLimit { salon_id: string; monthly_requests: number | null; monthly_tokens: number | null; blocked: boolean; note: string | null }
export interface UsageSummary {
  month: { requests: number; tokens: number; cost_usd: number; errors: number; blocked: number };
  by_day: { day: string; requests: number; cost_usd: number; errors: number }[];
  by_feature: { feature: string; requests: number; tokens: number; cost_usd: number }[];
  by_salon: { salon_id: string; name: string; requests: number; tokens: number; cost_usd: number; errors: number; blocked: number }[];
  last_24h: { requests: number; errors: number };
  last_error: { created_at: string; feature: string; provider: string; model: string; error_code: string } | null;
}
export interface AIAdminState {
  configured: boolean;
  config: AIConfig;
  keys: { provider: string; last4: string; updated_at: string }[];
  limits: SalonLimit[];
  usage: UsageSummary | null;
  salons: { id: string; name: string }[];
  envFallback: { gemini: boolean };
}

export const PROVIDERS = [
  { value: "gemini", name: "Google Gemini", models: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"], help: "Lê imagens (legendas). Chave em aistudio.google.com." },
  { value: "openai", name: "OpenAI", models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1-nano"], help: "Melhor uso de ferramentas no chatbot (agendar, remarcar). Chave em platform.openai.com." },
  { value: "groq", name: "Groq", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"], help: "Muito rápido e barato; não lê imagens. Chave em console.groq.com." },
  { value: "openrouter", name: "OpenRouter", models: ["openai/gpt-4o-mini", "google/gemini-2.5-flash"], help: "Acesso a vários modelos com uma chave. Chave em openrouter.ai." },
];
export const FEATURE_LABEL: Record<string, string> = {
  chatbot: "Chatbot WhatsApp", texto: "Melhorar texto", legenda: "Legenda de imagem", insights: "Insights", teste: "Teste do painel", simulacao: "Simulação",
};
export const LIMIT_REASON: Record<string, string> = {
  disabled: "IA desativada", budget: "orçamento mensal", salon_blocked: "salão bloqueado", salon_requests: "limite de requisições", salon_tokens: "limite de tokens",
};

/** Lê a mensagem amigável que a Edge Function devolve em erros (FunctionsHttpError guarda o Response em context). */
export async function functionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try { const body = await ctx.clone().json(); if (body?.error && body.error !== "demo_unavailable") return String(body.error); } catch { /* corpo não-JSON */ }
  }
  return error instanceof Error && error.message ? error.message : "Não foi possível concluir a operação.";
}

export async function aiAdmin<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("ai-admin", { body: { action, ...payload } });
  if (error) throw new Error(await functionError(error));
  if (!data?.success) throw new Error(data?.error ?? "Não foi possível concluir a operação.");
  return data as T;
}

export const usd = (v: number) => `US$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: Number(v) < 1 ? 4 : 2 })}`;
export const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const int = (v: number) => Number(v || 0).toLocaleString("pt-BR");
/** "" vira null (sem limite); número inválido também. */
export const optionalNumber = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
