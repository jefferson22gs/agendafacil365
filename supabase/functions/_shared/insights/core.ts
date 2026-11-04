import { Temporal } from "npm:@js-temporal/polyfill@0.5.1";

/** Regras puras do Agenda Fácil 365 Insights. Sem banco, sem rede: tudo testável. */

export type ReportKind = "weekly" | "monthly" | "yearly";
export interface Period { start: string; endExclusive: string; label: string }

export interface Metrics {
  start: string; end_exclusive: string;
  completed: number; scheduled_total: number; cuts: number; cancelled: number; no_show: number; open: number;
  revenue: number; expected_revenue: number; unique_clients: number; new_clients: number; unclassified_services: number;
  by_dow: { dow: number; n: number }[]; by_hour: { hour: number; n: number }[];
  by_service: { name: string | null; cat: string; n: number }[];
  top_professional: string | null;
  by_month: { month: string; n: number; revenue: number | null }[] | null;
  first_data_date: string | null;
}

const DOW = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const br = (d: string) => { const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
export const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Último período FECHADO antes de `today` (data local do salão). Fim é exclusivo, sem sobreposição. */
export function lastClosedPeriod(kind: ReportKind, today: Temporal.PlainDate): Period {
  if (kind === "weekly") {
    // Semana de segunda a domingo; fecha no domingo anterior a hoje.
    const thisMonday = today.subtract({ days: today.dayOfWeek - 1 });
    const start = thisMonday.subtract({ weeks: 1 });
    return { start: start.toString(), endExclusive: thisMonday.toString(), label: `${br(start.toString())} a ${br(thisMonday.subtract({ days: 1 }).toString())}` };
  }
  if (kind === "monthly") {
    const first = today.with({ day: 1 });
    const start = first.subtract({ months: 1 });
    return { start: start.toString(), endExclusive: first.toString(), label: `${MONTHS[start.month - 1]} de ${start.year}` };
  }
  const start = Temporal.PlainDate.from({ year: today.year - 1, month: 1, day: 1 });
  return { start: start.toString(), endExclusive: start.add({ years: 1 }).toString(), label: String(start.year) };
}

/** Período anterior equivalente (mesma duração em calendário). */
export function previousPeriod(kind: ReportKind, p: Period): Period {
  const s = Temporal.PlainDate.from(p.start);
  const back = kind === "weekly" ? { weeks: 1 } : kind === "monthly" ? { months: 1 } : { years: 1 };
  const start = s.subtract(back);
  return { start: start.toString(), endExclusive: p.start, label: "" };
}

/** Período corrente em aberto (consultas sob demanda): do início até amanhã (exclusivo). */
export function currentPeriod(kind: ReportKind, today: Temporal.PlainDate): Period {
  const start = kind === "weekly" ? today.subtract({ days: today.dayOfWeek - 1 }) : kind === "monthly" ? today.with({ day: 1 }) : today.with({ month: 1, day: 1 });
  return { start: start.toString(), endExclusive: today.add({ days: 1 }).toString(), label: `${br(start.toString())} até hoje` };
}

/** Variação sem percentuais enganosos: base zero não vira "+∞%". */
export function variation(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "sem movimento nos dois períodos";
  if (previous === 0) return "sem base de comparação no período anterior";
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "estável em relação ao período anterior";
  return `${pct > 0 ? "+" : ""}${pct}% vs período anterior`;
}

export const ticket = (m: Metrics) => (m.completed > 0 ? m.revenue / m.completed : 0);
export const cancelRate = (m: Metrics) => {
  const decided = m.completed + m.cancelled + m.no_show;
  return decided > 0 ? m.cancelled / decided : 0;
};
const peakDay = (m: Metrics) => (m.by_dow[0] ? DOW[m.by_dow[0].dow] : null);
const peakHour = (m: Metrics) => (m.by_hour[0] ? `${String(m.by_hour[0].hour).padStart(2, "0")}h–${String(m.by_hour[0].hour + 1).padStart(2, "0")}h` : null);
const topService = (m: Metrics) => m.by_service[0]?.name?.trim() || null;

/** Recomendação determinística baseada nas métricas; nunca promete resultado. */
export function recommendation(m: Metrics, prev: Metrics): string {
  if (m.completed === 0) return m.open > 0
    ? `Há ${m.open} horário(s) do período ainda como pendente/confirmado. Marque como concluído ou cancelado na agenda para o faturamento aparecer.`
    : "Marque os atendimentos como concluídos na agenda para que os relatórios mostrem números reais.";
  if (cancelRate(m) >= 0.25) return `Os cancelamentos ficaram em ${Math.round(cancelRate(m) * 100)}%. Lembretes automáticos antes do horário podem ajudar a reduzir faltas.`;
  const weakest = [...m.by_dow].sort((a, b) => a.n - b.n)[0];
  if (m.by_dow.length >= 3 && weakest && weakest.n * 2 <= (m.by_dow[0]?.n ?? 0)) return `${DOW[weakest.dow][0].toUpperCase()}${DOW[weakest.dow].slice(1)} teve menos atendimentos que os outros dias. Considere uma ação para esse dia.`;
  if (prev.completed > 0 && m.completed < prev.completed) return "Os atendimentos caíram em relação ao período anterior. Vale conferir a agenda dos próximos dias e chamar clientes que não voltaram.";
  if (m.unclassified_services > 0) return "Alguns serviços ainda não têm categoria. Classifique-os em Serviços para relatórios mais precisos.";
  return "Bom ritmo. Continue acompanhando a agenda e os horários de pico.";
}

function noData(kind: ReportKind, salon: string, p: Period): string {
  const title = kind === "weekly" ? "RESUMO SEMANAL" : kind === "monthly" ? "FECHAMENTO MENSAL" : "RETROSPECTIVA ANUAL";
  return `📊 AGENDA FÁCIL 365 — ${title}\n\nSalão: ${salon}\nPeríodo: ${p.label}\n\nAinda não há atendimentos concluídos neste período.\nQuando os horários forem marcados como concluídos na agenda, os números aparecem aqui.\n\nResponda MENU para outras consultas.`;
}

export function renderReport(kind: ReportKind, salon: string, p: Period, m: Metrics, prev: Metrics, showProfessional: boolean): string {
  if (m.completed === 0 && m.cancelled === 0 && m.open === 0) return noData(kind, salon, p);
  const lines: string[] = [];
  const otherServices = m.completed - m.cuts;
  if (kind === "weekly") {
    lines.push("📊 AGENDA FÁCIL 365 — RESUMO SEMANAL", "", `Salão: ${salon}`, `Período: ${p.label}`, "",
      `💰 Faturamento: ${money(m.revenue)}`, `✂️ Cortes realizados: ${m.cuts}`, `📅 Atendimentos: ${m.completed}`,
      `👥 Clientes atendidos: ${m.unique_clients}`, `📈 Variação: ${variation(m.completed, prev.completed)}`, "");
    if (peakDay(m)) lines.push(`🏆 Dia mais movimentado: ${peakDay(m)}`);
    if (peakHour(m)) lines.push(`⏰ Horário de pico: ${peakHour(m)}`);
    if (topService(m)) lines.push(`⭐ Serviço campeão: ${topService(m)}`);
  } else if (kind === "monthly") {
    lines.push("📊 AGENDA FÁCIL 365 — FECHAMENTO MENSAL", "", `Salão: ${salon}`, `Período: ${p.label}`, "",
      `💰 Faturamento: ${money(m.revenue)} (${variation(m.revenue, prev.revenue)})`,
      `📅 Atendimentos: ${m.completed} (${variation(m.completed, prev.completed)})`,
      `✂️ Cortes: ${m.cuts} · Outros serviços: ${otherServices}`, `🎟️ Ticket médio: ${money(ticket(m))}`,
      `🆕 Novos clientes: ${m.new_clients}`, `❌ Cancelamentos: ${m.cancelled} (${Math.round(cancelRate(m) * 100)}%)`, "");
    if (peakDay(m)) lines.push(`🏆 Melhor dia: ${peakDay(m)}`);
    if (peakHour(m)) lines.push(`⏰ Melhor faixa: ${peakHour(m)}`);
    if (topService(m)) lines.push(`⭐ Serviço campeão: ${topService(m)}`);
  } else {
    const months = (m.by_month ?? []).filter(x => x.n > 0);
    const best = [...months].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))[0];
    const activeMonths = months.length;
    lines.push("📊 AGENDA FÁCIL 365 — RETROSPECTIVA ANUAL", "", `Salão: ${salon}`, `Ano: ${p.label}`);
    if (m.first_data_date && m.first_data_date > p.start) lines.push(`(dados disponíveis a partir de ${br(m.first_data_date)})`);
    lines.push("", `💰 Faturamento total: ${money(m.revenue)}`, `📅 Atendimentos: ${m.completed}`, `✂️ Cortes: ${m.cuts}`,
      `👥 Clientes únicos: ${m.unique_clients}`);
    if (activeMonths > 0) lines.push(`📆 Média mensal: ${money(m.revenue / activeMonths)} (${activeMonths} ${activeMonths === 1 ? "mês" : "meses"} com atendimento)`);
    if (best) { const [y, mo] = best.month.split("-"); lines.push(`🏆 Melhor mês: ${MONTHS[Number(mo) - 1]}/${y}`); }
    if (topService(m)) lines.push(`⭐ Serviço campeão: ${topService(m)}`);
    lines.push(`📈 Crescimento: ${variation(m.revenue, prev.revenue)}`);
  }
  if (showProfessional && m.top_professional && kind !== "weekly") lines.push(`💇 Mais atendimentos: ${m.top_professional}`);
  // Pendente/confirmado não é dinheiro recebido: mostrado à parte, nunca somado ao faturamento.
  if (m.open > 0 && kind !== "yearly") lines.push(`⏳ Sem baixa na agenda: ${m.open} horário(s), ${money(m.expected_revenue)} (não somado ao faturamento)`);
  lines.push("", `💡 Dica: ${recommendation(m, prev)}`, "", "Responda MENU para consultar mais informações.");
  return lines.join("\n").slice(0, 3500);
}

export interface AlertSettings { alert_drop_pct: number; alert_growth_pct: number; alert_cancel_rate_pct: number }
export interface Alert { code: string; text: string }

/** Alertas comparando a última semana fechada com a anterior. Exige volume mínimo para não alarmar à toa. */
export function detectAlerts(m: Metrics, prev: Metrics, cfg: AlertSettings, dowHistory: { date: string; dow: number; n: number }[]): Alert[] {
  const out: Alert[] = [];
  const MIN_BASE = 5;
  if (prev.completed >= MIN_BASE) {
    const change = (m.completed - prev.completed) / prev.completed * 100;
    if (change <= -cfg.alert_drop_pct) out.push({ code: "drop", text: `Os atendimentos da última semana (${m.completed}) ficaram ${Math.round(-change)}% abaixo da semana anterior (${prev.completed}).` });
    if (change >= cfg.alert_growth_pct) out.push({ code: "growth", text: `Os atendimentos da última semana (${m.completed}) ficaram ${Math.round(change)}% acima da semana anterior (${prev.completed}).` });
  }
  const decided = m.completed + m.cancelled + m.no_show;
  if (decided >= MIN_BASE && cancelRate(m) * 100 >= cfg.alert_cancel_rate_pct) out.push({ code: "cancellations", text: `${m.cancelled} de ${decided} horários da última semana foram cancelados (${Math.round(cancelRate(m) * 100)}%).` });
  // Baixa ocupação: último dia X comparado à média dos 3 dias X anteriores.
  const byDow = new Map<number, { date: string; n: number }[]>();
  for (const d of dowHistory) byDow.set(d.dow, [...(byDow.get(d.dow) ?? []), d]);
  for (const [dow, days] of byDow) {
    if (days.length < 4) continue;
    const last = days[days.length - 1], prior = days.slice(-4, -1);
    const avg = prior.reduce((s, x) => s + x.n, 0) / prior.length;
    if (avg >= 4 && last.n <= avg * 0.5) {
      out.push({ code: `low_dow_${dow}`, text: `${DOW[dow][0].toUpperCase()}${DOW[dow].slice(1)} (${br(last.date)}) teve ${last.n} atendimentos, abaixo da média de ${avg.toFixed(1)} das três ${DOW[dow].endsWith("o") ? "últimos" : "últimas"} ${DOW[dow]}s. Considere uma ação para esse dia.` });
      break;
    }
  }
  return out;
}

export function renderAlerts(salon: string, alerts: Alert[]): string {
  return [`🔔 AGENDA FÁCIL 365 — ALERTA`, "", `Salão: ${salon}`, "", ...alerts.map(a => `• ${a.text}`), "", "Não indicamos causa: são observações dos números da agenda.", "Responda MENU para consultar mais informações."].join("\n");
}

export const MENU = [
  "📋 AGENDA FÁCIL 365 — MENU",
  "",
  "RESUMO — semana até agora",
  "SEMANA — última semana fechada",
  "MÊS — último mês fechado",
  "ANO — último ano fechado",
  "AGENDA — horários de hoje",
  "PENDENTES — agendamentos aguardando confirmação",
  "MENU — esta lista",
].join("\n");

export type AdminCommand = "resumo" | "semana" | "mes" | "ano" | "agenda" | "pendentes" | "menu";
export function parseAdminCommand(text: string): AdminCommand | null {
  const n = text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  const map: Record<string, AdminCommand> = { resumo: "resumo", semana: "semana", mes: "mes", ano: "ano", agenda: "agenda", pendentes: "pendentes", menu: "menu", ajuda: "menu" };
  return map[n] ?? null;
}

/** Momento local em que o relatório do período fechado deve sair. */
export function dueAt(kind: ReportKind, p: Period, weeklyDay: number, sendTime: string, tz: string): Temporal.ZonedDateTime {
  let day = Temporal.PlainDate.from(p.endExclusive);
  if (kind === "weekly") while (day.dayOfWeek % 7 !== weeklyDay) day = day.add({ days: 1 });
  const [h, m] = sendTime.split(":").map(Number);
  return day.toZonedDateTime({ timeZone: tz, plainTime: Temporal.PlainTime.from({ hour: h, minute: m }) });
}

/** Janela de 72h após o horário: worker atrasado/reiniciado ainda envia; ativar tarde não manda relatório velho. */
export const DUE_WINDOW_HOURS = 72;
export function isDue(kind: ReportKind, now: Temporal.ZonedDateTime, p: Period, weeklyDay: number, sendTime: string): boolean {
  const at = dueAt(kind, p, weeklyDay, sendTime, now.timeZoneId);
  return Temporal.ZonedDateTime.compare(now, at) >= 0 && Temporal.ZonedDateTime.compare(now, at.add({ hours: DUE_WINDOW_HOURS })) < 0;
}
