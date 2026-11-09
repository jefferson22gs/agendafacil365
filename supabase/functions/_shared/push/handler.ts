// Handler do painel (send-push-fcm e o alias send-push): só "Enviar teste para meu celular".
// Exige JWT do dono/admin do salão (validado no servidor). Avisos de evento saem por trigger → push_outbox → worker;
// campanhas pela RPC push_enqueue_campaign (limite e opt-out no banco). Nada aqui é disparável por anônimo.
import { authorizeSalon, serviceClient } from "../whatsapp/auth.ts";
import { corsHeaders, jsonResponse, readRequest, WhatsAppError } from "../whatsapp/errors.ts";
import { isUuid } from "./core.ts";
import { processJob, PushError, recordPlatform, vapidKeys, type OutboxJob } from "./delivery.ts";

const messages: Record<string, string> = {
  push_not_configured: "As notificações ainda não foram ativadas pela plataforma.",
  unauthorized: "Entre novamente para continuar.",
  forbidden: "Você não tem permissão para este salão.",
  invalid_request: "Pedido inválido.",
  rate_limited: "Muitos testes seguidos. Aguarde alguns minutos.",
  client_outdated: "Atualize a página para usar a versão nova das notificações.",
  persistence_failed: "Não foi possível consultar os dispositivos. Tente novamente.",
};
export function pushError(error: unknown) {
  const code = error instanceof PushError || error instanceof WhatsAppError ? error.code : "internal_error";
  const status = error instanceof PushError || error instanceof WhatsAppError ? error.status : 500;
  console.warn("push_operation_failed", code);
  return jsonResponse({ success: false, code, error: messages[code] ?? "Não foi possível enviar a notificação." }, status);
}

export async function handleSend(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await readRequest(req);
    if (!isUuid(body.salon_id)) throw new WhatsAppError("invalid_request");
    const db = serviceClient();
    const userId = await authorizeSalon(req, db, body.salon_id);

    // Pedido de avaliação agora é automático (trigger ao concluir). Bundle antigo recebe sucesso sem envio duplicado.
    if (body.type === "rating_request") return jsonResponse({ success: true, total: 0, sent: 0, failed: 0, automatic: true });
    if (body.type !== "test") throw new PushError("client_outdated", 409);

    const keys = vapidKeys();
    if (!keys) { await recordPlatform(db, { configured: false, error: "push_not_configured" }); throw new PushError("push_not_configured", 503); }

    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await db.from("push_outbox").select("id", { count: "exact", head: true })
      .eq("salon_id", body.salon_id).eq("kind", "test").gte("created_at", since);
    if ((count ?? 0) >= 5) throw new PushError("rate_limited", 429);

    const { data: job, error } = await db.from("push_outbox").insert({
      salon_id: body.salon_id, kind: "test", audience: "test", created_by: userId, status: "processing", attempts: 1,
      locked_at: new Date().toISOString(), title: "Notificação de teste",
      body: "Tudo certo! Os avisos do salão vão chegar neste aparelho.", url: "/admin/settings",
      dedupe_key: `test:${crypto.randomUUID()}`, expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    }).select("id,salon_id,kind,audience,title,body,url,appointment_id,attempts,expires_at").single();
    if (error || !job) throw new PushError("persistence_failed", 503);
    const r = await processJob(db, job as OutboxJob, keys);
    await recordPlatform(db, { configured: true, ...(r.sent ? { ok: true, error: null } : {}) });
    return jsonResponse({ success: true, total: r.total, sent: r.sent, failed: r.failed, removed: r.removed });
  } catch (error) {
    return pushError(error);
  }
}
