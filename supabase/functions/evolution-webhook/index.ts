import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { serviceClient, safeEqual } from "../_shared/whatsapp/auth.ts";
import { readRequest, jsonResponse, errorResponse, objectValue, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { deliveryUpdates, eventName, isPrivateChat, parseInboxMessage, parseIncoming, pollVotes, pollSelection, recordOf, whatsappTimestamp } from "../_shared/whatsapp/inbound.ts";
import { inboxRow } from "../_shared/whatsapp/inbox.ts";

/**
 * Ingestão durável. IA e envio não rodam dentro da resposta do webhook: o INSERT do evento aciona o
 * whatsapp-inbound-worker via trigger (pg_net, após o COMMIT), sem atrasar a resposta ao Evolution.
 */
serve(async (req) => {
  const arrived = Date.now();
  try {
    const supplied = req.headers.get("x-syshair-webhook-secret");
    if (!supplied || supplied.length > 128) throw new WhatsAppError("unauthorized", 401);
    const body = await readRequest(req);
    const name = body.instance;
    if (typeof name !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(name)) throw new WhatsAppError("invalid_request");
    const db = serviceClient();
    const { data: instance, error } = await db.from("whatsapp_instances").select("id,salon_id,instance_name").eq("instance_name", name).maybeSingle();
    if (error) throw new WhatsAppError("persistence_failed", 503);
    if (!instance) throw new WhatsAppError("unauthorized", 401);
    const { data: secrets, error: secretError } = await db.rpc("whatsapp_instance_secret", { p_instance_id: instance.id });
    if (secretError || !secrets?.[0]?.webhook_secret || !safeEqual(supplied, secrets[0].webhook_secret)) throw new WhatsAppError("unauthorized", 401);
    const event = eventName(body.event);
    if (event === "connection.update") {
      const data = objectValue(body.data);
      const state = data.state;
      const status = state === "open" ? "connected" : state === "connecting" ? "connecting" : state === "close" ? "disconnected" : null;
      if (!status) return jsonResponse({ accepted: false, reason: "unsupported_state" });
      // Eventos fora de ordem não decidem ligação final: UI/worker confirmam connectionState antes do uso.
      const { error: updateError } = await db.from("whatsapp_instances").update({ status, qrcode: null, updated_at: new Date().toISOString() }).eq("id", instance.id).eq("salon_id", instance.salon_id);
      if (updateError) throw new WhatsAppError("persistence_failed", 503);
      return jsonResponse({ accepted: true });
    }
    if (event === "qrcode.updated") return jsonResponse({ accepted: true, reason: "qr_transient_only" });
    const envelopeEntries = Array.isArray(body.data) ? body.data : [body.data];
    if (envelopeEntries.length > 100) throw new WhatsAppError("invalid_request", 413);
    if (["messages.update", "messages.upsert", "send.message"].includes(event)) {
      for (const { id, status } of deliveryUpdates(envelopeEntries)) {
        const { error: deliveryError } = await db.rpc("whatsapp_record_delivery", { p_salon_id: instance.salon_id, p_instance_id: instance.id, p_message_id: id, p_status: status });
        if (deliveryError) throw new WhatsAppError("persistence_failed", 503);
      }
      for (const entry of envelopeEntries) for (const vote of pollVotes(entry)) {
        // Mapeamento durável por mensagem enviada; a opção não é um comando nem dado de reserva do cliente.
        const { data: sent, error: lookupError } = await db.from("whatsapp_outbox").select("payload").eq("salon_id", instance.salon_id).eq("instance_id", instance.id).eq("remote_message_id", vote.pollId).eq("recipient_phone", vote.phone).maybeSingle();
        if (lookupError) throw new WhatsAppError("persistence_failed", 503);
        const selection = pollSelection(sent?.payload, vote.option);
        if (!selection) continue;
        const { error: voteError } = await db.from("whatsapp_webhook_events").upsert({
          salon_id: instance.salon_id, instance_id: instance.id, event_type: "messages.upsert",
          provider_message_id: `poll:${vote.pollId}:${selection}`, sender_phone: vote.phone,
          whatsapp_at: whatsappTimestamp(recordOf(entry)?.messageTimestamp, arrived),
          payload: { text: vote.option, name: "Cliente", selection, pollId: vote.pollId },
        }, { onConflict: "instance_id,event_type,provider_message_id", ignoreDuplicates: true });
        if (voteError) throw new WhatsAppError("persistence_failed", 503);
      }
    }
    if (event === "messages.update") return jsonResponse({ accepted: true });
    if (event !== "messages.upsert" && event !== "send.message") return jsonResponse({ accepted: false, reason: "unsupported_event" });
    const entries = envelopeEntries;
    // Caixa de entrada: recebidas, enviadas pelo celular e pela API. Duplicatas (retry/outbox) são ignoradas.
    const inbox = entries.map(parseInboxMessage).filter((m): m is NonNullable<typeof m> => !!m).map((m) => inboxRow(instance.salon_id, m));
    if (inbox.length) {
      const { error: inboxError } = await db.from("whatsapp_messages").upsert(inbox, { onConflict: "salon_id,provider_message_id", ignoreDuplicates: true });
      if (inboxError) throw new WhatsAppError("persistence_failed", 503);
    }
    if (event === "send.message") return jsonResponse({ accepted: inbox.length });
    let accepted = 0;
    for (const entry of entries) {
      // Grupo/comunidade/canal/status nunca viram evento do atendente (parseIncoming também filtra: camada dupla).
      if (!isPrivateChat(entry)) continue;
      const message = parseIncoming(entry);
      if (!message) continue;
      const { error: insertError } = await db.from("whatsapp_webhook_events").upsert({
        salon_id: instance.salon_id, instance_id: instance.id, event_type: "messages.upsert",
        provider_message_id: message.id, sender_phone: message.phone,
        whatsapp_at: whatsappTimestamp(recordOf(entry)?.messageTimestamp, arrived),
        payload: { text: message.text, name: message.name, quotedMessageId: message.quotedMessageId, selection: message.selection ?? null, media: message.media ?? null },
      }, { onConflict: "instance_id,event_type,provider_message_id", ignoreDuplicates: true });
      if (insertError) throw new WhatsAppError("persistence_failed", 503);
      accepted++;
    }
    return jsonResponse({ accepted });
  } catch (error) { return errorResponse(error); }
});
