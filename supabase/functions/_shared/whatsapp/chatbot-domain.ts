import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { objectValue, WhatsAppError } from "./errors.ts";
import { validUuid } from "./auth.ts";
import { Temporal } from "npm:@js-temporal/polyfill@0.5.1";
import { dayChunk, firstMatches } from "./latency.ts";

/** `typing`: chamado uma vez quando o atendente vai responder (bot ativo, sem pausa humana); best effort. `name`: pushName do WhatsApp. */
export interface BotContext { db: SupabaseClient; salonId: string; phone: string; eventId?: string; preview: boolean; typing?: () => void; name?: string }
export const tools = [
  { type: "function", function: { name: "salon_info", description: "Informações públicas cadastradas do salão.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "services", description: "Serviços ativos, preço e duração reais.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "professionals", description: "Profissionais ativos deste salão.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "available_slots", description: "Horários disponíveis. Só retorna horários, nunca dados de outros clientes.", parameters: { type: "object", properties: { serviceId: { type: "string" }, professionalId: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" } }, required: ["serviceId", "professionalId", "date"], additionalProperties: false } } },
  { type: "function", function: { name: "my_appointments", description: "Somente agendamentos futuros do remetente desta conversa.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "prepare_cancel", description: "Prepara cancelamento de um agendamento do próprio remetente (id vindo de my_appointments). Não cancela: a pessoa precisa responder CONFIRMAR.", parameters: { type: "object", properties: { appointmentId: { type: "string" } }, required: ["appointmentId"], additionalProperties: false } } },
  { type: "function", function: { name: "start_booking", description: "Abre o agendamento guiado (menus de serviço, profissional, data, horário, cadastro e confirmação). Use sempre que a pessoa quiser marcar. serviceId opcional, vindo de services.", parameters: { type: "object", properties: { serviceId: { type: "string" } }, additionalProperties: false } } },
  { type: "function", function: { name: "available_dates", description: "Próximos dias (até 14) com horário livre para o serviço, opcionalmente com um profissional.", parameters: { type: "object", properties: { serviceId: { type: "string" }, professionalId: { type: "string" } }, required: ["serviceId"], additionalProperties: false } } },
  { type: "function", function: { name: "check_coupon", description: "Valida um cupom que a pessoa informou para um serviço. Nunca liste ou sugira códigos.", parameters: { type: "object", properties: { code: { type: "string" }, serviceId: { type: "string" } }, required: ["code", "serviceId"], additionalProperties: false } } },
  { type: "function", function: { name: "prepare_reschedule", description: "Prepara remarcação de um agendamento do próprio remetente para um horário livre (consulte available_slots antes). O horário atual é mantido até a pessoa responder CONFIRMAR.", parameters: { type: "object", properties: { appointmentId: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, start: { type: "string", description: "HH:mm" } }, required: ["appointmentId", "date", "start"], additionalProperties: false } } },
] as const;

const CHANGE_DEADLINE_HOURS = 24;

// Cache por mensagem (ctx nasce a cada evento): evita reler o salão em cada ferramenta/passo do fluxo.
export interface SalonRow { name: string; timezone: string | null; address: string | null; city: string | null; pix_key: string | null; slug?: string | null; phone?: string | null; working_hours?: unknown; opening_time?: string | null; closing_time?: string | null }
const salonCache = new WeakMap<BotContext, Promise<SalonRow>>();
export function salonOf(ctx: BotContext): Promise<SalonRow> {
  let p = salonCache.get(ctx);
  if (!p) {
    p = Promise.resolve(ctx.db.from("salons").select("name,timezone,address,city,pix_key,slug,phone,working_hours,opening_time,closing_time").eq("id", ctx.salonId).single()).then(({ data, error }) => {
      if (error || !data) throw new WhatsAppError("persistence_failed", 503);
      return data as SalonRow;
    });
    p.catch(() => salonCache.delete(ctx)); // falha não fica em cache
    salonCache.set(ctx, p);
  }
  return p;
}
export type GuidedRenderMode = "hybrid" | "numbered" | "native";
export interface AutomationRow {
  booking: boolean; interactive: boolean;
  /** Fluxo guiado (Typebot). Colunas da MIGRATION_TYPEBOT_EVOLUTION_237.sql; ausentes = desligado. */
  guided: boolean; renderMode: GuidedRenderMode; welcome: string | null; confirmation: string | null; info: string | null; handoffHours: number;
}
const GUIDED_COLUMNS = "chatbot_booking_enabled,interactive_enabled,guided_flow_enabled,guided_render_mode,guided_welcome_message,guided_confirmation_message,guided_info_text,guided_handoff_hours";
const autoCache = new WeakMap<BotContext, Promise<AutomationRow>>();
/** whatsapp_automation_settings do salão, lida uma vez por mensagem. Sem a migração do fluxo guiado, relê só as colunas antigas. */
export function automationOf(ctx: BotContext): Promise<AutomationRow> {
  let p = autoCache.get(ctx);
  if (!p) {
    const read = (cols: string) => Promise.resolve(ctx.db.from("whatsapp_automation_settings").select(cols).eq("salon_id", ctx.salonId).maybeSingle());
    p = read(GUIDED_COLUMNS).then(async r => {
      // 42703 = coluna inexistente (migração ainda não aplicada): fallback resiliente às colunas antigas.
      if (r.error && String(r.error.code) === "42703") r = await read("chatbot_booking_enabled,interactive_enabled");
      const { data: raw, error } = r;
      if (error) throw new WhatsAppError("persistence_failed", 503);
      // deno-lint-ignore no-explicit-any
      const data = raw as any;
      const mode = String(data?.guided_render_mode ?? "hybrid");
      const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
      return {
        booking: !!data?.chatbot_booking_enabled, interactive: data?.interactive_enabled !== false,
        guided: !!data?.guided_flow_enabled, renderMode: (mode === "numbered" || mode === "native" ? mode : "hybrid") as GuidedRenderMode,
        welcome: str(data?.guided_welcome_message), confirmation: str(data?.guided_confirmation_message), info: str(data?.guided_info_text),
        handoffHours: Math.min(72, Math.max(1, Number(data?.guided_handoff_hours) || 2)),
      };
    });
    p.catch(() => autoCache.delete(ctx));
    autoCache.set(ctx, p);
  }
  return p;
}
const tzOf = async (ctx: BotContext) => String((await salonOf(ctx)).timezone || "America/Sao_Paulo");
/** Ferramentas só de leitura: podem rodar em paralelo no mesmo turno. */
export const READ_ONLY_TOOLS = new Set(["salon_info", "services", "professionals", "available_slots", "available_dates", "my_appointments", "check_coupon", "start_booking"]);

// Busca só agendamento ativo do próprio telefone; nunca aceita telefone/salão do modelo.
async function ownAppointment(ctx: BotContext, id: unknown) {
  if (!validUuid(id)) return null;
  const { data, error } = await ctx.db.from("appointments")
    .select("id,date,start_time,status,service_id,professional_id,services(name),professionals(name)")
    .eq("id", id).eq("salon_id", ctx.salonId).eq("client_phone", ctx.phone).in("status", ["pending", "confirmed"]).maybeSingle();
  if (error) throw new WhatsAppError("persistence_failed", 503);
  return data;
}

async function withinDeadline(ctx: BotContext, date: string, start: string): Promise<boolean> {
  const tz = await tzOf(ctx);
  const appt = Temporal.PlainDateTime.from(`${date}T${start.slice(0, 5)}`).toZonedDateTime(tz).toInstant();
  return Temporal.Instant.compare(appt, Temporal.Now.instant().add({ hours: CHANGE_DEADLINE_HOURS })) <= 0;
}

async function savePending(ctx: BotContext, proposal: Record<string, unknown>) {
  if (ctx.preview) return;
  const { error } = await ctx.db.from("whatsapp_conversation_state").upsert({ salon_id: ctx.salonId, phone: ctx.phone, pending_action: proposal, pending_action_expires_at: new Date(Date.now() + 600_000).toISOString() }, { onConflict: "salon_id,phone" });
  if (error) throw new WhatsAppError("persistence_failed", 503);
}

const nameOf = (rel: unknown) => (Array.isArray(rel) ? rel[0] : rel as { name?: string } | null)?.name ?? "";

function dateArg(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) throw new WhatsAppError("invalid_request");
  return value;
}
export async function executeBotTool(ctx: BotContext, name: string, raw: unknown): Promise<unknown> {
  const args = objectValue(raw);
  // Nenhum salon_id, telefone alvo, SQL ou campo extra é aceito de um modelo.
  const allowed: Record<string, string[]> = { salon_info: [], services: [], professionals: [], available_slots: ["serviceId", "professionalId", "date"], prepare_booking: ["serviceId", "professionalId", "date", "start", "name"], my_appointments: [], prepare_cancel: ["appointmentId"], prepare_reschedule: ["appointmentId", "date", "start"], start_booking: ["serviceId"], available_dates: ["serviceId", "professionalId"], check_coupon: ["code", "serviceId"] };
  if (!allowed[name] || Object.keys(args).some(k => !allowed[name].includes(k))) throw new WhatsAppError("invalid_request");
  if (name === "salon_info") {
    const { data, error } = await ctx.db.from("salons").select("name,address,city,state,phone,working_hours,opening_time,closing_time,timezone").eq("id", ctx.salonId).single();
    if (error) throw new WhatsAppError("persistence_failed", 503); return data;
  }
  if (name === "services" || name === "professionals") {
    const { data, error } = await ctx.db.from(name).select(name === "services" ? "id,name,price,duration_minutes" : "id,name,specialty").eq("salon_id", ctx.salonId).eq("is_active", true).limit(100);
    if (error) throw new WhatsAppError("persistence_failed", 503); return data;
  }
  if (name === "start_booking") {
    // O fluxo de menus é aberto pelo chatbot (chatbot.ts) depois desta resposta; aqui só valida o argumento.
    if (args.serviceId !== undefined && !validUuid(args.serviceId)) throw new WhatsAppError("invalid_request");
    return { started: true, serviceId: args.serviceId ?? null, instructions: "O menu de agendamento será enviado. Responda só uma frase curta, sem listar opções." };
  }
  if (name === "check_coupon") {
    if (!validUuid(args.serviceId) || typeof args.code !== "string" || args.code.length > 40) throw new WhatsAppError("invalid_request");
    const { data: svc, error: sErr } = await ctx.db.from("services").select("price").eq("id", args.serviceId).eq("salon_id", ctx.salonId).eq("is_active", true).maybeSingle();
    if (sErr) throw new WhatsAppError("persistence_failed", 503);
    if (!svc) throw new WhatsAppError("invalid_request");
    const { data, error } = await ctx.db.rpc("whatsapp_coupon_eval", { p_salon_id: ctx.salonId, p_phone: ctx.phone, p_code: args.code, p_total: svc.price });
    if (error) throw new WhatsAppError("persistence_failed", 503);
    const r = Array.isArray(data) ? data[0] : data;
    return r?.reason ? { valid: false, reason: r.reason } : { valid: true, discount: Number(r?.discount ?? 0), total: Number(svc.price) - Number(r?.discount ?? 0) };
  }
  if (name === "available_dates") {
    if (!validUuid(args.serviceId) || (args.professionalId !== undefined && !validUuid(args.professionalId))) throw new WhatsAppError("invalid_request");
    const [tz, { data: pros, error: pErr }] = await Promise.all([
      tzOf(ctx),
      args.professionalId ? Promise.resolve({ data: [{ id: args.professionalId }], error: null })
        : ctx.db.from("professionals").select("id").eq("salon_id", ctx.salonId).eq("is_active", true).limit(12),
    ]);
    if (pErr) throw new WhatsAppError("persistence_failed", 503);
    const list = (pros ?? []) as { id: string }[];
    const start = Temporal.Now.plainDateISO(tz);
    const days = Array.from({ length: 14 }, (_, i) => start.add({ days: i }).toString());
    // Antes: até 14 × 12 RPCs em sequência. Agora: dias em lotes paralelos, mesmo resultado (7 primeiros com vaga).
    const hasSlot = async (d: string) => (await Promise.all(list.map(async p => {
      const { data: slots, error } = await ctx.db.rpc("get_available_time_slots", { p_salon_id: ctx.salonId, p_service_id: args.serviceId, p_professional_id: p.id, p_date: d });
      if (error) throw new WhatsAppError("persistence_failed", 503);
      return Array.isArray(slots) && slots.length > 0;
    }))).some(Boolean);
    return { dates: await firstMatches(days, hasSlot, 7, dayChunk(list.length)) };
  }
  if (name === "my_appointments") {
    if (ctx.preview) return { notice: "Teste não consulta agendamentos de clientes reais." };
    const today = Temporal.Now.plainDateISO(await tzOf(ctx)).toString();
    const { data, error } = await ctx.db.from("appointments").select("id,date,start_time,status,services(name),professionals(name)").eq("salon_id", ctx.salonId).eq("client_phone", ctx.phone).in("status", ["pending", "confirmed"]).gte("date", today).order("date").order("start_time").limit(5);
    if (error) throw new WhatsAppError("persistence_failed", 503); return data;
  }
  if (name === "prepare_cancel" || name === "prepare_reschedule") {
    if (ctx.preview) return { notice: "Teste não altera agendamentos de clientes reais." };
    const appt = await ownAppointment(ctx, args.appointmentId);
    if (!appt) return { error: "Agendamento não encontrado entre os horários ativos desta pessoa. Use my_appointments e pergunte qual deles." };
    const current = `${nameOf(appt.services)} com ${nameOf(appt.professionals)}, ${appt.date} às ${String(appt.start_time).slice(0, 5)}`;
    if (await withinDeadline(ctx, appt.date, String(appt.start_time))) return { error: `Alterações pelo WhatsApp só até ${CHANGE_DEADLINE_HOURS}h antes. Encaminhe para a equipe.` };
    if (name === "prepare_cancel") {
      await savePending(ctx, { kind: "cancel", appointmentId: appt.id, summary: current });
      return { proposal: true, summary: `Cancelar: ${current}.`, instructions: "Peça para a pessoa responder CONFIRMAR. Nada foi cancelado ainda." };
    }
    const date = dateArg(args.date);
    if (typeof args.start !== "string" || !/^\d{2}:\d{2}$/.test(args.start)) return { error: "Horário inválido. Consulte available_slots." };
    if (await withinDeadline(ctx, date, args.start)) return { error: `O novo horário precisa ser com pelo menos ${CHANGE_DEADLINE_HOURS}h de antecedência.` };
    const { data: slots, error: slotError } = await ctx.db.rpc("get_available_time_slots", { p_salon_id: ctx.salonId, p_service_id: appt.service_id, p_professional_id: appt.professional_id, p_date: date, p_exclude_appointment_id: appt.id });
    if (slotError) throw new WhatsAppError("persistence_failed", 503);
    if (!Array.isArray(slots) || !slots.includes(args.start)) return { error: "Esse horário não está disponível com o mesmo profissional. Ofereça outros horários de available_slots.", slots: slots ?? [] };
    await savePending(ctx, { kind: "reschedule", appointmentId: appt.id, date, start: args.start, summary: current });
    return { proposal: true, summary: `Remarcar ${current} para ${date} às ${args.start}.`, instructions: "Peça para a pessoa responder CONFIRMAR. O horário atual continua reservado até lá." };
  }
  if (!validUuid(args.serviceId) || !validUuid(args.professionalId)) throw new WhatsAppError("invalid_request");
  const date = dateArg(args.date);
  const [{ data: service, error: se }, { data: professional, error: pe }] = await Promise.all([
    ctx.db.from("services").select("id,name,price,duration_minutes").eq("id", args.serviceId).eq("salon_id", ctx.salonId).eq("is_active", true).maybeSingle(),
    ctx.db.from("professionals").select("id,name").eq("id", args.professionalId).eq("salon_id", ctx.salonId).eq("is_active", true).maybeSingle(),
  ]);
  if (se || pe) throw new WhatsAppError("persistence_failed", 503);
  if (!service || !professional) throw new WhatsAppError("invalid_request");
  const { data: slots, error: slotError } = await ctx.db.rpc("get_available_time_slots", { p_salon_id: ctx.salonId, p_service_id: service.id, p_professional_id: professional.id, p_date: date });
  if (slotError) throw new WhatsAppError("persistence_failed", 503);
  if (name === "available_slots") return { date, service: service.name, professional: professional.name, slots: slots ?? [] };
  if (typeof args.start !== "string" || !/^\d{2}:\d{2}$/.test(args.start) || !Array.isArray(slots) || !slots.includes(args.start) || typeof args.name !== "string" || !args.name.trim() || args.name.length > 120) return { error: "Horário indisponível ou nome ausente. Consulte horários novamente." };
  const { data: cfg } = await ctx.db.from("whatsapp_automation_settings").select("chatbot_booking_enabled").eq("salon_id", ctx.salonId).maybeSingle();
  if (!cfg?.chatbot_booking_enabled) return { notice: "Agendamento por chatbot não está habilitado. Encaminhe à equipe." };
  const proposal = { kind: "flow", step: "review", serviceId: service.id, professionalId: professional.id, date, start: args.start, name: args.name.trim(), phone: ctx.phone, requestKey: crypto.randomUUID() };
  if (!ctx.preview) {
    const { error } = await ctx.db.from("whatsapp_conversation_state").upsert({ salon_id: ctx.salonId, phone: ctx.phone, pending_action: proposal, pending_action_expires_at: new Date(Date.now() + 600_000).toISOString() }, { onConflict: "salon_id,phone" });
    if (error) throw new WhatsAppError("persistence_failed", 503);
  }
  return { proposal: true, summary: `${service.name} com ${professional.name}, ${date} às ${args.start}, R$ ${Number(service.price).toFixed(2)}.`, instructions: "Peça para a pessoa responder CONFIRMAR. Nenhuma reserva foi criada; disponibilidade será verificada de novo.", preview: ctx.preview };
}

export function deterministicIntent(text: string): "human" | "opt_out" | "confirm" | "none" {
  const normalized = text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  if (["confirmar", "confirmo"].includes(normalized)) return "confirm";
  if (/^(parar|sair|nao quero (?:mais )?(?:receber )?(?:mensagens|promocoes)|cancelar mensagens)$/.test(normalized)) return "opt_out";
  // "quero agendar para outra pessoa" não é pedido de atendimento humano.
  if (/\b(atendente|humano|pessoa real|uma pessoa|alguem da equipe)\b/.test(normalized) && /\b(falar|chama|chame|chamar|preciso|transferir)\b/.test(normalized)) return "human";
  return "none";
}
