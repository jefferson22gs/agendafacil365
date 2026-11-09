import { supabase } from "@/integrations/supabase/client";

export interface QA { q: string; a: string }
export interface AIConfig {
  enabled: boolean;
  provider: "gemini";
  model_mode: "auto" | "fixed";
  model_family: "flash" | "pro";
  model: string;
  thinking_level: "LOW" | "MEDIUM" | "HIGH";
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
  price_cache_per_mtok: number | null;
  resolved_model?: string | null;
  resolved_at?: string | null;
}
export interface SalonLimit { salon_id: string; monthly_requests: number | null; monthly_tokens: number | null; blocked: boolean; note: string | null }
export interface UsageSummary {
  month: { requests: number; tokens: number; cost_usd: number; errors: number; blocked: number; stuck: number };
  by_salon: { salon_id: string; requests: number; tokens: number }[];
  last_24h: { requests: number; errors: number };
  last_error: { created_at: string; feature: string; provider: string; model: string; error_code: string } | null;
}
export interface AIAdminState {
  configured: boolean;
  config: AIConfig;
  effectiveModel: string;
  keys: { provider: string; last4: string; updated_at: string }[];
  limits: SalonLimit[];
  usage: UsageSummary | null;
  salons: { id: string; name: string }[];
  envFallback: { gemini: boolean };
}
export interface ModelInfo { id: string; displayName: string; family: "flash" | "pro" | null }

export interface ReportRow { requests: number; tokens_in: number; tokens_out: number; cost_usd: number; errors: number }
export interface UsageReport {
  from: string; to: string; group: "day" | "week" | "month";
  totals: ReportRow & { tokens_cached: number; tokens_thoughts: number; blocked: number; pending: number };
  series: (ReportRow & { bucket: string })[];
  by_feature: (ReportRow & { feature: string })[];
  by_model: { model: string; requests: number; cost_usd: number }[];
  ranking: (ReportRow & { salon_id: string; name: string; blocked: number; pct_cost: number; ai_replies: number; plain_replies: number; avg_cost_per_conversation: number | null })[];
  messages: { chatbot_ai: number; chatbot_plain: number; chatbot_plain_by_kind: Record<string, number>; automations_by_category: Record<string, number> };
}

/** whatsapp_reply_latency: do recebimento ao envio aceito da 1ª mensagem da resposta (ms). */
export interface ReplyLatency {
  replies: number; p50_ms: number | null; p95_ms: number | null; max_ms: number | null;
  processing_p50_ms: number | null; processing_p95_ms: number | null; not_sent: number;
  evolution_samples?: number; evolution_p50_ms?: number | null; evolution_p95_ms?: number | null;
  phone_to_reply_p50_ms?: number | null; phone_to_reply_p95_ms?: number | null;
}
/** 1234 -> "1,2 s"; 75000 -> "1 min 15 s". */
export const seconds = (ms: number | null | undefined) => {
  if (ms == null || !Number.isFinite(Number(ms))) return "—";
  const s = Number(ms) / 1000;
  if (s < 60) return `${s.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
  return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
};

export const FEATURE_LABEL: Record<string, string> = {
  chatbot: "Chatbot WhatsApp", texto: "Melhorar texto", legenda: "Legenda de imagem", insights: "Insights", teste: "Teste do painel", simulacao: "Simulação",
};
export const LIMIT_REASON: Record<string, string> = {
  disabled: "IA desativada", budget: "orçamento mensal", salon_blocked: "salão bloqueado", salon_requests: "limite de requisições", salon_tokens: "limite de tokens",
};
/** Respostas do chatbot sem IA (motivo gravado em ai_reply_log.kind). */
export const PLAIN_KIND_LABEL: Record<string, string> = {
  booking: "Agendamento confirmado", cancelled: "Cancelamento", rescheduled: "Remarcação", handoff: "Encaminhado à equipe", opt_out: "Saída de campanhas",
  out_of_hours: "Fora do horário", missing_provider: "IA sem chave", tool_limit: "Limite de ferramentas", expired: "Proposta expirada",
  booking_conflict: "Horário indisponível", reschedule_conflict: "Remarcação indisponível", change_deadline: "Prazo de 24h", cancel_failed: "Falha ao cancelar",
  cancel_noop: "Nada a alterar", not_configured: "Chatbot não configurado", disabled: "Agendamento automático desligado",
};
export const AUTOMATION_LABEL: Record<string, string> = {
  transactional: "Avisos de agendamento (confirmação, lembrete, PIX)", marketing: "Campanhas e aniversários", administrative: "Mensagens administrativas", status: "Status do WhatsApp",
};
export const plainKindLabel = (k: string) => PLAIN_KIND_LABEL[k] ?? (k.startsWith("limit_") ? `Limite de IA (${LIMIT_REASON[k.slice(6)] ?? k.slice(6)})` : k.startsWith("insights_") ? "Relatório Insights" : k);

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

/** Data YYYY-MM-DD no fuso de Brasília. */
export const spDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
export type PeriodPreset = "today" | "7d" | "30d" | "month" | "prev_month" | "custom";
/** Período pronto -> [de, até] inclusivos, no fuso de Brasília. */
export function presetRange(p: Exclude<PeriodPreset, "custom">, now = new Date()): [string, string] {
  const today = spDate(now);
  const shift = (days: number) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
  if (p === "today") return [today, today];
  if (p === "7d") return [shift(-6), today];
  if (p === "30d") return [shift(-29), today];
  const [y, m] = today.split("-").map(Number);
  if (p === "month") return [`${today.slice(0, 7)}-01`, today];
  const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return [`${py}-${String(pm).padStart(2, "0")}-01`, `${py}-${String(pm).padStart(2, "0")}-${last}`];
}

/** CSV com ";" e BOM (Excel pt-BR), campos sempre entre aspas e neutralização de fórmula. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return "﻿" + rows.map(r => r.map(cell).join(";")).join("\r\n");
}
export function downloadCsv(name: string, rows: Parameters<typeof toCsv>[0]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
