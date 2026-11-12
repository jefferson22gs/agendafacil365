// Compra de pacote pelo link público do salão (sem login). O preço vem do banco; o navegador só escolhe
// pacote, forma de pagamento e informa nome/telefone. Pix manual: devolve a chave e o copia e cola (o dono confirma).
// Provedor conectado: devolve copia e cola (Mercado Pago) ou a página segura; pagou, os créditos são liberados sozinhos.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { serviceClient, validUuid } from "../_shared/whatsapp/auth.ts";
import { corsHeaders } from "../_shared/whatsapp/errors.ts";
import { brazilPhone, fullName } from "../_shared/whatsapp/interactive.ts";
import { pixBRCode } from "../_shared/pix/brcode.ts";
import { createPackageOrder, settleCharge } from "../_shared/payments/service.ts";

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false }, 405);
  const db = serviceClient();
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  // Situação do pedido (tela "aguardando pagamento" e volta da página do provedor).
  if (body.action === "status") {
    if (!validUuid(body.orderId)) return json({ success: false, error: "invalid_request" }, 400);
    const { data: o } = await db.from("package_orders").select("id,status,salon_id").eq("id", body.orderId).maybeSingle();
    if (!o) return json({ success: false, error: "not_found" }, 404);
    if (o.status === "pending") {
      const { data: ch } = await db.from("payment_charges").select("id").eq("package_order_id", o.id).eq("status", "pending").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (ch) { try { if (await settleCharge(db, ch.id)) return json({ success: true, status: "paid" }); } catch { /* tenta de novo depois */ } }
    }
    return json({ success: true, status: o.status });
  }

  if (!validUuid(body.packageId)) return json({ success: false, error: "invalid_request", message: "Pacote inválido." }, 400);
  const name = fullName(body.name);
  const phone = brazilPhone(body.phone);
  if (!name) return json({ success: false, error: "invalid_name", message: "Informe nome e sobrenome." }, 400);
  if (!phone) return json({ success: false, error: "invalid_phone", message: "Informe o WhatsApp com DDD." }, 400);
  const r = await createPackageOrder(db, { packageId: String(body.packageId), name, phone, method: body.method === "card" ? "card" : "pix" }, pixBRCode);
  if (!r.ok) return json({ success: false, error: r.error, message: r.message }, r.status);
  return json({ success: true, orderId: r.orderId, mode: r.mode, provider: r.provider, pixCode: r.pixCode, url: r.url, pixKey: r.pixKey, amountCents: r.amountCents });
});
