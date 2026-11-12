// Edge Function: client-emails — e-mail ao cliente quando o agendamento é confirmado (fila client_email_outbox).
// Acionada pelo banco (trigger + cron de 5 min), só com chave de worker. Remetente com a marca do salão:
// "Nome do Salão" <slug@agendafacil365.com.br>, logo e cor do salão, respostas para o e-mail do salão.
// Chave do Resend SÓ em secret (RESEND_API_KEY).
import { authorizeWorker, serviceClient } from "../_shared/whatsapp/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { emailPayload, resendOutcome, safeHttps, salonReplyTo, salonSender } from "../process-return-alerts/core.ts";
import { confirmedMessage } from "./core.ts";

const BATCH = 30, BUDGET_MS = 40_000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (req.method !== "POST") throw new WhatsAppError("invalid_request", 405);
    authorizeWorker(req);
    const db = serviceClient();
    const key = Deno.env.get("RESEND_API_KEY")?.trim();
    if (!key) return jsonResponse({ success: true, processed: 0, email_configured: false });
    const from = Deno.env.get("RESEND_FROM")?.trim() || "Agenda Fácil 365 <lembretes@agendafacil365.com.br>";
    const replyTo = Deno.env.get("RESEND_REPLY_TO")?.trim();
    const origin = safeHttps((Deno.env.get("APP_PUBLIC_URL") ?? "https://agendafacil365.com.br").split(",")[0].trim());
    if (!origin) throw new WhatsAppError("configuration_missing", 503);
    const started = Date.now();
    let processed = 0, sent = 0;
    for (let i = 0; i < BATCH && Date.now() - started < BUDGET_MS; i++) {
      const { data: row, error } = await db.rpc("client_email_claim");
      if (error) throw new WhatsAppError("persistence_failed", 503);
      if (!row) break;
      if (row.skip) continue;
      const { subject, message } = confirmedMessage(row);
      const payload = emailPayload({
        from: salonSender(row.salon.name, row.salon.slug, from), to: row.to, salon: row.salon.name, color: row.salon.primary_color,
        logo: row.salon.logo_url || row.salon.pwa_icon_url, message, procedure: row.service ?? "",
        url: new URL(`/s/${encodeURIComponent(row.salon.slug ?? "")}/meus-agendamentos`, origin).href,
        replyTo: salonReplyTo(row.salon.email, replyTo), subject, cta: "Ver meus agendamentos",
        footer: `Você recebeu este e-mail porque agendou um horário em ${row.salon.name}. Não foi você? Responda a este e-mail.`,
      });
      let status = "failed", id: string | null = null;
      if (payload) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST", signal: AbortSignal.timeout(15_000),
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `client-email/${row.id}` },
            body: JSON.stringify(payload),
          });
          const out = await res.json().catch(() => null);
          status = resendOutcome(res.status, out);
          id = status === "accepted" ? String(out.id) : null;
          if (status !== "accepted") console.warn("client_email_not_accepted", { status: res.status });
        } catch { status = "retry"; }
      }
      await db.rpc("client_email_finish", { p_id: row.id, p_claim: row.claim, p_status: status, p_resend_id: id });
      if (status === "accepted") sent++;
      processed++;
    }
    return jsonResponse({ success: true, processed, sent, email_configured: true });
  } catch (error) { return errorResponse(error); }
});
