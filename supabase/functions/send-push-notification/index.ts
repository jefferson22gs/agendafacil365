// Edge Function: send-push-notification — worker da fila public.push_outbox (novo agendamento → dispositivos do dono).
// Só cron/servidor (chave secreta do projeto via Vault). Antes era chamada pelo navegador anônimo e apenas simulava o envio.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeWorker, serviceClient } from "../_shared/whatsapp/auth.ts";
import { corsHeaders, jsonResponse } from "../_shared/whatsapp/errors.ts";
import { selectTargets, type Subscription } from "../_shared/push/core.ts";
import { deliver, pushConfigured, PushError } from "../_shared/push/fcm.ts";
import { pushError } from "../_shared/push/handler.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    authorizeWorker(req);
    // Sem chave Firebase a fila fica pendente (expira em 24 h); não marca enviado sem envio real.
    if (!pushConfigured()) throw new PushError("push_not_configured", 503);
    const db = serviceClient();
    const { data: jobs, error } = await db.rpc("push_claim_outbox", { p_limit: 25 });
    if (error) throw new PushError("persistence_failed", 503);
    let sent = 0, failed = 0;
    for (const job of jobs ?? []) {
      try {
        const { data: salon } = await db.from("salons").select("owner_id,slug,logo_url,pwa_icon_url").eq("id", job.salon_id).maybeSingle();
        const { data: subs } = salon?.slug
          ? await db.from("push_subscriptions").select("id,user_id,client_id,fcm_token").eq("salon_id", job.salon_id)
              .eq("user_id", salon.owner_id).eq("is_active", true).not("fcm_token", "is", null).limit(50)
          : { data: [] };
        const targets = salon ? selectTargets((subs ?? []) as Subscription[], { audience: "owner", ownerId: salon.owner_id }) : [];
        const r = targets.length
          ? await deliver(db, targets, { title: job.title, body: job.body, url: job.url, type: job.kind, icon: salon!.pwa_icon_url || salon!.logo_url, salonSlug: salon!.slug })
          : { sent: 0, failed: 0 };
        // Sem dispositivo do dono: concluído (nada a enviar). Falha total: volta para pendente.
        const ok = r.sent > 0 || r.failed === 0;
        await db.from("push_outbox").update(ok
          ? { status: "sent", sent_at: new Date().toISOString(), last_error: null }
          : { status: job.attempts >= 5 ? "failed" : "pending", last_error: "delivery_failed" }).eq("id", job.id);
        ok ? sent++ : failed++;
      } catch {
        failed++;
        await db.from("push_outbox").update({ status: job.attempts >= 5 ? "failed" : "pending", last_error: "worker_error" }).eq("id", job.id);
      }
    }
    return jsonResponse({ success: true, processed: jobs?.length ?? 0, sent, failed });
  } catch (error) {
    return pushError(error);
  }
});
