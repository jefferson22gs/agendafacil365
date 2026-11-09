// Edge Function: send-push-notification — worker da fila public.push_outbox (Web Push/VAPID, sem Firebase).
// Só cron/kick do banco (chave secreta do projeto via Vault). Lotes com limite de tempo; retentativa com backoff no banco.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeWorker, serviceClient } from "../_shared/whatsapp/auth.ts";
import { corsHeaders, jsonResponse } from "../_shared/whatsapp/errors.ts";
import { processJob, PushError, recordPlatform, vapidKeys, type OutboxJob } from "../_shared/push/delivery.ts";
import { pushError } from "../_shared/push/handler.ts";

const BATCH = 25, MAX_BATCHES = 4, BUDGET_MS = 40_000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    authorizeWorker(req);
    const db = serviceClient();
    const keys = vapidKeys();
    // Sem chaves a fila fica pendente (expira sozinha); nunca marca enviado sem envio real.
    if (!keys) { await recordPlatform(db, { configured: false, error: "push_not_configured" }); throw new PushError("push_not_configured", 503); }
    const started = Date.now();
    let processed = 0, sent = 0, failed = 0, removed = 0;
    for (let b = 0; b < MAX_BATCHES && Date.now() - started < BUDGET_MS; b++) {
      const { data: jobs, error } = await db.rpc("push_claim_outbox", { p_limit: BATCH });
      if (error) throw new PushError("persistence_failed", 503);
      for (const job of (jobs ?? []) as OutboxJob[]) {
        processed++;
        try {
          const r = await processJob(db, job, keys);
          sent += r.sent; failed += r.failed; removed += r.removed;
        } catch {
          failed++;
          await db.from("push_outbox").update({ status: job.attempts >= 5 ? "failed" : "pending", last_error: "worker_error", locked_at: null,
            next_attempt_at: new Date(Date.now() + 60_000).toISOString() }).eq("id", job.id);
        }
      }
      if ((jobs ?? []).length < BATCH) break;
    }
    await recordPlatform(db, { configured: true, ok: processed === 0 || sent > 0 || failed === 0, ...(failed && !sent ? { error: "delivery_failed" } : processed ? { error: null } : {}) });
    return jsonResponse({ success: true, processed, sent, failed, removed });
  } catch (error) {
    return pushError(error);
  }
});
