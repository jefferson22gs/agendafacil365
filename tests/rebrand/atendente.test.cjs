// Atendente WhatsApp: menus, fallback numerado, ids de seleção, cadastro, lembretes, fluxo e escopo. Sem rede.
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
  vm.runInNewContext(out, { exports, require: req, crypto: require('node:crypto').webcrypto, Deno: { env: { get: () => undefined } }, TextEncoder, TextDecoder, Response, URL, atob, console: { warn() {} }, fetch: () => { throw new Error('rede proibida'); } });
  return exports;
}
const ui = load(path.join(sh, 'whatsapp/interactive.ts'));
const inbound = load(path.join(sh, 'whatsapp/inbound.ts'));
const att = load(path.join(sh, 'whatsapp/attendant.ts'));
const domain = load(path.join(sh, 'whatsapp/chatbot-domain.ts'));
const plain = v => JSON.parse(JSON.stringify(v));
const opts = n => Array.from({ length: n }, (_, i) => ({ title: `Serviço número ${i + 1} com nome bem comprido`, description: 'x'.repeat(100), value: { id: `s${i}` } }));

test('lista respeita limites 10/24/72 e pagina com "Ver mais"', () => {
  const { menu, stored } = ui.buildMenu('ab12cd', 'service', 'Serviços', 'Qual serviço?', opts(25));
  assert.equal(menu.kind, 'list');
  assert.ok(menu.rows.length <= ui.LIST_ROWS);
  assert.ok(menu.rows.every(r => Array.from(r.title).length <= 24 && (!r.description || Array.from(r.description).length <= 72)));
  assert.equal(menu.rows.at(-1).id, 'ab12cd.more');
  assert.equal(stored.hasMore, true);
  const p2 = ui.buildMenu('ab12cd', 'service', 'Serviços', 'x', opts(25), 2);
  assert.equal(p2.stored.hasMore, false, 'última página sem "ver mais"');
  assert.equal(p2.stored.options[0].id, 's18');
  const body = ui.evolutionBody(menu, '5511999999999').body;
  assert.equal(body.sections[0].rows.length, menu.rows.length);
  assert.ok(body.buttonText && body.sections[0].rows.every(r => r.rowId && r.title && r.description), 'campos obrigatórios do SendListDto');
});

test('até 3 opções curtas viram botões; fallback numerado sempre presente', () => {
  const { menu } = ui.buildMenu('zz99zz', 'payment', 'Pagamento', 'Como prefere pagar?', [{ title: 'Pagar agora (PIX)', value: {} }, { title: 'Pagar no salão', value: {} }]);
  assert.equal(menu.kind, 'buttons');
  const b = ui.evolutionBody(menu, '55').body;
  assert.deepEqual(b.buttons.map(x => x.type), ['reply', 'reply']);
  assert.ok(b.buttons.every(x => x.id.startsWith('zz99zz.')));
  const txt = ui.numberedText(menu);
  assert.match(txt, /1\. Pagar agora/); assert.match(txt, /Responda com o número \(1 a 2\)/);
  const msg = att.menuMessage(menu, false);
  assert.equal(msg.type, 'text', 'interativo desligado = só texto');
  const im = att.menuMessage(menu, true);
  assert.equal(im.type, 'interactive'); assert.equal(im.payload.op, 'buttons'); assert.ok(!('number' in im.payload.body), 'número nunca vai no payload');
  assert.equal(im.text, txt, 'fallback do outbox = texto numerado');
});

test('escolha: id clicado, número digitado, "ver mais"; id de menu antigo é ignorado', () => {
  const { stored } = ui.buildMenu('ab12cd', 'service', 'S', 'x', opts(12));
  assert.equal(ui.resolveChoice(stored, '', 'ab12cd.3'), 2);
  assert.equal(ui.resolveChoice(stored, '', 'zzzzzz.3'), null, 'nonce diferente');
  assert.equal(ui.resolveChoice(stored, '', 'ab12cd.42'), null);
  assert.equal(ui.resolveChoice(stored, '2'), 1);
  assert.equal(ui.resolveChoice(stored, 'opção 4'), 3);
  assert.equal(ui.resolveChoice(stored, '5️⃣'), 4);
  assert.equal(ui.resolveChoice(stored, '10'), 'more', 'última linha numerada = ver mais');
  assert.equal(ui.resolveChoice(stored, 'ver mais'), 'more');
  assert.equal(ui.resolveChoice(stored, '0'), null);
  assert.equal(ui.resolveChoice(stored, 'quero o corte'), null, 'texto livre volta para a IA');
  assert.equal(ui.resolveChoice(null, '1'), null);
});

test('webhook: seleção de lista/botão/template/nativeFlow vira selection; comprovante vira media', () => {
  const key = { fromMe: false, remoteJid: '5511912345678@s.whatsapp.net', id: 'ABC123' };
  const list = inbound.parseIncoming({ key, message: { listResponseMessage: { title: '14:00', singleSelectReply: { selectedRowId: 'ab12cd.2' } } } });
  assert.equal(list.selection, 'ab12cd.2'); assert.equal(list.text, '14:00');
  assert.equal(inbound.parseIncoming({ key, message: { buttonsResponseMessage: { selectedButtonId: 'rate.5', selectedDisplayText: 'Excelente' } } }).selection, 'rate.5');
  assert.equal(inbound.parseIncoming({ key, message: { templateButtonReplyMessage: { selectedId: 'ab12cd.1' } } }).selection, 'ab12cd.1');
  assert.equal(inbound.parseIncoming({ key, message: { interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: '{"id":"ab12cd.3"}' }, body: { text: 'x' } } } }).selection, 'ab12cd.3');
  assert.equal(inbound.parseIncoming({ key, message: { listResponseMessage: { singleSelectReply: { selectedRowId: "'; drop table" } } } }), null, 'id fora do formato é descartado');
  const img = inbound.parseIncoming({ key, message: { imageMessage: { mimetype: 'image/jpeg', url: 'https://mmg.whatsapp.net/x.enc' } } });
  assert.equal(img.media.type, 'image'); assert.equal(img.media.url, null, 'URL criptografada do WhatsApp não serve');
  const pdf = inbound.parseIncoming({ key, message: { documentMessage: { mimetype: 'application/pdf', fileName: 'comprovante.pdf', url: 'https://s3.example.com/a.pdf' } } });
  assert.equal(pdf.media.type, 'document'); assert.equal(pdf.media.url, 'https://s3.example.com/a.pdf');
  assert.equal(inbound.parseIncoming({ key, message: { conversation: 'oi' } }).text, 'oi', 'texto continua igual');
});

test('nome completo exige nome e sobrenome', () => {
  assert.equal(ui.fullName('maria da silva'), 'Maria da Silva');
  assert.equal(ui.fullName('Meu nome é joão pedro'), 'João Pedro');
  assert.equal(ui.fullName('Maria'), null);
  assert.equal(ui.fullName('M S'), null);
  assert.equal(ui.fullName('Maria 123'), null);
  assert.equal(ui.fullName('x'.repeat(200) + ' y'), null);
});

test('data de nascimento: formatos, recusa e validação', () => {
  const t = '2026-11-06';
  assert.deepEqual(plain(ui.parseBirthDate('25/03/1990', t)), { ok: true, date: '1990-03-25', partial: false });
  assert.deepEqual(plain(ui.parseBirthDate('25-03-90', t)), { ok: true, date: '1990-03-25', partial: false });
  assert.deepEqual(plain(ui.parseBirthDate('05/01/10', t)), { ok: true, date: '2010-01-05', partial: false });
  assert.deepEqual(plain(ui.parseBirthDate('12 de março de 1985', t)), { ok: true, date: '1985-03-12', partial: false });
  assert.deepEqual(plain(ui.parseBirthDate('12 de marco', t)), { ok: true, date: '1904-03-12', partial: true });
  assert.deepEqual(plain(ui.parseBirthDate('29/02', t)), { ok: true, date: '1904-02-29', partial: true }, 'sem ano aceita 29/02');
  assert.equal(ui.parseBirthDate('31/02/1990', t).ok, false);
  assert.equal(ui.parseBirthDate('01/01/2030', t).ok, false, 'futuro');
  assert.equal(ui.parseBirthDate('01/01/1890', t).ok, false, 'idade > 120');
  assert.deepEqual(plain(ui.parseBirthDate('prefiro não informar', t)), { ok: false, refused: true });
  assert.deepEqual(plain(ui.parseBirthDate('pular', t)), { ok: false, refused: true });
  assert.deepEqual(plain(ui.parseBirthDate('banana', t)), { ok: false, refused: false });
});

test('telefone do cadastro normalizado (+55 só com DDD)', () => {
  assert.equal(ui.brazilPhone('(11) 91234-5678'), '+5511912345678');
  assert.equal(ui.brazilPhone('11 3456-7890'), '+551134567890');
  assert.equal(ui.brazilPhone('+351 912 345 678'), '+351912345678');
  assert.equal(ui.brazilPhone('5511912345678'), '+5511912345678');
  assert.equal(ui.brazilPhone('91234-5678'), null, 'sem DDD não adivinha');
  assert.equal(ui.brazilPhone('11 81234-5678'), null, 'celular sem 9');
  assert.equal(ui.yesNo('sim'), true); assert.equal(ui.yesNo('Não'), false); assert.equal(ui.yesNo('talvez'), null);
});

test('cupom: mesmo cálculo do link público', () => {
  assert.equal(ui.couponDiscount({ type: 'percentage', value: 10 }, 80), 8);
  assert.equal(ui.couponDiscount({ type: 'fixed', value: 100 }, 80), 80);
  assert.equal(ui.couponDiscount({ type: 'fixed', value: 10, min_purchase: 100 }, 80), 0);
  assert.equal(att.couponMessage('expired'), 'Esse cupom expirou.');
});

test('lembretes 30 e 15 minutos no fuso do salão: só futuros, sem repetir', () => {
  const appt = Temporal.PlainDateTime.from('2026-11-07T10:00').toZonedDateTime('America/Sao_Paulo').epochMilliseconds;
  const now = Temporal.PlainDateTime.from('2026-11-07T09:40').toZonedDateTime('America/Sao_Paulo').epochMilliseconds;
  const r = ui.reminderInstants(appt, [1440, 120, 30, 15, 15, 45], now);
  assert.deepEqual(plain(r.map(x => x.minutes)), [15], '30 já passou (09:30), 45 não é permitido, 15 sem duplicar');
  assert.equal(new Date(r[0].at).toISOString(), '2026-11-07T12:45:00.000Z', '09:45 em São Paulo = 12:45 UTC');
  const manaus = Temporal.PlainDateTime.from('2026-11-07T10:00').toZonedDateTime('America/Manaus').epochMilliseconds;
  assert.equal(new Date(ui.reminderInstants(manaus, [30], 0)[0].at).toISOString(), '2026-11-07T13:30:00.000Z', 'Manaus UTC-4');
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261106004001_whatsapp_automations.sql'), 'utf8');
  assert.match(sql, /ARRAY\[1440,\s*120,\s*30,\s*15\]/);
  assert.match(sql, /cron\.schedule/); assert.match(sql, /cron\.unschedule/);
});

// Banco simulado mínimo do fluxo.
const SALON = '00000000-0000-4000-8000-000000000010', SVC = '00000000-0000-4000-8000-000000000030', PRO = '00000000-0000-4000-8000-000000000020';
function flowDb({ client = null, booking = true } = {}) {
  const calls = [];
  const rows = {
    salons: { name: 'Studio X', timezone: 'America/Sao_Paulo', address: 'Rua A, 1', city: 'SP', pix_key: null },
    whatsapp_automation_settings: { chatbot_booking_enabled: booking, interactive_enabled: true },
    services: [{ id: SVC, name: 'Corte', price: 50, duration_minutes: 30 }],
    professionals: [{ id: PRO, name: 'Ana', specialty: null }], professional_services: [],
    clients: client,
  };
  return { calls, from(table) {
    const filters = []; calls.push({ table, filters });
    const q = { select() { return q; }, eq(k, v) { filters.push([k, v]); return q; }, in() { return q; }, order() { return q; }, gte() { return q; },
      limit() { return Object.assign(Promise.resolve({ data: Array.isArray(rows[table]) ? rows[table] : [], error: null }), q); },
      maybeSingle: async () => ({ data: Array.isArray(rows[table]) ? rows[table][0] ?? null : rows[table], error: null }),
      single: async () => ({ data: rows[table], error: null }),
      then(res) { return Promise.resolve({ data: Array.isArray(rows[table]) ? rows[table] : [], error: null }).then(res); } };
    return q;
  }, rpc: async (name, args) => { calls.push({ name, args }); if (name === 'get_available_time_slots') return { data: ['09:00', '14:00'], error: null }; if (name === 'whatsapp_book_appointment_v2') return { data: { id: 'appt', final_price: 50 }, error: null }; return { data: null, error: null }; } };
}
const ctx = (db, o = {}) => ({ db, salonId: SALON, phone: '+5511912345678', eventId: 'ev', preview: false, ...o });
const pick = async (c, f, n) => att.continueFlow(c, f, { text: String(n) }, false);

test('fluxo: não confirma sem nome completo e telefone; não pede de novo dado existente', async () => {
  const db = flowDb();
  let r = await att.startFlow(ctx(db), false);
  assert.equal(r.state.step, 'service'); assert.match(r.messages[0].text, /1\. Corte/);
  r = await pick(ctx(db), r.state, 1); assert.equal(r.state.step, 'professional');
  r = await pick(ctx(db), r.state, 1); assert.equal(r.state.professionalId, null, '"qualquer profissional"');
  r = await pick(ctx(db), r.state, 1); assert.equal(r.state.step, 'time');
  r = await pick(ctx(db), r.state, 2); assert.equal(r.state.start, '14:00'); assert.equal(r.state.step, 'name');
  const half = await att.continueFlow(ctx(db), r.state, { text: 'Maria' }, false);
  assert.equal(half.state.step, 'name', 'só primeiro nome não avança');
  r = await att.continueFlow(ctx(db), r.state, { text: 'maria souza' }, false); assert.equal(r.state.name, 'Maria Souza'); assert.equal(r.state.step, 'phone_confirm');
  r = await att.continueFlow(ctx(db), r.state, { text: '2' }, false); assert.equal(r.state.step, 'phone');
  r = await att.continueFlow(ctx(db), r.state, { text: '11 3456-7890' }, false); assert.equal(r.state.phone, '+551134567890'); assert.equal(r.state.step, 'birth');
  r = await att.continueFlow(ctx(db), r.state, { text: 'pular' }, false); assert.equal(r.state.birth, null); assert.equal(r.state.step, 'coupon');
  r = await pick(ctx(db), r.state, 1); assert.equal(r.state.step, 'review'); assert.match(r.messages[0].text, /CONFIRMAR/);
  assert.ok(!db.calls.some(c => c.name === 'whatsapp_book_appointment_v2'), 'nada reservado antes da confirmação');
  // Estado adulterado sem nome: book volta a pedir, nunca chama a RPC.
  const bad = await att.continueFlow(ctx(db), { ...r.state, name: undefined }, { text: 'CONFIRMAR' }, false);
  assert.equal(bad.state.step, 'name'); assert.ok(!db.calls.some(c => c.name === 'whatsapp_book_appointment_v2'));
  r = await att.continueFlow(ctx(db), r.state, { text: 'CONFIRMAR' }, false);
  const call = db.calls.find(c => c.name === 'whatsapp_book_appointment_v2');
  assert.equal(call.args.p_client_name, 'Maria Souza'); assert.equal(call.args.p_client_phone, '+551134567890'); assert.equal(call.args.p_professional_id, null);
  assert.equal(call.args.p_event_id, 'ev'); assert.ok(!('p_salon_id' in call.args), 'salão vem do evento, não do fluxo');
  assert.equal(r.state, null, 'sem PIX cadastrado o fluxo termina'); assert.doesNotMatch(r.messages.map(m => m.text).join(' '), /PIX/);
  assert.match(r.messages[0].text, /aguarda a confirmação/);
});

test('cliente conhecido: cumprimenta pelo nome e pula nome/telefone/nascimento', async () => {
  const db = flowDb({ client: { name: 'joana prado', birth_date: '1990-01-02' } });
  let r = await att.startFlow(ctx(db), false);
  assert.match(r.messages[0].text, /Oi, Joana/);
  for (const n of [1, 1, 1, 1]) r = await pick(ctx(db), r.state, n);
  assert.equal(r.state.step, 'coupon', 'nome, telefone e nascimento já existem');
  assert.equal(r.state.phone, '+5511912345678');
});

test('agendamento desligado pelo salão não cria nada', async () => {
  const db = flowDb({ booking: false });
  const f = { kind: 'flow', step: 'review', serviceId: SVC, professionalId: PRO, date: '2026-11-10', start: '09:00', name: 'Ana Lima', phone: '+5511912345678', menu: null };
  const r = await att.continueFlow(ctx(db), f, { text: 'CONFIRMAR' }, false);
  assert.equal(r.model, 'booking_disabled'); assert.ok(!db.calls.some(c => c.name === 'whatsapp_book_appointment_v2'));
});

test('ferramentas novas: argumentos extras e ids inválidos são recusados sem tocar o banco', async () => {
  const db = flowDb(), c = ctx(db, { preview: true });
  await assert.rejects(() => domain.executeBotTool(c, 'start_booking', { serviceId: SVC, salon_id: 'x' }));
  await assert.rejects(() => domain.executeBotTool(c, 'check_coupon', { code: 'A', serviceId: SVC, phone: '+1' }));
  await assert.rejects(() => domain.executeBotTool(c, 'available_dates', { serviceId: 'nao-uuid' }));
  await assert.rejects(() => domain.executeBotTool(c, 'start_booking', { serviceId: '1; drop' }));
  assert.equal(db.calls.length, 0);
  assert.deepEqual(plain(await domain.executeBotTool(c, "start_booking", {})), { started: true, serviceId: null, instructions: 'O menu de agendamento será enviado. Responda só uma frase curta, sem listar opções.' });
  assert.ok(domain.tools.some(t => t.function.name === 'start_booking'));
});

test('migração do atendente: aditiva, idempotente, sem regex com repetição > 255', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261106004000_whatsapp_attendant.sql'), 'utf8');
  assert.match(sql, /^BEGIN;/m); assert.match(sql, /^COMMIT;/m);
  assert.doesNotMatch(sql, /^\s*(DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE)/m);
  for (const m of sql.matchAll(/\{(\d+),(\d+)\}/g)) assert.ok(Number(m[2]) <= 255, m[0]);
  assert.match(sql, /review:'\|\|NEW\.id/, 'um pedido de avaliação por agendamento');
  assert.match(sql, /whatsapp_review_requests\(appointment_id,salon_id,phone\)[^;]*ON CONFLICT DO NOTHING/);
});
