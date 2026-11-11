import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evolutionClient, privateNumber } from "./evolution.ts";
import { objectValue, WhatsAppError } from "./errors.ts";
import { providerMessageId, sendWithFallback, typingPulse } from "./evolutionSender.ts";
import { metaClient, toMetaInteractive } from "./meta.ts";

type OutboxItem = { id: string; salon_id: string; category: string; content_type: string; recipient_phone: string; text_content: string; payload: unknown; media_path: string | null; media_mime: string | null; media_filename: string | null; source_event_id: string | null };
/**
 * API oficial (Cloud API). Texto livre e interativo só dentro da janela de 24h desde a última mensagem do cliente;
 * fora dela, sem modelo aprovado, cancela (`outside_service_window`) em vez de pagar/arriscar recusa da Meta.
 * Interativo vira botões (≤ 3) ou lista "☰ Menu"; se a Meta recusar o interativo (4xx), manda o texto numerado.
 */
async function sendViaMeta(db: SupabaseClient, item: OutboxItem, phoneNumberId: string | null, begin: () => Promise<void>): Promise<{ id: string; skip?: undefined } | { skip: string; id?: undefined }> {
  if (!phoneNumberId) throw new WhatsAppError("configuration_missing", 503);
  if (item.content_type.startsWith("status_")) return { skip: "unsupported_on_meta" };
  const to = item.recipient_phone.replace(/^\+/, "");
  const { data: open, error } = await db.rpc("whatsapp_service_window_open", { p_salon_id: item.salon_id, p_phone: item.recipient_phone });
  if (error) throw new WhatsAppError("persistence_failed", 503);
  if (!open) return { skip: "outside_service_window" };
  const api = metaClient();
  // "Digitando…" + lido na mensagem que gerou a resposta (o id da Meta está no evento de origem).
  if (item.category === "chatbot" && item.source_event_id) {
    const { data: ev } = await db.from("whatsapp_webhook_events").select("provider_message_id").eq("id", item.source_event_id).maybeSingle();
    if (ev?.provider_message_id?.startsWith("wamid.")) await api.typing(phoneNumberId, ev.provider_message_id);
  }
  let body: Record<string, unknown>;
  if (item.content_type === "interactive") body = toMetaInteractive(item.payload as Record<string, unknown> | null, item.text_content) ?? { type: "text", text: { body: item.text_content, preview_url: false } };
  else if (item.content_type === "text") body = { type: "text", text: { body: item.text_content, preview_url: true } };
  else {
    if (typeof item.media_path !== "string" || !item.media_path.startsWith(`${item.salon_id}/`) || item.media_path.includes("..")) return { skip: "invalid_media" };
    const { data: signed, error: mediaError } = await db.storage.from("whatsapp-media").createSignedUrl(item.media_path, 600);
    if (mediaError || !signed?.signedUrl) throw new WhatsAppError("persistence_failed", 503);
    const kind = item.content_type === "image" ? "image" : item.content_type === "video" ? "video" : "document";
    body = { type: kind, [kind]: { link: signed.signedUrl, ...(item.text_content ? { caption: item.text_content.slice(0, 1024) } : {}), ...(kind === "document" && item.media_filename ? { filename: item.media_filename } : {}) } };
  }
  await begin();
  try { return { id: await api.send(phoneNumberId, body) }; }
  catch (e) {
    // Interativo recusado antes de sair (4xx): cai para o texto numerado, mesmo comportamento da Evolution.
    if (body.type === "interactive" && e instanceof WhatsAppError && e.code === "provider_rejected") return { id: await api.send(phoneNumberId, { type: "text", text: { body: item.text_content, preview_url: false } }) };
    throw e;
  }
}

/**
 * Sem opções: fila geral (whatsapp_claim_outbox, conversa primeiro). `sourceEvent`: só a resposta deste evento
 * (envio imediato pelo worker inbound). `chatbotOnly`: só conversa (dreno curto do dispatcher).
 */
export interface ClaimFilter { sourceEvent?: string; chatbotOnly?: boolean }
export async function processOutboxItem(db: SupabaseClient, filter?: ClaimFilter): Promise<boolean> {
  const { data, error } = filter
    ? await db.rpc("whatsapp_claim_outbox_v2", { p_source_event: filter.sourceEvent ?? null, p_chatbot_only: !!filter.chatbotOnly })
    : await db.rpc("whatsapp_claim_outbox");
  if (error) throw new WhatsAppError("persistence_failed", 503);
  const item = data?.[0];
  if (!item) return false;
  const finish = async (status: string, errorCode?: string, messageId?: string) => {
    const { data: saved, error: saveError } = await db.rpc("whatsapp_finish_outbox", { p_id: item.id, p_claim: item.claim_token, p_status: status, p_message_id: messageId ?? null, p_error_code: errorCode ?? null });
    if (saveError || saved !== true) throw new WhatsAppError("persistence_failed", 503);
  };
  let sendStarted = false;
  try {
    // Atendente nunca responde grupo/comunidade/canal: número só com dígitos (8–15). Demais categorias já exigem E.164 no banco.
    if (item.category === "chatbot" && !privateNumber(String(item.recipient_phone ?? "").replace(/^\+/, ""))) {
      await finish("cancelled", "not_private_chat"); return true;
    }
    const { data: instance, error: instanceError } = await db.from("whatsapp_instances").select("instance_name,salon_id,provider,meta_phone_number_id").eq("id", item.instance_id).eq("salon_id", item.salon_id).maybeSingle();
    if (instanceError) throw new WhatsAppError("persistence_failed", 503);
    if (!instance) { await finish("failed", "instance_missing"); return true; }
    if (item.appointment_id) {
      const { data: appointment, error: appointmentError } = await db.from("appointments").select("status,updated_at").eq("id", item.appointment_id).eq("salon_id", item.salon_id).maybeSingle();
      if (appointmentError) throw new WhatsAppError("persistence_failed", 503);
      if (!appointment || (item.expected_appointment_version && appointment.updated_at !== item.expected_appointment_version)) {
        await finish("cancelled", "appointment_changed"); return true;
      }
    }
    if (item.category === "marketing") {
      const { data: blocked, error: consentError } = await db.from("clients").select("id").eq("salon_id", item.salon_id).eq("phone_normalized", item.recipient_phone).eq("marketing_opt_out", true).limit(1);
      if (consentError) throw new WhatsAppError("persistence_failed", 503);
      const { data: suppression, error: suppressionError } = await db.from("whatsapp_marketing_suppression").select("phone").eq("salon_id", item.salon_id).eq("phone", item.recipient_phone).limit(1);
      if (suppressionError) throw new WhatsAppError("persistence_failed", 503);
      if (blocked?.length || suppression?.length) { await finish("cancelled", "marketing_opt_out"); return true; }
    }
    if (instance.provider === "meta") {
      const r = await sendViaMeta(db, item, instance.meta_phone_number_id, async () => {
        const { data, error } = await db.rpc("whatsapp_begin_send", { p_id: item.id, p_claim: item.claim_token });
        if (error || !data) throw new WhatsAppError("persistence_failed", 503);
        sendStarted = true;
      });
      if (r.skip) { await finish("cancelled", r.skip); return true; }
      await finish("accepted", undefined, r.id);
      return true;
    }
    const api = evolutionClient();
    const remote = objectValue(await api.request("state", instance.instance_name));
    const inner = remote.instance && typeof remote.instance === "object" ? objectValue(remote.instance) : remote;
    if ((inner.state ?? remote.state) !== "open") { await finish("pending", "disconnected"); return true; }
    let media: string | undefined;
    // Conversa: "digitando…" curto antes da resposta (experiência Typebot). Best effort, nunca bloqueia.
    if (item.category === "chatbot" && (item.content_type === "interactive" || item.content_type === "text")) await typingPulse(api, instance.instance_name, String(item.recipient_phone));
    if (item.content_type === "interactive") {
      // Lista/botões: instáveis em alguns aparelhos. Se a Evolution recusar ANTES do envio, manda o texto numerado.
      const p = item.payload && typeof item.payload === "object" ? item.payload as Record<string, unknown> : null;
      const number = item.recipient_phone.replace(/^\+/, "");
      const { data: started, error: beginError } = await db.rpc("whatsapp_begin_send", { p_id: item.id, p_claim: item.claim_token });
      if (beginError || !started) throw new WhatsAppError("persistence_failed", 503);
      sendStarted = true;
      const { response } = await sendWithFallback(api, instance.instance_name, number, p, item.text_content);
      const id = providerMessageId(response);
      if (!id) { await finish("uncertain", "provider_missing_message_id"); return true; }
      await finish("accepted", undefined, id);
      return true;
    }
    if (item.content_type !== "text" && item.content_type !== "status_text") {
      if (typeof item.media_path !== "string" || !item.media_path.startsWith(`${item.salon_id}/`) || item.media_path.includes("..")) { await finish("failed", "invalid_media"); return true; }
      const { data: signed, error: mediaError } = await db.storage.from("whatsapp-media").createSignedUrl(item.media_path, 300);
      if (mediaError || !signed?.signedUrl) throw new WhatsAppError("persistence_failed", 503);
      media = signed.signedUrl;
    }
    const { data: started, error: beginError } = await db.rpc("whatsapp_begin_send", { p_id: item.id, p_claim: item.claim_token });
    if (beginError || !started) throw new WhatsAppError("persistence_failed", 503);
    sendStarted = true;
    const isStatus = item.content_type.startsWith("status_");
    const response = await api.request(isStatus ? "status" : item.content_type === "text" ? "text" : "media", instance.instance_name,
      isStatus ? { type: item.content_type.replace("status_", ""), content: media ?? item.text_content, caption: media ? item.text_content : undefined, allContacts: true }
      : item.content_type === "text" ? { number: item.recipient_phone.replace(/^\+/, ""), text: item.text_content }
      : { number: item.recipient_phone.replace(/^\+/, ""), mediatype: item.content_type, media, mimetype: item.media_mime, caption: item.text_content, fileName: item.media_filename });
    const result = objectValue(response), key = result.key && typeof result.key === "object" ? objectValue(result.key) : null;
    const id = key?.id;
    if (typeof id !== "string" || !id) { await finish("uncertain", "provider_missing_message_id"); return true; }
    await finish("accepted", undefined, id);
  } catch (err) {
    if (err instanceof WhatsAppError && err.code !== "persistence_failed") {
      const uncertain = err.code === "send_uncertain" || (sendStarted && !["provider_rejected", "provider_rate_limited"].includes(err.code));
      await finish(uncertain ? "uncertain" : ["provider_unavailable", "provider_rate_limited", "disconnected"].includes(err.code) ? "pending" : "failed", err.code);
    } else {
      // Persistência falhou: mantém lease; recovery identifica se o envio havia começado.
      console.warn("whatsapp_outbox_persistence_failed");
      throw new WhatsAppError("persistence_failed", 503);
    }
  }
  return true;
}
