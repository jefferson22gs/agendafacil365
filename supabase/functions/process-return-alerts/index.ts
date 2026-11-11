// Edge Function: process-return-alerts — lembretes de retorno de procedimento (WhatsApp + E-mail Resend + Push + aviso interno).
// Cron (pg_cron, Vault): processa vencidos a partir das 09h no fuso de cada salão. Manual ("Disparar agora"): dono/admin
// do salão, um alerta por vez, validado contra o tenant. Chave do Resend SÓ em secret (RESEND_API_KEY), nunca no código.
import { authorizeSalon, authorizeWorker, serviceClient, validUuid } from "../_shared/whatsapp/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { emailPayload, renderTemplate, resendOutcome, safeHttps, salonReplyTo, salonSender } from "./core.ts";

const BATCH = 40, BUDGET_MS = 45_000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (req.method !== "POST") throw new WhatsAppError("invalid_request", 405);
    const db = serviceClient();
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const manual = body.id !== undefined;
    if (manual) {
      if (!validUuid(body.id) || !validUuid(body.salon_id)) throw new WhatsAppError("invalid_request");
      await authorizeSalon(req, db, body.salon_id);
      const { data, error } = await db.from("procedure_return_alerts").select("id").eq("id", body.id).eq("salon_id", body.salon_id).maybeSingle();
      if (error) throw new WhatsAppError("persistence_failed", 503);
      if (!data) throw new WhatsAppError("forbidden", 403);
    } else authorizeWorker(req);

    const rpc = async (fn: string, args: Record<string, unknown>) => {
      const { data, error } = await db.rpc(fn, args);
      if (error) throw new WhatsAppError("persistence_failed", 503);
      return data;
    };
    const origin = safeHttps((Deno.env.get("APP_PUBLIC_URL") ?? "https://agendafacil365.com.br").split(",")[0].trim());
    if (!origin) throw new WhatsAppError("configuration_missing", 503);
    const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
    const from = Deno.env.get("RESEND_FROM")?.trim() || "Agenda Fácil 365 <lembretes@agendafacil365.com.br>";
    const replyTo = Deno.env.get("RESEND_REPLY_TO")?.trim();

    const started = Date.now();
    let processed = 0, emails = 0;
    for (let i = 0; i < (manual ? 1 : BATCH) && Date.now() - started < BUDGET_MS; i++) {
      const row = await rpc("procedure_return_claim", { p_id: manual ? body.id : null });
      if (!row) break;
      const path = `/s/${encodeURIComponent(row.salon.slug ?? "")}`;
      const link = new URL(path, origin).href;
      const message = renderTemplate(row.template, {
        cliente: row.client_name ?? "", procedimento: row.procedure_name, salao: row.salon.name,
        dias: row.return_days, data_procedimento: row.performed_at, link_agendamento: link,
      });
      // Remetente e respostas com a identidade do salão: "Nome do Salão" <slug@agendafacil365.com.br>, reply-to = e-mail do salão.
      const email = resendKey && row.client_email && !row.opt_out ? emailPayload({
        from: salonSender(row.salon.name, row.salon.slug, from), to: row.client_email, salon: row.salon.name, color: row.salon.primary_color,
        logo: row.salon.logo_url || row.salon.pwa_icon_url, message, url: link, procedure: row.procedure_name,
        replyTo: salonReplyTo(row.salon.email, replyTo),
      }) : null;
      const prepared = await rpc("procedure_return_prepare", { p_id: row.id, p_claim: row.claim, p_message: message, p_url: path, p_email: email });
      if (!prepared) continue;
      let status: string | null = null, emailId: string | null = null;
      if (prepared.email && resendKey) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST", signal: AbortSignal.timeout(15_000),
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `return-alert/${row.id}` },
            body: JSON.stringify(prepared.email),
          });
          const out = await res.json().catch(() => null);
          status = resendOutcome(res.status, out);
          emailId = status === "accepted" ? String(out.id) : null;
          if (status !== "accepted") console.warn("return_email_not_accepted", { status: res.status });
        } catch { status = "retry"; }
        if (status === "accepted") emails++;
      }
      if (!await rpc("procedure_return_finish", { p_id: row.id, p_claim: row.claim, p_email_status: status, p_email_id: emailId })) {
        console.warn("return_finish_lost_claim", { id: row.id });
      }
      processed++;
    }
    if (!manual && processed) await rpc("procedure_return_owner_digest", {}).catch(() => null);
    return jsonResponse({ success: true, processed, emails_accepted: emails, email_configured: !!resendKey });
  } catch (error) {
    return errorResponse(error);
  }
});
