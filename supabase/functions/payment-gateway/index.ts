// Painel do salão: conectar a conta de cobrança (testa a credencial no provedor antes de salvar).
// A credencial vai para payment_private.gateway_secrets e nunca volta para o navegador (só a dica ••••1234).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeSalon, serviceClient } from "../_shared/whatsapp/auth.ts";
import { corsHeaders } from "../_shared/whatsapp/errors.ts";
import { GatewayError, hint, normalizeHandle, PROVIDERS, testAccount, validSecret, type Provider } from "../_shared/payments/gateways.ts";
import { accountOf, functionsUrl } from "../_shared/payments/service.ts";

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const MESSAGES: Record<string, string> = {
  invalid_credentials: "O provedor recusou a chave. Confira se copiou a chave de PRODUÇÃO inteira, sem espaços.",
  provider_unavailable: "O provedor não respondeu agora. Tente de novo em instantes.",
  provider_rejected: "O provedor recusou a operação. Confira se a conta está aprovada e com Pix ativo.",
  invalid_request: "Dados inválidos.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false }, 405);
  const db = serviceClient();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  try {
    await authorizeSalon(req, db, body.salonId);
  } catch (e) { return json({ success: false, error: (e as { code?: string }).code ?? "unauthorized" }, (e as { status?: number }).status ?? 401); }
  const salonId = String(body.salonId);
  const provider = body.provider as Provider;
  if (!PROVIDERS.includes(provider)) return json({ success: false, error: "invalid_request", message: MESSAGES.invalid_request }, 400);
  const sandbox = body.sandbox === true && provider !== "infinitepay";

  try {
    if (body.action === "test") {
      // Testa o que já está salvo (sem receber a chave de novo).
      const { data: st } = await db.from("salon_payment_settings").select("infinitepay_handle").eq("salon_id", salonId).maybeSingle();
      const account = await accountOf(db, salonId, { provider, sandbox, handle: st?.infinitepay_handle ?? null });
      if (!account) return json({ success: false, error: "missing", message: "Nenhuma chave salva para este provedor." });
      const r = await testAccount(fetch, account);
      await db.from("salon_payment_settings").update({ credential_ok_at: new Date().toISOString(), sandbox, credential_hint: provider === "infinitepay" ? `$${account.handle}` : hint(account.secret) }).eq("salon_id", salonId).eq("provider", provider);
      return json({ success: true, account: r.account ?? null });
    }
    if (body.action !== "save") return json({ success: false, error: "invalid_request" }, 400);
    const secret = typeof body.secret === "string" ? body.secret.trim() : "";
    const handle = provider === "infinitepay" ? normalizeHandle(String(body.handle ?? "")) : null;
    if (!validSecret(provider, secret) || (provider !== "infinitepay" && !secret)) return json({ success: false, error: "invalid_credentials", message: "Esse não parece o formato da chave deste provedor. Copie de novo, completa." });
    const r = await testAccount(fetch, { provider, secret, sandbox, handle });

    // Asaas: avisos de pagamento por webhook da conta (o checkout não aceita URL por cobrança). Best effort: o cron cobre.
    let webhookToken: string | null = null;
    if (provider === "asaas") {
      webhookToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const base = sandbox ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
      await fetch(`${base}/webhooks`, {
        method: "POST", signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/json", access_token: secret, "User-Agent": "AgendaFacil365/1.0" },
        body: JSON.stringify({ name: "Agenda Fácil 365", url: `${functionsUrl()}/payment-webhook?p=asaas`, email: "agendafacil365@gmail.com", enabled: true, interrupted: false, apiVersion: 3, authToken: webhookToken, sendType: "SEQUENTIALLY", events: ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "CHECKOUT_PAID"] }),
      }).then(res => { if (!res.ok) webhookToken = null; }).catch(() => { webhookToken = null; });
    }

    const { error: secretError } = await db.rpc("payment_save_secret", { p_salon_id: salonId, p_provider: provider, p_secret: secret || "-", p_webhook_token: webhookToken });
    if (secretError) return json({ success: false, error: "persistence_failed" }, 503);
    const { error } = await db.from("salon_payment_settings").upsert({
      salon_id: salonId, provider, sandbox, infinitepay_handle: handle,
      credential_hint: provider === "infinitepay" ? `$${handle}` : hint(secret), credential_ok_at: new Date().toISOString(),
    }, { onConflict: "salon_id" });
    if (error) return json({ success: false, error: "persistence_failed" }, 503);
    return json({ success: true, account: r.account ?? null, hint: provider === "infinitepay" ? `$${handle}` : hint(secret) });
  } catch (e) {
    const code = e instanceof GatewayError ? e.code : "provider_unavailable";
    return json({ success: false, error: code, message: MESSAGES[code] ?? MESSAGES.provider_unavailable });
  }
});
