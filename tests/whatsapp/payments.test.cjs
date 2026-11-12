// Cobrança com a conta do salão (Mercado Pago, Asaas, PagBank, InfinitePay): contratos de requisição, confirmação
// só pela consulta à API, pista do webhook e validação da credencial. Sem rede: fetch injetado.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const file = path.join(root, 'supabase/functions/_shared/payments/gateways.ts');
const g = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports: g, require: () => ({}), Response, AbortSignal, URLSearchParams });

/** fetch falso: registra a chamada e responde conforme a URL. */
function fake(routes) {
  const calls = [];
  const http = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : null });
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    const [status, body] = hit ? hit[1] : [404, {}];
    return new Response(JSON.stringify(body), { status });
  };
  return { http, calls };
}
const charge = (method = 'pix') => ({ id: '0b0e6b0e-0000-4000-8000-000000000001', amountCents: 4500, description: 'Corte - Studio', method, payer: { name: 'Ana Souza', phone: '+5511912345678' }, webhookUrl: 'https://x.supabase.co/functions/v1/payment-webhook?p=mercadopago&c=1', redirectUrl: 'https://agendafacil365.com.br/s/x/meus-agendamentos', expiresAt: new Date('2026-11-12T15:00:00Z') });
const MP = { provider: 'mercadopago', secret: 'APP_USR-1234567890123456-abcdef', sandbox: false };

test('credencial: formato por provedor antes de ir à rede; InfinitePay só com InfiniteTag', async () => {
  assert.equal(g.validSecret('mercadopago', 'APP_USR-1234567890123456-abcdef'), true);
  assert.equal(g.validSecret('mercadopago', 'chave errada com espaço'), false);
  assert.equal(g.validSecret('asaas', '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjA1'), true);
  assert.equal(g.validSecret('asaas', 'APP_USR-123'), false);
  assert.equal(g.validSecret('pagbank', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890abcd'), true);
  assert.equal(g.validSecret('infinitepay', ''), true, 'API Key opcional');
  assert.equal(g.hint('APP_USR-1234567890123456-abcdef'), '••••cdef');
  await assert.rejects(() => g.testAccount(fake({}).http, { provider: 'infinitepay', secret: '', handle: '' }), e => e.code === 'invalid_credentials');
  assert.equal((await g.testAccount(fake({}).http, { provider: 'infinitepay', secret: '', handle: '$Studio-X' })).account, '$studio-x');
  const { http, calls } = fake({ '/users/me': [200, { nickname: 'STUDIOX' }] });
  assert.equal((await g.testAccount(http, MP)).account, 'STUDIOX');
  assert.equal(calls[0].headers.Authorization, `Bearer ${MP.secret}`);
  await assert.rejects(() => g.testAccount(fake({ '/users/me': [401, {}] }).http, MP), e => e.code === 'invalid_credentials');
  const asaas = fake({ '/myAccount/commercialInfo/': [200, { companyName: 'Studio X' }] });
  await g.testAccount(asaas.http, { provider: 'asaas', secret: '$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3', sandbox: true });
  assert.match(asaas.calls[0].url, /^https:\/\/api-sandbox\.asaas\.com\/v3\//); assert.ok(asaas.calls[0].headers.access_token && asaas.calls[0].headers['User-Agent']);
});

test('Mercado Pago: Pix com idempotência, referência e copia e cola; cartão pelo Checkout Pro', async () => {
  const { http, calls } = fake({ '/v1/payments': [201, { id: 987, point_of_interaction: { transaction_data: { qr_code: '00020126PIX', ticket_url: 'https://mp/ticket' } } }], '/checkout/preferences': [201, { id: 'pref1', init_point: 'https://mp/checkout' }] });
  const pix = await g.createCharge(http, MP, charge('pix'));
  assert.deepEqual([pix.pixCode, pix.externalId], ['00020126PIX', '987']);
  const body = calls[0].body;
  assert.equal(calls[0].headers['X-Idempotency-Key'], charge().id);
  assert.equal(body.transaction_amount, 45); assert.equal(body.payment_method_id, 'pix'); assert.equal(body.external_reference, charge().id);
  assert.match(body.payer.email, /@/); assert.match(body.date_of_expiration, /-03:00$/); assert.match(body.notification_url, /^https:/);
  const card = await g.createCharge(http, MP, charge('card'));
  assert.equal(card.checkoutUrl, 'https://mp/checkout');
  assert.equal(calls[1].body.items[0].unit_price, 45); assert.equal(calls[1].body.external_reference, charge().id);
  await assert.rejects(() => g.createCharge(http, MP, { ...charge(), amountCents: 50 }), e => e.code === 'invalid_request', 'mínimo R$ 1,00');
});

test('confirmação só pela consulta: aprovado com nossa referência; valor em centavos; webhook não confirma', async () => {
  const paid = fake({ '/v1/payments/search': [200, { results: [{ id: 1, status: 'approved', external_reference: charge().id, transaction_amount: 45, payment_type_id: 'bank_transfer' }] }] });
  assert.deepEqual(JSON.parse(JSON.stringify(await g.checkCharge(paid.http, MP, { id: charge().id, externalId: null, ref: {} }))), { paid: true, paidCents: 4500, method: 'pix', externalId: '1' });
  assert.match(paid.calls[0].url, /external_reference=0b0e6b0e/);
  const other = fake({ '/v1/payments/search': [200, { results: [{ id: 2, status: 'approved', external_reference: 'outra', transaction_amount: 45 }] }] });
  assert.equal((await g.checkCharge(other.http, MP, { id: charge().id, externalId: null, ref: {} })).paid, false, 'referência de outra cobrança não vale');
  const pending = fake({ '/v1/payments/search': [200, { results: [{ id: 3, status: 'pending', external_reference: charge().id }] }] });
  assert.equal((await g.checkCharge(pending.http, MP, { id: charge().id, externalId: null, ref: {} })).paid, false);
  // Pista do webhook: só ids; nada de status.
  const q = new URLSearchParams('p=mercadopago&c=0b0e6b0e-0000-4000-8000-000000000001');
  assert.deepEqual(JSON.parse(JSON.stringify(g.webhookHint('mercadopago', { type: 'payment', data: { id: '999' } }, q))), { chargeId: charge().id, externalId: '999' });
  assert.equal(g.webhookHint('mercadopago', {}, new URLSearchParams('c=DROP')).chargeId, undefined, 'id inválido ignorado');
});

test('Asaas: checkout hospedado (sem CPF), Pix ou cartão; confirma por checkoutSession', async () => {
  const A = { provider: 'asaas', secret: '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3', sandbox: false };
  const { http, calls } = fake({ '/checkouts': [200, { id: 'chk_1' }], '/payments?checkoutSession=chk_1': [200, { data: [{ id: 'pay_1', status: 'RECEIVED', value: 45, billingType: 'PIX' }] }] });
  const c = await g.createCharge(http, A, charge('pix'));
  assert.equal(c.checkoutUrl, 'https://asaas.com/checkoutSession/show?id=chk_1'); assert.equal(c.externalId, 'chk_1');
  assert.deepEqual(calls[0].body.billingTypes, ['PIX']); assert.equal(calls[0].body.externalReference, charge().id); assert.equal(calls[0].body.items[0].value, 45);
  assert.ok(calls[0].body.minutesToExpire >= 10 && calls[0].body.minutesToExpire <= 1440);
  const s = await g.checkCharge(http, A, { id: charge().id, externalId: 'chk_1', ref: {} });
  assert.equal(s.paid, true); assert.equal(s.paidCents, 4500); assert.equal(s.method, 'pix');
  assert.equal(g.webhookHint('asaas', { event: 'PAYMENT_RECEIVED', payment: { externalReference: charge().id, checkoutSession: 'chk_1' } }, new URLSearchParams('p=asaas')).chargeId, charge().id);
});

test('PagBank: checkout com valor em centavos e link PAY; pago quando a cobrança do pedido está PAID', async () => {
  const P = { provider: 'pagbank', secret: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890abcd', sandbox: true };
  const { http, calls } = fake({ '/checkouts/CHEC_1': [200, { orders: [{ id: 'ORDE_1', charges: [{ status: 'PAID', amount: { value: 4500, summary: { paid: 4500 } }, payment_method: { type: 'CREDIT_CARD' } }] }] }], '/checkouts': [201, { id: 'CHEC_1', links: [{ rel: 'SELF', href: 'x' }, { rel: 'PAY', href: 'https://pagamento.pagbank/1' }] }] });
  const c = await g.createCharge(http, P, charge('card'));
  assert.equal(c.checkoutUrl, 'https://pagamento.pagbank/1');
  assert.match(calls[0].url, /^https:\/\/sandbox\.api\.pagseguro\.com\/checkouts$/);
  assert.equal(calls[0].body.items[0].unit_amount, 4500); assert.deepEqual(calls[0].body.payment_methods, [{ type: 'CREDIT_CARD' }]); assert.equal(calls[0].body.reference_id, charge().id);
  const s = await g.checkCharge(http, P, { id: charge().id, externalId: 'CHEC_1', ref: {} });
  assert.deepEqual([s.paid, s.paidCents, s.method], [true, 4500, 'card']);
});

test('InfinitePay: link pela InfiniteTag; só confirma com transaction_nsu + slug do aviso (payment_check)', async () => {
  const I = { provider: 'infinitepay', secret: '', sandbox: false, handle: '$studio-x' };
  const { http, calls } = fake({ '/links': [200, { url: 'https://checkout.infinitepay.io/studio-x/abc' }], '/payment_check': [200, { success: true, paid: true, amount: 4500, paid_amount: 4590, capture_method: 'pix' }] });
  const c = await g.createCharge(http, I, charge('pix'));
  assert.equal(c.checkoutUrl, 'https://checkout.infinitepay.io/studio-x/abc');
  assert.equal(calls[0].body.handle, 'studio-x'); assert.equal(calls[0].body.order_nsu, charge().id); assert.equal(calls[0].body.items[0].price, 4500);
  assert.equal((await g.checkCharge(http, I, { id: charge().id, externalId: null, ref: {} })).paid, false, 'sem aviso não há como consultar');
  const hint = g.webhookHint('infinitepay', { order_nsu: charge().id, transaction_nsu: 'tx1', invoice_slug: 'slug1' }, new URLSearchParams('p=infinitepay'));
  const s = await g.checkCharge(http, I, { id: charge().id, externalId: null, ref: hint.ref });
  assert.deepEqual([s.paid, s.paidCents, s.method], [true, 4590, 'pix']);
  assert.deepEqual(calls.at(-1).body, { handle: 'studio-x', order_nsu: charge().id, transaction_nsu: 'tx1', slug: 'slug1' });
});

test('erros: 5xx/rede = indisponível (tenta depois); 4xx = recusado com motivo; 401 = credencial', async () => {
  await assert.rejects(() => g.createCharge(fake({ '/v1/payments': [502, {}] }).http, MP, charge()), e => e.code === 'provider_unavailable');
  await assert.rejects(() => g.createCharge(fake({ '/v1/payments': [400, { message: 'Collector user without key enabled for QR render' }] }).http, MP, charge()), e => e.code === 'provider_rejected' && /QR render/.test(e.detail));
  await assert.rejects(() => g.createCharge(async () => { throw new Error('offline'); }, MP, charge()), e => e.code === 'provider_unavailable');
});

test('banco: credencial em schema privado, cobrança confirmada uma vez, avaliações públicas sem telefone', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261112000200_payments_reviews.sql'), 'utf8');
  assert.match(sql, /REVOKE ALL ON payment_private\.gateway_secrets FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /IF ch\.status = 'paid' THEN RETURN true; END IF;/, 'idempotente');
  assert.match(sql, /p_paid_cents < ch\.amount_cents THEN RAISE EXCEPTION 'amount_mismatch'/, 'valor menor não confirma');
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.payment_mark_paid\(uuid, integer, text, text\) TO service_role/);
  const reviews = sql.slice(sql.indexOf('public_professional_reviews'), sql.indexOf('client_portal_review'));
  assert.doesNotMatch(reviews, /phone/, 'lista pública nunca expõe telefone');
  assert.match(reviews, /left\(split_part/, 'nome abreviado (Ana S.)');
});
