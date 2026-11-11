const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..'), shared = path.join(root, 'supabase/functions/_shared');
const cache = new Map(), logs = [];
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: n => n.startsWith('https:') ? {} : n.startsWith('npm:@js-temporal') ? require('@js-temporal/polyfill') : n.startsWith('npm:') ? {} : load(path.resolve(path.dirname(file), n)), crypto: require('node:crypto').webcrypto, Deno: { env: { get: () => undefined } }, TextEncoder, TextDecoder, Response, Request, URL, AbortSignal, setTimeout, atob, console: { warn: (...v) => logs.push(v) }, fetch: () => { throw Error('rede proibida'); } });
  return exports;
}
const bot = load(path.join(shared, 'whatsapp/chatbot.ts')), ui = load(path.join(shared, 'whatsapp/interactive.ts')), inbound = load(path.join(shared, 'whatsapp/inbound.ts'));
const plain = v => JSON.parse(JSON.stringify(v));
const phone = '+5511912345678';
function mock({ legacy = false, error = null, auto = false } = {}) {
  const calls = [], review = ui.buildMenu('abcdef', 'review', 'Confirmar', 'Resumo', [{ title: 'Confirmar', value: { ok: true } }, { title: 'Mudar horário', value: { ok: 'time' } }, { title: 'Cancelar', value: { ok: false } }]);
  let state = { kind: legacy ? 'booking' : 'flow', step: 'review', serviceId: 's', professionalId: 'p', date: '2026-12-20', start: '11:15', name: 'Maria Souza', phone, requestKey: 'request-1234', menu: review.stored };
  const tables = { salons: { name: 'Studio Teste', timezone: 'America/Sao_Paulo', pix_key: null, auto_confirm_appointments: auto }, chatbot_settings: { enabled: true, active_days: [] }, whatsapp_automation_settings: { chatbot_booking_enabled: true, interactive_enabled: true }, services: [{ id: 's', name: 'Corte', price: 45, duration_minutes: 15 }], professionals: [{ id: 'p', name: 'Ana' }], professional_services: [] };
  const db = { calls, get state() { return state; }, from(table) {
    let write;
    const result = single => ({ data: table === 'whatsapp_conversation_state' ? { pending_action: state, pending_action_expires_at: new Date(Date.now() + 600000).toISOString() } : single && Array.isArray(tables[table]) ? tables[table][0] : tables[table] ?? null, count: 1, error: null });
    const q = { select: () => q, eq: () => q, in: () => q, gte: () => q, order: () => q, limit: () => q, update: v => { write = v; calls.push({ table, write }); return q; }, upsert: async v => { state = v.pending_action; return { error: null }; }, maybeSingle: async () => result(true), single: async () => result(true), then: (yes, no) => Promise.resolve(result(false)).then(yes, no) };
    return q;
  }, rpc: async (name, args) => { calls.push({ name, args });
    if (name === 'whatsapp_book_appointment_v2') return { data: error ? null : { id: 'appt', final_price: 45, status: auto ? 'confirmed' : 'pending' }, error };
    if (name === 'whatsapp_book_appointment') return { data: null, error: { code: '42883', message: 'function gen_random_bytes(integer) does not exist' } };
    if (name === 'get_available_time_slots') return { data: ['12:00', '12:15'], error: null };
    return { data: null, error: null };
  } };
  return { db, ctx: { db, salonId: 'salon', phone, eventId: 'event', preview: false } };
}
for (const legacy of [false, true]) for (const text of ['1', 'confirmar', 'CONFIRMAR', 'confirmo', 'sim']) test(`reserva ${legacy ? 'legada' : 'guiada'}: ${text} usa apenas v2`, async () => {
  const { db, ctx } = mock({ legacy });
  const r = await bot.chatbotReply(ctx, text);
  assert.equal(r.model, 'booking'); assert.equal(db.calls.filter(c => c.name === 'whatsapp_book_appointment_v2').length, 1);
  assert.equal(db.calls.filter(c => c.name === 'whatsapp_book_appointment').length, 0);
  assert.match(r.text, /aguarda a confirmação/); assert.doesNotMatch(r.text, /PIX/);
});
test('confirmação clicada não chama IA; modo automático usa status real', async () => {
  const { ctx } = mock({ auto: true }); const r = await bot.chatbotReply(ctx, '', { selection: 'abcdef.1' });
  assert.equal(r.model, 'booking'); assert.match(r.text, /está confirmado/); assert.doesNotMatch(r.text, /aguarda/);
});
for (const [message, step] of [['slot_unavailable', 'time'], ['invalid_coupon', 'coupon']]) test(`RPC ${message}: diagnóstico e recuperação`, async () => {
  const { db, ctx } = mock({ error: { code: 'P0001', message } }); const r = await bot.chatbotReply(ctx, 'confirmar');
  assert.equal(db.state.step, step); assert.ok(db.calls.some(c => c.table === 'whatsapp_webhook_events' && c.write.error_code));
  assert.ok(r.text.length); if (step === 'time') assert.match(r.text, /12:00/);
});
test('erro inesperado registra SQLSTATE, preserva requestKey para repetir sem duplicar', async () => {
  const { db, ctx } = mock({ error: { code: '42883', message: 'function gen_random_bytes(integer) does not exist' } });
  await bot.chatbotReply(ctx, 'confirmar'); assert.equal(db.state.requestKey, 'request-1234');
  assert.ok(db.calls.some(c => c.write?.error_code === 'booking_rpc_42883'));
});

// ------------------------------------------------------------------ A) entrega (Evolution 2.3.7 src/utils/renderStatus.ts)
test('MESSAGES_UPDATE: todos os formatos (texto, número, update.status, findMessages MessageUpdate)', () => {
  const id = '3EB0AABBCCDD';
  const cases = [
    [{ keyId: id, fromMe: true, status: 'DELIVERY_ACK' }, 'delivered'],
    [{ keyId: id, fromMe: true, status: 'READ' }, 'read'],
    [{ keyId: id, fromMe: true, status: 'PLAYED' }, 'read'],
    [{ keyId: id, fromMe: true, status: 'SERVER_ACK' }, 'sent'],
    [{ key: { id, fromMe: true }, update: { status: 3 } }, 'delivered'],
    [{ key: { id, fromMe: true }, update: { status: 4 } }, 'read'],
    [{ key: { id, fromMe: true }, MessageUpdate: [{ status: 'SERVER_ACK' }, { status: 'DELIVERY_ACK' }, { status: 'READ' }] }, 'read'],
  ];
  for (const [v, s] of cases) assert.deepEqual(plain(inbound.deliveryUpdates(v)), [{ id, status: s }], JSON.stringify(v));
  assert.deepEqual(plain(inbound.deliveryUpdates([{ keyId: id, fromMe: false, status: 'READ' }, { keyId: 'x y', status: 'READ' }, { keyId: id, status: 'ERROR' }])), [], 'recebida, id inválido e erro são ignorados');
});
test('status honesto: migração mapeia fila/aceito e não rebaixa; Central não chama aceito de entregue', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261109000300_whatsapp_premium.sql'), 'utf8');
  assert.match(sql, /WHEN 'pending' THEN 'queued' WHEN 'processing' THEN 'queued' WHEN 'accepted' THEN 'sent'/);
  assert.match(sql, /NOT \(status IN\('delivered','read'\) AND v_status IN\('queued','sent','failed','uncertain'\)\)/);
  assert.match(sql, /AFTER INSERT OR UPDATE OF status ON public\.whatsapp_outbox/);
  assert.match(sql, /AND status IN\('failed','uncertain'\) FOR UPDATE/, 'reenvio só de falhou/incerto');
  const page = fs.readFileSync(path.join(root, 'src/pages/admin/whatsapp/Inbox.tsx'), 'utf8');
  for (const label of ['Na fila', 'Enviada ao WhatsApp', 'Entregue', 'Lida', 'Falhou', 'Tentar de novo']) assert.ok(page.includes(label), label);
});

// ------------------------------------------------------------------ B) enquete premium
test('enquete premium: 2–10 opções (schema 2.3.7), opção ≤ 100, nome ≤ 255, rodapé do salão, "Ver mais horários"', () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ title: `${String(9 + (i % 10)).padStart(2, '0')}:${i % 2 ? '30' : '00'} ${'x'.repeat(i)}`, description: 'd'.repeat(120), value: { start: String(i) } }));
  const { menu } = ui.buildMenu('ab12cd', 'time', 'Horários', 'B'.repeat(900), many);
  const p = plain(ui.premiumPoll(menu, 'Studio Muito Bonito de Teste'));
  assert.equal(p.op, 'poll'); assert.equal(p.body.selectableCount, 1);
  assert.ok(p.body.values.length >= 2 && p.body.values.length <= 10);
  assert.ok(p.body.values.every(v => Array.from(v).length <= 100));
  assert.equal(new Set(p.body.values).size, p.body.values.length, 'únicas');
  assert.ok(Array.from(p.body.name).length <= 255); assert.match(p.body.name, /Studio Muito Bonito/);
  assert.match(p.body.values.at(-1), /Ver mais horários/);
  assert.equal(p.options.at(-1).id, 'ab12cd.more');
  assert.equal(ui.premiumPoll(ui.buildMenu('ab12cd', 's', 'S', 'x', [{ title: 'Só um', value: {} }]).menu, 'S'), null, '1 opção = texto');
});
test('voto da enquete: upsert descriptografado e update agregado viram o id do menu; grupo, voto múltiplo e opção desconhecida não', async () => {
  const { menu } = ui.buildMenu('ab12cd', 'service', 'Serviços', 'Qual?', [{ title: 'Corte', description: 'R$ 45,00 · 15 min', value: { id: 's1' } }, { title: 'Barba', value: { id: 's2' } }]);
  const payload = plain(ui.premiumPoll(menu, 'Studio'));
  const option = payload.body.values[1];
  const upsert = { key: { remoteJid: '5511912345678@s.whatsapp.net', fromMe: false, id: 'VOTE1' }, message: { pollUpdateMessage: { pollCreationMessageKey: { id: 'POLL1', fromMe: true }, vote: { selectedOptions: [option] } } }, messageTimestamp: 1762700000 };
  const [v] = plain(inbound.pollVotes(upsert));
  assert.deepEqual([v.pollId, v.phone, v.option], ['POLL1', '+5511912345678', option]);
  assert.equal(await inbound.pollSelection(payload, v.option), 'ab12cd.2');
  const update = { keyId: 'POLL1', remoteJid: '5511912345678@s.whatsapp.net', fromMe: true, pollUpdates: [{ name: payload.body.values[0], voters: ['5511912345678@s.whatsapp.net'] }, { name: option, voters: [] }] };
  assert.equal(await inbound.pollSelection(payload, inbound.pollVotes(update)[0].option), 'ab12cd.1');
  assert.deepEqual(plain(inbound.pollVotes({ ...upsert, key: { ...upsert.key, remoteJid: '120363000000000000@g.us' } })), [], 'grupo');
  assert.deepEqual(plain(inbound.pollVotes({ ...upsert, message: { pollUpdateMessage: { ...upsert.message.pollUpdateMessage, vote: { selectedOptions: [option, payload.body.values[0]] } } } })), [], 'voto múltiplo');
  assert.equal(await inbound.pollSelection(payload, 'opção inventada'), null);
  assert.equal(await inbound.pollSelection({ op: 'list' }, option), null);
  assert.equal(inbound.whatsappTimestamp(1762700000, 1762700005000), '2025-11-09T14:53:20.000Z');
  assert.equal(inbound.whatsappTimestamp({ low: 1762700000 }, 1762700005000), '2025-11-09T14:53:20.000Z');
  assert.equal(inbound.whatsappTimestamp(1762700010, 1762700005000), null, 'relógio no futuro não vira atraso negativo');
});
test('fallback de texto: "1", nome exato da opção e texto livre (volta para a IA)', () => {
  const { stored } = ui.buildMenu('ab12cd', 'service', 'S', 'x', [{ title: 'Corte Masculino', value: {} }, { title: 'Barba', value: {} }]);
  assert.equal(ui.resolveChoice(stored, '1'), 0);
  assert.equal(ui.resolveChoice(stored, 'corte masculino'), 0);
  assert.equal(ui.resolveChoice(stored, 'BARBA'), 1);
  assert.equal(ui.resolveChoice(stored, 'quero cortar o cabelo'), null);
});
test('Evolution 2.3.7: sendPoll e settings na lista branca; set_groups_ignore lê antes e preserva as demais opções', () => {
  const evo = fs.readFileSync(path.join(shared, 'whatsapp/evolution.ts'), 'utf8');
  assert.match(evo, /poll: \["POST", "\/message\/sendPoll\/"\]/);
  assert.match(evo, /settingsFind: \["GET", "\/settings\/find\/"\]/); assert.match(evo, /settingsSet: \["POST", "\/settings\/set\/"\]/);
  const fn = fs.readFileSync(path.join(root, 'supabase/functions/whatsapp-instances/index.ts'), 'utf8');
  for (const k of ['rejectCall', 'msgCall', 'alwaysOnline', 'readMessages', 'readStatus', 'syncFullHistory']) assert.ok(fn.includes(`${k}: keep("${k}"`), k);
  assert.ok(fn.indexOf('"settingsFind"') < fn.indexOf('"settingsSet"'), 'lê antes de gravar');
});

// ------------------------------------------------------------------ F) confirmação automática/manual
test('confirmação: trigger antes da validação, painel não é afetado, padrão manual e mensagem única coerente', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261109000300_whatsapp_premium.sql'), 'utf8');
  assert.ok('appointments_auto_confirm' < 'whatsapp_validate_appointment', 'BEFORE INSERT roda por ordem de nome');
  assert.match(sql, /CREATE TRIGGER appointments_auto_confirm BEFORE INSERT ON public\.appointments/);
  assert.match(sql, /NOT \(auth\.uid\(\) IS NOT NULL AND public\.whatsapp_can_manage_salon\(NEW\.salon_id\)\)/);
  assert.match(sql, /ALTER COLUMN auto_confirm_appointments SET DEFAULT false/);
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.trigger_appointment_confirmation\(\)/);
  assert.match(sql, /WHEN NEW\.status='pending' THEN 'Recebemos sua solicitação de agendamento\. Ela aguarda confirmação do salão\.'/);
  assert.match(sql, /ELSE 'Seu agendamento está confirmado ✅'/);
  assert.match(sql, /RETURNING id,status::text INTO v_id,v_status/);
  assert.match(sql, /search_path com extensions/, 'pente-fino de extensões');
  assert.doesNotMatch(sql, /^\s*(DROP TABLE|DROP COLUMN|DELETE FROM public\.appointments|TRUNCATE)/m);
  for (const m of sql.matchAll(/\{(\d+),(\d+)\}/g)) assert.ok(Number(m[2]) <= 255, m[0]);
});
