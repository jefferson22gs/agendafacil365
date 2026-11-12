// Status pelo QR Code (Evolution 2.3.7): vai só para os clientes do salão (whatsapp_status_audience), nunca `allContacts`
// (varre todos os contatos do celular e estoura o tempo), texto leva backgroundColor (400 sem ele) e usa timeout maior.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const sh = path.join(root, 'supabase/functions/_shared');

const evoCalls = [];
async function fakeEvolution(url, init) {
  evoCalls.push({ url, body: init.body ? JSON.parse(init.body) : null, timeout: init.signal?.__ms });
  if (url.includes('/instance/connectionState/')) return new Response(JSON.stringify({ instance: { state: 'open' } }), { status: 200 });
  if (url.includes('/message/sendStatus/')) return new Response(JSON.stringify({ key: { remoteJid: 'status@broadcast', fromMe: true, id: '3EB0STATUS' } }), { status: 201 });
  return new Response('{}', { status: 404 });
}
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const req = n => n.startsWith('https://') || n.startsWith('npm:') ? {} : load(path.resolve(path.dirname(file), n));
  const env = { EVOLUTION_API_KEY: 'k', EVOLUTION_API_URL: 'https://evo.example.com' };
  const Signal = { timeout: ms => ({ __ms: ms }) };
  vm.runInNewContext(out, { exports, require: req, crypto: require('node:crypto').webcrypto, Deno: { env: { get: k => env[k] } }, TextEncoder, TextDecoder, Response, URL, AbortSignal: Signal, console: { warn() {} }, fetch: fakeEvolution });
  return exports;
}
const outbox = load(path.join(sh, 'whatsapp/outbox.ts'));

function db(audience) {
  const finished = [];
  const item = { id: 'ob1', claim_token: 'c', salon_id: 's1', instance_id: 'i1', category: 'status', content_type: 'status_text', recipient_phone: '', text_content: 'Agenda aberta!', payload: null, media_path: null, appointment_id: null };
  const d = { finished, from(table) {
    const q = { select() { return q; }, eq() { return q; }, limit: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: table === 'whatsapp_instances' ? { instance_name: 'syshair_x', salon_id: 's1', provider: 'evolution', meta_phone_number_id: null } : null, error: null }) };
    return q;
  }, rpc: async (name, args) => {
    if (name === 'whatsapp_claim_outbox') return { data: [item], error: null };
    if (name === 'whatsapp_status_audience') { assert.equal(args.p_salon_id, 's1'); return { data: audience, error: null }; }
    if (name === 'whatsapp_begin_send') return { data: true, error: null };
    if (name === 'whatsapp_finish_outbox') { finished.push(args); return { data: true, error: null }; }
    return { data: null, error: null };
  } };
  return d;
}

test('Status de texto: lista explícita dos clientes, backgroundColor, timeout longo, id da Evolution gravado', async () => {
  evoCalls.length = 0;
  const d = db(['+5511961626897', '+5511989266129']);
  assert.equal(await outbox.processOutboxItem(d), true);
  const send = evoCalls.find(c => c.url.includes('/message/sendStatus/syshair_x'));
  assert.ok(send, 'chamou sendStatus');
  assert.deepEqual(send.body, { type: 'text', content: 'Agenda aberta!', statusJidList: ['5511961626897@s.whatsapp.net', '5511989266129@s.whatsapp.net'], backgroundColor: '#2563EB', font: 1 });
  assert.equal('allContacts' in send.body, false);
  assert.equal(send.timeout, 120_000);
  assert.deepEqual([d.finished[0].p_status, d.finished[0].p_message_id, d.finished[0].p_error_code ?? null], ['accepted', '3EB0STATUS', null]);
});

test('Status sem clientes elegíveis: cancela (no_audience) sem chamar a Evolution', async () => {
  evoCalls.length = 0;
  const d = db([]);
  await outbox.processOutboxItem(d);
  assert.ok(!evoCalls.some(c => c.url.includes('/message/sendStatus/')));
  assert.equal(d.finished[0].p_status, 'cancelled'); assert.equal(d.finished[0].p_error_code, 'no_audience');
});

test('migração do público do Status: só service_role, respeita opt-out e supressão, limite de 500', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261113000300_status_audience.sql'), 'utf8');
  assert.match(sql, /NOT c\.marketing_opt_out/); assert.match(sql, /whatsapp_marketing_suppression/); assert.match(sql, /LIMIT 500/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.whatsapp_status_audience\(uuid\) FROM public, anon, authenticated/);
});
