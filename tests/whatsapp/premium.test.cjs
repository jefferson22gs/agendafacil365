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
