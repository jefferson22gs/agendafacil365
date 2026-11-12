import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Temporal } from "npm:@js-temporal/polyfill@0.5.1";
import { WhatsAppError } from "../whatsapp/errors.ts";
import {
  type AdminCommand, type Metrics, type Period, type ReportKind,
  currentPeriod, detectAlerts, lastClosedPeriod, MENU, previousPeriod, renderAlerts, renderReport, isDue,
} from "./core.ts";

export interface SalonCtx { db: SupabaseClient; salonId: string }
interface Settings {
  weekly_enabled: boolean; monthly_enabled: boolean; yearly_enabled: boolean; alerts_enabled: boolean;
  weekly_day: number; send_time: string; show_professional_ranking: boolean;
  alert_drop_pct: number; alert_growth_pct: number; alert_cancel_rate_pct: number; alert_cooldown_days: number;
}

export async function salonInfo({ db, salonId }: SalonCtx) {
  const { data, error } = await db.from("salons").select("name,timezone").eq("id", salonId).single();
  if (error) throw new WhatsAppError("persistence_failed", 503);
  return { name: String(data.name), tz: String(data.timezone || "America/Sao_Paulo") };
}

export async function metrics({ db, salonId }: SalonCtx, p: Period): Promise<Metrics> {
  const { data, error } = await db.rpc("insights_metrics", { p_salon_id: salonId, p_start: p.start, p_end: p.endExclusive });
  if (error || !data) throw new WhatsAppError("persistence_failed", 503);
  return data as Metrics;
}

/** Texto do relatório de um período, sempre a partir do banco do próprio salão. */
export async function buildReport(ctx: SalonCtx, kind: ReportKind, mode: "closed" | "current", showProfessional = true) {
  const salon = await salonInfo(ctx);
  const today = Temporal.Now.plainDateISO(salon.tz);
  const period = mode === "closed" ? lastClosedPeriod(kind, today) : currentPeriod(kind, today);
  // Período corrente compara com o mesmo intervalo do período anterior (até o mesmo dia).
  const prev = mode === "closed" ? previousPeriod(kind, period) : (() => {
    const back = kind === "weekly" ? { weeks: 1 } : kind === "monthly" ? { months: 1 } : { years: 1 };
    return { start: Temporal.PlainDate.from(period.start).subtract(back).toString(), endExclusive: Temporal.PlainDate.from(period.endExclusive).subtract(back).toString(), label: "" };
  })();
  const [m, pm] = await Promise.all([metrics(ctx, period), metrics(ctx, prev)]);
  return { period, metrics: m, previous: pm, text: renderReport(kind, salon.name, period, m, pm, showProfessional), salon };
}

async function instanceId({ db, salonId }: SalonCtx): Promise<string | null> {
  const { data, error } = await db.rpc("whatsapp_instance_for", { p_salon_id: salonId, p_purpose: "chat" });
  if (error) throw new WhatsAppError("persistence_failed", 503);
  return (data as string | null) ?? null;
}

export async function verifiedRecipients({ db, salonId }: SalonCtx) {
  const { data, error } = await db.from("insights_recipients").select("id,phone").eq("salon_id", salonId).not("verified_at", "is", null);
  if (error) throw new WhatsAppError("persistence_failed", 503);
  return data ?? [];
}

/**
 * Registra o relatório e enfileira no outbox. A chave única do relatório impede reenvio
 * do mesmo período mesmo se o worker rodar de novo ou reiniciar.
 */
export async function deliver(ctx: SalonCtx, opts: { kind: string; period: Period; dedupeKey: string; metrics: unknown; text: string; recipient: { id: string; phone: string } }) {
  const { db, salonId } = ctx;
  const { data: existing, error: lookupError } = await db.from("insights_reports").select("id,status").eq("salon_id", salonId).eq("dedupe_key", opts.dedupeKey).maybeSingle();
  if (lookupError) throw new WhatsAppError("persistence_failed", 503);
  if (existing) return { status: "duplicate" as const };
  const inst = await instanceId(ctx);
  const row = { salon_id: salonId, recipient_id: opts.recipient.id, kind: opts.kind, period_start: opts.period.start, period_end: opts.period.endExclusive, dedupe_key: opts.dedupeKey, metrics: opts.metrics, message: opts.text };
  if (!inst) {
    const { error } = await db.from("insights_reports").insert({ ...row, status: "skipped", error_code: "instance_missing" });
    if (error && error.code !== "23505") throw new WhatsAppError("persistence_failed", 503);
    return { status: "skipped" as const };
  }
  // Insere o relatório primeiro: conflito = outro worker já pegou este período.
  const { data: report, error: insertError } = await db.from("insights_reports").insert(row).select("id").single();
  if (insertError) {
    if (insertError.code === "23505") return { status: "duplicate" as const };
    throw new WhatsAppError("persistence_failed", 503);
  }
  const { data: out, error: outError } = await db.from("whatsapp_outbox").upsert({
    salon_id: salonId, instance_id: inst, idempotency_key: `insights:${opts.dedupeKey}`.slice(0, 200), category: "administrative",
    recipient_phone: opts.recipient.phone, text_content: opts.text,
  }, { onConflict: "salon_id,idempotency_key", ignoreDuplicates: true }).select("id").maybeSingle();
  if (outError) {
    await db.from("insights_reports").update({ status: "failed", error_code: "outbox_failed" }).eq("id", report.id);
    throw new WhatsAppError("persistence_failed", 503);
  }
  if (out?.id) await db.from("insights_reports").update({ outbox_id: out.id }).eq("id", report.id);
  return { status: "queued" as const, reportId: report.id };
}

/** Executa relatórios e alertas vencidos de um salão. Idempotente por período. */
export async function runScheduled(ctx: SalonCtx, s: Settings, now = Temporal.Now.instant()) {
  const salon = await salonInfo(ctx);
  const zoned = now.toZonedDateTimeISO(salon.tz);
  const today = zoned.toPlainDate();
  const recipients = await verifiedRecipients(ctx);
  if (!recipients.length) return { sent: 0, reason: "no_recipient" };
  let sent = 0;
  const kinds: [ReportKind, boolean][] = [["weekly", s.weekly_enabled], ["monthly", s.monthly_enabled], ["yearly", s.yearly_enabled]];
  for (const [kind, enabled] of kinds) {
    if (!enabled) continue;
    const period = lastClosedPeriod(kind, today);
    if (!isDue(kind, zoned, period, s.weekly_day, s.send_time)) continue;
    const prev = previousPeriod(kind, period);
    const [m, pm] = await Promise.all([metrics(ctx, period), metrics(ctx, prev)]);
    const text = renderReport(kind, salon.name, period, m, pm, s.show_professional_ranking);
    for (const r of recipients) {
      const res = await deliver(ctx, { kind, period, dedupeKey: `${kind}:${period.start}:${r.id}`, metrics: { current: m, previous: pm }, text, recipient: r });
      if (res.status === "queued") sent++;
    }
  }
  if (s.alerts_enabled) {
    const period = lastClosedPeriod("weekly", today);
    // Alertas saem junto com a janela do semanal (dia/hora configurados), mesmo sem o resumo ligado.
    if (isDue("weekly", zoned, period, s.weekly_day, s.send_time)) {
      const prev = previousPeriod("weekly", period);
      const [m, pm, hist] = await Promise.all([
        metrics(ctx, period), metrics(ctx, prev),
        ctx.db.rpc("insights_dow_history", { p_salon_id: ctx.salonId, p_until: period.endExclusive, p_weeks: 4 }).then(r => { if (r.error) throw new WhatsAppError("persistence_failed", 503); return r.data ?? []; }),
      ]);
      const alerts = detectAlerts(m, pm, s, hist);
      // Cooldown por tipo de alerta: não repetir o mesmo aviso dentro da janela configurada.
      const since = today.subtract({ days: s.alert_cooldown_days }).toString();
      const { data: recent, error } = await ctx.db.from("insights_reports").select("metrics").eq("salon_id", ctx.salonId).eq("kind", "alert").gte("period_start", since);
      if (error) throw new WhatsAppError("persistence_failed", 503);
      const recentCodes = new Set((recent ?? []).flatMap(r => ((r.metrics as { codes?: string[] })?.codes ?? [])));
      const fresh = alerts.filter(a => !recentCodes.has(a.code));
      if (fresh.length) {
        const text = renderAlerts(salon.name, fresh);
        for (const r of recipients) {
          const res = await deliver(ctx, { kind: "alert", period, dedupeKey: `alert:${period.start}:${r.id}`, metrics: { codes: fresh.map(a => a.code) }, text, recipient: r });
          if (res.status === "queued") sent++;
        }
      }
    }
  }
  return { sent };
}

/** Resposta a comandos administrativos. Remetente já validado como destinatário verificado do salão. */
export async function answerCommand(ctx: SalonCtx, cmd: AdminCommand, showProfessional: boolean): Promise<string> {
  if (cmd === "menu") return MENU;
  if (cmd === "resumo") return (await buildReport(ctx, "weekly", "current", showProfessional)).text.replace("RESUMO SEMANAL", "RESUMO DA SEMANA (parcial)");
  if (cmd === "semana") return (await buildReport(ctx, "weekly", "closed", showProfessional)).text;
  if (cmd === "mes") return (await buildReport(ctx, "monthly", "closed", showProfessional)).text;
  if (cmd === "ano") return (await buildReport(ctx, "yearly", "closed", showProfessional)).text;
  const salon = await salonInfo(ctx);
  const today = Temporal.Now.plainDateISO(salon.tz).toString();
  if (cmd === "agenda") {
    const { data, error } = await ctx.db.from("appointments").select("start_time,status,client_name,services(name),professionals(name)")
      .eq("salon_id", ctx.salonId).eq("date", today).in("status", ["pending", "confirmed", "completed"]).order("start_time").limit(40);
    if (error) throw new WhatsAppError("persistence_failed", 503);
    if (!data?.length) return `📅 Agenda de hoje (${today.split("-").reverse().join("/")}): nenhum horário marcado.`;
    const n = (r: unknown) => (Array.isArray(r) ? r[0] : r as { name?: string } | null)?.name ?? "";
    return [`📅 Agenda de hoje — ${data.length} horário(s)`, "", ...data.map(a => `${String(a.start_time).slice(0, 5)} · ${a.client_name ?? "Cliente"} · ${n(a.services)}${n(a.professionals) ? ` (${n(a.professionals)})` : ""}${a.status === "pending" ? " · pendente" : a.status === "completed" ? " · concluído" : ""}`)].join("\n").slice(0, 3500);
  }
  const { data, error } = await ctx.db.from("appointments").select("date,start_time,client_name,services(name)")
    .eq("salon_id", ctx.salonId).eq("status", "pending").gte("date", today).order("date").order("start_time").limit(20);
  if (error) throw new WhatsAppError("persistence_failed", 503);
  if (!data?.length) return "✅ Nenhum agendamento aguardando confirmação.";
  const n = (r: unknown) => (Array.isArray(r) ? r[0] : r as { name?: string } | null)?.name ?? "";
  return [`⏳ Pendentes de confirmação — ${data.length}`, "", ...data.map(a => `${a.date.split("-").reverse().join("/")} ${String(a.start_time).slice(0, 5)} · ${a.client_name ?? "Cliente"} · ${n(a.services)}`), "", "Confirme pela agenda do Agenda Fácil 365."].join("\n");
}
