import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeSalon, serviceClient, salonInstance, requiredEnv } from "../_shared/whatsapp/auth.ts";
import { evolutionClient } from "../_shared/whatsapp/evolution.ts";
import { evolutionContacts } from "../_shared/whatsapp/inbound.ts";
import { corsHeaders, errorResponse, jsonResponse, readRequest, objectValue, WhatsAppError } from "../_shared/whatsapp/errors.ts";

// SEND_MESSAGE registra na caixa de entrada o que sai pela API; MESSAGES_UPSERT com fromMe, o que sai pelo celular.
const WEBHOOK_EVENTS = ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE", "CONNECTION_UPDATE", "QRCODE_UPDATED"];
function stateOf(value: unknown) {
  const data = objectValue(value);
  const instance = data.instance && typeof data.instance === "object" ? objectValue(data.instance) : data;
  const state = String(instance.state ?? instance.connectionStatus ?? data.state ?? "close");
  return { state, status: ["open", "connected", "CONNECTED"].includes(state) ? "connected" : ["connecting", "PAIRING"].includes(state) ? "connecting" : "disconnected" };
}
function phoneOf(value: unknown): string | null {
  const data = objectValue(value);
  const nested = data.instance && typeof data.instance === "object" ? objectValue(data.instance) : data;
  const raw = nested.ownerJid ?? nested.owner ?? data.ownerJid;
  return typeof raw === "string" && /^\d{7,15}(?:@s\.whatsapp\.net)?$/.test(raw) ? raw.split("@")[0] : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await readRequest(req);
    const db = serviceClient();
    const action = body.action;
    if (!["create", "connect", "status", "fetch", "disconnect", "delete", "contacts", "sync_webhook"].includes(String(action))) throw new WhatsAppError("invalid_request");
    // Compatibilidade com chamadas antigas: resolve nome no servidor e depois autoriza o salão real.
    let salonId = body.salonId;
    if (!salonId && typeof body.instanceName === "string") {
      const { data, error } = await db.from("whatsapp_instances").select("salon_id").eq("instance_name", body.instanceName).maybeSingle();
      if (error) throw new WhatsAppError("persistence_failed", 503);
      salonId = data?.salon_id;
    }
    await authorizeSalon(req, db, salonId);
    const tenant = salonId as string;
    const api = evolutionClient();
    const persist = async (id: string, changes: Record<string, unknown>) => {
      const { error } = await db.from("whatsapp_instances").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", id).eq("salon_id", tenant);
      if (error) throw new WhatsAppError("persistence_failed", 503);
    };
    if (action === "create") {
      const { data: existing, error: lookupError } = await db.from("whatsapp_instances").select("id,instance_name,status").eq("salon_id", tenant).maybeSingle();
      if (lookupError) throw new WhatsAppError("persistence_failed", 503);
      if (existing) return jsonResponse({ success: true, instance: { ...existing, salon_id: tenant, instanceName: existing.instance_name } });
      const name = `syshair_${tenant.replaceAll("-", "")}`;
      const webhookUrl = `${requiredEnv("SUPABASE_URL")}/functions/v1/evolution-webhook`;
      // Cadastro persistente anterior à chamada remota; nome determinístico permite reconciliação.
      const { data: row, error } = await db.from("whatsapp_instances").insert({ salon_id: tenant, instance_name: name, api_url: requiredEnv("EVOLUTION_API_URL"), webhook_url: webhookUrl, status: "disconnected" }).select("id").single();
      if (error || !row) throw new WhatsAppError("persistence_failed", 503);
      const { data: secret, error: secretError } = await db.rpc("whatsapp_ensure_instance_secret", { p_instance_id: row.id });
      if (secretError || typeof secret !== "string") throw new WhatsAppError("configuration_missing", 503);
      await api.request("create", name, { instanceName: name, integration: "WHATSAPP-BAILEYS", qrcode: false, webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: false, headers: { "x-syshair-webhook-secret": secret }, events: WEBHOOK_EVENTS } });
      return jsonResponse({ success: true, instance: { id: row.id, salon_id: tenant, instance_name: name, instanceName: name, status: "disconnected" } });
    }
    const instance = await salonInstance(db, tenant);
    if (body.instanceName && body.instanceName !== instance.instance_name) throw new WhatsAppError("forbidden", 403);
    // Instâncias conectadas antes do webhook autenticado não passam pelo connect; sincronizar
    // sem exigir novo QR evita que o webhook passe a rejeitar mensagens após o deploy.
    const syncWebhook = async () => {
      const { data: secret, error } = await db.rpc("whatsapp_ensure_instance_secret", { p_instance_id: instance.id });
      if (error || typeof secret !== "string") throw new WhatsAppError("configuration_missing", 503);
      const url = `${requiredEnv("SUPABASE_URL")}/functions/v1/evolution-webhook`;
      await api.request("webhook", instance.instance_name, { webhook: { enabled: true, url, byEvents: false, base64: false, headers: { "x-syshair-webhook-secret": secret }, events: WEBHOOK_EVENTS } });
      await persist(instance.id, { webhook_url: url });
      const { error: markError } = await db.rpc("whatsapp_webhook_synced", { p_instance_id: instance.id, p_mark: true });
      if (markError) throw new WhatsAppError("persistence_failed", 503);
    };
    if (action === "sync_webhook") {
      await syncWebhook();
      return jsonResponse({ success: true });
    }
    if (action === "connect") {
      await syncWebhook();
      const data = objectValue(await api.request("connect", instance.instance_name));
      const nested = data.qrcode && typeof data.qrcode === "object" ? objectValue(data.qrcode) : {};
      const raw = data.base64 ?? nested.base64;
      const qrcode = typeof raw === "string" && raw.length < 250_000 ? (raw.startsWith("data:image/png;base64,") ? raw : `data:image/png;base64,${raw}`) : null;
      const status = qrcode ? "qrcode" : stateOf(await api.request("state", instance.instance_name)).status;
      await persist(instance.id, { status, qrcode: null });
      return jsonResponse({ success: true, qrcode, status });
    }
    if (action === "delete" || action === "disconnect") {
      await api.request(action === "delete" ? "delete" : "disconnect", instance.instance_name);
      if (action === "delete") {
        const { error } = await db.from("whatsapp_instances").delete().eq("id", instance.id).eq("salon_id", tenant);
        if (error) throw new WhatsAppError("persistence_failed", 503);
      } else await persist(instance.id, { status: "disconnected", phone_number: null, qrcode: null });
      return jsonResponse({ success: true });
    }
    if (action === "contacts") {
      if (instance.status !== "connected") throw new WhatsAppError("disconnected", 409);
      // Agenda (findContacts) + conversas (findChats): quem só conversou também aparece. Grupos/listas/@lid ficam fora.
      const [book, chats] = await Promise.all([
        api.request("contacts", instance.instance_name, {}),
        body.includeChats === false ? Promise.resolve([]) : api.request("chats", instance.instance_name, {}).catch(() => []),
      ]);
      if (!Array.isArray(book)) throw new WhatsAppError("provider_unavailable", 502);
      const all = [...(Array.isArray(chats) ? chats : []), ...book];
      const { contacts, excluded } = evolutionContacts(all);
      return jsonResponse({ success: true, contacts, excluded, truncated: all.length > 10_000 });
    }
    const state = stateOf(await api.request("state", instance.instance_name));
    let phoneNumber = instance.phone_number;
    if (state.status === "connected") {
      // Primeira consulta após o deploy registra o webhook autenticado sem pedir novo QR.
      const { data: synced, error: syncError } = await db.rpc("whatsapp_webhook_synced", { p_instance_id: instance.id });
      if (syncError) throw new WhatsAppError("persistence_failed", 503);
      if (synced !== true) await syncWebhook();
      const remote = await api.request("fetch", instance.instance_name);
      const row = Array.isArray(remote) ? remote.find((v) => {
        if (!v || typeof v !== "object") return false;
        const d = objectValue(v), inner = d.instance && typeof d.instance === "object" ? objectValue(d.instance) : d;
        return (inner.instanceName ?? inner.name) === instance.instance_name;
      }) : remote;
      if (row) phoneNumber = phoneOf(row) ?? phoneNumber;
    }
    await persist(instance.id, { status: state.status, phone_number: phoneNumber, qrcode: null });
    return jsonResponse({ success: true, ...state, phoneNumber, instance: { instanceName: instance.instance_name, owner: phoneNumber ? `${phoneNumber}@s.whatsapp.net` : null } });
  } catch (error) { return errorResponse(error); }
});
