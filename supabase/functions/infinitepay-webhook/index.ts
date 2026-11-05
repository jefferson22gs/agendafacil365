// Webhook não é prova de pagamento: confirma pela API InfinitePay e grava tudo numa transação.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { INFINITEPAY_API, isConfirmedPayment, normalizeHandle, parseWebhook, type PaymentCheck } from "../_shared/infinitepay/core.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ success: false }, 405);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), handle = Deno.env.get("INFINITEPAY_HANDLE");
  if (!url || !key || !handle) return json({ success: false, message: "configuration_missing" }, 503);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const hook = parseWebhook(await req.json().catch(() => null));
  if (!hook) return json({ success: false, message: "invalid_payload" }, 400);

  const { data: order, error: readError } = await db.from("infinitepay_orders").select("*").eq("order_nsu", hook.order_nsu).maybeSingle();
  if (readError) return json({ success: false, message: "persistence_failed" }, 503);
  if (!order) return json({ success: false, message: "unknown_order" });
  if (order.status === "paid") return json({ success: true, message: "already_processed" });

  let check: PaymentCheck | null = null;
  try {
    const res = await fetch(`${INFINITEPAY_API}/payment_check`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ handle: normalizeHandle(handle), order_nsu: hook.order_nsu, transaction_nsu: hook.transaction_nsu, slug: hook.invoice_slug }),
    });
    if (res.ok) check = await res.json();
  } catch { /* Falha transitória: não confirma nem consome o pedido. */ }
  if (!isConfirmedPayment(check, order.amount_cents)) return json({ success: false, message: "not_confirmed" }, 400);

  const { data: confirmation, error } = await db.rpc("confirm_infinitepay_order", {
    p_order_nsu: order.order_nsu,
    p_transaction_nsu: hook.transaction_nsu,
    p_invoice_slug: hook.invoice_slug,
    p_paid_amount_cents: Number(check!.paid_amount ?? check!.amount),
    p_capture_method: check!.capture_method ?? null,
  });
  if (error || confirmation?.success !== true) {
    console.warn("infinitepay_confirmation_failed", order.order_nsu);
    return json({ success: false, message: "persistence_failed" }, 503);
  }
  return json({ success: true });
});
