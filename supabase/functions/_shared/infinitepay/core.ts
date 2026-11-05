/**
 * InfinitePay — link de pagamento (Checkout) para assinatura do Agenda Fácil 365.
 * Sem chave de API: o recebedor é identificado pela InfiniteTag (handle). Por isso a confirmação
 * NUNCA confia no webhook sozinho: todo aviso é revalidado em `payment_check` antes de liberar acesso.
 *
 * Endpoints (verificados em 05/11/2026):
 *   POST https://api.infinitepay.io/invoices/public/checkout/links          -> { url }
 *   POST https://api.infinitepay.io/invoices/public/checkout/payment_check  -> { success, paid, amount, paid_amount, capture_method }
 */
export const INFINITEPAY_API = "https://api.infinitepay.io/invoices/public/checkout";

/** Preços em centavos — os mesmos do Checkout (R$ 39,90/mês, R$ 400,00/ano). Fonte única no servidor. */
export const PLANS = {
  monthly: { cents: 3990, months: 1, label: "Agenda Fácil 365 Premium — Mensal" },
  annual: { cents: 40000, months: 12, label: "Agenda Fácil 365 Premium — Anual" },
} as const;
export type Plan = keyof typeof PLANS;

export const isPlan = (v: unknown): v is Plan => v === "monthly" || v === "annual";

/** Handle sem "$" (a InfiniteTag pública é "$marco-boggian"; a API espera "marco-boggian"). */
export const normalizeHandle = (tag: string): string => tag.trim().replace(/^\$/, "").toLowerCase();

export interface LinkRequest {
  handle: string;
  order_nsu: string;
  items: { quantity: number; price: number; description: string }[];
  redirect_url: string;
  webhook_url: string;
  customer?: { name?: string; email?: string; phone_number?: string };
}

export function buildLinkRequest(opts: {
  handle: string; orderNsu: string; plan: Plan; redirectUrl: string; webhookUrl: string;
  customer?: { name?: string | null; email?: string | null; phone?: string | null };
}): LinkRequest {
  const p = PLANS[opts.plan];
  const customer: LinkRequest["customer"] = {};
  if (opts.customer?.name) customer.name = opts.customer.name.slice(0, 120);
  if (opts.customer?.email) customer.email = opts.customer.email.slice(0, 160);
  const digits = (opts.customer?.phone ?? "").replace(/\D/g, "");
  if (digits.length >= 10) customer.phone_number = `+${digits.startsWith("55") ? digits : `55${digits}`}`;
  return {
    handle: normalizeHandle(opts.handle),
    order_nsu: opts.orderNsu,
    items: [{ quantity: 1, price: p.cents, description: p.label }],
    redirect_url: opts.redirectUrl,
    webhook_url: opts.webhookUrl,
    ...(Object.keys(customer).length ? { customer } : {}),
  };
}

/** Só aceita redirecionar para o próprio app (evita open-redirect com URL vinda do cliente). */
export function safeRedirect(requested: unknown, allowedOrigins: string[], fallback: string): string {
  if (typeof requested !== "string") return fallback;
  try {
    const u = new URL(requested);
    return allowedOrigins.includes(u.origin) ? u.href : fallback;
  } catch { return fallback; }
}

export interface PaymentCheck { success?: boolean; paid?: boolean; amount?: number; paid_amount?: number; capture_method?: string; installments?: number }

/**
 * Decide se um pedido pode ser marcado como pago. Exige confirmação da InfinitePay
 * E valor pago >= valor do pedido (pedido criado pelo servidor, valor não vem do cliente).
 */
export function isConfirmedPayment(check: PaymentCheck | null | undefined, expectedCents: number): boolean {
  if (!check || check.success !== true || check.paid !== true) return false;
  const paid = Number(check.paid_amount ?? check.amount ?? 0);
  return Number.isSafeInteger(expectedCents) && expectedCents > 0
    && Number.isSafeInteger(paid) && paid >= expectedCents;
}

/** Fim do novo período: soma meses a partir do maior entre "agora" e o fim atual (pagamento antecipado não perde dias). */
export function nextPeriodEnd(plan: Plan, currentEnd: string | null | undefined, now = new Date()): Date {
  const cur = currentEnd ? new Date(currentEnd) : null;
  const start = cur && cur > now ? cur : now;
  const end = new Date(start);
  end.setMonth(end.getMonth() + PLANS[plan].months);
  return end;
}

/** Campos mínimos do webhook InfinitePay que usamos (o restante é ignorado). */
export interface WebhookPayload { order_nsu?: string; transaction_nsu?: string; invoice_slug?: string; amount?: number; paid_amount?: number; capture_method?: string; receipt_url?: string }

export function parseWebhook(body: unknown): Required<Pick<WebhookPayload, "order_nsu" | "transaction_nsu" | "invoice_slug">> & WebhookPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const s = (k: string) => (typeof b[k] === "string" && (b[k] as string).length <= 200 ? (b[k] as string) : undefined);
  const order_nsu = s("order_nsu"), transaction_nsu = s("transaction_nsu"), invoice_slug = s("invoice_slug");
  if (!order_nsu || !transaction_nsu || !invoice_slug) return null;
  return {
    order_nsu, transaction_nsu, invoice_slug,
    amount: typeof b.amount === "number" ? b.amount : undefined,
    paid_amount: typeof b.paid_amount === "number" ? b.paid_amount : undefined,
    capture_method: s("capture_method"),
    receipt_url: s("receipt_url"),
  };
}
