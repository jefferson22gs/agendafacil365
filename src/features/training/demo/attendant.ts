/**
 * Atendente da DEMONSTRAÇÃO: roteiro determinístico que imita o fluxo do chatbot real
 * (serviço, profissional, data, horário, nome completo, telefone, aniversário opcional, CONFIRMAR, pagamento).
 * Puro: sem rede, sem IA, sem imports. Preços/serviços vêm SÓ dos parâmetros (fixtures); sem catálogo, não inventa valores.
 * ponytail: entende frases simples por palavras-chave; o atendimento real usa a IA com ferramentas do salão.
 * Integração (mockSupabase, outro agente): simulateAttendant(historico, db.services, { professionals: db.professionals, salonName: salon.name, phone }).
 */
export interface AttendantMessage { role: "user" | "assistant"; content: string; kind?: "text" | "image" }
export interface AttendantService { id?: string; name: string; price: number; duration_minutes?: number | null }
export interface AttendantProfessional { id?: string; name: string }
export interface AttendantOptions {
  salonName?: string;
  professionals?: AttendantProfessional[];
  /** Horários livres oferecidos (fixture). Sem lista, aceita o horário HH:MM que o cliente digitar. */
  slots?: string[];
  /** Telefone desta conversa de WhatsApp (só dígitos ou formatado). */
  phone?: string;
  /** Cadastro existente: o que vier preenchido não é perguntado de novo. */
  client?: { name?: string | null; phone?: string | null; birth_date?: string | null } | null;
}
export type AttendantStep = "service" | "professional" | "date" | "time" | "name" | "phone" | "birthday" | "confirm" | "payment" | "done";
export interface AttendantBooking {
  service: AttendantService | null; professional: string | null; date: string | null; time: string | null;
  name: string | null; phone: string | null; birthday: string | null;
  confirmed: boolean; payment: "now" | "salon" | null; proofReceived: boolean;
}
export interface AttendantResult { reply: string; step: AttendantStep; booking: AttendantBooking; demo: true; chips?: string[] }

function stepChips(step: AttendantStep, services: AttendantService[], pros: AttendantProfessional[], slots?: string[]): string[] {
  switch (step) {
    case "service": return services.map(s => s.name).slice(0, 10);
    case "professional": return ["Qualquer profissional", ...pros.map(p => p.name)].slice(0, 10);
    case "date": return ["Hoje", "Amanhã"];
    case "time": return (slots?.length ? slots : ["09:00", "10:30", "14:00", "16:00"]).slice(0, 10);
    case "confirm": return ["CONFIRMAR", "Mudar horário", "Cancelar"];
    case "payment": return ["Pagar agora (PIX)", "Pagar no salão"];
    default: return [];
  }
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(w => w.length > 2);
const brl = (v: number) => `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
const digits = (s: string) => s.replace(/\D/g, "");
const fmtPhone = (d: string) => d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
/** Celular/fixo BR com DDD (10-11 dígitos, aceita prefixo 55). */
export function validPhone(raw: string): string | null {
  let d = digits(raw);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  if (Number(d.slice(0, 2)) < 11 || d[2] === "0" || (d.length === 11 && d[2] !== "9")) return null;
  return d;
}
const validDate = (dd: number, mm: number, yyyy?: number) => {
  const y = yyyy ?? 2000; // ano bissexto: aceita 29/02 sem ano
  const d = new Date(y, mm - 1, dd);
  return d.getFullYear() === y && d.getMonth() === mm - 1 && d.getDate() === dd;
};
const pad = (n: number) => String(n).padStart(2, "0");

const INJECTION = /(ignor|esquec|desconsider)\w*\s+(as\s+|suas\s+|todas\s+)?(regra|instruc)|prompt|modo (dev|desenvolvedor)|system/;
const ASK_HUMAN = /(voce|vc)\s+e\s+(uma?\s+)?(pessoa|humana?|robo|bot|ia|inteligencia)|e\s+(um\s+)?robo|falando com (um\s+)?(robo|humano|pessoa)/;
const PROOF = /comprovante|paguei|pix (feito|enviado)|transferi/;

export function simulateAttendant(messages: AttendantMessage[], services: AttendantService[] = [], opts: AttendantOptions = {}): AttendantResult {
  const salon = opts.salonName?.trim() || "salão";
  const pros = (opts.professionals ?? []).filter(p => p?.name);
  const b: AttendantBooking = {
    service: null, professional: null, date: null, time: null,
    name: opts.client?.name?.trim() && opts.client.name.trim().split(/\s+/).length >= 2 ? opts.client.name.trim() : null,
    phone: opts.client?.phone ? validPhone(opts.client.phone) : null,
    birthday: opts.client?.birth_date ?? null,
    confirmed: false, payment: null, proofReceived: false,
  };
  let step: AttendantStep = "service";
  let birthdayAsked = !!b.birthday;
  let reply = "";

  const nextStep = (): AttendantStep => {
    if (!b.service) return "service";
    if (!b.professional && pros.length) return "professional";
    if (!b.date) return "date";
    if (!b.time) return "time";
    if (!b.name) return "name";
    if (!b.phone) return "phone";
    if (!birthdayAsked) return "birthday";
    if (!b.confirmed) return "confirm";
    if (!b.payment) return "payment";
    return "done";
  };
  const question = (s: AttendantStep): string => {
    switch (s) {
      case "service":
        return services.length
          ? `Qual serviço você gostaria de agendar? Temos ${services.map(x => x.name).join(", ")}.`
          : "Qual serviço você gostaria de agendar?";
      case "professional": return `Tem preferência de profissional? Atendem ${pros.map(p => p.name).join(", ")}, ou pode ser qualquer um.`;
      case "date": return "Para qual dia você prefere? Pode ser hoje, amanhã ou uma data como 15/12.";
      case "time": return opts.slots?.length ? `Para ${b.date} tenho ${opts.slots.join(", ")}. Qual fica melhor?` : `Qual horário você prefere em ${b.date}? Ex.: 14:00.`;
      case "name": return "Para o cadastro, qual é o seu nome completo?";
      case "phone": return opts.phone && validPhone(opts.phone)
        ? `Posso usar este número de WhatsApp, ${fmtPhone(validPhone(opts.phone)!)}, no cadastro? Se preferir outro, envie com DDD.`
        : "Qual telefone com DDD devo usar no cadastro?";
      case "birthday": return "Quer informar sua data de aniversário (dia/mês)? É opcional.";
      case "confirm": {
        const s = b.service!;
        return `Resumo: ${s.name}${b.professional ? ` com ${b.professional}` : ""} em ${b.date} às ${b.time}, ${brl(s.price)}. Responda CONFIRMAR para agendar.`;
      }
      case "payment": return "Agendado! Prefere pagar agora pelo link do salão ou pagar no salão no dia?";
      case "done": return `Seu horário está reservado. Qualquer dúvida, é só chamar a recepção do ${salon}.`;
    }
  };

  const users = messages.filter(m => m?.role === "user");
  users.forEach((m, i) => {
    const raw = String(m.content ?? "").slice(0, 2000);
    const t = norm(raw);
    step = nextStep();
    const greet = i === 0 ? `Olá! Aqui é a recepção do ${salon}. ` : "";

    if (INJECTION.test(t)) { reply = `Não consigo fazer isso; sigo as regras de atendimento do ${salon}. ${question(step)}`; return; }
    if (ASK_HUMAN.test(t)) { reply = `Sou a assistente virtual do ${salon}. Se preferir falar com alguém da equipe, é só pedir. ${question(step)}`; return; }
    if (/desconto|cupom/.test(t)) { reply = `Descontos só valem com cupom autorizado pelo ${salon}; a equipe confere no atendimento. ${question(step)}`; return; }
    if (m.kind === "image" && !b.confirmed) { reply = `Recebi a imagem; a equipe do ${salon} pode avaliar no atendimento. ${question(step)}`; return; }
    if (m.kind === "image" || PROOF.test(t)) {
      if (b.confirmed) { b.proofReceived = true; b.payment ??= "now"; reply = "Recebi o comprovante e registrei para a equipe conferir. O pagamento só é confirmado depois que o salão validar."; }
      else reply = `Ainda não há agendamento para pagar. ${question(step)}`;
      return;
    }

    switch (step) {
      case "service": {
        if (!services.length) { reply = `${greet}Na demonstração, o catálogo de serviços não foi carregado, então não consigo informar valores. Fale com a equipe do ${salon}.`; return; }
        const full = services.filter(s => t.includes(norm(s.name)));
        const tw = words(raw);
        const scored = services.map(s => ({ s, n: words(s.name).filter(w => tw.includes(w)).length })).filter(x => x.n > 0);
        const top = scored.length ? Math.max(...scored.map(x => x.n)) : 0;
        const hits = full.length ? full : scored.filter(x => x.n === top).map(x => x.s);
        if (hits.length === 1) { b.service = hits[0]; reply = `${greet}${hits[0].name} custa ${brl(hits[0].price)}${hits[0].duration_minutes ? ` e leva cerca de ${hits[0].duration_minutes} min` : ""}. ${question(nextStep())}`; return; }
        reply = hits.length > 1 ? `${greet}Temos ${hits.map(s => s.name).join(" e ")}. Qual deles?` : `${greet}${question("service")}`;
        return;
      }
      case "professional": {
        if (/qualquer|tanto faz|sem preferencia|nao tenho/.test(t)) b.professional = "qualquer profissional disponível";
        else b.professional = pros.find(p => words(p.name).some(w => words(raw).includes(w)))?.name ?? null;
        reply = b.professional ? `Combinado. ${question(nextStep())}` : question("professional");
        return;
      }
      case "date": {
        const dm = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
        if (/\bhoje\b/.test(t)) b.date = "hoje";
        else if (/\bamanha\b/.test(t)) b.date = "amanhã";
        else if (dm && validDate(+dm[1], +dm[2], dm[3] ? +dm[3] : undefined)) b.date = `${pad(+dm[1])}/${pad(+dm[2])}`;
        reply = b.date ? question(nextStep()) : `Não entendi a data. ${question("date")}`;
        return;
      }
      case "time": {
        const hm = t.match(/\b(\d{1,2})(?:[:h](\d{2}))?\s*h?\b/);
        const cand = hm && +hm[1] < 24 && +(hm[2] ?? 0) < 60 ? `${pad(+hm[1])}:${hm[2] ?? "00"}` : null;
        if (cand && (!opts.slots?.length || opts.slots.includes(cand))) { b.time = cand; reply = `Perfeito! ${question(nextStep())}`; }
        else reply = cand ? `Esse horário não está livre. ${question("time")}` : question("time");
        return;
      }
      case "name": {
        const name = raw.replace(/^(meu nome e|meu nome é|sou|eu sou)\s+/i, "").trim().replace(/\s+/g, " ");
        if (/^[\p{L}' -]{5,80}$/u.test(name) && name.split(" ").filter(w => w.length > 1).length >= 2) { b.name = name; reply = `Obrigada, ${name.split(" ")[0]}! ${question(nextStep())}`; }
        else reply = "Preciso do nome completo (nome e sobrenome), por favor.";
        return;
      }
      case "phone": {
        const typed = validPhone(raw);
        const own = opts.phone ? validPhone(opts.phone) : null;
        if (typed) b.phone = typed;
        else if (own && /^(sim|pode|isso|ok|esse|este|claro|s)\b/.test(t)) b.phone = own;
        reply = b.phone ? `Anotado. ${question(nextStep())}` : `Preciso de um telefone válido com DDD, por exemplo (11) 91234-5678.`;
        return;
      }
      case "birthday": {
        birthdayAsked = true;
        const dm = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
        if (dm && validDate(+dm[1], +dm[2], dm[3] ? +dm[3] : undefined)) { b.birthday = `${pad(+dm[1])}/${pad(+dm[2])}`; reply = `Anotado! ${question(nextStep())}`; }
        else reply = `Tudo bem! ${question(nextStep())}`;
        return;
      }
      case "confirm": {
        if (/\bconfirmar\b/.test(t)) { b.confirmed = true; reply = question("payment"); }
        else if (/\b(nao|cancela|mudar|trocar|outro)\b/.test(t)) { b.time = null; reply = `Sem problema, nada foi agendado. ${question("time")}`; }
        else reply = `Para agendar, responda CONFIRMAR. ${question("confirm")}`;
        return;
      }
      case "payment": {
        if (/agora|link|pix|cartao|online/.test(t)) { b.payment = "now"; reply = "Na demonstração não há cobrança real. No salão de verdade, o link de pagamento chegaria aqui; depois envie o comprovante para a equipe conferir."; }
        else if (/salao|no dia|\bla\b|pessoalmente|depois/.test(t)) { b.payment = "salon"; reply = `Combinado, o pagamento fica para o dia do atendimento. Até ${b.date}!`; }
        else reply = question("payment");
        return;
      }
      default: reply = question("done");
    }
  });

  if (!users.length) reply = `Olá! Aqui é a recepção do ${salon}. ${question("service")}`;
  const endStep = nextStep();
  return { reply, step: endStep, booking: b, demo: true, chips: stepChips(endStep, services, pros, opts.slots) };
}
