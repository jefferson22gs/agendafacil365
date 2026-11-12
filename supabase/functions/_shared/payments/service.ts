// Ponte banco ↔ gateways: configuração do salão, credencial (schema privado) e ciclo da cobrança.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkCharge, createCharge, GatewayError, type Account, type Method, type Provider } from "./gateways.ts";

export interface PaySettings { enabled: boolean; provider: "pix_manual" | Provider; methods: Method[]; payAtSalon: boolean; sandbox: boolean; handle: string | null; ready: boolean }

/** Configuração de cobrança do salão. Sem linha: só Pix manual se houver chave (comportamento antigo). */
export async function paySettings(db: SupabaseClient, salonId: string, pixKey: string | null): Promise<PaySettings> {
  const { data } = await db.from("salon_payment_settings").select("whatsapp_enabled,provider,methods,pay_at_salon,sandbox,infinitepay_handle,credential_ok_at").eq("salon_id", salonId).maybeSingle();
  if (!data) return { enabled: !!pixKey, provider: "pix_manual", methods: ["pix"], payAtSalon: true, sandbox: false, handle: null, ready: !!pixKey };
  const provider = data.provider as PaySettings["provider"];
  const methods = ((data.methods ?? ["pix"]) as string[]).filter((m): m is Method => m === "pix" || m === "card");
  // Gateway só entra no bot depois do "Testar conexão" ter dado certo (credential_ok_at).
  const ready = provider === "pix_manual" ? !!pixKey && methods.includes("pix") : !!data.credential_ok_at;
  return { enabled: !!data.whatsapp_enabled, provider, methods: provider === "pix_manual" ? ["pix"] : methods, payAtSalon: data.pay_at_salon !== false, sandbox: !!data.sandbox, handle: data.infinitepay_handle ?? null, ready };
}

export async function accountOf(db: SupabaseClient, salonId: string, s: Pick<PaySettings, "provider" | "sandbox" | "handle">): Promise<Account | null> {
  if (s.provider === "pix_manual") return null;
  const { data, error } = await db.rpc("payment_secret", { p_salon_id: salonId, p_provider: s.provider });
  if (error) throw new GatewayError("provider_unavailable", "secret_read");
  const row = (Array.isArray(data) ? data[0] : data) as { secret?: string } | null;
  if (s.provider === "infinitepay") return s.handle ? { provider: s.provider, secret: row?.secret === "-" ? "" : row?.secret ?? "", sandbox: false, handle: s.handle } : null;
  return row?.secret ? { provider: s.provider, secret: row.secret, sandbox: s.sandbox } : null;
}

export function functionsUrl(): string {
  // deno-lint-ignore no-explicit-any
  const base = String((globalThis as any).Deno?.env?.get?.("SUPABASE_URL") ?? "").replace(/\/$/, "");
  return `${base}/functions/v1`;
}
function appOrigin(): string {
  // deno-lint-ignore no-explicit-any
  return String((globalThis as any).Deno?.env?.get?.("APP_PUBLIC_URL") ?? "https://agendafacil365.com.br").split(",")[0].trim().replace(/\/$/, "");
}

export interface ChargeOut { id: string; method: Method | "link"; url: string | null; pixCode: string | null; amountCents: number; reused: boolean }
/**
 * Cobrança do agendamento (cliente do próprio telefone). Reaproveita a pendente ainda válida do mesmo método,
 * para dois cliques não gerarem duas cobranças.
 */
export async function chargeAppointment(db: SupabaseClient, salonId: string, phone: string, appointmentId: string, method: Method, s: PaySettings, fetcher: typeof fetch = fetch): Promise<ChargeOut | null> {
  if (s.provider === "pix_manual") return null;
  const { data: appt, error } = await db.from("appointments").select("id,client_name,client_phone,final_price,price,status,services(name),salons(slug,name)").eq("id", appointmentId).eq("salon_id", salonId).maybeSingle();
  if (error) throw new GatewayError("provider_unavailable", "db");
  if (!appt || appt.client_phone !== phone || !["pending", "confirmed"].includes(String(appt.status))) return null;
  const cents = Math.round(Number(appt.final_price ?? appt.price) * 100);
  if (!(cents >= 100)) return null;
  // Pix direto só no Mercado Pago; nos outros o cliente escolhe na página segura (link).
  const kind: Method | "link" = s.provider === "mercadopago" ? method : s.provider === "infinitepay" ? "link" : method;
  const { data: open } = await db.from("payment_charges").select("id,method,checkout_url,pix_code,amount_cents,expires_at").eq("appointment_id", appointmentId).eq("status", "pending").eq("provider", s.provider).eq("method", kind).gt("expires_at", new Date(Date.now() + 5 * 60_000).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (open && open.amount_cents === cents) return { id: open.id, method: kind, url: open.checkout_url, pixCode: open.pix_code, amountCents: cents, reused: true };
  const account = await accountOf(db, salonId, s);
  if (!account) return null;
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + (kind === "pix" ? 60 : 24 * 60) * 60_000);
  const rel = (v: unknown) => (Array.isArray(v) ? v[0] : v) as Record<string, string> | null;
  const salon = rel(appt.salons), service = rel(appt.services);
  const { error: insertError } = await db.from("payment_charges").insert({ id, salon_id: salonId, appointment_id: appointmentId, provider: s.provider, method: kind, amount_cents: cents, expires_at: expiresAt.toISOString() });
  if (insertError) throw new GatewayError("provider_unavailable", "db");
  try {
    const created = await createCharge(fetcher, account, {
      id, amountCents: cents, method, description: `${service?.name ?? "Atendimento"} - ${salon?.name ?? "Salão"}`,
      payer: { name: appt.client_name, phone },
      webhookUrl: `${functionsUrl()}/payment-webhook?p=${s.provider}&c=${id}`,
      redirectUrl: salon?.slug ? `${appOrigin()}/s/${salon.slug}/meus-agendamentos?pagamento=${id}` : appOrigin(),
      expiresAt,
    });
    await db.from("payment_charges").update({ external_id: created.externalId, checkout_url: created.checkoutUrl, pix_code: created.pixCode, provider_ref: created.ref ?? {}, updated_at: new Date().toISOString() }).eq("id", id);
    return { id, method: kind, url: created.checkoutUrl, pixCode: created.pixCode, amountCents: cents, reused: false };
  } catch (e) {
    await db.from("payment_charges").update({ status: "failed", provider_ref: { error: e instanceof GatewayError ? `${e.code}:${e.detail ?? ""}`.slice(0, 200) : "error" }, updated_at: new Date().toISOString() }).eq("id", id);
    throw e;
  }
}

/**
 * Cobrança de um pedido de pacote no provedor do salão (link público). Valor vem do pedido (servidor).
 * Mercado Pago com Pix devolve copia e cola; os demais devolvem a página segura do provedor.
 */
export async function chargePackageOrder(db: SupabaseClient, order: { id: string; salon_id: string; amount_cents: number; client_name: string; client_phone: string; packageName: string; slug: string | null }, method: Method, s: PaySettings, fetcher: typeof fetch = fetch): Promise<ChargeOut | null> {
  if (s.provider === "pix_manual") return null;
  const account = await accountOf(db, order.salon_id, s);
  if (!account) return null;
  const kind: Method | "link" = s.provider === "mercadopago" ? method : s.provider === "infinitepay" ? "link" : method;
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + (kind === "pix" ? 60 : 24 * 60) * 60_000);
  const { error } = await db.from("payment_charges").insert({ id, salon_id: order.salon_id, package_order_id: order.id, provider: s.provider, method: kind, amount_cents: order.amount_cents, expires_at: expiresAt.toISOString() });
  if (error) throw new GatewayError("provider_unavailable", "db");
  try {
    const created = await createCharge(fetcher, account, {
      id, amountCents: order.amount_cents, method, description: `Pacote ${order.packageName}`,
      payer: { name: order.client_name, phone: order.client_phone },
      webhookUrl: `${functionsUrl()}/payment-webhook?p=${s.provider}&c=${id}`,
      redirectUrl: order.slug ? `${appOrigin()}/s/${order.slug}?pacote=${order.id}` : appOrigin(),
      expiresAt,
    });
    await db.from("payment_charges").update({ external_id: created.externalId, checkout_url: created.checkoutUrl, pix_code: created.pixCode, provider_ref: created.ref ?? {}, updated_at: new Date().toISOString() }).eq("id", id);
    return { id, method: kind, url: created.checkoutUrl, pixCode: created.pixCode, amountCents: order.amount_cents, reused: false };
  } catch (e) {
    await db.from("payment_charges").update({ status: "failed", provider_ref: { error: e instanceof GatewayError ? `${e.code}:${e.detail ?? ""}`.slice(0, 200) : "error" }, updated_at: new Date().toISOString() }).eq("id", id);
    throw e;
  }
}

/** Consulta o provedor e, se pago, confirma (uma vez). Retorna true quando a cobrança ficou paga. */
export async function settleCharge(db: SupabaseClient, chargeId: string, extraRef?: Record<string, string>, fetcher: typeof fetch = fetch): Promise<boolean> {
  const { data: ch } = await db.from("payment_charges").select("id,salon_id,provider,status,external_id,provider_ref,expires_at,created_at").eq("id", chargeId).maybeSingle();
  if (!ch) return false;
  if (ch.status === "paid") return true;
  if (ch.status !== "pending") return false;
  const ref = { ...(ch.provider_ref as Record<string, unknown> ?? {}), ...(extraRef ?? {}) };
  if (extraRef) await db.from("payment_charges").update({ provider_ref: ref }).eq("id", ch.id);
  const { data: st } = await db.from("salon_payment_settings").select("provider,sandbox,infinitepay_handle").eq("salon_id", ch.salon_id).maybeSingle();
  const account = await accountOf(db, ch.salon_id, { provider: ch.provider as Provider, sandbox: !!st?.sandbox, handle: st?.infinitepay_handle ?? null });
  if (!account) return false;
  const status = await checkCharge(fetcher, account, { id: ch.id, externalId: ch.external_id, ref });
  const now = new Date();
  if (status.paid) {
    const { error } = await db.rpc("payment_mark_paid", { p_charge_id: ch.id, p_paid_cents: status.paidCents, p_method: status.method ?? null, p_external_id: status.externalId ?? null });
    if (error) throw new GatewayError("provider_unavailable", "mark_paid");
    return true;
  }
  // Vencida há mais de 1 dia (margem para Pix compensado tarde): encerra.
  const expired = ch.expires_at && new Date(ch.expires_at).getTime() < now.getTime() - 24 * 3_600_000;
  await db.from("payment_charges").update({ last_checked_at: now.toISOString(), ...(expired ? { status: "expired" } : status.failed ? { status: "failed" } : {}) }).eq("id", ch.id).eq("status", "pending");
  return false;
}
