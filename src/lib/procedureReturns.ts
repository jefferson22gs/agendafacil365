import { supabase } from "@/integrations/supabase/client";

/** Opções rápidas de retorno (dias). 0 = sem retorno. */
export const RETURN_PRESETS: { days: number; label: string }[] = [
  { days: 0, label: "Sem retorno" },
  { days: 7, label: "7 dias (1 semana)" },
  { days: 15, label: "15 dias" },
  { days: 30, label: "30 dias (1 mês)" },
  { days: 60, label: "60 dias (2 meses)" },
  { days: 90, label: "90 dias (3 meses - ex: Botox)" },
  { days: 120, label: "120 dias (4 meses)" },
  { days: 180, label: "180 dias (6 meses - ex: Limpeza Dentária)" },
];

export interface ServiceReturnConfig {
  default_return_days?: number | null;
  auto_return_alert?: boolean | null;
  notify_whatsapp?: boolean | null;
  notify_email?: boolean | null;
  notify_push?: boolean | null;
  return_message_template?: string | null;
}

export const RETURN_TEMPLATE_VARS = "{cliente}, {procedimento}, {salao}, {dias}, {data_procedimento}, {link_agendamento}";
export const DEFAULT_RETURN_TEMPLATE =
  "Olá, {cliente}! Já faz {dias} desde seu {procedimento} no {salao} ({data_procedimento}). Está na hora do retorno. Agende: {link_agendamento}";

/** "1 mês", "2 meses", "1 semana", "15 dias". */
export function humanDays(days: number): string {
  if (days >= 30 && days % 30 === 0) return days === 30 ? "1 mês" : `${days / 30} meses`;
  if (days === 7) return "1 semana";
  return days === 1 ? "1 dia" : `${days} dias`;
}

/** Data do alerta (YYYY-MM-DD) = data do atendimento + dias, sem erro de fuso. */
export function returnDate(date: string, days: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(days) || days < 1 || days > 3650) return null;
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function returnPreview(date: string, days: number): string {
  const due = returnDate(date, days);
  if (!due) return "Sem alerta de retorno para este atendimento.";
  return `Alerta de retorno programado para ${due.split("-").reverse().join("/")} (daqui a ${humanDays(days)} do atendimento). O cliente será lembrado automaticamente nessa data.`;
}

/** Erro de coluna/tabela inexistente: migration ainda não aplicada no banco remoto. */
export const isMissingSchema = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (["42703", "42P01", "PGRST204", "PGRST205", "PGRST202", "42883"].includes(e.code ?? "") || /does not exist|schema cache/i.test(e.message ?? ""));

let cached: Promise<boolean> | null = null;
/** true quando as colunas de retorno existem no banco (fallback seguro antes da migration). */
export function returnsAvailable(): Promise<boolean> {
  cached ??= (async () => {
    try { const { error } = await supabase.from("services").select("default_return_days").limit(1); return !isMissingSchema(error); }
    catch { return false; }
  })();
  return cached;
}

export const RETURNS_MIGRATION_NOTICE =
  "Retornos automáticos ainda não estão ativos neste banco. Aplique MIGRATION_RETORNO_WHITELABEL_WCAG.sql no Supabase para habilitar.";
