// Pedido de avaliação "preso na fila": a fila geral espera o gate de 3 s em vez de parar (antes saía 1 por minuto),
// o pedido sai na hora do Concluído e a nota vai para o atendimento da mensagem clicada. Sem rede.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const { Temporal } = require('@js-temporal/polyfill');
const root = path.resolve(__dirname, '../..');
const sh = path.join(root, 'supabase/functions/_shared');
const waits = [];
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const req = n => n.startsWith('https://') ? {} : n.startsWith('npm:@js-temporal') ? { Temporal } : n.startsWith('npm:') ? {} : load(path.resolve(path.dirname(file), n));
  // setTimeout sem espera real: só registra quanto o dreno esperaria.
  vm.runInNewContext(out, { exports, require: req, crypto: require('node:crypto').webcrypto, Deno: { env: { get: () => undefined } }, TextEncoder, TextDecoder, Response, URL, AbortSignal, atob, Date, console: { warn() {} },
    setTimeout: (fn, ms) => { waits.push(ms); fn(); }, fetch: () => { throw new Error('rede proibida'); } });
  return exports;
}
const outbox = load(path.join(sh, 'whatsapp/outbox.ts'));
const guided = load(path.join(sh, 'whatsapp/guided.ts'));

/** Fila simulada: `queue` = respostas do claim (true = há item que é cancelado na hora; false = gate fechado). */
function queueDb(queue, waitMs) {
  const d = { claims: 0, finished: 0, rpc: async (name) => {
    if (name === 'whatsapp_claim_outbox') { d.claims++; return { data: queue.shift() ? [{ id: `o${d.claims}`, claim_token: 'c', salon_id: 's', instance_id: 'i', category: 'chatbot', content_type: 'text', recipient_phone: '120363000000@g.us', text_content: 'x' }] : [], error: null }; }
    if (name === 'whatsapp_finish_outbox') { d.finished++; return { data: true, error: null }; }
    if (name === 'whatsapp_outbox_wait_ms') return { data: waitMs(), error: null };
    return { data: null, error: null };
  } };
  return d;
}

test('fila: gate fechado com mensagem vencida espera e continua; antes parava na primeira (1 por minuto)', async () => {
  waits.length = 0;
  const d = queueDb([true, false, true, false, true, false], () => d.finished < 3 ? 2900 : null);
  assert.equal(await outbox.drainOutbox(d), 3);
  assert.deepEqual([...waits], [3000, 3000], 'espera o gate (3 s) entre as mensagens');
});

test('fila: nada vencido encerra na hora; espera maior que o orçamento não segura a função', async () => {
  waits.length = 0;
  assert.equal(await outbox.drainOutbox(queueDb([false], () => null)), 0);
  assert.equal(await outbox.drainOutbox(queueDb([false], () => 300_000)), 0, 'pausa de 5 min (limite do provedor): fica para o próximo cron');
  assert.equal(waits.length, 0);
  const many = queueDb(Array.from({ length: 40 }, () => true), () => null);
  assert.equal(await outbox.drainOutbox(many), 20, 'teto por execução');
});

test('avaliação: a mensagem clicada (id do WhatsApp) segue até a busca do pedido', async () => {
  const calls = [];
  const rows = { salons: { name: 'Studio X', timezone: 'America/Sao_Paulo', slug: 'studio-x' }, whatsapp_automation_settings: { chatbot_booking_enabled: true, guided_flow_enabled: true, guided_render_mode: 'native', guided_handoff_hours: 2 }, service_packages: [] };
  const db = { from(table) {
    const q = { select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return Object.assign(Promise.resolve({ data: [], error: null }), q); },
      maybeSingle: async () => ({ data: Array.isArray(rows[table]) ? null : rows[table] ?? null, error: null }), single: async () => ({ data: rows[table], error: null }), upsert: async () => ({ error: null }) };
    return q;
  }, rpc: async (name, args) => {
    calls.push({ name, args });
    if (name === 'whatsapp_bot_provider') return { data: 'meta', error: null };
    if (name === 'whatsapp_open_review_request') return { data: [{ appointment_id: 'apptA', sent_at: new Date().toISOString(), service: 'Barba' }], error: null };
    if (name === 'whatsapp_rate_appointment') return { data: { ok: true }, error: null };
    return { data: null, error: null };
  } };
  const r = await guided.guidedReply({ db, salonId: 's', phone: '+5511912345678', eventId: 'ev', preview: false }, { text: '⭐⭐⭐⭐⭐ Excelente', selection: 'rate.5', quoted: 'wamid.ABC' });
  assert.equal(calls.find(c => c.name === 'whatsapp_open_review_request').args.p_message_id, 'wamid.ABC');
  assert.deepEqual([calls.find(c => c.name === 'whatsapp_rate_appointment').args.p_appointment_id, calls.find(c => c.name === 'whatsapp_rate_appointment').args.p_rating], ['apptA', 5]);
  assert.equal(r.session.step, 'RATE_COMMENT');
});

test('migração e workers: pedido sai na hora, mensagem clicada tem prioridade, os dois workers usam o dreno', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261113000600_review_request_queue.sql'), 'utf8');
  assert.match(sql, /replace\(def, 'now\(\) \+ interval ''15 minutes''\)', 'now\(\)\)'\)/);
  assert.match(sql, /ORDER BY \(p_message_id IS NOT NULL AND o\.remote_message_id = p_message_id\) DESC/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.whatsapp_outbox_wait_ms\(\) FROM PUBLIC, anon, authenticated/);
  for (const f of ['whatsapp-dispatch', 'process-notifications']) {
    const src = fs.readFileSync(path.join(root, `supabase/functions/${f}/index.ts`), 'utf8');
    assert.match(src, /drainOutbox\(db\)/, f); assert.doesNotMatch(src, /processOutboxItem/, f);
  }
});
