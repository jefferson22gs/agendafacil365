// Cobrança com a conta do PRÓPRIO salão: Mercado Pago, Asaas, PagBank e InfinitePay.
// Sem rede direta: tudo passa por `http` (fetch injetável) para testar sem internet.
// Regra de ouro: webhook só avisa; pagamento é confirmado consultando o provedor (`check`).
// Pix com copia-e-cola direto só no Mercado Pago (Asaas/PagBank exigem CPF do cliente para isso):
// nos demais o cliente paga Pix ou cartão numa página segura do provedor (link).

export type Provider = "mercadopago" | "asaas" | "pagbank" | "infinitepay";
export type Method = "pix" | "card";
export const PROVIDERS: Provider[] = ["mercadopago", "asaas", "pagbank", "infinitepay"];
export const PROVIDER_LABEL: Record<Provider, string> = { mercadopago: "Mercado Pago", asaas: "Asaas", pagbank: "PagBank", infinitepay: "InfinitePay" };

export class GatewayError extends Error {
  constructor(public code: "invalid_credentials" | "provider_rejected" | "provider_unavailable" | "not_supported" | "invalid_request", public detail?: string) { super(code); }
}
export type Http = (url: string, init: RequestInit) => Promise<Response>;
export interface Account { provider: Provider; secret: string; sandbox: boolean; handle?: string | null }
export interface ChargeInput {
  id: string; amountCents: number; description: string; method: Method;
  payer: { name?: string | null; phone?: string | null; email?: string | null };
  webhookUrl: string; redirectUrl: string; expiresAt: Date;
}
export interface Created { externalId: string | null; checkoutUrl: string | null; pixCode: string | null; ref?: Record<string, string> }
export interface Status { paid: boolean; paidCents: number; method?: Method; externalId?: string; failed?: boolean }

const BASE = {
  mercadopago: () => "https://api.mercadopago.com",
  asaas: (s: boolean) => (s ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3"),
  pagbank: (s: boolean) => (s ? "https://sandbox.api.pagseguro.com" : "https://api.pagseguro.com"),
  infinitepay: () => "https://api.checkout.infinitepay.io",
} as const;
const UA = "AgendaFacil365/1.0 (+https://agendafacil365.com.br)";
const reais = (cents: number) => Math.round(cents) / 100;
const toCents = (v: unknown) => Math.round(Number(v) * 100);
const clip = (s: string, n: number) => Array.from(s.replace(/\s+/g, " ").trim()).slice(0, n).join("");
/** ISO com fuso de Brasília (-03:00), formato aceito pelos três provedores que pedem data local. */
export function isoBR(d: Date): string {
  const t = new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 19);
  return `${t}.000-03:00`;
}
/** Credencial bem formada antes de ir à rede (evita mandar lixo/colagem errada ao provedor). */
export function validSecret(provider: Provider, secret: string): boolean {
  const s = secret.trim();
  // InfinitePay funciona só com a InfiniteTag; a API Key (inchk_) é opcional.
  if (provider === "infinitepay") return s === "" || /^inchk_[\w-]{8,200}$/.test(s);
  if (s.length < 20 || s.length > 600 || /\s/.test(s)) return false;
  if (provider === "mercadopago") return /^(APP_USR|TEST)-[\w-]+$/.test(s);
  if (provider === "asaas") return /^\$?aact_[\w+/=:$-]+$/.test(s);
  return /^[\w.-]+$/.test(s);
}
export const normalizeHandle = (tag: string) => tag.trim().replace(/^\$/, "").toLowerCase();
/** Últimos 4 caracteres, para o painel mostrar qual credencial está salva sem expô-la. */
export const hint = (secret: string) => (secret.trim() ? `••••${secret.trim().slice(-4)}` : null);

async function call(http: Http, url: string, init: RequestInit): Promise<{ status: number; data: Record<string, unknown> | null }> {
  let res: Response;
  try { res = await http(url, { ...init, redirect: "error", signal: AbortSignal.timeout(20_000) }); }
  catch { throw new GatewayError("provider_unavailable"); }
  const text = await res.text();
  let data: Record<string, unknown> | null = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (res.status === 401 || res.status === 403) throw new GatewayError("invalid_credentials");
  if (res.status >= 500) throw new GatewayError("provider_unavailable", String(res.status));
  if (res.status >= 400) throw new GatewayError("provider_rejected", errorText(data) || String(res.status));
  return { status: res.status, data };
}
function errorText(d: Record<string, unknown> | null): string {
  if (!d) return "";
  const e = (d.errors ?? d.error_messages ?? d.cause) as unknown;
  const first = Array.isArray(e) ? e[0] as Record<string, unknown> : null;
  return clip(String(first?.description ?? first?.message ?? d.message ?? d.error ?? ""), 160);
}
const headers = (a: Account, extra: Record<string, string> = {}): Record<string, string> => {
  const h: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA, ...extra };
  if (a.provider === "asaas") h.access_token = a.secret.trim();
  else if (a.provider === "infinitepay") { if (a.secret.trim()) h["X-Api-Key"] = a.secret.trim(); }
  else h.Authorization = `Bearer ${a.secret.trim()}`;
  return h;
};
const get = (o: unknown, ...path: (string | number)[]): unknown => path.reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string | number, unknown>)[k] : undefined), o);
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

// --------------------------------------------------------------------------------------------- testar credencial
/** Chamada barata e sem efeito colateral. InfinitePay não tem consulta: valida o formato da InfiniteTag. */
export async function testAccount(http: Http, a: Account): Promise<{ ok: true; account?: string }> {
  if (a.provider === "infinitepay") {
    if (!a.handle || !/^[a-z0-9][a-z0-9_.-]{1,59}$/.test(normalizeHandle(a.handle))) throw new GatewayError("invalid_credentials");
    return { ok: true, account: `$${normalizeHandle(a.handle)}` };
  }
  if (!validSecret(a.provider, a.secret)) throw new GatewayError("invalid_credentials");
  if (a.provider === "mercadopago") {
    const { data } = await call(http, `${BASE.mercadopago()}/users/me`, { method: "GET", headers: headers(a) });
    return { ok: true, account: str(get(data, "nickname")) ?? str(get(data, "email")) ?? undefined };
  }
  if (a.provider === "asaas") {
    const { data } = await call(http, `${BASE.asaas(a.sandbox)}/myAccount/commercialInfo/`, { method: "GET", headers: headers(a) });
    return { ok: true, account: str(get(data, "companyName")) ?? str(get(data, "name")) ?? undefined };
  }
  // PagBank: sem endpoint de conta com token simples; a chave pública de cartão exige token válido.
  await call(http, `${BASE.pagbank(a.sandbox)}/public-keys/card`, { method: "GET", headers: headers(a) });
  return { ok: true };
}

// --------------------------------------------------------------------------------------------- criar cobrança
/** Webhook do provedor só funciona com https público. */
const hookOk = (u: string) => /^https:\/\//.test(u);

export async function createCharge(http: Http, a: Account, c: ChargeInput): Promise<Created> {
  if (!Number.isSafeInteger(c.amountCents) || c.amountCents < 100) throw new GatewayError("invalid_request", "min_amount");
  const desc = clip(c.description || "Atendimento", 60);
  if (a.provider === "mercadopago") {
    if (c.method === "pix") {
      const body = {
        transaction_amount: reais(c.amountCents), payment_method_id: "pix", description: desc, external_reference: c.id,
        date_of_expiration: isoBR(c.expiresAt), ...(hookOk(c.webhookUrl) ? { notification_url: c.webhookUrl } : {}),
        // Mercado Pago valida o formato do e-mail; sem e-mail do cliente vai um endereço técnico do pedido.
        payer: { email: c.payer.email || `cliente+${c.id.slice(0, 8)}@agendafacil365.com.br`, ...(c.payer.name ? { first_name: clip(c.payer.name.split(" ")[0], 40) } : {}) },
      };
      const { data } = await call(http, `${BASE.mercadopago()}/v1/payments`, { method: "POST", headers: headers(a, { "X-Idempotency-Key": c.id }), body: JSON.stringify(body) });
      const code = str(get(data, "point_of_interaction", "transaction_data", "qr_code"));
      if (!code) throw new GatewayError("provider_rejected", "pix_not_enabled");
      return { externalId: String(get(data, "id") ?? "") || null, pixCode: code, checkoutUrl: str(get(data, "point_of_interaction", "transaction_data", "ticket_url")) };
    }
    const body = {
      items: [{ id: c.id, title: desc, quantity: 1, unit_price: reais(c.amountCents), currency_id: "BRL" }], external_reference: c.id,
      back_urls: { success: c.redirectUrl, failure: c.redirectUrl, pending: c.redirectUrl }, auto_return: "approved",
      ...(hookOk(c.webhookUrl) ? { notification_url: c.webhookUrl } : {}), expires: true, expiration_date_to: isoBR(c.expiresAt),
      payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] }, statement_descriptor: clip(desc, 13),
    };
    const { data } = await call(http, `${BASE.mercadopago()}/checkout/preferences`, { method: "POST", headers: headers(a), body: JSON.stringify(body) });
    const url = str(get(data, a.sandbox ? "sandbox_init_point" : "init_point")) ?? str(get(data, "init_point"));
    if (!url) throw new GatewayError("provider_rejected", "no_checkout_url");
    return { externalId: null, checkoutUrl: url, pixCode: null, ref: { preference: String(get(data, "id") ?? "") } };
  }
  if (a.provider === "asaas") {
    // Checkout hospedado: não exige CPF na criação (o cliente informa na página). Pix e/ou cartão.
    const minutes = Math.max(10, Math.min(1440, Math.round((c.expiresAt.getTime() - Date.now()) / 60_000)));
    const body = {
      billingTypes: c.method === "card" ? ["CREDIT_CARD"] : ["PIX"], chargeTypes: ["DETACHED"], minutesToExpire: minutes, externalReference: c.id,
      callback: { successUrl: c.redirectUrl, cancelUrl: c.redirectUrl, expiredUrl: c.redirectUrl },
      items: [{ name: desc, description: desc, quantity: 1, value: reais(c.amountCents) }],
    };
    const { data } = await call(http, `${BASE.asaas(a.sandbox)}/checkouts`, { method: "POST", headers: headers(a), body: JSON.stringify(body) });
    const id = str(get(data, "id"));
    if (!id) throw new GatewayError("provider_rejected", "no_checkout");
    const host = a.sandbox ? "https://sandbox.asaas.com" : "https://asaas.com";
    return { externalId: id, checkoutUrl: str(get(data, "link")) ?? `${host}/checkoutSession/show?id=${encodeURIComponent(id)}`, pixCode: null };
  }
  if (a.provider === "pagbank") {
    const body = {
      reference_id: c.id, expiration_date: isoBR(c.expiresAt), items: [{ reference_id: c.id, name: desc, quantity: 1, unit_amount: c.amountCents }],
      payment_methods: c.method === "card" ? [{ type: "CREDIT_CARD" }] : [{ type: "PIX" }], redirect_url: c.redirectUrl,
      ...(hookOk(c.webhookUrl) ? { notification_urls: [c.webhookUrl], payment_notification_urls: [c.webhookUrl] } : {}),
    };
    const { data } = await call(http, `${BASE.pagbank(a.sandbox)}/checkouts`, { method: "POST", headers: headers(a), body: JSON.stringify(body) });
    const links = (get(data, "links") as { rel?: string; href?: string }[] | undefined) ?? [];
    const pay = links.find(l => l?.rel === "PAY")?.href;
    const id = str(get(data, "id"));
    if (!pay || !id) throw new GatewayError("provider_rejected", "no_checkout_url");
    return { externalId: id, checkoutUrl: pay, pixCode: null };
  }
  // InfinitePay: link de checkout (Pix + cartão na mesma página). Sem Pix por API.
  if (!a.handle) throw new GatewayError("invalid_credentials");
  const body = {
    handle: normalizeHandle(a.handle), order_nsu: c.id, items: [{ description: desc, price: c.amountCents, quantity: 1 }],
    redirect_url: c.redirectUrl, ...(hookOk(c.webhookUrl) ? { webhook_url: c.webhookUrl } : {}),
    ...(c.payer.name || c.payer.phone ? { customer: { ...(c.payer.name ? { name: clip(c.payer.name, 120) } : {}), ...(c.payer.phone ? { phone_number: c.payer.phone } : {}) } } : {}),
  };
  const { data } = await call(http, `${BASE.infinitepay()}/links`, { method: "POST", headers: headers(a), body: JSON.stringify(body) });
  const url = str(get(data, "url")) ?? str(get(data, "link")) ?? str(get(data, "checkout_url"));
  if (!url || !/^https:\/\//.test(url)) throw new GatewayError("provider_rejected", "no_checkout_url");
  return { externalId: null, checkoutUrl: url, pixCode: null };
}

// --------------------------------------------------------------------------------------------- consultar
/** Consulta o provedor. `ref`: dados da cobrança (externalId e, no InfinitePay, transaction_nsu/slug do webhook). */
export async function checkCharge(http: Http, a: Account, ch: { id: string; externalId: string | null; ref: Record<string, unknown> }): Promise<Status> {
  const none: Status = { paid: false, paidCents: 0 };
  if (a.provider === "mercadopago") {
    const { data } = await call(http, `${BASE.mercadopago()}/v1/payments/search?external_reference=${encodeURIComponent(ch.id)}&sort=date_created&criteria=desc&limit=10`, { method: "GET", headers: headers(a) });
    const results = (get(data, "results") as Record<string, unknown>[] | undefined) ?? [];
    const ok = results.find(p => p?.status === "approved" && p?.external_reference === ch.id);
    if (!ok) return { ...none, failed: results.length > 0 && results.every(p => ["rejected", "cancelled"].includes(String(p?.status))) };
    return { paid: true, paidCents: toCents(get(ok, "transaction_amount")), method: get(ok, "payment_type_id") === "bank_transfer" ? "pix" : "card", externalId: String(get(ok, "id")) };
  }
  if (a.provider === "asaas") {
    const q = ch.externalId ? `checkoutSession=${encodeURIComponent(ch.externalId)}` : `externalReference=${encodeURIComponent(ch.id)}`;
    const { data } = await call(http, `${BASE.asaas(a.sandbox)}/payments?${q}&limit=10`, { method: "GET", headers: headers(a) });
    const list = (get(data, "data") as Record<string, unknown>[] | undefined) ?? [];
    const ok = list.find(p => ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(String(p?.status)));
    if (!ok) return none;
    return { paid: true, paidCents: toCents(get(ok, "value")), method: get(ok, "billingType") === "PIX" ? "pix" : "card", externalId: String(get(ok, "id")) };
  }
  if (a.provider === "pagbank") {
    if (!ch.externalId) return none;
    const { data } = await call(http, `${BASE.pagbank(a.sandbox)}/checkouts/${encodeURIComponent(ch.externalId)}`, { method: "GET", headers: headers(a) });
    const orders = ((get(data, "orders") as Record<string, unknown>[] | undefined) ?? []);
    for (const o of orders) {
      const charges = (get(o, "charges") as Record<string, unknown>[] | undefined) ?? [];
      const paid = charges.find(x => x?.status === "PAID");
      if (paid) return { paid: true, paidCents: Number(get(paid, "amount", "summary", "paid") ?? get(paid, "amount", "value") ?? 0), method: get(paid, "payment_method", "type") === "PIX" ? "pix" : "card", externalId: String(get(o, "id") ?? "") };
    }
    return none;
  }
  // InfinitePay: só confirma com transaction_nsu + slug (vêm no webhook ou no redirect).
  const tx = str(ch.ref.transaction_nsu), slug = str(ch.ref.slug);
  if (!tx || !slug || !a.handle) return none;
  const { data } = await call(http, `${BASE.infinitepay()}/payment_check`, { method: "POST", headers: headers(a), body: JSON.stringify({ handle: normalizeHandle(a.handle), order_nsu: ch.id, transaction_nsu: tx, slug }) });
  if (get(data, "success") !== true || get(data, "paid") !== true) return none;
  return { paid: true, paidCents: Number(get(data, "paid_amount") ?? get(data, "amount") ?? 0), method: get(data, "capture_method") === "pix" ? "pix" : "card", externalId: tx };
}

// --------------------------------------------------------------------------------------------- webhook
/**
 * Do corpo do aviso, só a pista para achar a cobrança. Nada aqui confirma pagamento.
 * `chargeId` = nosso id (referência externa) quando o provedor devolve; `externalId` = id do provedor.
 */
export function webhookHint(provider: Provider, body: unknown, query: URLSearchParams): { chargeId?: string; externalId?: string; ref?: Record<string, string> } {
  const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : undefined);
  const s = (v: unknown) => (typeof v === "string" && v.length <= 200 ? v : typeof v === "number" ? String(v) : undefined);
  const charge = uuid(query.get("c"));
  if (provider === "mercadopago") return { chargeId: charge, externalId: s(get(body, "data", "id")) ?? s(query.get("data.id")) ?? s(query.get("id")) };
  if (provider === "asaas") return { chargeId: charge ?? uuid(get(body, "payment", "externalReference")) ?? uuid(get(body, "checkout", "externalReference")), externalId: s(get(body, "payment", "checkoutSession")) ?? s(get(body, "checkout", "id")) };
  if (provider === "pagbank") return { chargeId: charge ?? uuid(get(body, "reference_id")), externalId: s(get(body, "checkout_id")) };
  const tx = s(get(body, "transaction_nsu")), slug = s(get(body, "invoice_slug")) ?? s(get(body, "slug"));
  return { chargeId: charge ?? uuid(get(body, "order_nsu")), ref: tx && slug ? { transaction_nsu: tx, slug } : undefined };
}
