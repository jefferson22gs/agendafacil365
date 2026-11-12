// Pacotes e e-mail no bot do WhatsApp (QR Code, texto numerado): menu "🎁 Pacotes", "quer agendar hoje?",
// só assinar → Pix da chave do salão, agendar hoje → pedido ligado ao horário, assinante usa crédito sozinho,
// e-mail já cadastrado não é perguntado de novo. Sem rede.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const { Temporal } = require('@js-temporal/polyfill');
const root = path.resolve(__dirname, '../..');
const sh = path.join(root, 'supabase/functions/_shared');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const req = n => n.startsWith('https://') ? {} : n.startsWith('npm:@js-temporal') ? { Temporal } : n.startsWith('npm:') ? {} : load(path.resolve(path.dirname(file), n));
  vm.runInNewContext(out, { exports, require: req, crypto: require('node:crypto').webcrypto, Deno: { env: { get: () => undefined } }, TextEncoder, TextDecoder, Response, URL, AbortSignal, atob, setTimeout, console: { warn() {} }, fetch: () => { throw new Error('rede proibida'); } });
  return exports;
}
const guided = load(path.join(sh, 'whatsapp/guided.ts'));
const mail = load(path.join(root, 'supabase/functions/client-emails/core.ts'));
const core = load(path.join(root, 'supabase/functions/process-return-alerts/core.ts'));

const SALON = '00000000-0000-4000-8000-000000000010', SVC = '00000000-0000-4000-8000-000000000030', PKG = '00000000-0000-4000-8000-000000000040';
function db({ credits = [], client = { name: 'João Silva', email: 'joao@exemplo.com' }, book = { id: 'appt', final_price: 45, status: 'pending' } } = {}) {
  const calls = [], orders = [];
  const salon = { name: 'Studio X', timezone: 'America/Sao_Paulo', address: 'Rua A, 1', city: 'SP', pix_key: '12345678901', slug: 'studio-x', phone: null, working_hours: null, opening_time: '09:00:00', closing_time: '18:00:00', is_active: true };
  const rows = {
    salons: salon,
    whatsapp_automation_settings: { chatbot_booking_enabled: true, interactive_enabled: true, guided_flow_enabled: true, guided_render_mode: 'native', guided_welcome_message: null, guided_confirmation_message: null, guided_info_text: null, guided_handoff_hours: 2 },
    services: [{ id: SVC, name: 'Corte Degradê', price: 45, duration_minutes: 40 }, { id: 'svc2', name: 'Barba', price: 30, duration_minutes: 20 }],
    professionals: [{ id: 'pro0', name: 'Ana', specialty: null }], professional_services: [],
    service_packages: [{ id: PKG, salon_id: SALON, name: 'Clube do Corte', price: 150, validity_days: 90, is_active: true, salons: salon, service_package_items: [{ service_id: SVC, quantity: 4, services: { name: 'Corte Degradê' } }] }],
    clients: client, whatsapp_chatbot_sessions: null, salon_payment_settings: null, appointments: [],
  };
  const d = { calls, orders, orderStatus: 'pending', from(table) {
    const list = () => Array.isArray(rows[table]) ? rows[table] : [];
    const q = { select() { return q; }, eq() { return q; }, in() { return q; }, is() { return q; }, order() { return q; }, gte() { return q; }, gt() { return q; }, not() { return q; }, update() { return q; },
      limit() { return Object.assign(Promise.resolve({ data: list(), error: null }), q); },
      maybeSingle: async () => table === 'package_orders' ? { data: { status: d.orderStatus }, error: null } : ({ data: Array.isArray(rows[table]) ? rows[table][0] ?? null : rows[table], error: null }),
      single: async () => table === 'package_orders' ? { data: { id: 'aaaaaaaa-0000-4000-8000-000000000001' }, error: null } : ({ data: rows[table], error: null }),
      upsert: async (row) => { if (table === 'whatsapp_chatbot_sessions') rows.whatsapp_chatbot_sessions = { current_step: row.current_step, session_data: row.session_data, client_name: row.client_name, human_takeover_until: row.human_takeover_until, last_interaction_at: row.last_interaction_at }; return { error: null }; },
      insert(row) { if (table === 'package_orders') orders.push(row); return Object.assign(Promise.resolve({ error: null }), q); },
      then(r) { return Promise.resolve({ data: list(), count: 0, error: null }).then(r); } };
    return q;
  }, rpc: async (name, args) => {
    calls.push({ name, args });
    if (name === 'whatsapp_bot_provider') return { data: 'evolution', error: null };
    if (name === 'public_client_credits') return { data: credits, error: null };
    if (name === 'get_available_time_slots') return { data: ['09:00', '14:00'], error: null };
    if (name === 'whatsapp_book_appointment_v2') return { data: book, error: null };
    return { data: null, error: null };
  } };
  return d;
}
const send = (d, text) => guided.guidedReply({ db: d, salonId: SALON, phone: '+5511912345678', eventId: 'ev', preview: false, name: 'João Silva' }, { text, selection: null });
const pick = (r, re) => { const line = r.text.split('\n').find(l => /^\d+\. /.test(l) && re.test(l)); assert.ok(line, `opção ${re} em:\n${r.text}`); return line.match(/^(\d+)\./)[1]; };

test('só assinar: menu Pacotes → pacote → "quer agendar hoje?" não → Pix copia e cola da chave do salão → Já paguei', async () => {
  const d = db();
  let r = await send(d, 'oi');
  assert.match(r.text, /6\. 🎁 Pacotes/, 'entra no fim: 1–5 continuam iguais');
  r = await send(d, pick(r, /Pacotes/)); assert.equal(r.session.step, 'PACKAGES'); assert.match(r.text, /Clube do Corte/); assert.match(r.text, /R\$ 150,00 · 4x Corte Degradê · 90 dias/);
  r = await send(d, pick(r, /Clube do Corte/)); assert.equal(r.session.step, 'PACKAGE_BUY'); assert.match(r.text, /Quer agendar um horário hoje\?/);
  r = await send(d, pick(r, /Só assinar/));
  assert.deepEqual([d.orders[0].client_phone, d.orders[0].amount_cents, d.orders[0].method, d.orders[0].package_id, d.orders[0].client_name], ['+5511912345678', 15000, 'pix_manual', PKG, 'João Silva']);
  assert.equal('appointment_id' in d.orders[0], false);
  assert.ok(r.messages.some(m => /^000201/.test(m.text) && m.text.includes('12345678901')), 'copia e cola com a chave do salão');
  assert.match(r.text, /o salão confere e libera seus créditos/); assert.match(r.text, /Já paguei/);
  r = await send(d, pick(r, /Já paguei/)); assert.equal(r.session.step, 'PACKAGE_BUY'); assert.match(r.text, /Ainda não apareceu/);
  d.orderStatus = 'paid';
  r = await send(d, pick(r, /Já paguei/)); assert.match(r.text, /Pacote Clube do Corte liberado/); assert.match(r.text, /Agendar horário/);
});

test('agendar hoje: só os serviços do pacote, reserva o horário e o pedido leva o agendamento (crédito entra ao pagar)', async () => {
  const d = db();
  let r = await send(d, 'pacotes'); assert.equal(r.session.step, 'PACKAGES', 'comando rápido');
  r = await send(d, pick(r, /Clube do Corte/));
  r = await send(d, pick(r, /Sim, agendar/)); assert.equal(r.session.step, 'SELECT_SERVICE'); assert.match(r.text, /Corte Degradê/); assert.doesNotMatch(r.text, /Barba/);
  r = await send(d, pick(r, /Corte Degradê/)); r = await send(d, pick(r, /Amanhã/)); r = await send(d, pick(r, /14:00/));
  assert.equal(r.session.step, 'CONFIRM_BOOKING', 'nome e e-mail já cadastrados: não pergunta de novo'); assert.match(r.text, /joao@exemplo\.com/);
  r = await send(d, pick(r, /Confirmar/));
  const call = d.calls.find(c => c.name === 'whatsapp_book_appointment_v2');
  assert.equal(call.args.p_email, 'joao@exemplo.com');
  assert.equal(d.orders[0].appointment_id, 'appt'); assert.equal(r.session.step, 'PACKAGE_BUY');
  assert.match(r.text, /Solicitação registrada/); assert.match(r.text, /Seu horário de hoje já usa 1 crédito do pacote/);
});

test('assinante: serviço do pacote aparece como incluso e a reserva usa o crédito, sem cobrança', async () => {
  const d = db({ credits: [{ credit_id: 'c1', service_id: SVC, service: 'Corte Degradê', package: 'Clube do Corte', remaining: 3 }], book: { id: 'appt', final_price: 0, status: 'confirmed', credit: true, credit_left: 2 } });
  let r = await send(d, 'oi'); r = await send(d, '1');
  assert.match(r.text, /Você é assinante/); assert.match(r.text, /Corte Degradê — 🎁 No seu pacote \(3 créditos\)/); assert.match(r.text, /Barba — R\$ 30,00/);
  r = await send(d, pick(r, /Corte Degradê/)); r = await send(d, pick(r, /Amanhã/)); r = await send(d, pick(r, /14:00/)); r = await send(d, pick(r, /Confirmar/));
  assert.match(r.text, /Pacote:\* 1 crédito usado \(restam 2\)/); assert.match(r.text, /Enviamos a confirmação para joao@exemplo\.com/);
  assert.equal(r.session.step, 'IDLE'); assert.equal(d.orders.length, 0);
  r = await send(d, 'pacotes'); assert.match(r.text, /Seus créditos:\*\n• Corte Degradê: 3/);
});

test('e-mail: validação, texto do e-mail de confirmação e marca do salão no remetente', () => {
  assert.equal(guided.validEmail(' Ana.Souza@Gmail.COM '), 'ana.souza@gmail.com');
  for (const bad of ['ana', 'ana@', 'ana@gmail', 'a b@x.com', '<a>@x.com', '']) assert.equal(guided.validEmail(bad), null, bad);
  const m = mail.confirmedMessage({ client_name: 'Ana Souza', service: 'Corte', professional: 'Bia', date: '2026-11-16', start: '14:00', final_price: 45, salon: { name: 'Studio X', address: 'Rua A, 1', city: 'SP' } });
  assert.equal(m.subject, 'Studio X: agendamento confirmado para 16/11/2026 às 14:00');
  assert.match(m.message, /Olá, Ana! Seu agendamento está confirmado/); assert.match(m.message, /Data: segunda-feira, 16\/11\/2026 às 14:00/); assert.match(m.message, /Valor: R\$ 45,00/);
  assert.match(mail.confirmedMessage({ date: '2026-11-16', start: '14:00', credit: true, salon: { name: 'S' } }).message, /Incluso no seu pacote/);
  const p = core.emailPayload({ from: core.salonSender('Studio X', 'studio-x', 'AF <lembretes@agendafacil365.com.br>'), to: 'ana@x.com', salon: 'Studio X', logo: 'https://cdn.x.com/l.png', message: m.message, url: 'https://agendafacil365.com.br/s/studio-x/meus-agendamentos', procedure: 'Corte', subject: m.subject, cta: 'Ver meus agendamentos', footer: 'Rodapé' });
  assert.equal(p.from, '"Studio X" <studio-x@agendafacil365.com.br>'); assert.equal(p.subject, m.subject);
  assert.match(p.html, /Ver meus agendamentos<\/a>/); assert.match(p.html, /Logo de Studio X/); assert.doesNotMatch(p.html, /Agendar meu retorno/);
});

test('migração: e-mail só quando confirmado, uma vez por agendamento; funções de fila só para o servidor', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261113000400_bot_packages_client_email.sql'), 'utf8');
  assert.match(sql, /NEW\.status::text <> 'confirmed'/); assert.match(sql, /UNIQUE \(appointment_id, kind\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.client_email_claim\(\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.whatsapp_book_appointment_v2\([^)]*\) FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /^\s*(DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE)/m);
});
