// Avisos dos provedores de cobrança (Mercado Pago, Asaas, PagBank, InfinitePay) + conferência periódica (cron).
// O aviso nunca confirma sozinho: a cobrança é consultada na API do provedor com a credencial do salão.
// Responde 200 rápido para o provedor não reenviar em loop; falha transitória fica para o cron.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authorizeWorker, serviceClient } from "../_shared/whatsapp/auth.ts";
import { PROVIDERS, webhookHint, type Provider } from "../_shared/payments/gateways.ts";
import { settleCharge } from "../_shared/payments/service.ts";

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") return json({ ok: true }); // alguns painéis testam a URL com GET
  if (req.method !== "POST") return json({ ok: false }, 405);
  const db = serviceClient();
  const raw = await req.text();
  let body: unknown = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }

  // Cron: confere até 20 cobranças pendentes, as menos conferidas primeiro.
  if ((body as { worker?: boolean } | null)?.worker === true) {
    try { authorizeWorker(req); } catch { return json({ ok: false }, 403); }
    const { data } = await db.from("payment_charges").select("id").eq("status", "pending").gt("created_at", new Date(Date.now() - 2 * 86_400_000).toISOString())
      .or(`last_checked_at.is.null,last_checked_at.lt.${new Date(Date.now() - 60_000).toISOString()}`).order("last_checked_at", { ascending: true, nullsFirst: true }).limit(20);
    let paid = 0;
    for (const row of data ?? []) { try { if (await settleCharge(db, row.id)) paid++; } catch { /* próxima rodada */ } }
    return json({ ok: true, checked: data?.length ?? 0, paid });
  }

  const provider = url.searchParams.get("p") as Provider | null;
  if (!provider || !PROVIDERS.includes(provider)) return json({ ok: false }, 400);
  const hint = webhookHint(provider, body, url.searchParams);
  let chargeId = hint.chargeId;
  if (!chargeId && hint.externalId) {
    const { data } = await db.from("payment_charges").select("id").eq("provider", provider).eq("external_id", hint.externalId).maybeSingle();
    chargeId = data?.id;
  }
  if (!chargeId) return json({ ok: true, ignored: true });
  // Asaas: token do webhook (quando configurado) precisa bater; os outros validam consultando a API.
  if (provider === "asaas") {
    const { data: ch } = await db.from("payment_charges").select("salon_id").eq("id", chargeId).maybeSingle();
    if (ch) {
      const { data: sec } = await db.rpc("payment_secret", { p_salon_id: ch.salon_id, p_provider: "asaas" });
      const expected = (Array.isArray(sec) ? sec[0] : sec)?.webhook_token;
      if (expected && req.headers.get("asaas-access-token") !== expected) return json({ ok: false }, 401);
    }
  }
  try {
    const paid = await settleCharge(db, chargeId, hint.ref);
    return json({ ok: true, paid });
  } catch {
    return json({ ok: true, retry: true }); // o cron confere de novo em até 1 min
  }
});
