// Texto do e-mail de agendamento confirmado (puro, sem Deno/IO): testado em tests/whatsapp/client-email.test.cjs.
const WEEK = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const br = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export interface ConfirmedRow {
  client_name?: string | null; service?: string | null; professional?: string | null; date: string; start: string;
  final_price?: number | null; credit?: boolean;
  salon: { name: string; address?: string | null; city?: string | null; phone?: string | null };
}
export function confirmedMessage(r: ConfirmedRow): { subject: string; message: string } {
  const first = String(r.client_name ?? "").trim().split(" ")[0] || "cliente";
  const day = WEEK[new Date(`${r.date}T12:00:00Z`).getUTCDay()];
  const where = [r.salon.address, r.salon.city].filter(Boolean).join(", ");
  const price = r.credit ? "Incluso no seu pacote (1 crédito usado)" : Number(r.final_price) > 0 ? `R$ ${Number(r.final_price).toFixed(2).replace(".", ",")}` : "";
  const lines = [
    `Olá, ${first}! Seu agendamento está confirmado. ✅`, "",
    `Serviço: ${r.service ?? "Atendimento"}`, ...(r.professional ? [`Profissional: ${r.professional}`] : []),
    `Data: ${day}, ${br(r.date)} às ${r.start}`, ...(price ? [`Valor: ${price}`] : []), ...(where ? [`Endereço: ${where}`] : []),
    ...(r.salon.phone ? [`Contato: ${r.salon.phone}`] : []), "",
    "Precisa remarcar ou cancelar? Use o botão abaixo ou fale com a gente.",
  ];
  return { subject: `${r.salon.name}: agendamento confirmado para ${br(r.date)} às ${r.start}`, message: lines.join("\n") };
}
