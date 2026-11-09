// Atendente: fluxo de agendamento por WhatsApp igual ao link público, guiado por menus clicáveis.
// Determinístico (não chama IA): a IA só conversa livremente e chama start_booking para abrir o fluxo.
// Identidade (salão/telefone) vem do evento autenticado; o cliente só escolhe entre opções que o servidor gerou.
import { WhatsAppError } from "./errors.ts";
import { automationOf, salonOf, type BotContext } from "./chatbot-domain.ts";
import { dayChunk, firstMatches } from "./latency.ts";
import { Temporal } from "npm:@js-temporal/polyfill@0.5.1";
import {
  brazilPhone, brl, buildMenu, dateBR, fullName, numberedText, parseBirthDate, resolveChoice, weekday, yesNo, evolutionBody,
  premiumPoll, type Menu, type Option, type StoredMenu,
} from "./interactive.ts";
import { bookingPix, receivePaymentProof } from "../pix/payment.ts";

export type OutMessage =
  | { type: "text"; text: string }
  | { type: "interactive"; text: string; payload: Record<string, unknown> }
  | { type: "image"; text: string; media_path: string; media_mime: string; media_filename: string };

export interface Flow {
  kind: "flow";
  step: "service" | "professional" | "date" | "time" | "name" | "phone_confirm" | "phone" | "birth" | "coupon" | "review" | "payment" | "proof";
  serviceId?: string; professionalId?: string | null; date?: string; start?: string;
  name?: string; phone?: string; birth?: string | null; coupon?: string | null;
  known?: { name: boolean; birth: boolean };
  appointmentId?: string; requestKey?: string;
  menu?: StoredMenu | null;
}
export interface Input { text: string; selection?: string | null; media?: unknown }
export interface FlowReply { messages: OutMessage[]; state: Flow | null; model: string }

const FLOW_TTL_MS = 30 * 60_000, DATE_DAYS = 21;
const nonce = () => Math.random().toString(36).slice(2, 8).padEnd(6, "0");
const fail = () => { throw new WhatsAppError("persistence_failed", 503); };

/** Menu + texto: interativo quando ligado (fallback numerado vai no text_content do outbox); senão só texto. */
export function menuMessage(menu: Menu, interactive: boolean, salon?: string): OutMessage {
  const text = numberedText(menu);
  if (!interactive) return { type: "text", text };
  if (salon !== undefined) {
    const payload = premiumPoll(menu, salon);
    return payload ? { type: "interactive", text, payload } : { type: "text", text };
  }
  const { op, body } = evolutionBody(menu, "");
  delete (body as Record<string, unknown>).number;
  return { type: "interactive", text, payload: { op, body } };
}

/** Uma leitura do salão por mensagem (cache em salonOf). */
const salonRow = (ctx: BotContext) => salonOf(ctx);
const settings = (ctx: BotContext) => automationOf(ctx);
async function services(ctx: BotContext) {
  const { data, error } = await ctx.db.from("services").select("id,name,price,duration_minutes").eq("salon_id", ctx.salonId).eq("is_active", true).order("name").limit(60);
  if (error) fail();
  return (data ?? []) as { id: string; name: string; price: number; duration_minutes: number }[];
}
/** Profissionais ativos que fazem o serviço (sem vínculo cadastrado = todos, igual ao link público). */
// Cache por mensagem: a busca de datas consulta "qualquer profissional" em até 21 dias e relia isto a cada dia.
const prosCache = new WeakMap<BotContext, Map<string, ReturnType<typeof loadProfessionalsFor>>>();
function professionalsFor(ctx: BotContext, serviceId: string) {
  let m = prosCache.get(ctx);
  if (!m) prosCache.set(ctx, m = new Map());
  let p = m.get(serviceId);
  if (!p) { p = loadProfessionalsFor(ctx, serviceId); p.catch(() => m!.delete(serviceId)); m.set(serviceId, p); }
  return p;
}
async function loadProfessionalsFor(ctx: BotContext, serviceId: string) {
  const [{ data: pros, error: pe }, { data: links, error: le }] = await Promise.all([
    ctx.db.from("professionals").select("id,name,specialty").eq("salon_id", ctx.salonId).eq("is_active", true).order("name").limit(40),
    ctx.db.from("professional_services").select("professional_id").eq("service_id", serviceId).limit(200),
  ]);
  if (pe || le) fail();
  const ids = new Set((links ?? []).map((l: { professional_id: string }) => l.professional_id));
  return ((pros ?? []) as { id: string; name: string; specialty: string | null }[]).filter(p => !ids.size || ids.has(p.id));
}
async function slots(ctx: BotContext, serviceId: string, professionalId: string, date: string): Promise<string[]> {
  const { data, error } = await ctx.db.rpc("get_available_time_slots", { p_salon_id: ctx.salonId, p_service_id: serviceId, p_professional_id: professionalId, p_date: date });
  if (error) fail();
  return Array.isArray(data) ? data as string[] : [];
}
/** Horários livres: um profissional ou união de "qualquer um" (mesma regra da RPC v2). */
async function freeTimes(ctx: BotContext, f: Flow): Promise<string[]> {
  if (f.professionalId) return slots(ctx, f.serviceId!, f.professionalId, f.date!);
  const pros = await professionalsFor(ctx, f.serviceId!);
  const all = await Promise.all(pros.slice(0, 12).map(p => slots(ctx, f.serviceId!, p.id, f.date!)));
  return [...new Set(all.flat())].sort();
}

function today(tz: string) { return Temporal.Now.plainDateISO(tz); }

async function step(ctx: BotContext, f: Flow, interactive: boolean, page = 0, intro = ""): Promise<FlowReply> {
  const n = nonce(), pre = intro ? `${intro}\n\n` : "", salonName = (await salonRow(ctx)).name;
  const ask = (title: string, body: string, opts: Option[]): FlowReply => {
    const { menu, stored } = buildMenu(n, f.step, title, pre + body, opts, page);
    return { messages: [menuMessage(menu, interactive, salonName)], state: { ...f, menu: stored }, model: `flow_${f.step}` };
  };
  const say = (text: string): FlowReply => ({ messages: [{ type: "text", text: pre + text }], state: { ...f, menu: null }, model: `flow_${f.step}` });
  if (f.step === "service") {
    const list = await services(ctx);
    if (!list.length) return { messages: [{ type: "text", text: "Ainda não temos serviços disponíveis para agendar por aqui. Vou pedir para a equipe te ajudar." }], state: null, model: "flow_no_services" };
    return ask("Serviços", "Qual serviço você quer agendar?", list.map(s => ({ title: s.name, description: `${brl(s.price)} · ${s.duration_minutes} min`, value: { id: s.id } })));
  }
  if (f.step === "professional") {
    const pros = await professionalsFor(ctx, f.serviceId!);
    if (!pros.length) return { messages: [{ type: "text", text: "No momento ninguém da equipe atende esse serviço pelo agendamento online. Vou pedir para a equipe te ajudar." }], state: null, model: "flow_no_professionals" };
    return ask("Profissional", "Tem preferência de profissional?", [{ title: "Qualquer profissional", description: "Primeiro horário livre", value: { id: null } }, ...pros.map(p => ({ title: p.name, description: p.specialty ?? undefined, value: { id: p.id } }))]);
  }
  if (f.step === "date") {
    const salon = await salonRow(ctx);
    const start = today(salon.timezone ?? "America/Sao_Paulo");
    // Antes: até 21 dias consultados em sequência. Agora em lotes paralelos; mesmo resultado e ordem.
    const all = Array.from({ length: DATE_DAYS }, (_, i) => i);
    const pros = f.professionalId ? 1 : Math.min(12, (await professionalsFor(ctx, f.serviceId!)).length);
    const found = await firstMatches(all, async i => (await freeTimes(ctx, { ...f, date: start.add({ days: i }).toString() })).length > 0, 9 * (page + 1) + 1, dayChunk(pros));
    const days: Option[] = found.map(i => {
      const d = start.add({ days: i }).toString();
      return { title: `${i === 0 ? "Hoje" : i === 1 ? "Amanhã" : weekday(d)} ${dateBR(d)}`, value: { date: d } };
    });
    if (!days.length) return say(`Não encontrei horários livres nos próximos ${DATE_DAYS} dias. Quer que eu chame alguém da equipe?`);
    return ask("Datas", "Para qual dia?", days);
  }
  if (f.step === "time") {
    const times = await freeTimes(ctx, f);
    if (!times.length) return step(ctx, { ...f, step: "date" }, interactive, 0, "Esse dia acabou de lotar.");
    return ask("Horários", `Horários livres em ${dateBR(f.date!)}:`, times.map(t => ({ title: t, value: { start: t } })));
  }
  if (f.step === "name") return say("Para finalizar, qual é o seu nome completo?");
  if (f.step === "phone_confirm") return ask("Telefone", `Este WhatsApp (${ctx.phone}) é o telefone do seu cadastro?`, [{ title: "Sim, é este", value: { same: true } }, { title: "Informar outro", value: { same: false } }]);
  if (f.step === "phone") return say("Qual é o telefone do cadastro, com DDD?");
  if (f.step === "birth") return say("Qual é a sua data de nascimento? (ex.: 25/03/1990). É para lembrarmos do seu aniversário. Se preferir não informar, responda \"pular\".");
  if (f.step === "coupon") return ask("Cupom", "Tem cupom de desconto?", [{ title: "Não tenho", value: { coupon: null } }, { title: "Tenho um cupom", value: { coupon: "ask" } }]);
  if (f.step === "review") return reviewStep(ctx, f, interactive, pre, n);
  if (f.step === "payment") return ask("Pagamento", "Como prefere pagar?", [{ title: "Pagar agora (PIX)", value: { pay: "pix" } }, { title: "Pagar no salão", value: { pay: "salon" } }]);
  return say("Pode me enviar o comprovante por aqui (foto ou PDF).");
}

async function reviewStep(ctx: BotContext, f: Flow, interactive: boolean, pre: string, n: string): Promise<FlowReply> {
  const [{ data: service, error: se }, pros] = await Promise.all([
    ctx.db.from("services").select("name,price").eq("id", f.serviceId!).eq("salon_id", ctx.salonId).maybeSingle(),
    f.professionalId ? ctx.db.from("professionals").select("name").eq("id", f.professionalId).eq("salon_id", ctx.salonId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (se || pros.error || !service) fail();
  let discountLine = "";
  if (f.coupon) {
    const { data, error } = await ctx.db.rpc("whatsapp_coupon_eval", { p_salon_id: ctx.salonId, p_phone: ctx.phone, p_code: f.coupon, p_total: service.price });
    if (error) fail();
    const r = Array.isArray(data) ? data[0] : data;
    if (r?.reason) return step(ctx, { ...f, coupon: null, step: "coupon" }, interactive, 0, couponMessage(String(r.reason)));
    discountLine = `\nDesconto: ${brl(r?.discount ?? 0)}\nTotal: ${brl(Number(service.price) - Number(r?.discount ?? 0))}`;
  }
  const summary = `Confere os dados:\n${service.name} — ${brl(service.price)}\nProfissional: ${pros.data?.name ?? "qualquer profissional disponível"}\nData: ${weekday(f.date!)} ${dateBR(f.date!)} às ${f.start}\nNome: ${f.name}\nTelefone: ${f.phone}${f.birth ? `\nNascimento: ${f.birth.startsWith("1904-") ? dateBR(f.birth) : `${dateBR(f.birth)}/${f.birth.slice(0, 4)}`}` : ""}${discountLine}`;
  const { menu, stored } = buildMenu(n, "review", "Confirmar", pre + summary, [{ title: "Confirmar", value: { ok: true } }, { title: "Mudar horário", value: { ok: "time" } }, { title: "Cancelar", value: { ok: false } }]);
  const msg = menuMessage(menu, interactive, (await salonRow(ctx)).name);
  if (msg.type === "text") msg.text += "\n\nVocê também pode responder CONFIRMAR.";
  return { messages: [msg], state: { ...f, menu: stored }, model: "flow_review" };
}

export function couponMessage(reason: string): string {
  return ({ not_found: "Não encontrei esse cupom.", expired: "Esse cupom expirou.", not_started: "Esse cupom ainda não está valendo.", exhausted: "Esse cupom já atingiu o limite de usos.", min_purchase: "Esse cupom exige um valor mínimo maior.", new_clients_only: "Esse cupom é só para a primeira visita." } as Record<string, string>)[reason] ?? "Não consegui aplicar esse cupom.";
}

/** Abre o fluxo. Cliente conhecido (telefone normalizado) não precisa repetir nome/nascimento. */
export async function startFlow(ctx: BotContext, interactive: boolean, serviceId?: string): Promise<FlowReply> {
  const { data: client, error } = await ctx.db.from("clients").select("name,birth_date").eq("salon_id", ctx.salonId).eq("phone_normalized", ctx.phone).order("created_at").limit(1).maybeSingle();
  if (error) fail();
  const known = { name: !!fullName(client?.name), birth: !!client?.birth_date };
  const f: Flow = { kind: "flow", step: "service", known, ...(known.name ? { name: fullName(client!.name)! } : {}), requestKey: crypto.randomUUID() };
  if (serviceId && (await services(ctx)).some(s => s.id === serviceId)) return step(ctx, { ...f, serviceId, step: "professional" }, interactive);
  const hello = known.name ? `Oi, ${f.name!.split(" ")[0]}! Vamos agendar.` : "";
  return step(ctx, f, interactive, 0, hello);
}

/** Próximo passo após coletar a escolha. */
function after(f: Flow): Flow["step"] {
  const order: Flow["step"][] = ["service", "professional", "date", "time", "name", "phone_confirm", "birth", "coupon", "review"];
  let i = order.indexOf(f.step === "phone" ? "phone_confirm" : f.step) + 1;
  while (order[i] === "name" && f.known?.name && f.name) i++;
  if (order[i] === "phone_confirm" && f.known?.name && f.phone) i++;
  if (order[i] === "birth" && f.known?.birth) i++;
  return order[i] ?? "review";
}

/** Uma mensagem do cliente dentro do fluxo. Retorna null se o fluxo não reconhece (cai para a IA). */
export async function continueFlow(ctx: BotContext, f: Flow, input: Input, interactive: boolean): Promise<FlowReply | null> {
  const choice = resolveChoice(f.menu, input.text, input.selection);
  if (choice === "more" && f.menu) return step(ctx, f, interactive, f.menu.page + 1);
  const picked = typeof choice === "number" ? f.menu!.options[choice] as Record<string, unknown> : null;
  const next = (patch: Partial<Flow>, intro = "") => { const g = { ...f, ...patch } as Flow; return step(ctx, { ...g, step: after(g) }, interactive, 0, intro); };
  const salon = await salonRow(ctx);
  const tz = salon.timezone ?? "America/Sao_Paulo";
  switch (f.step) {
    case "service": return picked ? next({ serviceId: String(picked.id) }) : null;
    case "professional": return picked ? next({ professionalId: (picked.id as string | null) ?? null }) : null;
    case "date": return picked ? next({ date: String(picked.date) }) : null;
    case "time": return picked ? next({ start: String(picked.start), ...(f.known?.name ? { phone: ctx.phone } : {}) }) : null;
    case "name": {
      const name = fullName(input.text);
      return name ? next({ name }) : step(ctx, f, interactive, 0, "Preciso do nome e sobrenome, por favor.");
    }
    case "phone_confirm": {
      const same = picked ? picked.same === true : yesNo(input.text);
      if (same === null) return null;
      return same ? next({ phone: ctx.phone }) : step(ctx, { ...f, step: "phone" }, interactive);
    }
    case "phone": {
      const phone = brazilPhone(input.text);
      return phone ? next({ phone }) : step(ctx, f, interactive, 0, "Não reconheci esse número. Envie com DDD, por exemplo 11 91234-5678.");
    }
    case "birth": {
      const r = parseBirthDate(input.text, today(tz).toString());
      if (r.ok) return next({ birth: r.date });
      if (r.refused) return next({ birth: null });
      return step(ctx, f, interactive, 0, "Não entendi a data. Pode mandar no formato dia/mês/ano?");
    }
    case "coupon": {
      if (picked?.coupon === "ask") return { messages: [{ type: "text", text: "Qual é o código do cupom?" }], state: { ...f, menu: null, coupon: "?" }, model: "flow_coupon" };
      if (picked) return next({ coupon: null });
      if (f.coupon === "?") { const code = input.text.trim().slice(0, 40); return code ? step(ctx, { ...f, coupon: code, step: "review" }, interactive) : null; }
      return null;
    }
    case "review": {
      const ok = picked ? picked.ok : /^(confirmar|confirmo|sim|1)$/i.test(input.text.trim()) ? true : null;
      if (ok === "time") return step(ctx, { ...f, step: "date", start: undefined }, interactive);
      if (ok === false) return { messages: [{ type: "text", text: "Tudo bem, não agendei nada. Se quiser, é só chamar de novo." }], state: null, model: "flow_cancelled" };
      return ok === true ? book(ctx, f, interactive, salon) : null;
    }
    case "payment": {
      if (!picked) return null;
      if (picked.pay === "salon") return { messages: [{ type: "text", text: "Combinado, o pagamento fica para o dia no salão. Até lá!" }], state: null, model: "flow_pay_salon" };
      return pixMessages(ctx, f);
    }
    case "proof": return null;
  }
  return null;
}

async function book(ctx: BotContext, f: Flow, interactive: boolean, salon: Awaited<ReturnType<typeof salonRow>>): Promise<FlowReply> {
  const cfg = await settings(ctx);
  if (!cfg.booking) return { messages: [{ type: "text", text: "O agendamento automático está desligado no momento. Vou pedir para a equipe te ajudar." }], state: null, model: "booking_disabled" };
  if (!f.name || !fullName(f.name) || !f.phone || !f.serviceId || !f.date || !f.start) return step(ctx, { ...f, step: !f.name ? "name" : "phone_confirm" }, interactive);
  if (ctx.preview || !ctx.eventId) return { messages: [{ type: "text", text: "(Teste) Aqui o agendamento seria criado e o salão receberia a solicitação." }], state: null, model: "booking_preview" };
  const { data, error } = await ctx.db.rpc("whatsapp_book_appointment_v2", {
    p_event_id: ctx.eventId, p_service_id: f.serviceId, p_professional_id: f.professionalId ?? null, p_date: f.date, p_start: f.start,
    p_client_name: f.name, p_client_phone: f.phone, p_birth_date: f.birth ?? null, p_coupon_code: f.coupon ?? null, p_request_key: f.requestKey ?? crypto.randomUUID(),
  });
  if (error) {
    const msg = String(error.message ?? "");
    const reason = ["invalid_coupon", "slot_unavailable", "slot_conflict"].find(c => msg.includes(c));
    const code = `booking_rpc_${reason ?? (/^[A-Z0-9]{5}$/.test(String(error.code)) ? error.code : "unknown")}`;
    // Sem conteúdo da conversa/PII nos logs. Erro tratado também fica no evento completed.
    console.warn("whatsapp_booking_failed", { eventId: ctx.eventId, code });
    const { error: logError } = await ctx.db.from("whatsapp_webhook_events").update({ error_code: code }).eq("id", ctx.eventId).eq("salon_id", ctx.salonId);
    if (logError) fail();
    if (msg.includes("invalid_coupon")) return step(ctx, { ...f, coupon: null, step: "coupon" }, interactive, 0, "Esse cupom não pôde ser aplicado.");
    if (msg.includes("slot_unavailable") || msg.includes("slot_conflict")) return step(ctx, { ...f, step: "time", start: undefined, requestKey: crypto.randomUUID() }, interactive, 0, "Esse horário acabou de ser ocupado. Escolha outro:");
    return { messages: [{ type: "text", text: "Não consegui concluir o agendamento agora. Tente CONFIRMAR novamente ou peça para falar com a equipe." }], state: f, model: "booking_failed" };
  }
  const r = data as { id: string; final_price: number; status?: string };
  const where = [salon.address, salon.city].filter(Boolean).join(", ");
  const done = `Pronto, ${f.name!.split(" ")[0]}! Sua solicitação para ${weekday(f.date)} ${dateBR(f.date)} às ${f.start} ${r.status === "confirmed" ? `está confirmado no ${salon.name}` : `foi registrada e aguarda a confirmação do ${salon.name}`}.${where ? `\nEndereço: ${where}` : ""}\nValor: ${brl(r.final_price)}`;
  const g: Flow = { ...f, appointmentId: r.id, menu: null };
  if (!salon.pix_key || !(Number(r.final_price) > 0)) return { messages: [{ type: "text", text: done }], state: null, model: "booking" };
  const pay = await step(ctx, { ...g, step: "payment" }, interactive);
  return { messages: [{ type: "text", text: done }, ...pay.messages], state: pay.state, model: "booking" };
}

async function pixMessages(ctx: BotContext, f: Flow): Promise<FlowReply> {
  const pix = await bookingPix(ctx, f.appointmentId!);
  if (!pix) return { messages: [{ type: "text", text: "Não consegui gerar o PIX agora. Você pode pagar no salão." }], state: null, model: "pix_unavailable" };
  return {
    messages: [
      { type: "image", text: pix.media.caption, media_path: pix.media.path, media_mime: pix.media.mime, media_filename: pix.media.filename },
      (await settings(ctx)).interactive
        ? { type: "interactive", text: pix.payload, payload: { op: "buttons", body: { title: "PIX", description: pix.payload, footer: (await salonRow(ctx)).name, buttons: [{ type: "copy", displayText: "Copiar código PIX", copyCode: pix.payload }] } } }
        : { type: "text", text: pix.payload },
      { type: "text", text: "Depois de pagar, envie o comprovante aqui (foto ou PDF). A equipe do salão confere e confirma." },
    ],
    state: { ...f, step: "proof", menu: null }, model: "pix",
  };
}

/** Comprovante: só quando há agendamento em aberto no fluxo; senão o chatbot pergunta a qual se refere. */
export async function handleProof(ctx: BotContext, appointmentId: string): Promise<OutMessage[]> {
  const r = await receivePaymentProof(ctx, appointmentId);
  if (r.ok) return [{ type: "text", text: "Recebi seu comprovante. A equipe do salão vai conferir." }];
  if (r.reason === "too_large") return [{ type: "text", text: "O arquivo é grande demais (máx. 5 MB). Pode enviar uma foto ou PDF menor?" }];
  if (r.reason === "invalid_media") return [{ type: "text", text: "Consigo receber o comprovante como foto (JPG/PNG) ou PDF. Pode reenviar?" }];
  return [{ type: "text", text: "Não consegui baixar o arquivo. Pode enviar de novo?" }];
}

export const flowExpired = (expires: string | null | undefined) => !expires || expires < new Date().toISOString();
export const flowExpiry = () => new Date(Date.now() + FLOW_TTL_MS).toISOString();
