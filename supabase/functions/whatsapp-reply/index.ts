import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeSalon, salonInstance, serviceClient, validUuid } from "../_shared/whatsapp/auth.ts";
import { evolutionClient } from "../_shared/whatsapp/evolution.ts";
import { corsHeaders, errorResponse, jsonResponse, objectValue, readRequest, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { messageRecords, parseInboxMessage } from "../_shared/whatsapp/inbound.ts";
import { inboxRow, replyText } from "../_shared/whatsapp/inbox.ts";

/**
 * Conversas (central WhatsApp): resposta manual do dono, assumir/devolver para a IA e sincronizar histórico.
 * Resposta direta numa conversa iniciada pelo contato não é marketing: supressão de campanhas não se aplica
 * (mesma regra do outbox, que só bloqueia category=marketing).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await readRequest(req), db = serviceClient();
    const userId = await authorizeSalon(req, db, body.salonId);
    const salonId = body.salonId as string;
    const action = body.action;
    if (!["send", "takeover", "release", "sync"].includes(String(action))) throw new WhatsAppError("invalid_request");
    const phone = body.phone;
    if (typeof phone !== "string" || !/^\+[1-9][0-9]{6,14}$/.test(phone)) throw new WhatsAppError("invalid_request");

    // Só conversas reais deste salão: o contato precisa ter escrito para o número conectado.
    const { data: known, error: knownError } = await db.from("whatsapp_messages").select("id").eq("salon_id", salonId).eq("phone", phone).eq("direction", "in").limit(1);
    if (knownError) throw new WhatsAppError("persistence_failed", 503);
    if (!known?.length && action !== "sync") throw new WhatsAppError("conversation_missing", 404);

    const setTakeover = async (pause: boolean) => {
      const { error } = await db.from("whatsapp_conversation_state").upsert({
        salon_id: salonId, phone, human_takeover: pause, taken_over_by: userId, taken_over_at: new Date().toISOString(),
        pending_action: null, pending_action_expires_at: null, updated_at: new Date().toISOString(),
      }, { onConflict: "salon_id,phone" });
      if (error) throw new WhatsAppError("persistence_failed", 503);
    };
    if (action === "takeover" || action === "release") {
      await setTakeover(action === "takeover");
      return jsonResponse({ success: true, humanTakeover: action === "takeover" });
    }

    const instance = await salonInstance(db, salonId);
    if (instance.status !== "connected") throw new WhatsAppError("disconnected", 409);
    const api = evolutionClient();

    if (action === "sync") {
      // Puxa as mensagens recentes desta conversa (Evolution v2 /chat/findMessages). Não aciona o chatbot.
      const remote = await api.request("messages", instance.instance_name, { where: { key: { remoteJid: `${phone.slice(1)}@s.whatsapp.net` } }, page: 1, offset: 100 });
      const rows = messageRecords(remote).slice(0, 100).map(parseInboxMessage).filter((m): m is NonNullable<typeof m> => !!m && m.phone === phone)
        .map((m) => ({ ...inboxRow(salonId, m), source: m.direction === "in" ? "contact" : "sync" }));
      if (rows.length) {
        const { error } = await db.from("whatsapp_messages").upsert(rows, { onConflict: "salon_id,provider_message_id", ignoreDuplicates: true });
        if (error) throw new WhatsAppError("persistence_failed", 503);
      }
      return jsonResponse({ success: true, imported: rows.length });
    }

    const text = replyText(body.text);
    if (!text || !validUuid(body.clientRef)) throw new WhatsAppError("invalid_request");
    // Idempotência: o mesmo clientRef (reenvio após timeout) nunca gera segunda mensagem.
    const { data: row, error: insertError } = await db.from("whatsapp_messages").insert({
      salon_id: salonId, phone, direction: "out", author: "human", source: "reply", body: text, client_ref: body.clientRef, sent_by: userId, status: "sending",
    }).select("id").single();
    if (insertError) {
      if (insertError.code !== "23505") throw new WhatsAppError("persistence_failed", 503);
      const { data: prev, error: prevError } = await db.from("whatsapp_messages").select("id,status").eq("salon_id", salonId).eq("client_ref", body.clientRef).single();
      if (prevError) throw new WhatsAppError("persistence_failed", 503);
      return jsonResponse({ success: true, duplicate: true, id: prev.id, status: prev.status });
    }
    // Quem responde pelo sistema assume a conversa: a IA não fala por cima do atendente.
    await setTakeover(true);
    const finish = async (status: string, providerId?: string, code?: string) => {
      const changes = { status, provider_message_id: providerId ?? null, error_code: code ?? null };
      let { error } = await db.from("whatsapp_messages").update(changes).eq("id", row.id).eq("salon_id", salonId);
      if (error?.code === "23505" && providerId) {
        // Webhook SEND_MESSAGE chegou antes e gravou a mesma mensagem como "celular": fica a versão com autoria correta.
        await db.from("whatsapp_messages").delete().eq("salon_id", salonId).eq("provider_message_id", providerId).is("client_ref", null);
        ({ error } = await db.from("whatsapp_messages").update(changes).eq("id", row.id).eq("salon_id", salonId));
      }
      if (error) throw new WhatsAppError("persistence_failed", 503);
    };
    try {
      const result = objectValue(await api.request("text", instance.instance_name, { number: phone.slice(1), text }));
      const key = result.key && typeof result.key === "object" ? objectValue(result.key) : null;
      const providerId = typeof key?.id === "string" && key.id ? key.id : undefined;
      await finish(providerId ? "sent" : "uncertain", providerId, providerId ? undefined : "provider_missing_message_id");
      return jsonResponse({ success: true, id: row.id, status: providerId ? "sent" : "uncertain" });
    } catch (err) {
      const code = err instanceof WhatsAppError ? err.code : "internal_error";
      if (code === "persistence_failed") throw err;
      await finish(code === "send_uncertain" ? "uncertain" : "failed", undefined, code);
      throw err;
    }
  } catch (error) { return errorResponse(error); }
});
