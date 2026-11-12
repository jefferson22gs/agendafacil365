// Lógica pura do lembrete de retorno (sem Deno/IO): testada em tests/rebrand/returns.test.cjs.
export const DEFAULT_TEMPLATE =
  "Olá, {cliente}! Já faz {dias} desde seu {procedimento} no {salao} ({data_procedimento}). Está na hora do retorno. Agende: {link_agendamento}";

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** "30 dias", "2 meses", "1 semana": como o cliente entende o intervalo. */
export function humanDays(days: number): string {
  if (days % 30 === 0 && days >= 30) return days === 30 ? "1 mês" : `${days / 30} meses`;
  if (days === 7) return "1 semana";
  return days === 1 ? "1 dia" : `${days} dias`;
}
export const brDate = (iso: string) => /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join("/") : iso;

export function renderTemplate(template: string | null | undefined, v: { cliente: string; procedimento: string; salao: string; dias: number; data_procedimento: string; link_agendamento: string }): string {
  const values: Record<string, string> = { ...v, dias: humanDays(v.dias), data_procedimento: brDate(v.data_procedimento), cliente: v.cliente || "cliente" };
  const t = (template ?? "").trim() || DEFAULT_TEMPLATE;
  return t.replace(/\{(cliente|procedimento|salao|dias|data_procedimento|link_agendamento)\}/g, (_, k) => values[k]).slice(0, 2000);
}

export function safeHttps(value: unknown): string {
  try { const u = new URL(String(value)); return u.protocol === "https:" && !u.username && !u.password ? u.href : ""; } catch { return ""; }
}

/** Texto legível sobre a cor do salão (WCAG 4.5:1): #FFFFFF ou #0F172A. */
function onColor(hex: string): string {
  const f = hex.length === 4 ? "#" + [...hex.slice(1)].map((c) => c + c).join("") : hex;
  const lum = (h: string) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const l = lum(f), ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return ratio(l, 1) >= ratio(l, lum("#0F172A")) ? "#FFFFFF" : "#0F172A";
}

/**
 * Remetente com a identidade do salão no domínio já verificado: "Nome do Salão" <slug@agendafacil365.com.br>.
 * Endereço por salão (parte local = slug) não exige DNS novo; subdomínio por salão exigiria verificar cada um no Resend.
 */
export function salonSender(salonName: string, slug: string | null | undefined, platformFrom: string): string {
  const domain = platformFrom.match(/@([a-z0-9.-]+\.[a-z]{2,})>?\s*$/i)?.[1]?.toLowerCase() ?? "agendafacil365.com.br";
  const local = String(slug ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "").slice(0, 64) || "lembretes";
  const name = String(salonName ?? "").replace(/[\r\n"<>\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Agenda Fácil 365";
  return `"${name}" <${local}@${domain}>`;
}

/** Respostas do cliente vão para o e-mail do salão (se válido); senão, para o padrão da plataforma. */
export function salonReplyTo(salonEmail: string | null | undefined, fallback?: string | null): string | undefined {
  const e = String(salonEmail ?? "").trim().toLowerCase();
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(e) ? e : (fallback?.trim() || undefined);
}

/** Logo do Storage em versão leve (o original pode ter megabytes); outras URLs HTTPS seguem como estão. */
export function emailLogo(url: string | null | undefined): string {
  const safe = safeHttps(url);
  if (!safe) return "";
  const u = new URL(safe);
  if (u.hostname.endsWith(".supabase.co") && u.pathname.startsWith("/storage/v1/object/public/")) {
    u.pathname = u.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    u.search = "?width=160&height=160&resize=contain";
  }
  return u.href;
}

export interface EmailInput {
  from: string; to: string; salon: string; color?: string | null; logo?: string | null; message: string; url: string; procedure: string; replyTo?: string;
  /** Outros avisos com a mesma marca do salão (ex.: agendamento confirmado). Padrão: lembrete de retorno. */
  subject?: string; cta?: string; footer?: string;
}
/** Payload do Resend com logo/cores do salão. Null quando faltam dados (nunca envia link/e-mail inválido). */
export function emailPayload(i: EmailInput) {
  const link = safeHttps(i.url);
  if (!i.from || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(i.to) || !link) return null;
  const color = HEX.test(i.color ?? "") ? i.color! : "#2563EB", fg = onColor(color);
  const logo = emailLogo(i.logo);
  const subject = (i.subject ?? `${i.salon}: hora do seu retorno (${i.procedure})`).replace(/[\r\n]+/g, " ").slice(0, 180);
  const cta = i.cta ?? "Agendar meu retorno";
  const footer = i.footer ?? `Recebeu por engano ou não quer mais lembretes? Responda a este e-mail ou avise ${i.salon}.`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#F4F8FF;font-family:Arial,Helvetica,sans-serif;color:#0F172A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden">
<tr><td align="center" style="background:${color};color:${fg};padding:24px">
${logo ? `<img src="${esc(logo)}" alt="Logo de ${esc(i.salon)}" width="72" height="72" style="border-radius:16px;background:#FFFFFF;display:block;margin:0 auto 12px;object-fit:contain">` : ""}
<h1 style="margin:0;font-size:22px;line-height:1.3;color:${fg}">${esc(i.salon)}</h1></td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.6;color:#0F172A"><p style="margin:0 0 20px;white-space:pre-line">${esc(i.message)}</p>
<p style="margin:0 0 24px;text-align:center"><a href="${esc(link)}" style="display:inline-block;background:${color};color:${fg};padding:14px 28px;border-radius:10px;font-weight:bold;text-decoration:none;min-height:24px">${esc(cta)}</a></p>
<p style="margin:0;font-size:13px;color:#475569">${esc(footer)}</p></td></tr>
</table></td></tr></table></body></html>`;
  return { from: i.from, to: [i.to], subject, html, text: `${i.message}\n\n${i.cta ? `${cta}: ` : "Agendar: "}${link}`, ...(i.replyTo ? { reply_to: i.replyTo } : {}) };
}

/** accepted = Resend aceitou (não é entrega). retry só com a mesma Idempotency-Key, dentro da janela. */
export function resendOutcome(status: number, body: unknown): "accepted" | "retry" | "failed" {
  const id = (body as { id?: unknown } | null)?.id;
  if (status >= 200 && status < 300) return typeof id === "string" && id ? "accepted" : "retry"; // 2xx sem id: incerto, mesma chave
  if (status === 408 || status === 409 || status === 429 || status >= 500 || status === 0) return "retry";
  return "failed";
}
