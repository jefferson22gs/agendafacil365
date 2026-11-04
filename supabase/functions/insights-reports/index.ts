import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeSalon, authorizeWorker, serviceClient, validUuid } from "../_shared/whatsapp/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, readRequest, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { internationalPhone } from "../_shared/whatsapp/phone.ts";
import { buildReport, deliver, runScheduled, salonInfo } from "../_shared/insights/service.ts";
import type { ReportKind } from "../_shared/insights/core.ts";

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
        text: `Agenda Fácil 365 Insights — ${salon.name}\n\nSeu código de verificação: ${code}\n\nResponda esta conversa com o código para começar a receber relatórios. Válido por 15 minutos.`,
        recipient: { id: rec.id, phone },
      });
      if (res.status === "skipped") throw new WhatsAppError("instance_missing", 409);
      return jsonResponse({ success: true, recipientId: rec.id });
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
