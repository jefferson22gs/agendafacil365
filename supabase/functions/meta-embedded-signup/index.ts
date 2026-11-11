// Cadastro Incorporado (Embedded Signup) do WhatsApp: o dono do salão autoriza no Facebook e o número passa a ser
// operado pela plataforma (Provedor de Tecnologia). Fluxo do servidor:
//  1) troca o `code` do login por token do cliente (só para validar a autorização e ler a WABA);
//  2) confere que a WABA e o número vieram da autorização (debug_token → granular_scopes.target_ids);
//  3) atribui a WABA ao usuário do sistema da plataforma (dali em diante tudo usa META_SYSTEM_TOKEN);
//  4) inscreve o app na WABA (webhook), registra o número na Cloud API (PIN) e grava a conexão do salão.
// O token do cliente nunca é guardado.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeSalon, requiredEnv, serviceClient } from "../_shared/whatsapp/auth.ts";
import { corsHeaders, errorResponse, jsonResponse, readRequest, WhatsAppError } from "../_shared/whatsapp/errors.ts";
import { GRAPH } from "../_shared/whatsapp/meta.ts";

const ID = /^\d{5,30}$/;
async function graph(path: string, init: RequestInit & { token?: string } = {}): Promise<Record<string, unknown>> {
  const { token, ...rest } = init;
  let r: Response;
  try {
    r = await fetch(`${GRAPH}/${path}`, { ...rest, redirect: "error", signal: AbortSignal.timeout(20_000), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(rest.headers ?? {}) } });
  } catch { throw new WhatsAppError("provider_unavailable", 503); }
  const data = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (!r.ok) {
    console.warn("meta_signup_graph_error", path.split("?")[0].replace(/\d{5,}/g, ":id"), (data.error as { code?: number } | undefined)?.code);
    throw new WhatsAppError("provider_rejected", 502);
  }
  return data;
}

serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await readRequest(req), db = serviceClient();
    await authorizeSalon(req, db, body.salonId);
    const salonId = body.salonId as string;
    if (body.action === "config") {
      // Dados públicos para o botão abrir o login (nenhum segredo).
      return jsonResponse({ success: true, appId: requiredEnv("META_APP_ID"), configId: requiredEnv("META_EMBEDDED_CONFIG_ID") });
    }
    if (body.action !== "complete") throw new WhatsAppError("invalid_request");
    const code = body.code, wabaId = body.wabaId, phoneId = body.phoneNumberId;
    if (typeof code !== "string" || code.length < 10 || code.length > 2000 || !ID.test(String(wabaId)) || !ID.test(String(phoneId))) throw new WhatsAppError("invalid_request");

    const appId = requiredEnv("META_APP_ID"), secret = requiredEnv("META_APP_SECRET"), system = requiredEnv("META_SYSTEM_TOKEN");
    // 1) code → token do cliente (business integration, curta duração).
    const exchanged = await graph(`oauth/access_token?client_id=${appId}&client_secret=${encodeURIComponent(secret)}&code=${encodeURIComponent(code)}`);
    const userToken = String(exchanged.access_token ?? "");
    if (!userToken) throw new WhatsAppError("provider_rejected", 502);
    // 2) a WABA informada pelo navegador precisa estar entre as autorizadas neste login.
    const dbg = await graph(`debug_token?input_token=${encodeURIComponent(userToken)}&access_token=${appId}|${encodeURIComponent(secret)}`);
    const scopes = ((dbg.data as { granular_scopes?: { scope: string; target_ids?: string[] }[]; app_id?: string } | undefined) ?? {});
    if (scopes.app_id !== appId) throw new WhatsAppError("forbidden", 403);
    const allowed = new Set((scopes.granular_scopes ?? []).filter(s => s.scope.startsWith("whatsapp_business")).flatMap(s => s.target_ids ?? []));
    if (allowed.size && !allowed.has(String(wabaId))) throw new WhatsAppError("forbidden", 403);
    const phones = await graph(`${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, { token: userToken });
    const phone = ((phones.data as { id: string; display_phone_number?: string; verified_name?: string }[] | undefined) ?? []).find(p => p.id === String(phoneId));
    if (!phone) throw new WhatsAppError("forbidden", 403);
    // Um número só pode estar ligado a um salão.
    const { data: taken, error: takenError } = await db.from("whatsapp_instances").select("salon_id").eq("meta_phone_number_id", String(phoneId)).maybeSingle();
    if (takenError) throw new WhatsAppError("persistence_failed", 503);
    if (taken && taken.salon_id !== salonId) throw new WhatsAppError("forbidden", 409);

    // 3) a plataforma passa a operar a WABA pelo usuário do sistema.
    const me = await graph("me?fields=id", { token: system });
    const business = requiredEnv("META_BUSINESS_ID");
    // A WABA do cliente é compartilhada com o portfólio da plataforma no cadastro; atribui ao usuário do sistema
    // (primeiro com o token da plataforma, depois com o do cliente). Já atribuído = segue.
    const assign = `${wabaId}/assigned_users?user=${me.id}&tasks=${encodeURIComponent('["MANAGE"]')}&business=${business}`;
    await graph(assign, { method: "POST", token: system }).catch(() => graph(assign, { method: "POST", token: userToken })).catch(() => undefined);
    // 4) webhook e registro do número na Cloud API.
    await graph(`${wabaId}/subscribed_apps`, { method: "POST", token: system });
    await graph(`${phoneId}/register`, { method: "POST", token: system, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", pin: requiredEnv("META_WA_PIN") }) })
      .catch(e => { if (!(e instanceof WhatsAppError) || e.code !== "provider_rejected") throw e; }); // já registrado: segue

    const digits = String(phone.display_phone_number ?? "").replace(/\D/g, "") || null;
    const row = {
      salon_id: salonId, provider: "meta", status: "connected", instance_name: `meta_${phoneId}`, api_url: null,
      webhook_url: `${requiredEnv("SUPABASE_URL")}/functions/v1/meta-webhook`, phone_number: digits,
      meta_phone_number_id: String(phoneId), meta_waba_id: String(wabaId), meta_display_name: phone.verified_name ?? null, qrcode: null,
    };
    // Substitui a conexão por QR code do salão (uma conexão por salão). A instância da Evolution fica para o dono excluir.
    const { error: upsertError } = await db.from("whatsapp_instances").upsert(row, { onConflict: "salon_id" });
    if (upsertError) throw new WhatsAppError("persistence_failed", 503);
    return jsonResponse({ success: true, phoneNumber: digits, displayName: phone.verified_name ?? null });
  } catch (error) { return errorResponse(error); }
});
