import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { serviceClient, safeEqual } from "../_shared/whatsapp/auth.ts";
import { readRequest, jsonResponse, errorResponse, objectValue, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { deliveryUpdates, eventName, isPrivateChat, parseInboxMessage, parseIncoming, pollVotes, pollSelection, recordOf, whatsappTimestamp } from "../_shared/whatsapp/inbound.ts";
import { inboxRow } from "../_shared/whatsapp/inbox.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { data: instance, error } = await db.from("whatsapp_instances").select("id,salon_id,instance_name,phone_number").eq("instance_name", name).maybeSingle();
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
      // Voto de enquete (pollVotes já recusa grupo/participante): vira evento do atendente com a seleção do menu.
      // Vem ANTES de qualquer filtro fromMe: a enquete foi criada por nós (fromMe), o voto é do cliente.
      for (const entry of envelopeEntries) await storePollVotes(db, instance, entry, arrived, ownNumber(instance.phone_number, body.sender));
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
    // O dono escolhe UMA conexão para o robô (WhatsApp > Conexão). Se for a oficial, mensagens no número do QR Code
    // ficam só na Caixa de entrada para a equipe, sem resposta automática duplicada.
    const { data: botProvider } = await db.rpc("whatsapp_bot_provider", { p_salon_id: instance.salon_id });
    if (botProvider && botProvider !== "evolution") return jsonResponse({ accepted: 0, reason: "bot_on_official" });
    let accepted = 0;
    // Anti-loop: o próprio número do salão (dono da instância) nunca vira conversa do robô.
    const own = ownNumber(instance.phone_number, body.sender);
    for (const entry of entries) {
      // Grupo/comunidade/canal/status nunca viram evento do atendente (parseIncoming também filtra: camada dupla).
      if (!isPrivateChat(entry)) continue;
      const message = parseIncoming(entry);
      if (!message || (own && message.phone === own)) continue;
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

/** +E.164 do número do salão (instância conectada; `sender` do envelope como reserva), ou null. */
function ownNumber(phone: unknown, sender: unknown): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "") || String(sender ?? "").split("@")[0].replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}
const pollTitle = (payload: unknown, id: string) =>
  String((recordOf(payload)?.options as { id?: string; title?: string }[] | undefined)?.find(o => o?.id === id)?.title ?? "Opção escolhida").slice(0, 200);

/**
 * Evolution 2.3.7 entrega o voto já descriptografado (messages.upsert pollUpdateMessage.vote.selectedOptions = nomes;
 * messages.update pollUpdates[{name,voters}]). O nome vira id de menu SÓ pelo payload da enquete que NÓS enviamos a
 * este mesmo telefone (whatsapp_outbox.remote_message_id). Mesma opção na mesma enquete = um evento (dedupe).
 */
async function storePollVotes(db: SupabaseClient, instance: { id: string; salon_id: string }, entry: unknown, arrived: number, own: string | null) {
  for (const vote of pollVotes(entry)) {
    if (own && vote.phone === own) continue;
    const { data: sent, error: lookupError } = await db.from("whatsapp_outbox").select("payload").eq("salon_id", instance.salon_id).eq("instance_id", instance.id).eq("remote_message_id", vote.pollId).eq("recipient_phone", vote.phone).maybeSingle();
    if (lookupError) throw new WhatsAppError("persistence_failed", 503);
    const selection = await pollSelection(sent?.payload, vote.option, vote.hash);
    if (!selection) continue;
    const { error: voteError } = await db.from("whatsapp_webhook_events").upsert({
      salon_id: instance.salon_id, instance_id: instance.id, event_type: "messages.upsert",
      provider_message_id: `poll_${vote.pollId}_${selection.replace(".", "_")}`.slice(0, 160), sender_phone: vote.phone,
      whatsapp_at: whatsappTimestamp(recordOf(entry)?.messageTimestamp, arrived),
      // Texto legível do voto (hash não serve para histórico/IA): título da opção enviada.
      payload: { text: vote.hash ? pollTitle(sent?.payload, selection) : vote.option, name: "Cliente", selection, pollId: vote.pollId },
    }, { onConflict: "instance_id,event_type,provider_message_id", ignoreDuplicates: true });
    if (voteError) throw new WhatsAppError("persistence_failed", 503);
  }
}
