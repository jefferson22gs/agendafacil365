// Cria o link de pagamento InfinitePay da assinatura do estabelecimento do usuário autenticado.
// Valor e plano são definidos AQUI (servidor); o navegador só escolhe "monthly" | "annual".
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { INFINITEPAY_API, PLANS, buildLinkRequest, isPlan, safeRedirect } from "../_shared/infinitepay/core.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const handle = Deno.env.get("INFINITEPAY_HANDLE"), appUrl = Deno.env.get("APP_PUBLIC_URL");
    if (!url || !key || !handle || !appUrl) return json({ error: "configuration_missing" }, 503);
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data: auth, error: authErr } = await db.auth.getUser(token);
    if (authErr || !auth.user) return json({ error: "unauthorized" }, 401);
    const user = auth.user;

    const body = await req.json().catch(() => ({}));
    const plan = (body as Record<string, unknown>).plan;
    if (!isPlan(plan)) return json({ error: "invalid_plan" }, 400);

    const { data: salon } = await db.from("salons").select("id, name, email, phone").eq("owner_id", user.id).limit(1).maybeSingle();
    if (!salon) return json({ error: "salon_missing" }, 409);
    const { data: sub } = await db.from("subscriptions").select("id").eq("salon_id", salon.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    const origins = appUrl.split(",").map((s) => new URL(s.trim()).origin);
    const redirect = safeRedirect((body as Record<string, unknown>).redirect_url, origins, `${origins[0]}/admin/subscription?status=processing`);
    const orderNsu = crypto.randomUUID();
    const webhookUrl = `${url.replace(/\/$/, "")}/functions/v1/infinitepay-webhook`;

    const { error: insErr } = await db.from("infinitepay_orders").insert({
      order_nsu: orderNsu, subscription_id: sub?.id ?? null, salon_id: salon.id, user_id: user.id,
      plan, amount_cents: PLANS[plan].cents, status: "pending",
    });
    if (insErr) return json({ error: "persistence_failed" }, 503);

    const payload = buildLinkRequest({
      handle, orderNsu, plan, redirectUrl: redirect, webhookUrl,
      customer: { name: (user.user_metadata?.full_name as string) ?? salon.name, email: user.email ?? salon.email, phone: salon.phone },
    });
    const res = await fetch(`${INFINITEPAY_API}/links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => null) as { url?: string } | null;
    if (!res.ok || !data?.url || !data.url.startsWith("https://checkout.infinitepay.io/")) {
      console.warn("infinitepay_link_failed", res.status);
      return json({ error: "provider_unavailable" }, 502);
    }
    await db.from("infinitepay_orders").update({ checkout_url: data.url, updated_at: new Date().toISOString() }).eq("order_nsu", orderNsu);
    return json({ url: data.url, order_nsu: orderNsu });
  } catch (e) {
    console.warn("infinitepay_checkout_error", e instanceof Error ? e.name : "unknown");
    return json({ error: "internal_error" }, 500);
  }
});
