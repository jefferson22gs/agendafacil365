// Entrega de um item da fila push_outbox (Deno). Chaves VAPID só em Deno.env; nunca loga endpoint, chave ou texto.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { backoffMinutes, buildPayload, classifyPushResponse, MAX_PAYLOAD_BYTES, payloadBytes, type PushOutcome } from "./core.ts";
import { buildPushRequest, vapidJwt, type VapidKeys } from "./webpush.ts";

export class PushError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

/** VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (escalar d base64url) / VAPID_SUBJECT. Sem as duas chaves: não configurado. */
export function vapidKeys(): VapidKeys | null {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY")?.trim(), privateKey = Deno.env.get("VAPID_PRIVATE_KEY")?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: Deno.env.get("VAPID_SUBJECT")?.trim() || "https://agendafacil365.com.br" };
}
export const pushConfigured = () => vapidKeys() !== null;

export interface OutboxJob {
  id: string; salon_id: string; kind: string; audience: string; title: string; body: string; url: string;
  appointment_id: string | null; attempts: number; expires_at: string | null;
}
interface Target { id: string; endpoint: string; p256dh: string; auth: string }
export interface JobResult { total: number; sent: number; failed: number; removed: number; status: "sent" | "failed" | "pending" | "expired" }

const URGENT = new Set(["new_appointment", "appointment_cancelled", "appointment_rescheduled", "whatsapp_human", "whatsapp_handoff", "payment_proof", "client_reminder", "test"]);
const CONCURRENCY = 8;

/** Envia um item já reservado (status processing) e grava o resultado. Retentativa só quando nada foi entregue. */
export async function processJob(db: SupabaseClient, job: OutboxJob, keys: VapidKeys): Promise<JobResult> {
  const finish = async (r: JobResult, error: string | null) => {
    await db.from("push_outbox").update({
      status: r.status, sent_count: r.sent, failed_count: r.failed, last_error: error, locked_at: null,
      sent_at: r.status === "sent" ? new Date().toISOString() : null,
      next_attempt_at: r.status === "pending" ? new Date(Date.now() + backoffMinutes(job.attempts) * 60_000).toISOString() : undefined,
    }).eq("id", job.id);
    return r;
  };
  const expiresMs = job.expires_at ? Date.parse(job.expires_at) : Date.now() + 86_400_000;
  if (expiresMs <= Date.now()) return finish({ total: 0, sent: 0, failed: 0, removed: 0, status: "expired" }, null);

  const { data: salon, error: salonError } = await db.from("salons").select("slug,logo_url,pwa_icon_url").eq("id", job.salon_id).maybeSingle();
  if (salonError) throw new PushError("persistence_failed", 503);
  const { data: rows, error } = await db.rpc("push_job_targets", { p_job: job.id });
  if (error) throw new PushError("persistence_failed", 503);
  const targets = (rows ?? []) as Target[];
  if (!salon?.slug || !targets.length) return finish({ total: 0, sent: 0, failed: 0, removed: 0, status: "sent" }, null);

  const payload = buildPayload({
    title: job.title, body: job.body, url: job.url, kind: job.kind, icon: salon.pwa_icon_url || salon.logo_url,
    salonSlug: salon.slug, appointmentId: job.appointment_id, tag: `${job.kind}:${job.id}`,
  });
  if (payloadBytes(payload) > MAX_PAYLOAD_BYTES) return finish({ total: targets.length, sent: 0, failed: targets.length, removed: 0, status: "failed" }, "payload_too_large");

  const ttl = Math.max(60, Math.min(86_400, Math.floor((expiresMs - Date.now()) / 1000)));
  const urgency = URGENT.has(job.kind) ? "high" : "normal";
  const jwts = new Map<string, string>(); // um JWT por serviço de push (aud = origin)
  const outcomes: { id: string; outcome: PushOutcome | "invalid_keys" }[] = [];

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    await Promise.all(targets.slice(i, i + CONCURRENCY).map(async (t) => {
      let outcome: PushOutcome | "invalid_keys";
      try {
        const origin = new URL(t.endpoint).origin;
        if (!jwts.has(origin)) jwts.set(origin, await vapidJwt(t.endpoint, keys));
        let req;
        try { req = await buildPushRequest(t, payload, keys, { ttl, urgency, jwt: jwts.get(origin) }); }
        catch { outcomes.push({ id: t.id, outcome: "invalid_keys" }); return; } // chave do navegador inválida: inscrição inutilizável
        const res = await fetch(req.url, req.init);
        outcome = classifyPushResponse(res.status);
        await res.body?.cancel();
      } catch { outcome = "retry"; } // rede
      outcomes.push({ id: t.id, outcome });
    }));
  }

  const sent = outcomes.filter(o => o.outcome === "ok").length;
  const dead = outcomes.filter(o => o.outcome === "gone" || o.outcome === "invalid_keys").map(o => o.id);
  const failed = outcomes.length - sent;
  if (dead.length) {
    await db.from("push_subscriptions").update({ is_active: false, deactivated_reason: "gone", updated_at: new Date().toISOString() }).in("id", dead);
  }
  const retryable = outcomes.some(o => o.outcome === "retry");
  const authError = outcomes.some(o => o.outcome === "auth_error");
  if (failed) console.warn("push_delivery_partial", { job: job.id, kind: job.kind, sent, failed, removed: dead.length, authError });

  // Entregue a alguém: concluído (não reenvia para quem já recebeu). Nada entregue e falha temporária: tenta de novo.
  const status = sent > 0 || failed === dead.length ? "sent" : retryable && job.attempts < 5 ? "pending" : "failed";
  const lastError = authError ? "vapid_rejected" : retryable && sent === 0 ? "temporary_failure" : failed ? "partial" : null;
  return finish({ total: targets.length, sent, failed, removed: dead.length, status }, status === "sent" && !failed ? null : lastError);
}

/** Estado da plataforma para o painel/super admin (sem segredo). */
export async function recordPlatform(db: SupabaseClient, patch: { configured: boolean; ok?: boolean; error?: string | null }) {
  const now = new Date().toISOString();
  await db.from("push_platform_status").update({
    configured: patch.configured, last_run_at: now, updated_at: now,
    ...(patch.ok ? { last_success_at: now } : {}),
    ...(patch.error !== undefined ? { last_error: patch.error } : {}),
  }).eq("id", true);
}
