// Fluxo guiado estilo Typebot (Evolution 2.3.7): menu principal, agendamento passo a passo, meus agendamentos
// (remarcar/cancelar), serviços, endereço e transbordo humano. Determinístico; a IA só responde dúvida solta e
// devolve o cliente para a etapa atual. Estado em whatsapp_chatbot_sessions (salão + telefone).
// Identidade vem do evento autenticado; o cliente só escolhe entre opções que o servidor gerou (options_map).
import { Temporal } from "npm:@js-temporal/polyfill@0.5.1";
import { WhatsAppError } from "./errors.ts";
import { automationOf, salonOf, type AutomationRow, type BotContext, type SalonRow } from "./chatbot-domain.ts";
import { dayChunk, firstMatches } from "./latency.ts";
import { brl, buildMenu, clip, dateBR, fullName, resolveChoice, weekday, type Option, type StoredMenu } from "./interactive.ts";
import { freeTimes, paymentStep, professionalsFor, services, type Flow, type Input, type OutMessage } from "./attendant.ts";
import { renderMenu } from "./evolutionSender.ts";
import { BUTTON_TEXT, MAX_BUTTONS, buttonPage, renderButtons } from "./evolutionButtons.ts";

export type Step = "IDLE" | "MAIN_MENU" | "SELECT_SERVICE" | "SELECT_PROFESSIONAL" | "SELECT_DATE" | "SELECT_TIME" | "CONFIRM_NAME" | "CONFIRM_BOOKING"
  | "MY_APPOINTMENTS" | "APPOINTMENT_ACTIONS" | "CONFIRM_CANCEL_APPOINTMENT" | "RESCHEDULE_SELECT_DATE" | "RESCHEDULE_SELECT_TIME" | "HUMAN_HANDOFF";
export const STEPS: Step[] = ["IDLE", "MAIN_MENU", "SELECT_SERVICE", "SELECT_PROFESSIONAL", "SELECT_DATE", "SELECT_TIME", "CONFIRM_NAME", "CONFIRM_BOOKING",
  "MY_APPOINTMENTS", "APPOINTMENT_ACTIONS", "CONFIRM_CANCEL_APPOINTMENT", "RESCHEDULE_SELECT_DATE", "RESCHEDULE_SELECT_TIME", "HUMAN_HANDOFF"];

interface Appt { id: string; date: string; start: string; service: string; professional: string }
export interface SessionData {
  flow?: Flow; menu?: StoredMenu | null; stack?: Step[]; appts?: Appt[]; target?: Appt | null; typingDate?: boolean;
  /** Modo botões: turno escolhido (Manhã/Tarde/Noite) antes dos horários. */
  period?: string | null;
}
export interface GuidedSession { step: Step; data: SessionData; name: string | null; takeoverUntil: string | null; lastAt: string | null }
export interface GuidedReply { text: string; provider: "deterministic" | string; model: string; messages: OutMessage[]; handoff?: boolean; session: GuidedSession; flowState?: Flow | null }
export interface GuidedDeps {
  /** Dúvida solta fora das opções: resposta curta da IA (null = IA indisponível). `startBooking` = IA mandou agendar. */
  ai?: (text: string) => Promise<{ text: string; startBooking?: string | null } | null>;
  /** Simulador: sessão vem e volta no corpo da requisição (nada persiste). */
  session?: GuidedSession | null;
}

const SESSION_TTL_MS = 6 * 3_600_000, DATE_LOOKAHEAD = 21, DATE_OPTIONS = 7;
export const FOOTER = "Digite *V* para voltar ou *0* para o Menu Inicial.";
const nonce = () => Math.random().toString(36).slice(2, 8).padEnd(6, "0");
const fail = (): never => { throw new WhatsAppError("persistence_failed", 503); };
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const emptySession = (): GuidedSession => ({ step: "IDLE", data: {}, name: null, takeoverUntil: null, lastAt: null });
const today = (tz: string) => Temporal.Now.plainDateISO(tz);

/** Comandos rápidos reconhecidos em qualquer etapa (`#agendar`, `0`, `menu`, `v`, `atendente`…). */
export type Command = "menu" | "book" | "mine" | "cancel" | "prices" | "back" | "human" | null;
export function parseCommand(text: string): Command {
  const t = fold(text).replace(/[!.?]+$/, "");
  if (/^(0|menu|inicio|início|oi|ola|olá|bom dia|boa tarde|boa noite|começar|comecar|start)$/.test(t)) return "menu";
  if (/^(#?agendar|agendar horario|quero agendar|marcar|#marcar)$/.test(t)) return "book";
  if (/^(#?meushorarios|#?meus horarios|meus agendamentos|#?agendamentos)$/.test(t)) return "mine";
  if (/^(#?cancelar|cancelar agendamento|remarcar|#remarcar)$/.test(t)) return "cancel";
  if (/^(#?valores|#?precos|preços|servicos|serviços|#servicos|tabela)$/.test(t)) return "prices";
  if (/^(v|voltar|#voltar)$/.test(t)) return "back";
  if (/^(atendente|humano|#atendente|#humano|falar com atendente|falar com humano|pessoa)$/.test(t) || (/\b(atendente|humano|pessoa real|alguem da equipe)\b/.test(t) && /\b(falar|chama|chame|chamar|preciso|quero)\b/.test(t))) return "human";
  return null;
}

/** Data digitada (15/11 ou 15/11/2026) → ISO, só hoje em diante e até 1 ano. */
export function parseTypedDate(text: string, todayIso: string): string | null {
  const m = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/);
  if (!m) return null;
  const [ty] = todayIso.split("-").map(Number);
  let y = m[3] ? Number(m[3]) : ty;
  if (y < 100) y += 2000;
  const d = Number(m[1]), mo = Number(m[2]);
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const check = new Date(`${iso}T12:00:00Z`);
  if (mo < 1 || mo > 12 || d < 1 || Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== iso) return null;
  // Sem ano e já passou: assume o próximo ano (ex.: em dezembro, "05/01").
  const final = !m[3] && iso < todayIso ? `${y + 1}${iso.slice(4)}` : iso;
  if (final < todayIso) return null;
  const limit = Temporal.PlainDate.from(todayIso).add({ days: 365 }).toString();
  return final <= limit ? final : null;
}
export const parseTypedTime = (text: string): string | null => {
  const m = text.trim().match(/^(\d{1,2})(?::|h)?(\d{2})?\s*h?$/i);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2] ?? "0");
  return h <= 23 && mi <= 59 ? `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}` : null;
};
const period = (t: string) => (t < "12:00" ? "Manhã" : t < "18:00" ? "Tarde" : "Noite");
const firstName = (n: string | null | undefined) => (n ?? "").trim().split(" ")[0];

/** Template do salão com {nome}, {salao} e {primeiro_nome}. */
export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "").replace(/[ \t]+\n/g, "\n").trim();
}

// ----------------------------------------------------------------------------------------------- sessão
async function loadSession(ctx: BotContext, deps: GuidedDeps): Promise<GuidedSession | "unavailable"> {
  if (ctx.preview) return deps.session ?? emptySession();
  const { data, error } = await ctx.db.from("whatsapp_chatbot_sessions").select("current_step,session_data,client_name,human_takeover_until,last_interaction_at").eq("salon_id", ctx.salonId).eq("client_phone", ctx.phone).maybeSingle();
  // 42P01 = tabela ainda não criada (migração pendente): o atendente antigo segue respondendo.
  if (error) { if (String(error.code) === "42P01") return "unavailable"; fail(); }
  if (!data) return emptySession();
  const step = STEPS.includes(data.current_step as Step) ? data.current_step as Step : "IDLE";
  const raw = data.session_data && typeof data.session_data === "object" ? data.session_data as SessionData : {};
  return { step, data: raw, name: data.client_name ?? null, takeoverUntil: data.human_takeover_until ?? null, lastAt: data.last_interaction_at ?? null };
}
async function saveSession(ctx: BotContext, s: GuidedSession): Promise<void> {
  if (ctx.preview) return;
  const { error } = await ctx.db.from("whatsapp_chatbot_sessions").upsert({
    salon_id: ctx.salonId, client_phone: ctx.phone, client_name: s.name, current_step: s.step, session_data: s.data,
    human_takeover_until: s.takeoverUntil, last_interaction_at: new Date().toISOString(),
  }, { onConflict: "salon_id,client_phone" });
  if (error) fail();
}

// ----------------------------------------------------------------------------------------------- render
interface Ctx { ctx: BotContext; cfg: AutomationRow; salon: SalonRow; s: GuidedSession; tz: string }
type Out = { messages: OutMessage[]; model: string; handoff?: boolean; flowState?: Flow | null };

function menu(c: Ctx, step: Step, title: string, body: string, opts: Option[], page = 0, footer = FOOTER): Out {
  if (c.cfg.renderMode === "buttons") return buttonsMenu(c, step, title, body, opts, page);
  const { menu, stored } = buildMenu(nonce(), step, title, body, opts, page);
  menu.footer = footer;
  c.s.step = step; c.s.data.menu = stored;
  return { messages: [renderMenu(menu, c.cfg.renderMode)], model: `guided_${step.toLowerCase()}` };
}
const buttonsFooter = (c: Ctx) => `${clip(c.salon.name, 30)} • Toque em um botão abaixo`;
/** Modo 100% botões: até 3 por mensagem; sobra vira "➡️ Ver mais" e a última página oferece "🔁 Do início". */
function buttonsMenu(c: Ctx, step: Step, title: string, body: string, opts: Option[], page: number): Out {
  const n = nonce(), pg = buttonPage(opts.length, page);
  const slice = opts.slice(pg.start, pg.end);
  // Botão tem 20 caracteres: preço, duração e nome completo vão no texto do card.
  const details = slice.filter(o => o.description || Array.from(o.title).length > BUTTON_TEXT).map(o => `• *${o.title}*${o.description ? ` — ${o.description}` : ""}`);
  const { menu, stored } = buildMenu(n, step, pg.pages > 1 ? `${title} (${pg.page + 1}/${pg.pages})` : title, details.length ? `${body}\n\n${details.join("\n")}` : body,
    slice.map(o => ({ ...o, description: undefined })), 0, MAX_BUTTONS);
  if (pg.more || pg.wrap) { menu.rows.push({ id: `${n}.more`, title: pg.more ? "➡️ Ver mais" : "🔁 Do início" }); stored.hasMore = true; }
  stored.page = pg.page;
  menu.footer = buttonsFooter(c);
  c.s.step = step; c.s.data.menu = stored;
  return { messages: [renderButtons(menu)], model: `guided_${step.toLowerCase()}` };
}
/** Tira do texto as instruções de digitação ("Digite *0*…") quando a resposta é por botão. */
export function stripTypingHints(text: string): string {
  return text.split("\n").map(line => line.split(/(?<=[.!?])[ \t]+/).filter(s => !/\b(?:[Dd]igit(?:e|ar)|[Rr]esponda) \*/.test(s)).join(" "))
    .join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
/** Texto final com botões de saída (menu, atendente quando o texto oferece). */
function quickButtons(c: Ctx, text: string, rows: { id: string; title: string }[] = []): OutMessage {
  const out = [...rows, ...(rows.length ? [] : [{ id: "menu_main", title: "🏠 Menu inicial" }]), ...(/\*5\*/.test(text) && !rows.length ? [{ id: "menu_human", title: "💬 Atendente" }] : [])];
  return renderButtons({ kind: "buttons", title: clip(c.salon.name, 60), body: stripTypingHints(text) || "Como posso ajudar?", button: "", rows: out.slice(0, MAX_BUTTONS), footer: buttonsFooter(c) });
}
const say = (c: Ctx, step: Step, text: string, model = `guided_${step.toLowerCase()}`): Out => {
  c.s.step = step; c.s.data.menu = null;
  return { messages: [c.cfg.renderMode === "buttons" ? quickButtons(c, text) : { type: "text", text }], model };
};
const push = (c: Ctx, from: Step) => { if (from !== "IDLE" && from !== "MAIN_MENU") c.s.data.stack = [...(c.s.data.stack ?? []).slice(-8), from]; };
const prefix = (o: Out, intro: string): Out => {
  const m = o.messages[0];
  if (!intro || !m) return o;
  m.text = `${intro}\n\n${m.text}`;
  // Card de botões: o texto visível é a description do payload.
  const body = m.type === "interactive" ? m.payload.body as Record<string, unknown> | undefined : undefined;
  if (body && typeof body.description === "string") body.description = `${intro}\n\n${body.description}`;
  return o;
};
const buttonsMode = (c: Ctx) => c.cfg.renderMode === "buttons";

async function knownClient(c: Ctx): Promise<string | null> {
  const { data, error } = await c.ctx.db.from("clients").select("name").eq("salon_id", c.ctx.salonId).eq("phone_normalized", c.ctx.phone).order("created_at").limit(1).maybeSingle();
  if (error) fail();
  return fullName(data?.name) ?? null;
}

async function mainMenu(c: Ctx, greet = true, page = 0): Promise<Out> {
  c.s.data = {};
  const name = c.s.name ?? (c.s.name = await knownClient(c));
  const vars = { salao: c.salon.name, nome: name ?? "", primeiro_nome: firstName(name) };
  const hello = c.cfg.welcome ? fillTemplate(c.cfg.welcome, vars) : `Olá${name ? `, ${firstName(name)}` : ""}! 👋 Bem-vindo(a) ao *${c.salon.name}*.`;
  const body = greet ? `${hello}\nComo posso ajudar?` : "O que você quer fazer?";
  // Botões: 2 por card + "Ver mais" (Serviços e Atendente na 2ª página, Endereço na 3ª). Títulos cabem em 20 caracteres.
  if (buttonsMode(c)) return menu(c, "MAIN_MENU", "Menu principal", body, [
    { id: "menu_book", title: "📅 Agendar horário", value: { go: "book" } },
    { id: "menu_my_appointments", title: "📋 Meus horários", value: { go: "mine" } },
    { id: "menu_services", title: "💈 Serviços/valores", value: { go: "prices" } },
    { id: "menu_human", title: "💬 Atendente", value: { go: "human" } },
    { id: "menu_info", title: "📍 Endereço/horário", value: { go: "info" } },
  ], page);
  return menu(c, "MAIN_MENU", "Menu principal", body, [
    { id: "menu_book", title: "📅 Agendar horário", description: "Escolha serviço, dia e horário", value: { go: "book" } },
    { id: "menu_my_appointments", title: "📋 Meus agendamentos", description: "Ver, remarcar ou cancelar", value: { go: "mine" } },
    { id: "menu_services", title: "💈 Serviços e valores", description: "Tabela de preços e duração", value: { go: "prices" } },
    { id: "menu_info", title: "📍 Endereço e horários", description: "Onde estamos e quando abrimos", value: { go: "info" } },
    { id: "menu_human", title: "💬 Falar com atendente", description: "Uma pessoa da equipe assume", value: { go: "human" } },
  ], 0, "Responda com o número da opção.");
}

async function selectService(c: Ctx, intro = "", page = 0): Promise<Out> {
  const list = await services(c.ctx);
  if (!list.length) return say(c, "MAIN_MENU", "Ainda não temos serviços disponíveis para agendar por aqui. Digite *5* para falar com a equipe.", "guided_no_services");
  c.s.data.flow ??= { kind: "flow", step: "service", requestKey: crypto.randomUUID() };
  return prefix(menu(c, "SELECT_SERVICE", "Serviços", "Qual serviço você quer agendar?", list.map(s => ({ title: s.name, description: `${brl(s.price)} (${s.duration_minutes} min)`, value: { id: s.id, name: s.name, price: s.price, duration: s.duration_minutes } })), page), intro);
}

async function selectProfessional(c: Ctx, intro = "", page = 0): Promise<Out> {
  const f = c.s.data.flow!;
  const pros = await professionalsFor(c.ctx, f.serviceId!);
  if (!pros.length) return say(c, "MAIN_MENU", "No momento ninguém da equipe atende esse serviço pelo agendamento online. Digite *5* para falar com a equipe.", "guided_no_professionals");
  // Um profissional só: escolhe sozinho e vai direto para a data.
  if (pros.length === 1) { f.professionalId = pros[0].id; return selectDate(c, intro); }
  return prefix(menu(c, "SELECT_PROFESSIONAL", "Profissional", "Com quem você prefere?", [
    { id: "any_professional", title: "Sem preferência", description: "Primeiro horário livre", value: { id: null } },
    ...pros.map(p => ({ title: p.name, description: p.specialty ?? undefined, value: { id: p.id, name: p.name } })),
  ], page), intro);
}

async function selectDate(c: Ctx, intro = "", page = 0): Promise<Out> {
  const f = c.s.data.flow!, step: Step = c.s.data.target ? "RESCHEDULE_SELECT_DATE" : "SELECT_DATE";
  const start = today(c.tz);
  const pros = f.professionalId ? 1 : Math.min(12, (await professionalsFor(c.ctx, f.serviceId!)).length);
  const all = Array.from({ length: DATE_LOOKAHEAD }, (_, i) => i);
  // Botões: os 7 próximos dias com vaga, paginados pelo "Ver mais" (a página não aumenta a busca).
  const found = await firstMatches(all, async i => (await freeTimes(c.ctx, { ...f, date: start.add({ days: i }).toString() })).length > 0, DATE_OPTIONS * (buttonsMode(c) ? 1 : page + 1), dayChunk(pros));
  if (!found.length) return say(c, "MAIN_MENU", `Não encontrei horários livres nos próximos ${DATE_LOOKAHEAD} dias. Digite *5* para falar com a equipe ou *0* para o menu.`, "guided_no_dates");
  const days: Option[] = found.map(i => {
    const d = start.add({ days: i }).toString();
    const label = i === 0 ? "Hoje" : i === 1 ? "Amanhã" : dateBR(d);
    return { title: i < 2 ? `${label} (${dateBR(d)} - ${weekday(d)})` : `${label} (${weekday(d)})`, value: { date: d } };
  });
  c.s.data.typingDate = false;
  if (buttonsMode(c)) return prefix(menu(c, step, "Datas", "📅 Para qual dia?", days, page), intro);
  days.push({ id: "date_other", title: "Digitar outra data", description: "Formato DD/MM", value: { other: true } });
  return prefix(menu(c, step, "Datas", "Para qual dia?", days, page, `${FOOTER}\nVocê também pode digitar a data (ex.: 15/11).`), intro);
}

const PERIODS = [{ key: "Manhã", icon: "☀️" }, { key: "Tarde", icon: "🌤️" }, { key: "Noite", icon: "🌙" }];
async function selectTime(c: Ctx, intro = "", page = 0): Promise<Out> {
  const f = c.s.data.flow!, step: Step = c.s.data.target ? "RESCHEDULE_SELECT_TIME" : "SELECT_TIME";
  const times = await freeTimes(c.ctx, f);
  if (!times.length) return selectDate(c, "Esse dia acabou de lotar. Escolha outro:");
  const head = `Horários livres em ${dateBR(f.date!)} (${weekday(f.date!)})`;
  if (!buttonsMode(c)) return prefix(menu(c, step, "Horários", `${head}:`, times.map(t => ({ title: t, description: period(t), value: { start: t } })), page, `${FOOTER}\nVocê também pode digitar o horário (ex.: 14:00).`), intro);
  // Botões: primeiro o turno (só os que têm vaga; um só = pula), depois os horários dele, 2 por card + "Ver mais".
  const groups = PERIODS.filter(p => times.some(t => period(t) === p.key));
  if (!c.s.data.period || !groups.some(g => g.key === c.s.data.period)) {
    if (groups.length > 1) return prefix(menu(c, step, "Turno", `${head}.\nQual turno você prefere?`, groups.map(g => ({ id: `period_${fold(g.key)}`, title: `${g.icon} ${g.key} (${times.filter(t => period(t) === g.key).length})`, value: { period: g.key } }))), intro);
    c.s.data.period = groups[0].key;
  }
  const chosen = PERIODS.find(p => p.key === c.s.data.period)!;
  return prefix(menu(c, step, "Horários", `${head} · ${chosen.icon} ${chosen.key}`, [...times.filter(t => period(t) === chosen.key).map(t => ({ title: `🕒 ${t}`, value: { start: t } })), ...(groups.length > 1 ? [{ id: "period_change", title: "🔄 Outro turno", value: { period: null } }] : [])], page), intro);
}

async function confirmName(c: Ctx, intro = ""): Promise<Out> {
  const f = c.s.data.flow!;
  const known = c.s.name ?? (c.s.name = await knownClient(c));
  if (known) { f.name = known; return confirmBooking(c, intro); }
  const suggested = fullName(c.ctx.name);
  if (suggested && buttonsMode(c)) return prefix(menu(c, "CONFIRM_NAME", "Seu nome", `Para finalizar, o agendamento fica no nome de *${suggested}*?`, [
    { id: "use_pushname", title: "✅ Sim, esse nome", value: { name: suggested } }, { id: "name_other", title: "✏️ Outro nome", value: { other: true } },
  ]), intro);
  if (suggested) return prefix(menu(c, "CONFIRM_NAME", "Seu nome", `Para finalizar, qual é o seu nome completo? Pode usar o do WhatsApp ou digitar outro.`, [{ id: "use_pushname", title: `Usar "${suggested}"`.slice(0, 24), value: { name: suggested } }]), intro);
  return prefix(say(c, "CONFIRM_NAME", "Para finalizar, qual é o seu nome completo?"), intro);
}

async function summaryOf(c: Ctx, f: Flow): Promise<string> {
  const [{ data: service, error: se }, pro] = await Promise.all([
    c.ctx.db.from("services").select("name,price").eq("id", f.serviceId!).eq("salon_id", c.ctx.salonId).maybeSingle(),
    f.professionalId ? c.ctx.db.from("professionals").select("name").eq("id", f.professionalId).eq("salon_id", c.ctx.salonId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (se || pro.error || !service) return fail();
  return `🏢 *Local:* ${c.salon.name}\n✂️ *Procedimento:* ${service.name} (${brl(service.price)})\n👤 *Profissional:* ${pro.data?.name ?? "qualquer profissional disponível"}\n📅 *Data:* ${dateBR(f.date!)}/${f.date!.slice(0, 4)} (${weekday(f.date!)}) às *${f.start}*\n🙋 *Cliente:* ${f.name}`;
}

async function confirmBooking(c: Ctx, intro = ""): Promise<Out> {
  const f = c.s.data.flow!;
  f.phone = c.ctx.phone;
  const summary = await summaryOf(c, f);
  return prefix(menu(c, "CONFIRM_BOOKING", "Confirmar", `Confira os dados:\n\n${summary}`, [
    { id: "confirm_yes", title: "✅ Confirmar", value: { ok: true } },
    { id: "confirm_change_date", title: "🔄 Trocar data/hora", value: { ok: "time" } },
    { id: "confirm_cancel", title: "❌ Cancelar", value: { ok: false } },
  ], 0, "Responda 1 para confirmar."), intro);
}

function appUrl(salon: SalonRow): string | null {
  // deno-lint-ignore no-explicit-any
  const env = (globalThis as any).Deno?.env?.get?.("APP_PUBLIC_URL");
  const origin = String(env ?? "https://agendafacil365.com.br").split(",")[0].trim().replace(/\/$/, "");
  return salon.slug ? `${origin}/s/${salon.slug}` : null;
}

async function book(c: Ctx): Promise<Out> {
  const f = c.s.data.flow!, { ctx } = c;
  if (!c.cfg.booking) return say(c, "MAIN_MENU", "O agendamento automático está desligado no momento. Digite *5* para falar com a equipe.", "booking_disabled");
  if (!f.name || !fullName(f.name) || !f.serviceId || !f.date || !f.start) return confirmName(c, "Faltou um dado. Vamos conferir:");
  const summary = await summaryOf(c, f);
  if (ctx.preview || !ctx.eventId) return say(c, "IDLE", `(Simulação) Aqui o agendamento seria criado e o salão avisado.\n\n${summary}`, "booking_preview");
  const { data, error } = await ctx.db.rpc("whatsapp_book_appointment_v2", {
    p_event_id: ctx.eventId, p_service_id: f.serviceId, p_professional_id: f.professionalId ?? null, p_date: f.date, p_start: f.start,
    p_client_name: f.name, p_client_phone: ctx.phone, p_birth_date: null, p_coupon_code: null, p_request_key: f.requestKey ?? crypto.randomUUID(),
  });
  if (error) {
    const msg = String(error.message ?? "");
    const code = `booking_rpc_${["slot_unavailable", "slot_conflict", "booking_disabled"].find(k => msg.includes(k)) ?? "unknown"}`;
    console.warn("whatsapp_booking_failed", { eventId: ctx.eventId, code });
    await ctx.db.from("whatsapp_webhook_events").update({ error_code: code }).eq("id", ctx.eventId).eq("salon_id", ctx.salonId);
    if (msg.includes("slot_unavailable") || msg.includes("slot_conflict")) { f.start = undefined; f.requestKey = crypto.randomUUID(); return selectTime(c, "Esse horário acabou de ser ocupado. Escolha outro:"); }
    const retry = await confirmBooking(c, "Não consegui concluir o agendamento agora. Toque em Confirmar para tentar de novo.");
    retry.model = "booking_failed";
    return retry;
  }
  const r = data as { id: string; final_price: number; status?: string };
  const confirmed = r.status === "confirmed";
  const link = appUrl(c.salon);
  const vars = { salao: c.salon.name, nome: f.name, primeiro_nome: firstName(f.name), resumo: summary, link: link ?? "" };
  const head = c.cfg.confirmation ? fillTemplate(c.cfg.confirmation, vars) : `${confirmed ? "✅ *Agendamento confirmado!*" : "✅ *Solicitação registrada!* Aguarde a confirmação do salão."}`;
  const where = [c.salon.address, c.salon.city].filter(Boolean).join(", ");
  const done = `${head}\n\n${summary}\n💰 *Valor:* ${brl(r.final_price)}${where ? `\n📍 ${where}` : ""}${link ? `\n\n📲 Acompanhe ou altere pelo app: ${link}` : ""}\n\nDigite *0* a qualquer momento para o menu.`;
  c.s.step = "IDLE"; c.s.data = {};
  const out: Out = { messages: [buttonsMode(c) ? quickButtons(c, done, [{ id: "menu_my_appointments", title: "📋 Meus horários" }, { id: "menu_main", title: "🏠 Menu inicial" }]) : { type: "text", text: done }], model: "guided_booking" };
  // PIX cadastrado: o passo de pagamento do atendente assume (QR, copia e cola, comprovante).
  if (c.salon.pix_key && Number(r.final_price) > 0) {
    if (buttonsMode(c)) {
      // Mesmo passo "payment" do atendente (continueFlow resolve pelo id `<nonce>.<n>`), só que em botões.
      const { menu: m, stored } = buildMenu(nonce(), "payment", "Pagamento", "Como prefere pagar?", [{ title: "💳 Pagar agora (PIX)", value: { pay: "pix" } }, { title: "🏪 Pagar no salão", value: { pay: "salon" } }]);
      m.footer = buttonsFooter(c);
      out.messages.push(renderButtons(m)); out.flowState = { ...f, appointmentId: r.id, step: "payment", menu: stored };
      return out;
    }
    const pay = await paymentStep(ctx, { ...f, appointmentId: r.id, menu: null }, c.cfg.interactive);
    out.messages.push(...pay.messages); out.flowState = pay.state;
  }
  return out;
}

async function listAppointments(c: Ctx): Promise<Appt[]> {
  if (c.ctx.preview) return [];
  const t = today(c.tz).toString();
  const { data, error } = await c.ctx.db.from("appointments").select("id,date,start_time,services(name),professionals(name)").eq("salon_id", c.ctx.salonId).eq("client_phone", c.ctx.phone).in("status", ["pending", "confirmed"]).gte("date", t).order("date").order("start_time").limit(5);
  if (error) fail();
  const nameOf = (rel: unknown) => ((Array.isArray(rel) ? rel[0] : rel) as { name?: string } | null)?.name ?? "";
  return ((data ?? []) as Record<string, unknown>[]).map(a => ({ id: String(a.id), date: String(a.date), start: String(a.start_time).slice(0, 5), service: nameOf(a.services) || "Atendimento", professional: nameOf(a.professionals) }));
}
const apptLabel = (a: Appt) => `${dateBR(a.date)} (${weekday(a.date)}) às ${a.start} — ${a.service}${a.professional ? ` com ${a.professional}` : ""}`;

async function myAppointments(c: Ctx, intro = "", page = 0): Promise<Out> {
  const appts = await listAppointments(c);
  c.s.data = { appts };
  if (c.ctx.preview) return prefix(say(c, "MAIN_MENU", "(Simulação) Aqui apareceriam os agendamentos futuros do cliente, com opções de remarcar ou cancelar.\n\nDigite *0* para o menu."), intro);
  if (!appts.length) return prefix(menu(c, "MAIN_MENU", "Agendamentos", "Você não tem agendamentos futuros por aqui.", [{ id: "menu_book", title: "📅 Agendar horário", value: { go: "book" } }, { id: "menu_main", title: "⬅️ Menu inicial", value: { go: "menu" } }], 0, "Responda com o número."), intro);
  if (appts.length === 1) { c.s.data.target = appts[0]; return appointmentActions(c, intro); }
  return prefix(menu(c, "MY_APPOINTMENTS", "Seus agendamentos", "Seus próximos horários. Qual deles?", appts.map(a => ({ title: `${dateBR(a.date)} ${a.start}`, description: `${a.service}${a.professional ? ` · ${a.professional}` : ""}`, value: { id: a.id } })), page), intro);
}

function appointmentActions(c: Ctx, intro = ""): Out {
  const a = c.s.data.target!;
  return prefix(menu(c, "APPOINTMENT_ACTIONS", "Agendamento", `📅 ${apptLabel(a)}\n\nO que você quer fazer?`, [
    { id: "appt_reschedule", title: "🔄 Remarcar", value: { act: "reschedule" } },
    { id: "appt_cancel", title: "❌ Cancelar", value: { act: "cancel" } },
    { id: "appt_back", title: "⬅️ Voltar ao menu", value: { act: "menu" } },
  ], 0, "Responda com o número."), intro);
}

function confirmCancel(c: Ctx): Out {
  const a = c.s.data.target!;
  return menu(c, "CONFIRM_CANCEL_APPOINTMENT", "Cancelar", `Cancelar ${apptLabel(a)}?`, [
    { id: "cancel_yes", title: "Sim, cancelar", value: { yes: true } },
    { id: "cancel_no", title: "Não, manter", value: { yes: false } },
  ], 0, "Responda 1 ou 2.");
}

async function changeAppointment(c: Ctx, action: "cancel" | "reschedule"): Promise<Out> {
  const a = c.s.data.target!, f = c.s.data.flow, { ctx } = c;
  if (ctx.preview || !ctx.eventId) return say(c, "IDLE", "(Simulação) Aqui o agendamento seria alterado e o salão avisado.", "guided_change_preview");
  const { data, error } = await ctx.db.rpc("whatsapp_change_appointment", { p_event_id: ctx.eventId, p_appointment_id: a.id, p_action: action, p_date: action === "reschedule" ? f?.date : null, p_start: action === "reschedule" ? f?.start : null });
  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("change_deadline")) return say(c, "MAIN_MENU", "Faltam menos de 24 horas para o horário, então a alteração precisa ser feita pela equipe. Digite *5* para falar com um atendente.", "change_deadline");
    if (msg.includes("slot_unavailable")) { f!.start = undefined; return selectTime(c, "Esse horário acabou de ficar indisponível. Escolha outro:"); }
    return say(c, "MAIN_MENU", action === "cancel" ? "Não consegui cancelar agora. Seu horário continua registrado; digite *5* para a equipe verificar." : "Não consegui remarcar agora. Seu horário original continua mantido. Digite *0* para tentar de novo.", `${action}_failed`);
  }
  c.s.step = "IDLE"; c.s.data = {};
  if (data !== (action === "cancel" ? "cancelled" : "rescheduled")) return say(c, "IDLE", "Esse agendamento já não estava ativo, então nada foi alterado. Digite *0* para o menu.", `${action}_noop`);
  return say(c, "IDLE", action === "cancel"
    ? `Pronto, cancelado: ${apptLabel(a)}.\n\nQuando quiser remarcar, digite *1* ou *0* para o menu.`
    : `Pronto, remarcado para ${dateBR(f!.date!)} (${weekday(f!.date!)}) às *${f!.start}*. Até lá!\n\nDigite *0* para o menu.`, `guided_${action === "cancel" ? "cancelled" : "rescheduled"}`);
}

async function pricesInfo(c: Ctx): Promise<Out> {
  const list = await services(c.ctx);
  const lines = list.length ? list.map(s => `• *${s.name}* — ${brl(s.price)} (${s.duration_minutes} min)`).join("\n") : "Ainda não há serviços cadastrados.";
  return menu(c, "MAIN_MENU", "Serviços", `💈 *Serviços e valores — ${c.salon.name}*\n\n${lines}`, [
    { id: "menu_book", title: "📅 Agendar agora", value: { go: "book" } }, { id: "menu_main", title: "⬅️ Menu inicial", value: { go: "menu" } },
  ], 0, "Responda com o número.");
}

/** Horário de funcionamento a partir de working_hours ({0..6:{isOpen,start,end}}) ou opening/closing. */
export function hoursText(salon: SalonRow): string {
  const WEEK = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const wh = salon.working_hours && typeof salon.working_hours === "object" ? salon.working_hours as Record<string, { isOpen?: boolean; start?: string; end?: string }> : null;
  const hhmm = (v: unknown) => String(v ?? "").slice(0, 5);
  if (wh) {
    const lines = WEEK.map((d, i) => { const h = wh[String(i)]; return h?.isOpen ? `${d}: ${hhmm(h.start)}–${hhmm(h.end)}` : `${d}: fechado`; });
    return lines.join("\n");
  }
  return salon.opening_time && salon.closing_time ? `Todos os dias: ${hhmm(salon.opening_time)}–${hhmm(salon.closing_time)}` : "Consulte a equipe.";
}
function infoMenu(c: Ctx): Out {
  const where = [c.salon.address, c.salon.city].filter(Boolean).join(", ");
  const text = c.cfg.info ?? `📍 *Endereço:* ${where || "consulte a equipe"}\n\n🕒 *Horário de funcionamento:*\n${hoursText(c.salon)}${c.salon.phone ? `\n\n📞 ${c.salon.phone}` : ""}`;
  return menu(c, "MAIN_MENU", "Informações", text, [
    { id: "menu_book", title: "📅 Agendar agora", value: { go: "book" } }, { id: "menu_main", title: "⬅️ Menu inicial", value: { go: "menu" } },
  ], 0, "Responda com o número.");
}

async function handoff(c: Ctx): Promise<Out> {
  const { ctx } = c;
  const until = new Date(Date.now() + c.cfg.handoffHours * 3_600_000).toISOString();
  c.s.step = "HUMAN_HANDOFF"; c.s.data = {}; c.s.takeoverUntil = until;
  if (!ctx.preview) {
    // taken_over_by nulo = pausa automática (gera push "Assistente pediu ajuda"); o dono pode devolver antes pela central.
    const { error } = await ctx.db.from("whatsapp_conversation_state").upsert({ salon_id: ctx.salonId, phone: ctx.phone, human_takeover: true, taken_over_by: null, taken_over_at: new Date().toISOString(), pending_action: null, pending_action_expires_at: null }, { onConflict: "salon_id,phone" });
    if (error) fail();
    // Sino do painel (admin_notifications). Falha aqui não impede a resposta ao cliente.
    const who = c.s.name ?? ctx.name ?? "Cliente";
    await ctx.db.from("admin_notifications").insert({ salon_id: ctx.salonId, type: "whatsapp_handoff", title: "💬 Cliente pediu atendente", message: `${who} (${ctx.phone}) quer falar com uma pessoa no WhatsApp. O assistente ficará pausado por ${c.cfg.handoffHours}h.`, client_name: who, client_phone: ctx.phone, metadata: { phone: ctx.phone, until } });
  }
  const text = `Certo! Um atendente da equipe do *${c.salon.name}* vai assumir esta conversa em instantes. 🙋\n\nO assistente automático fica pausado por ${c.cfg.handoffHours}h. Se preferir voltar ao atendimento automático antes, digite *0*.`;
  return { messages: [buttonsMode(c) ? quickButtons(c, text.replace(", digite *0*.", ", toque no botão abaixo."), [{ id: "menu_main", title: "🤖 Voltar ao robô" }]) : { type: "text", text }], model: "guided_handoff", handoff: true };
}

// ----------------------------------------------------------------------------------------------- transições
async function back(c: Ctx): Promise<Out> {
  const prev = c.s.data.stack?.pop();
  const f = c.s.data.flow;
  switch (prev) {
    case "SELECT_SERVICE": return selectService(c);
    case "SELECT_PROFESSIONAL": if (f) f.professionalId = undefined; return selectProfessional(c);
    case "SELECT_DATE": case "RESCHEDULE_SELECT_DATE": if (f) { f.date = undefined; f.start = undefined; } c.s.data.period = null; return selectDate(c);
    case "SELECT_TIME": case "RESCHEDULE_SELECT_TIME": if (f) f.start = undefined; return selectTime(c);
    case "CONFIRM_NAME": return confirmName(c);
    case "MY_APPOINTMENTS": return myAppointments(c);
    case "APPOINTMENT_ACTIONS": return appointmentActions(c);
    default: return mainMenu(c, false);
  }
}

async function startReschedule(c: Ctx): Promise<Out> {
  const a = c.s.data.target!;
  const { data, error } = await c.ctx.db.from("appointments").select("service_id,professional_id").eq("id", a.id).eq("salon_id", c.ctx.salonId).eq("client_phone", c.ctx.phone).maybeSingle();
  if (error) fail();
  if (!data) return mainMenu(c, false);
  c.s.data.flow = { kind: "flow", step: "date", serviceId: data.service_id, professionalId: data.professional_id, excludeAppointmentId: a.id, requestKey: crypto.randomUUID() };
  return selectDate(c, `Vamos remarcar ${apptLabel(a)}.`);
}

async function handle(c: Ctx, input: Input, deps: GuidedDeps): Promise<Out> {
  const { s } = c, text = input.text.trim(), step = s.step;
  const cmd = parseCommand(text);
  const sel = input.selection ?? null;
  // Comandos globais e ids fixos do menu principal valem em qualquer etapa.
  if (cmd === "human" || sel === "menu_human") return handoff(c);
  if (cmd === "menu" || sel === "menu_main") return mainMenu(c, step === "IDLE" || step === "HUMAN_HANDOFF");
  if (cmd === "back") return back(c);
  if (cmd === "book" || sel === "menu_book") { push(c, step); return selectService(c); }
  if (cmd === "mine" || cmd === "cancel" || sel === "menu_my_appointments") { push(c, step); return myAppointments(c); }
  if (cmd === "prices" || sel === "menu_services") return pricesInfo(c);
  if (sel === "menu_info") return infoMenu(c);
  if (step === "IDLE" || step === "HUMAN_HANDOFF") return mainMenu(c);

  const choice = resolveChoice(s.data.menu, text, sel);
  const picked = typeof choice === "number" ? s.data.menu!.options[choice] as Record<string, unknown> : null;
  const page = s.data.menu?.page ?? 0;
  const f = s.data.flow;
  const unknown = () => unknownInput(c, text, deps);
  switch (step) {
    case "MAIN_MENU": {
      if (choice === "more") return mainMenu(c, false, page + 1);
      if (!picked) return unknown();
      push(c, step);
      switch (picked.go) { case "book": return selectService(c); case "mine": return myAppointments(c); case "prices": return pricesInfo(c); case "info": return infoMenu(c); case "human": return handoff(c); default: return mainMenu(c, false); }
    }
    case "SELECT_SERVICE": {
      if (choice === "more") return selectService(c, "", page + 1); // lista (> 9) ou botões (> 3): próxima página
      if (!picked || !f) return unknown();
      push(c, step); f.serviceId = String(picked.id);
      return selectProfessional(c);
    }
    case "SELECT_PROFESSIONAL": {
      if (choice === "more") return selectProfessional(c, "", page + 1);
      if (!picked || !f) return unknown();
      push(c, step); f.professionalId = (picked.id as string | null) ?? null;
      return selectDate(c);
    }
    case "SELECT_DATE": case "RESCHEDULE_SELECT_DATE": {
      if (!f) return mainMenu(c, false);
      if (choice === "more") return selectDate(c, "", page + 1);
      if (picked?.other) { s.data.typingDate = true; s.data.menu = null; return say(c, step, "Digite a data desejada no formato *DD/MM* (ex.: 15/11)."); }
      const typed = picked ? String(picked.date) : parseTypedDate(text, today(c.tz).toString());
      if (!typed) return s.data.typingDate ? say(c, step, "Não entendi a data. Use o formato *DD/MM* (ex.: 15/11) ou digite *V* para voltar.") : unknown();
      push(c, step); f.date = typed; f.start = undefined; s.data.period = null;
      return selectTime(c);
    }
    case "SELECT_TIME": case "RESCHEDULE_SELECT_TIME": {
      if (!f) return mainMenu(c, false);
      if (choice === "more") return selectTime(c, "", page + 1);
      // Modo botões: turno escolhido (☀️/🌤️/🌙) ou "Outro turno" volta à escolha de turno.
      if (picked && "period" in picked) { s.data.period = (picked.period as string | null) ?? null; return selectTime(c); }
      let start = picked ? String(picked.start) : parseTypedTime(text);
      if (start && !picked && !(await freeTimes(c.ctx, f)).includes(start)) start = null;
      if (!start) return parseTypedTime(text) ? selectTime(c, "Esse horário não está livre. Escolha um dos disponíveis:") : unknown();
      push(c, step); f.start = start;
      if (s.data.target) return changeAppointment(c, "reschedule");
      return confirmName(c);
    }
    case "CONFIRM_NAME": {
      if (!f) return mainMenu(c, false);
      if (picked?.other) return say(c, step, "Digite seu nome completo (ex.: Maria Souza).");
      const name = picked ? String(picked.name) : fullName(text);
      if (!name) return say(c, step, "Preciso do nome e sobrenome, por favor (ex.: Maria Souza).");
      push(c, step); f.name = name; s.name = name;
      return confirmBooking(c);
    }
    case "CONFIRM_BOOKING": {
      const ok = picked ? picked.ok : /^(confirmar|confirmo|sim|ok)$/i.test(text) ? true : null;
      if (ok === true) return book(c);
      if (ok === "time") { if (f) { f.date = undefined; f.start = undefined; } return selectDate(c); }
      if (ok === false) { s.data = {}; return say(c, "IDLE", "Tudo bem, não agendei nada. Quando quiser, é só digitar *0*.", "guided_cancelled"); }
      return unknown();
    }
    case "MY_APPOINTMENTS": {
      if (choice === "more") return myAppointments(c, "", page + 1);
      if (!picked) return unknown();
      s.data.target = (s.data.appts ?? []).find(a => a.id === picked.id) ?? null;
      if (!s.data.target) return myAppointments(c);
      push(c, step);
      return appointmentActions(c);
    }
    case "APPOINTMENT_ACTIONS": {
      if (!picked) return unknown();
      push(c, step);
      if (picked.act === "cancel") return confirmCancel(c);
      if (picked.act === "reschedule") return startReschedule(c);
      return mainMenu(c, false);
    }
    case "CONFIRM_CANCEL_APPOINTMENT": {
      if (!picked) return unknown();
      if (picked.yes === true) return changeAppointment(c, "cancel");
      s.data = {};
      return say(c, "IDLE", "Combinado, seu horário continua mantido. Digite *0* para o menu.", "guided_cancel_kept");
    }
  }
  return mainMenu(c);
}

/** Texto fora das opções: IA responde curto (se houver) e a etapa atual é reapresentada. */
async function unknownInput(c: Ctx, text: string, deps: GuidedDeps): Promise<Out> {
  const { s } = c;
  let intro = "Não entendi. Escolha uma das opções abaixo:";
  let model = "guided_repeat";
  if (deps.ai && text.length >= 3 && !/^\d{1,2}$/.test(text)) {
    const r = await deps.ai(text).catch(() => null);
    if (r?.startBooking !== undefined) { push(c, s.step); if (r.text) { const out = await selectService(c, r.text); out.model = "guided_ai_booking"; return out; } return selectService(c); }
    if (r?.text) { intro = r.text; model = "guided_ai_fallback"; }
  }
  const again = await repeat(c);
  again.model = model;
  return prefix(again, intro);
}
async function repeat(c: Ctx): Promise<Out> {
  const page = c.s.data.menu?.page ?? 0;
  switch (c.s.step) {
    case "SELECT_SERVICE": return selectService(c);
    case "SELECT_PROFESSIONAL": return selectProfessional(c);
    case "SELECT_DATE": case "RESCHEDULE_SELECT_DATE": return selectDate(c, "", page);
    case "SELECT_TIME": case "RESCHEDULE_SELECT_TIME": return selectTime(c, "", page);
    case "CONFIRM_NAME": return confirmName(c);
    case "CONFIRM_BOOKING": return confirmBooking(c);
    case "MY_APPOINTMENTS": return myAppointments(c);
    case "APPOINTMENT_ACTIONS": return appointmentActions(c);
    case "CONFIRM_CANCEL_APPOINTMENT": return confirmCancel(c);
    default: return mainMenu(c, false);
  }
}

/**
 * Ponto de entrada. Retorna null quando o fluxo guiado não deve responder (tabela ausente, mídia/avaliação ou
 * pagamento PIX em andamento no atendente clássico): o caminho antigo assume.
 */
export async function guidedReply(ctx: BotContext, input: Input, deps: GuidedDeps = {}, humanPaused = false): Promise<GuidedReply | null> {
  if (input.media || (input.selection && /^rate\./.test(input.selection))) return null;
  const [cfg, loaded] = await Promise.all([automationOf(ctx), loadSession(ctx, deps)]);
  if (!cfg.guided || loaded === "unavailable") return null;
  const s = loaded;
  const now = Date.now();
  // Pausa feita pelo dono na central (sem prazo do fluxo): o caminho clássico silencia.
  if (humanPaused && !s.takeoverUntil) return null;
  // Transbordo humano com prazo: enquanto vale, silêncio; vencido, libera e volta ao menu.
  if (s.takeoverUntil) {
    // Só "0"/"menu" explícitos liberam antes do prazo ("oi" é conversa com a pessoa da equipe).
    const release = /^(0|menu)$/i.test(input.text.trim()) || input.selection === "menu_main";
    if (new Date(s.takeoverUntil).getTime() > now && !release) return { text: "", provider: "deterministic", model: "guided_paused", messages: [], session: s };
    s.takeoverUntil = null; s.step = "IDLE";
    if (!ctx.preview) {
      const { error } = await ctx.db.from("whatsapp_conversation_state").update({ human_takeover: false, updated_at: new Date().toISOString() }).eq("salon_id", ctx.salonId).eq("phone", ctx.phone).is("taken_over_by", null);
      if (error) fail();
    }
  }
  if (s.step !== "IDLE" && s.lastAt && now - new Date(s.lastAt).getTime() > SESSION_TTL_MS) { s.step = "IDLE"; s.data = {}; }
  const salon = await salonOf(ctx);
  const c: Ctx = { ctx, cfg, salon, s, tz: salon.timezone ?? "America/Sao_Paulo" };
  const out = await handle(c, input, deps);
  await saveSession(ctx, s);
  const text = out.messages.map(m => m.text).filter(Boolean).join("\n\n").slice(0, 4096);
  return { text, provider: "deterministic", model: out.model, messages: out.messages, handoff: out.handoff, session: s, flowState: out.flowState };
}
