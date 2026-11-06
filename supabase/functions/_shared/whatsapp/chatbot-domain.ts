import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { objectValue, WhatsAppError } from "./errors.ts";
import { validUuid } from "./auth.ts";
import { Temporal } from "npm:@js-temporal/polyfill@0.5.1";

export interface BotContext { db: SupabaseClient; salonId: string; phone: string; eventId?: string; preview: boolean }
export const tools = [
  { type: "function", function: { name: "salon_info", description: "Informações públicas cadastradas do salão.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "services", description: "Serviços ativos, preço e duração reais.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "professionals", description: "Profissionais ativos deste salão.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "available_slots", description: "Horários disponíveis. Só retorna horários, nunca dados de outros clientes.", parameters: { type: "object", properties: { serviceId: { type: "string" }, professionalId: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" } }, required: ["serviceId", "professionalId", "date"], additionalProperties: false } } },
  { type: "function", function: { name: "prepare_booking", description: "Prepara proposta sem criar reserva. A pessoa precisa responder CONFIRMAR para finalizar.", parameters: { type: "object", properties: { serviceId: { type: "string" }, professionalId: { type: "string" }, date: { type: "string" }, start: { type: "string", description: "HH:mm" }, name: { type: "string" } }, required: ["serviceId", "professionalId", "date", "start", "name"], additionalProperties: false } } },
  { type: "function", function: { name: "my_appointments", description: "Somente agendamentos futuros do remetente desta conversa.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "prepare_cancel", description: "Prepara cancelamento de um agendamento do próprio remetente (id vindo de my_appointments). Não cancela: a pessoa precisa responder CONFIRMAR.", parameters: { type: "object", properties: { appointmentId: { type: "string" } }, required: ["appointmentId"], additionalProperties: false } } },
  { type: "function", function: { name: "start_booking", description: "Abre o agendamento guiado (menus de serviço, profissional, data, horário, cadastro e confirmação). Use sempre que a pessoa quiser marcar. serviceId opcional, vindo de services.", parameters: { type: "object", properties: { serviceId: { type: "string" } }, additionalProperties: false } } },
  { type: "function", function: { name: "available_dates", description: "Próximos dias (até 14) com horário livre para o serviço, opcionalmente com um profissional.", parameters: { type: "object", properties: { serviceId: { type: "string" }, professionalId: { type: "string" } }, required: ["serviceId"], additionalProperties: false } } },
  { type: "function", function: { name: "check_coupon", description: "Valida um cupom que a pessoa informou para um serviço. Nunca liste ou sugira códigos.", parameters: { type: "object", properties: { code: { type: "string" }, serviceId: { type: "string" } }, required: ["code", "serviceId"], additionalProperties: false } } },
  { type: "function", function: { name: "prepare_reschedule", description: "Prepara remarcação de um agendamento do próprio remetente para um horário livre (consulte available_slots antes). O horário atual é mantido até a pessoa responder CONFIRMAR.", parameters: { type: "object", properties: { appointmentId: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, start: { type: "string", description: "HH:mm" } }, required: ["appointmentId", "date", "start"], additionalProperties: false } } },
] as const;

const CHANGE_DEADLINE_HOURS = 24;

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
  const { data, error } = await ctx.db.from("salons").select("timezone").eq("id", ctx.salonId).single();
  if (error) throw new WhatsAppError("persistence_failed", 503);
  const tz = String(data.timezone || "America/Sao_Paulo");
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
    const { data: salon, error: tzError } = await ctx.db.from("salons").select("timezone").eq("id", ctx.salonId).single();
    if (tzError) throw new WhatsAppError("persistence_failed", 503);
    const { data: pros, error: pErr } = args.professionalId ? { data: [{ id: args.professionalId }], error: null }
      : await ctx.db.from("professionals").select("id").eq("salon_id", ctx.salonId).eq("is_active", true).limit(12);
    if (pErr) throw new WhatsAppError("persistence_failed", 503);
    const start = Temporal.Now.plainDateISO(String(salon.timezone || "America/Sao_Paulo"));
    const dates: string[] = [];
    for (let i = 0; i < 14 && dates.length < 7; i++) {
      const d = start.add({ days: i }).toString();
      for (const p of (pros ?? []) as { id: string }[]) {
        const { data: slots, error } = await ctx.db.rpc("get_available_time_slots", { p_salon_id: ctx.salonId, p_service_id: args.serviceId, p_professional_id: p.id, p_date: d });
        if (error) throw new WhatsAppError("persistence_failed", 503);
        if (Array.isArray(slots) && slots.length) { dates.push(d); break; }
      }
    }
    return { dates };
  }
  if (name === "my_appointments") {
    if (ctx.preview) return { notice: "Teste não consulta agendamentos de clientes reais." };
    const { data: salon, error: tzError } = await ctx.db.from("salons").select("timezone").eq("id", ctx.salonId).single();
    if (tzError) throw new WhatsAppError("persistence_failed", 503);
    const today = Temporal.Now.plainDateISO(String(salon.timezone || "America/Sao_Paulo")).toString();
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
  const proposal = { kind: "booking", serviceId: service.id, professionalId: professional.id, date, start: args.start, name: args.name.trim(), requestKey: crypto.randomUUID() };
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
