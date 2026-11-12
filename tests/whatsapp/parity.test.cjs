// Paridade QR Code (Evolution, sem botões) × API oficial (Meta, botões): o mesmo fluxo completo — menu, serviço,
// profissional, data, horário, nome, confirmação, reserva e pagamento (Pix copia e cola e link do cartão) — só
// digitando números no QR Code. Sem rede: o gateway (Mercado Pago) responde por um fetch falso.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const { Temporal } = require('@js-temporal/polyfill');
const root = path.resolve(__dirname, '../..');
const sh = path.join(root, 'supabase/functions/_shared');

const gatewayCalls = [];
async function fakeGateway(url, init) {
  const body = init.body ? JSON.parse(init.body) : null;
  gatewayCalls.push({ url, body });
  if (url.includes('/v1/payments')) return new Response(JSON.stringify({ id: 555, point_of_interaction: { transaction_data: { qr_code: '00020126PIXQRCODE', ticket_url: 'https://mp/t' } } }), { status: 201 });
  if (url.includes('/checkout/preferences')) return new Response(JSON.stringify({ id: 'pref', init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref' }), { status: 201 });
  return new Response('{}', { status: 404 });
}
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const req = n => n.startsWith('https://') ? {} : n.startsWith('npm:@js-temporal') ? { Temporal } : n.startsWith('npm:') ? {} : load(path.resolve(path.dirname(file), n));
  vm.runInNewContext(out, { exports, require: req, crypto: require('node:crypto').webcrypto, Deno: { env: { get: () => undefined } }, TextEncoder, TextDecoder, Response, URL, AbortSignal, atob, setTimeout, console: { warn() {} }, fetch: fakeGateway });
  return exports;
}
const guided = load(path.join(sh, 'whatsapp/guided.ts'));
const domain = load(path.join(sh, 'whatsapp/chatbot-domain.ts'));

const SALON = '00000000-0000-4000-8000-000000000010', SVC = '00000000-0000-4000-8000-000000000030';
/** Banco simulado: 2 serviços, 2 profissionais, cobrança Mercado Pago conectada (Pix + cartão + no salão). */
function db(provider) {
  const calls = [], charges = [];
  const rows = {
    salons: { name: 'Studio X', timezone: 'America/Sao_Paulo', address: 'Rua A, 1', city: 'SP', pix_key: null, slug: 'studio-x', phone: null, working_hours: null, opening_time: '09:00:00', closing_time: '18:00:00' },
    whatsapp_automation_settings: { chatbot_booking_enabled: true, interactive_enabled: true, guided_flow_enabled: true, guided_render_mode: 'hybrid', guided_welcome_message: null, guided_confirmation_message: null, guided_info_text: null, guided_handoff_hours: 2 },
    services: [{ id: SVC, name: 'Corte Degradê', price: 45, duration_minutes: 40 }, { id: 'svc2', name: 'Barba', price: 30, duration_minutes: 20 }],
    professionals: [{ id: 'pro0', name: 'Ana', specialty: null }, { id: 'pro1', name: 'Bia', specialty: null }], professional_services: [],
    clients: null, whatsapp_chatbot_sessions: null,
    salon_payment_settings: { whatsapp_enabled: true, provider: 'mercadopago', methods: ['pix', 'card'], pay_at_salon: true, sandbox: false, infinitepay_handle: null, credential_ok_at: '2026-11-12' },
    appointments: { id: 'appt', client_name: 'João Silva', client_phone: '+5511912345678', final_price: 45, price: 45, status: 'pending', services: { name: 'Corte Degradê' }, salons: { slug: 'studio-x', name: 'Studio X' } },
  };
  const d = { calls, charges, from(table) {
    const q = { select() { return q; }, eq() { return q; }, in() { return q; }, is() { return q; }, order() { return q; }, gte() { return q; }, gt() { return q; }, not() { return q; },
      limit() { return Object.assign(Promise.resolve({ data: Array.isArray(rows[table]) ? rows[table] : [], error: null }), q); },
      maybeSingle: async () => table === 'payment_charges' ? { data: null, error: null } : ({ data: Array.isArray(rows[table]) ? rows[table][0] ?? null : rows[table], error: null }),
      single: async () => ({ data: rows[table], error: null }),
      upsert: async (row) => { if (table === 'whatsapp_chatbot_sessions') rows.whatsapp_chatbot_sessions = { current_step: row.current_step, session_data: row.session_data, client_name: row.client_name, human_takeover_until: row.human_takeover_until, last_interaction_at: row.last_interaction_at }; return { error: null }; },
      insert: async (row) => { if (table === 'payment_charges') charges.push(row); return { error: null }; },
      update() { return q; }, then(r) { return Promise.resolve({ data: Array.isArray(rows[table]) ? rows[table] : [], error: null }).then(r); } };
    return q;
  }, rpc: async (name, args) => {
    calls.push({ name, args });
    if (name === 'whatsapp_bot_provider') return { data: provider, error: null };
    if (name === 'get_available_time_slots') return { data: ['09:00', '14:00', '19:00'], error: null };
    if (name === 'whatsapp_book_appointment_v2') return { data: { id: 'appt', final_price: 45, status: 'pending' }, error: null };
    if (name === 'payment_secret') return { data: [{ secret: 'APP_USR-1234567890123456-abcdef', webhook_token: null }], error: null };
    return { data: null, error: null };
  } };
  return d;
}
const ctx = d => ({ db: d, salonId: SALON, phone: '+5511912345678', eventId: 'ev', preview: false, name: 'João Silva' });
const send = (d, text, selection = null) => guided.guidedReply(ctx(d), { text, selection });
const isText = r => r.messages.every(m => m.type === 'text');
/** Número da opção (1, 2, 3…) cujo rótulo casa com `re` no texto numerado. */
const optionNumber = (r, re) => { const line = r.text.split('\n').find(l => /^\d+\. /.test(l) && re.test(l)); assert.ok(line, `opção ${re} no texto:\n${r.text}`); return line.match(/^(\d+)\./)[1]; };

/** Modo de exibição efetivo para a conexão do robô e o modo salvo pelo dono. */
async function modeFor(provider, saved) {
  const settings = { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { guided_flow_enabled: true, guided_render_mode: saved }, error: null }) }) }) };
  const fake = { from: () => settings, rpc: async () => ({ data: provider, error: null }) };
  return (await domain.automationOf({ db: fake, salonId: SALON })).renderMode;
}

test('QR Code: o robô usa texto numerado (WhatsApp descarta botões/listas da Evolution); enquete se o dono escolheu', async () => {
  for (const saved of ['hybrid', 'native', 'buttons', 'numbered']) assert.equal(await modeFor('evolution', saved), 'numbered', saved);
  assert.equal(await modeFor('evolution', 'poll'), 'poll', 'enquete continua opção');
  assert.equal(await modeFor('meta', 'hybrid'), 'native', 'oficial mantém botões e lista');
  assert.equal(await modeFor('meta', 'buttons'), 'buttons');
});

test('QR Code × oficial: fluxo completo até o Pix copia e cola e o link do cartão, só digitando números no QR Code', async () => {
  for (const method of ['pix', 'card']) {
    gatewayCalls.length = 0;
    const d = db('evolution');
    let r = await send(d, 'oi');
    assert.ok(isText(r), 'menu em texto'); assert.match(r.text, /1\. 📅 Agendar horário/); assert.doesNotMatch(r.text, /Voltar/);
    r = await send(d, optionNumber(r, /Agendar/));                assert.equal(r.session.step, 'SELECT_SERVICE'); assert.ok(isText(r)); assert.match(r.text, /Menu inicial/);
    r = await send(d, optionNumber(r, /Corte Degradê/));          assert.equal(r.session.step, 'SELECT_PROFESSIONAL'); assert.match(r.text, /Voltar/);
    r = await send(d, optionNumber(r, /Ana/));                    assert.equal(r.session.step, 'SELECT_DATE');
    r = await send(d, optionNumber(r, /Amanhã/));                 assert.equal(r.session.step, 'SELECT_TIME');
    r = await send(d, optionNumber(r, /14:00/));                  assert.equal(r.session.step, 'CONFIRM_NAME');
    r = await send(d, optionNumber(r, /João Silva/));             assert.equal(r.session.step, 'CONFIRM_EMAIL'); assert.ok(isText(r));
    r = await send(d, 'joao@exemplo.com');                        assert.equal(r.session.step, 'CONFIRM_BOOKING'); assert.match(r.text, /Corte Degradê/); assert.match(r.text, /joao@exemplo\.com/);
    r = await send(d, optionNumber(r, /Confirmar/));
    assert.ok(d.calls.some(c => c.name === 'whatsapp_book_appointment_v2'), 'reservou');
    assert.equal(r.session.step, 'PAYMENT'); assert.ok(isText(r)); assert.match(r.text, /Pagamento — R\$ 45,00/);
    r = await send(d, optionNumber(r, method === 'pix' ? /Pix/ : /cartão/));
    assert.ok(isText(r), 'cobrança em texto');
    if (method === 'pix') { assert.match(r.text, /00020126PIXQRCODE/, 'copia e cola na conversa'); assert.ok(gatewayCalls.some(g => g.url.includes('/v1/payments') && g.body.transaction_amount === 45)); }
    else { assert.match(r.text, /https:\/\/www\.mercadopago\.com\.br\/checkout/, 'link do cartão na conversa'); assert.ok(gatewayCalls.some(g => g.url.includes('/checkout/preferences'))); }
    assert.match(r.text, /Já paguei/); assert.equal(d.charges[0].provider, 'mercadopago'); assert.equal(d.charges[0].amount_cents, 4500);
  }
  // Mesmo caminho na oficial chega à mesma cobrança, com botões/lista.
  gatewayCalls.length = 0;
  const m = db('meta');
  let r = await send(m, 'oi');
  assert.equal(r.messages[0].type, 'interactive');
  for (const sel of ['menu_book']) r = await send(m, '', sel);
  for (const t of ['1', '2', '2', '2']) r = await send(m, t);
  r = await send(m, '', 'use_pushname'); r = await send(m, '', 'email_skip'); r = await send(m, '', 'confirm_yes');
  assert.equal(r.session.step, 'PAYMENT'); r = await send(m, '', 'pay_pix');
  assert.match(r.text, /00020126PIXQRCODE/);
});

test('QR Code: navegação por número (Voltar e Menu inicial) e pagar no salão', async () => {
  const d = db('evolution');
  let r = await send(d, 'oi'); r = await send(d, '1'); r = await send(d, '1');
  assert.equal(r.session.step, 'SELECT_PROFESSIONAL');
  r = await send(d, optionNumber(r, /Voltar/)); assert.equal(r.session.step, 'SELECT_SERVICE');
  r = await send(d, optionNumber(r, /Menu inicial/)); assert.equal(r.session.step, 'MAIN_MENU');
  for (const t of ['1', '1', '1', '2', '2']) r = await send(d, t);
  r = await send(d, optionNumber(r, /João Silva/)); r = await send(d, optionNumber(r, /Não tenho e-mail/)); r = await send(d, optionNumber(r, /Confirmar/));
  r = await send(d, optionNumber(r, /no salão/));
  assert.equal(r.session.step, 'IDLE'); assert.match(r.text, /pagamento fica para o dia no salão/); assert.match(r.text, /Menu inicial/, 'texto final com saída numerada');
});
