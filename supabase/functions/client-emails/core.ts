// Textos dos e-mails ao cliente (puro, sem Deno/IO): testado em tests/whatsapp/packages-bot.test.cjs e client-emails.test.cjs.
const WEEK = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const br = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const money = (cents: unknown) => `R$ ${(Number(cents ?? 0) / 100).toFixed(2).replace(".", ",")}`;
const when = (date: string, start: string) => `${WEEK[new Date(`${date.slice(0, 10)}T12:00:00Z`).getUTCDay()]}, ${br(date)} às ${start}`;

export type EmailKind = "confirmed" | "reminder" | "cancelled" | "rescheduled" | "payment" | "package" | "credits" | "review" | "birthday";
export interface ConfirmedRow {
  client_name?: string | null; service?: string | null; professional?: string | null; date: string; start: string;
  final_price?: number | null; credit?: boolean;
  salon: { name: string; address?: string | null; city?: string | null; phone?: string | null };
}
export interface EmailRow extends Omit<ConfirmedRow, "date" | "start"> {
  kind: EmailKind; date?: string | null; start?: string | null;
  payload?: { amount_cents?: number; method?: string; package?: string; validity_days?: number; old_date?: string; old_start?: string;
    items?: { service: string; quantity?: number; remaining?: number; expires_at?: string | null }[] } | null;
}
export interface EmailText { subject: string; message: string; cta: string; /** "portal" = meus agendamentos; "book" = página do salão. */ target: "portal" | "book"; marketing: boolean }

const details = (r: ConfirmedRow) => {
  const where = [r.salon.address, r.salon.city].filter(Boolean).join(", ");
  const price = r.credit ? "Incluso no seu pacote (1 crédito usado)" : Number(r.final_price) > 0 ? `R$ ${Number(r.final_price).toFixed(2).replace(".", ",")}` : "";
  return [
    `Serviço: ${r.service ?? "Atendimento"}`, ...(r.professional ? [`Profissional: ${r.professional}`] : []),
    `Data: ${when(r.date, r.start)}`, ...(price ? [`Valor: ${price}`] : []), ...(where ? [`Endereço: ${where}`] : []),
    ...(r.salon.phone ? [`Contato: ${r.salon.phone}`] : []),
  ];
};

export function confirmedMessage(r: ConfirmedRow): { subject: string; message: string } {
  const first = String(r.client_name ?? "").trim().split(" ")[0] || "cliente";
  return {
    subject: `${r.salon.name}: agendamento confirmado para ${br(r.date)} às ${r.start}`,
    message: [`Olá, ${first}! Seu agendamento está confirmado. ✅`, "", ...details(r), "", "Precisa remarcar ou cancelar? Use o botão abaixo ou fale com a gente."].join("\n"),
  };
}

/** Assunto, texto e botão de cada aviso. Null quando faltam dados (nada é enviado). */
export function emailText(r: EmailRow): EmailText | null {
  const first = String(r.client_name ?? "").trim().split(" ")[0] || "cliente";
  const salon = r.salon.name, p = r.payload ?? {};
  const appt = r.date && r.start ? { ...r, date: r.date, start: r.start } as ConfirmedRow : null;
  const slot = appt ? `${br(appt.date)} às ${appt.start}` : "";
  const out = (subject: string, lines: string[], cta: string, target: EmailText["target"], marketing = false): EmailText => ({ subject, message: lines.join("\n"), cta, target, marketing });
  switch (r.kind) {
    case "confirmed": if (!appt) return null; { const m = confirmedMessage(appt); return { ...m, cta: "Ver meus agendamentos", target: "portal", marketing: false }; }
    case "reminder": return appt && out(`${salon}: lembrete do seu horário em ${slot}`, [`Olá, ${first}! Passando para lembrar do seu horário. ⏰`, "", ...details(appt), "", "Não vai conseguir vir? Remarque ou cancele pelo botão abaixo para liberar o horário."], "Ver meus agendamentos", "portal");
    case "cancelled": return appt && out(`${salon}: agendamento de ${slot} cancelado`, [`Olá, ${first}. Seu agendamento foi cancelado.`, "", `Serviço: ${appt.service ?? "Atendimento"}`, `Data: ${when(appt.date, appt.start)}`, ...(appt.credit ? ["O crédito do seu pacote voltou para o saldo."] : []), "", "Quando quiser, é só marcar um novo horário."], "Agendar novo horário", "book");
    case "rescheduled": return appt && out(`${salon}: agendamento remarcado para ${slot}`, [`Olá, ${first}! Seu agendamento foi remarcado. 🔄`, "", ...(p.old_date && p.old_start ? [`Antes: ${when(p.old_date, p.old_start)}`] : []), ...details(appt).map(l => l.replace(/^Data: /, "Novo horário: "))], "Ver meus agendamentos", "portal");
    case "payment": return appt && out(`${salon}: pagamento de ${money(p.amount_cents)} recebido`, [`Olá, ${first}! Recebemos seu pagamento. ✅`, "", `Valor pago: ${money(p.amount_cents)}${p.method === "pix" ? " (Pix)" : p.method === "card" ? " (cartão)" : ""}`, `Serviço: ${appt.service ?? "Atendimento"}`, `Data: ${when(appt.date, appt.start)}`, "", "Seu horário está garantido. Guarde este e-mail como comprovante."], "Ver meus agendamentos", "portal");
    case "package": return p.package ? out(`${salon}: pacote ${p.package} liberado`, [`Olá, ${first}! Seu pacote ${p.package} está liberado. 🎁`, "", `Valor pago: ${money(p.amount_cents)}`, ...(p.items ?? []).map(i => `• ${i.quantity ?? 1}x ${i.service}`), ...(Number(p.validity_days) > 0 ? [`Validade: ${p.validity_days} dias`] : []), "", "Ao agendar com o mesmo WhatsApp, seus créditos entram sozinhos."], "Agendar com meus créditos", "book") : null;
    case "credits": return p.items?.length ? out(`${salon}: seus créditos estão acabando`, [`Olá, ${first}! Um aviso sobre o seu pacote:`, "", ...p.items.map(i => `• ${i.service}: ${i.remaining === 1 ? "1 crédito" : `${i.remaining} créditos`}${i.expires_at ? ` (vale até ${br(i.expires_at)})` : ""}`), "", "Aproveite e já garanta seu próximo horário."], "Agendar agora", "book", true) : null;
    case "review": return appt && out(`${salon}: como foi seu atendimento?`, [`Olá, ${first}! Como foi seu atendimento${appt.service ? ` de ${appt.service}` : ""}${appt.professional ? ` com ${appt.professional}` : ""}?`, "", "Sua nota leva menos de um minuto e ajuda a gente a melhorar sempre. ⭐"], "Avaliar atendimento", "portal", true);
    case "birthday": return out(`Feliz aniversário, ${first}! 🎉`, [`Parabéns, ${first}! 🎂`, "", `Toda a equipe do ${salon} deseja um dia incrível para você.`, "Que tal comemorar com um horário só seu?"], "Agendar meu horário", "book", true);
  }
}
