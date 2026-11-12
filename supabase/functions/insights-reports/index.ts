import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeSalon, authorizeWorker, serviceClient, validUuid } from "../_shared/whatsapp/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, readRequest, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { internationalPhone } from "../_shared/whatsapp/phone.ts";
import { buildReport, deliver, runScheduled, salonInfo, verifiedRecipients } from "../_shared/insights/service.ts";
import type { ReportKind } from "../_shared/insights/core.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/**
 * Relatório por e-mail (Resend) para o e-mail da conta do dono e o e-mail do salão. Chave só em secret.
 * Retorna "sent" | "no_email" | "email_unavailable" | "failed".
 */
async function emailReport(db: SupabaseClient, salonId: string, userId: string, salonName: string, text: string): Promise<string> {
  const key = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!key) return "email_unavailable";
  const [{ data: user }, { data: salon }] = await Promise.all([db.auth.admin.getUserById(userId), db.from("salons").select("email").eq("id", salonId).maybeSingle()]);
  const to = [...new Set([user?.user?.email, salon?.email].filter((e): e is string => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
  if (!to.length) return "no_email";
  const from = Deno.env.get("RESEND_FROM")?.trim() || "Agenda Fácil 365 <lembretes@agendafacil365.com.br>";
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#0f172a"><h2 style="margin:0 0 12px">📊 Relatório — ${esc(salonName)}</h2><pre style="white-space:pre-wrap;font-family:inherit;font-size:15px;line-height:1.5;background:#f1f5f9;border-radius:12px;padding:16px">${esc(text)}</pre><p style="color:#64748b;font-size:12px">Enviado pelo Agenda Fácil 365 · Relatórios e Insights.</p></div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: `📊 Relatório ${salonName}`, text, html }),
    });
    if (!res.ok) console.warn("insights_email_failed", res.status);
    return res.ok ? "sent" : "failed";
  } catch { return "failed"; }
}

async function sha256(v: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)))).map(b => b.toString(16).padStart(2, "0")).join("");
}
const kinds: ReportKind[] = ["weekly", "monthly", "yearly"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const db = serviceClient();
    const body = await readRequest(req).catch(() => ({} as Record<string, unknown>));

    // Cron: sem action => varre salões com algum relatório ligado.
    if (!body.action) {
      authorizeWorker(req);
      const { data: all, error } = await db.from("insights_settings").select("*")
        .or("weekly_enabled.eq.true,monthly_enabled.eq.true,yearly_enabled.eq.true,alerts_enabled.eq.true").limit(500);
      if (error) throw new WhatsAppError("persistence_failed", 503);
      let sent = 0, failed = 0;
      for (const s of all ?? []) {
        try { sent += (await runScheduled({ db, salonId: s.salon_id }, s)).sent; }
        catch { failed++; console.warn("insights_salon_failed"); } // um salão com erro não para os outros
      }
      return jsonResponse({ salons: all?.length ?? 0, sent, failed });
    }

    const salonId = body.salonId;
    const userId = await authorizeSalon(req, db, salonId);
    const ctx = { db, salonId: salonId as string };
    const kind = kinds.includes(body.kind as ReportKind) ? body.kind as ReportKind : "weekly";

    if (body.action === "preview") {
      const mode = body.mode === "current" ? "current" : "closed";
      const r = await buildReport(ctx, kind, mode);
      return jsonResponse({ success: true, text: r.text, period: r.period, metrics: r.metrics, previous: r.previous });
    }

    if (body.action === "register_phone") {
      const phone = internationalPhone(body.phone);
      const { data: rec, error } = await db.from("insights_recipients")
        .upsert({ salon_id: ctx.salonId, user_id: userId, phone, verified_at: null }, { onConflict: "salon_id,phone" }).select("id").single();
      if (error || !rec) throw new WhatsAppError("persistence_failed", 503);
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
      const { error: codeError } = await db.rpc("insights_set_code", { p_recipient_id: rec.id, p_code_hash: await sha256(`${rec.id}:${code}`) });
      if (codeError) throw new WhatsAppError("persistence_failed", 503);
      // Código vai para o próprio número: prova de posse antes de receber dados financeiros.
      const salon = await salonInfo(ctx);
      const res = await deliver(ctx, {
        kind: "test", period: { start: "2000-01-01", endExclusive: "2000-01-02", label: "" },
        dedupeKey: `verify:${rec.id}:${Date.now()}`, metrics: {},
        text: `Agenda Fácil 365 Insights — ${salon.name}\n\nSeu código de verificação: ${code}\n\nDigite o código no painel (Conexão > Relatórios e Insights) ou responda esta conversa com ele. Válido por 15 minutos.`,
        recipient: { id: rec.id, phone },
      });
      if (res.status === "skipped") throw new WhatsAppError("instance_missing", 409);
      return jsonResponse({ success: true, recipientId: rec.id });
    }

    // Código digitado no painel (alternativa a responder no WhatsApp). Mesma checagem: hash, validade e 5 tentativas.
    if (body.action === "verify_code") {
      if (!validUuid(body.recipientId) || typeof body.code !== "string" || !/^\d{6}$/.test(body.code.trim())) throw new WhatsAppError("invalid_request");
      const { data: rec } = await db.from("insights_recipients").select("id").eq("id", body.recipientId).eq("salon_id", ctx.salonId).maybeSingle();
      if (!rec) throw new WhatsAppError("invalid_request");
      const { data: ok, error } = await db.rpc("insights_check_code", { p_recipient_id: rec.id, p_code_hash: await sha256(`${rec.id}:${body.code.trim()}`) });
      if (error) throw new WhatsAppError("persistence_failed", 503);
      return jsonResponse({ success: ok === true, error: ok === true ? undefined : "Código inválido ou expirado. Gere um novo código." });
    }

    // Envio manual agora (WhatsApp e/ou e-mail), sem esperar o horário agendado.
    if (body.action === "send_now") {
      const channels = Array.isArray(body.channels) ? body.channels.filter((c): c is "whatsapp" | "email" => c === "whatsapp" || c === "email") : ["whatsapp"];
      const mode = body.mode === "current" ? "current" : "closed";
      const r = await buildReport(ctx, kind, mode);
      const text = `🧪 ENVIO MANUAL\n\n${r.text}`;
      const out: { whatsapp?: string; email?: string } = {};
      if (channels.includes("whatsapp")) {
        const recipients = await verifiedRecipients(ctx);
        if (!recipients.length) out.whatsapp = "no_recipient";
        else {
          let queued = 0;
          for (const rec of recipients) {
            const res = await deliver(ctx, { kind: "test", period: r.period, dedupeKey: `manual:${kind}:${rec.id}:${Date.now()}`, metrics: { current: r.metrics, previous: r.previous }, text, recipient: rec });
            if (res.status === "skipped") { out.whatsapp = "instance_missing"; break; }
            if (res.status === "queued") queued++;
          }
          out.whatsapp ??= queued ? "queued" : "failed";
        }
      }
      if (channels.includes("email")) out.email = await emailReport(db, ctx.salonId, userId, r.salon.name, text);
      return jsonResponse({ success: true, ...out });
    }

    if (body.action === "status") {
      const { data } = await db.from("insights_reports").select("id,status,error_code,created_at,whatsapp_outbox(status,error_code)").eq("salon_id", ctx.salonId).order("created_at", { ascending: false }).limit(5);
      return jsonResponse({ success: true, reports: data ?? [] });
    }

    if (body.action === "remove_phone") {
      if (!validUuid(body.recipientId)) throw new WhatsAppError("invalid_request");
      const { error } = await db.from("insights_recipients").delete().eq("id", body.recipientId).eq("salon_id", ctx.salonId);
      if (error) throw new WhatsAppError("persistence_failed", 503);
      return jsonResponse({ success: true });
    }

    if (body.action === "send_test") {
      const r = await buildReport(ctx, kind, "closed");
      const { data: recipients, error } = await db.from("insights_recipients").select("id,phone").eq("salon_id", ctx.salonId).not("verified_at", "is", null);
      if (error) throw new WhatsAppError("persistence_failed", 503);
      if (!recipients?.length) throw new WhatsAppError("recipient_missing", 409);
      let queued = 0;
      for (const rec of recipients) {
        // Testes podem ser repetidos; chave com timestamp evita colisão com o envio agendado.
        const res = await deliver(ctx, { kind: "test", period: r.period, dedupeKey: `test:${kind}:${rec.id}:${Date.now()}`, metrics: { current: r.metrics, previous: r.previous }, text: `🧪 TESTE\n\n${r.text}`, recipient: rec });
        if (res.status === "skipped") throw new WhatsAppError("instance_missing", 409);
        if (res.status === "queued") queued++;
      }
      return jsonResponse({ success: true, queued });
    }

    throw new WhatsAppError("invalid_request");
  } catch (error) { return errorResponse(error); }
});
