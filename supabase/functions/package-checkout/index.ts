// Compra de pacote pelo link público do salão (sem login). O preço vem do banco; o navegador só escolhe
// pacote, forma de pagamento e informa nome/telefone. Pix manual: devolve a chave e o copia e cola (o dono confirma).
// Provedor conectado: devolve copia e cola (Mercado Pago) ou a página segura; pagou, os créditos são liberados sozinhos.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { serviceClient, validUuid } from "../_shared/whatsapp/auth.ts";
import { corsHeaders } from "../_shared/whatsapp/errors.ts";
import { brazilPhone, fullName } from "../_shared/whatsapp/interactive.ts";
import { pixBRCode } from "../_shared/pix/brcode.ts";
import { chargePackageOrder, paySettings, settleCharge } from "../_shared/payments/service.ts";
import { PROVIDER_LABEL } from "../_shared/payments/gateways.ts";

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
  const method = body.method === "card" ? "card" : "pix";

  const { data: pkg } = await db.from("service_packages").select("id,salon_id,name,price,is_active,salons(name,slug,city,pix_key,is_active)").eq("id", body.packageId).maybeSingle();
  const salon = (Array.isArray(pkg?.salons) ? pkg?.salons[0] : pkg?.salons) as { name: string; slug: string | null; city: string | null; pix_key: string | null; is_active: boolean | null } | null;
  if (!pkg || !pkg.is_active || !salon || salon.is_active === false) return json({ success: false, error: "not_found", message: "Pacote indisponível." }, 404);
  const cents = Math.round(Number(pkg.price) * 100);
  if (!(cents >= 100)) return json({ success: false, error: "invalid_price", message: "Pacote sem preço. Fale com o salão." }, 400);

  // Anti-abuso simples: no máximo 5 pedidos pendentes por telefone/salão nas últimas 24 h.
  const { count } = await db.from("package_orders").select("id", { count: "exact", head: true }).eq("salon_id", pkg.salon_id).eq("client_phone", phone).eq("status", "pending").gt("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= 5) return json({ success: false, error: "too_many", message: "Você já tem pedidos em aberto. Conclua o pagamento ou fale com o salão." }, 429);

  const st = await paySettings(db, pkg.salon_id, salon.pix_key);
  const gateway = st.provider !== "pix_manual" && st.ready && st.methods.includes(method);
  if (!gateway && !salon.pix_key) return json({ success: false, error: "no_payment", message: "Este salão ainda não configurou pagamento online. Fale com o salão." }, 409);

  const { data: order, error } = await db.from("package_orders").insert({ salon_id: pkg.salon_id, package_id: pkg.id, client_name: name, client_phone: phone, amount_cents: cents, method: gateway ? method : "pix_manual" }).select("id").single();
  if (error || !order) return json({ success: false, error: "persistence_failed" }, 503);

  if (gateway) {
    try {
      const ch = await chargePackageOrder(db, { id: order.id, salon_id: pkg.salon_id, amount_cents: cents, client_name: name, client_phone: phone, packageName: pkg.name, slug: salon.slug }, method, st);
      if (ch) return json({ success: true, orderId: order.id, mode: "gateway", provider: PROVIDER_LABEL[st.provider as keyof typeof PROVIDER_LABEL], pixCode: ch.pixCode, url: ch.url, amountCents: cents });
    } catch (e) { console.warn("package_charge_failed", (e as { code?: string }).code); }
    if (!salon.pix_key) return json({ success: false, error: "provider_unavailable", message: "Não foi possível gerar a cobrança agora. Tente de novo em instantes." }, 502);
    await db.from("package_orders").update({ method: "pix_manual" }).eq("id", order.id);
  }
  // Pix manual: copia e cola com a chave do salão (txid = pedido). O dono confere e libera os créditos.
  let pixCode: string | null = null;
  try { pixCode = pixBRCode({ key: String(salon.pix_key).trim(), name: salon.name || "Salao", city: salon.city || "Brasil", amount: cents / 100, txid: order.id.replace(/-/g, "").slice(0, 25) }); } catch { pixCode = null; }
  return json({ success: true, orderId: order.id, mode: "pix_manual", pixKey: salon.pix_key, pixCode, amountCents: cents });
});
