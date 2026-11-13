// Conexão "QR Code com botões" pela Whaileys API própria: cartões de botões/lista com texto numerado,
// cliente só da instância configurada, HMAC do webhook (válido, adulterado, replay), número real de LID,
// robô em uma só conexão e Status/Disparador fora do motor. Sem rede.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const crypto = require('node:crypto');
const { Temporal } = require('@js-temporal/polyfill');
const root = path.resolve(__dirname, '../..');
const sh = path.join(root, 'supabase/functions/_shared');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
function load(file, env = {}, cache = new Map()) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const deno = { env: { get: (k) => env[k] } };
  const req = n => n.startsWith('https://') ? { serve: () => {} } : n.startsWith('npm:@js-temporal') ? { Temporal } : n.startsWith('npm:') ? {} : load(path.resolve(path.dirname(file), n), env, cache);
  vm.runInNewContext(out, { exports, require: req, crypto: crypto.webcrypto, Deno: deno, globalThis: { Deno: deno }, TextEncoder, TextDecoder, Response, URL, AbortSignal, atob, setTimeout, console: { warn() {} }, fetch: () => { throw new Error('rede proibida'); } });
  return exports;
}
const ENV = { WHAILEYS_API_URL: 'https://copilot.example.com', WHAILEYS_INSTANCE: 'agendafacil265', WHAILEYS_TOKEN: 't'.repeat(64), WHAILEYS_WEBHOOK_SECRET: 's'.repeat(64) };
const wa = load(path.join(sh, 'whatsapp/whaileys.ts'), ENV);
const SALON = '00000000-0000-4000-8000-000000000010';

test('cartão: botões e lista do robô viram o formato da Whaileys API, com o texto numerado junto', () => {
  const b = wa.whaileysCard({ op: 'buttons', body: { title: 'Confirmar', description: 'Confira', footer: 'Studio', buttons: [{ type: 'reply', displayText: '✅ Confirmar', id: 'confirm_yes' }, { displayText: '❌ Cancelar', id: 'confirm_cancel' }] } }, 'Confira\n\n1. ✅ Confirmar\n2. ❌ Cancelar');
  assert.deepEqual(JSON.parse(JSON.stringify(b.buttons)), [{ id: 'confirm_yes', title: '✅ Confirmar' }, { id: 'confirm_cancel', title: '❌ Cancelar' }]);
  assert.match(b.text, /1\. ✅ Confirmar/); assert.equal(b.footer, 'Studio');
  const l = wa.whaileysCard({ op: 'list', body: { title: 'Serviços', buttonText: '☰ Menu', footerText: 'V volta', sections: [{ title: 'Serviços', rows: [{ title: 'Corte', description: 'R$ 45', rowId: 'ab12cd.1' }] }] } }, 'Qual?\n\n1. Corte');
  assert.equal(l.sections[0].rows[0].id, 'ab12cd.1'); assert.equal(l.buttonText, '☰ Menu'); assert.equal(l.footer, 'V volta');
  assert.deepEqual(JSON.parse(JSON.stringify(wa.whaileysCard({ op: 'poll', body: { name: 'x', values: ['a'] } }, '1. a'))), { text: '1. a' }, 'enquete: só texto numerado');
  assert.equal(wa.whaileysCard({ op: 'buttons', body: { buttons: [1, 2, 3, 4].map(i => ({ displayText: `B${i}`, id: `b${i}` })) } }, 'x').buttons.length, 3);
});

test('cliente: só a instância configurada, só https, token no header; 409 = desconectado; 5xx no envio = incerto', async () => {
  const calls = [];
  const fake = (status, body) => async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify(body), { status }); };
  const c = new wa.WhaileysClient('t'.repeat(64), 'https://copilot.example.com/', 'agendafacil265', fake(200, { messageId: 'M1' }));
  assert.equal(await c.send('5511912345678', { text: 'oi' }), 'M1');
  assert.equal(calls[0].url, 'https://copilot.example.com/sessions/agendafacil265/send');
  assert.equal(calls[0].init.headers['x-api-key'], 't'.repeat(64)); assert.equal(calls[0].init.redirect, 'error');
  assert.equal(JSON.parse(calls[0].init.body).to, '5511912345678');
  await assert.rejects(() => new wa.WhaileysClient('k', 'https://x.com', 'agendafacil265', fake(409, {})).send('5511', { text: 'x' }), e => e.code === 'disconnected');
  await assert.rejects(() => new wa.WhaileysClient('k', 'https://x.com', 'agendafacil265', fake(502, {})).send('5511', { text: 'x' }), e => e.code === 'send_uncertain');
  await assert.rejects(() => new wa.WhaileysClient('k', 'https://x.com', 'agendafacil265', fake(200, {})).send('5511', { text: 'x' }), e => e.code === 'send_uncertain', 'sem messageId');
  assert.throws(() => new wa.WhaileysClient('k', 'http://x.com', 'agendafacil265'), e => e.code === 'configuration_missing');
  assert.throws(() => new wa.WhaileysClient('k', 'https://x.com', '../admin'), e => e.code === 'configuration_missing');
  assert.equal(wa.whaileysConfigured(), true); assert.equal(wa.whaileysInstance(), 'agendafacil265');
  assert.equal(load(path.join(sh, 'whatsapp/whaileys.ts'), { ...ENV, WHAILEYS_TOKEN: '' }).whaileysConfigured(), false);
});

test('estado do motor → status da conexão e número', () => {
  assert.equal(wa.whaileysStatusOf({ state: 'open' }), 'connected');
  assert.equal(wa.whaileysStatusOf({ state: 'connecting', qr: 'data:image/png;base64,x' }), 'qrcode');
  assert.equal(wa.whaileysStatusOf({ state: 'closed' }), 'disconnected');
  assert.equal(wa.whaileysPhone({ me: { id: '5511951645271:12@s.whatsapp.net' } }), '5511951645271');
});

test('webhook: HMAC válido aceito; corpo adulterado, segredo errado e replay recusados', async () => {
  const secret = 's'.repeat(64), raw = JSON.stringify({ instanceKey: 'agendafacil265', key: { id: 'ABC1' } }), now = Date.now(), ts = String(now);
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex');
  assert.equal(await wa.verifyWhaileysSignature(raw, ts, sig, secret, now), true);
  assert.equal(await wa.verifyWhaileysSignature(raw.replace('ABC1', 'ABC2'), ts, sig, secret, now), false, 'adulterado');
  assert.equal(await wa.verifyWhaileysSignature(raw, ts, sig, 'x'.repeat(64), now), false, 'segredo errado');
  assert.equal(await wa.verifyWhaileysSignature(raw, ts, sig, secret, now + 301_000), false, 'replay fora da janela de 5 min');
  assert.equal(await wa.verifyWhaileysSignature(raw, ts, 'zz', secret, now), false);
  assert.equal(await wa.verifyWhaileysSignature(raw, null, sig, secret, now), false);
  assert.equal(await wa.verifyWhaileysSignature(raw, ts, sig, '', now), false, 'sem segredo configurado');
});

test('webhook: contato só com LID usa o número real; sem número real é ignorado', () => {
  const hook = load(path.join(root, 'supabase/functions/whaileys-webhook/index.ts'), ENV);
  assert.equal(hook.realKey({ remoteJid: '5511912345678@s.whatsapp.net', id: 'A' }).remoteJid, '5511912345678@s.whatsapp.net');
  assert.equal(hook.realKey({ remoteJid: '123@lid', senderPn: '5511987654321@s.whatsapp.net', id: 'B' }).remoteJid, '5511987654321@s.whatsapp.net');
  assert.equal(hook.realKey({ remoteJid: '999@lid', id: 'C' }), null);
  const src = read('supabase/functions/whaileys-webhook/index.ts');
  assert.match(src, /body\.instanceKey !== whaileysInstance\(\)/, 'só a instância configurada');
  assert.match(src, /onConflict: "instance_id,event_type,provider_message_id", ignoreDuplicates: true/, 'dedupe por key.id');
  assert.match(src, /botProvider !== "whaileys"/, 'robô em uma só conexão');
  assert.ok(src.indexOf('verifyWhaileysSignature') < src.indexOf('JSON.parse(raw)'), 'assinatura antes de ler o corpo');
});

test('robô na conexão com botões: botões e lista com números no texto (reserva)', async () => {
  const domain = load(path.join(sh, 'whatsapp/chatbot-domain.ts'));
  const modeFor = async (provider, saved) => {
    const settings = { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { guided_flow_enabled: true, guided_render_mode: saved }, error: null }) }) }) };
    return (await domain.automationOf({ db: { from: () => settings, rpc: async () => ({ data: provider, error: null }) }, salonId: SALON })).renderMode;
  };
  for (const saved of ['native', 'hybrid', 'numbered']) assert.equal(await modeFor('whaileys', saved), 'hybrid', saved);
  assert.equal(await modeFor('whaileys', 'buttons'), 'buttons');
  assert.equal(await modeFor('evolution', 'native'), 'numbered');
  assert.equal(await modeFor('meta', 'hybrid'), 'native');
});

test('migração e envio: whaileys nunca faz Status nem Disparador; uma instância do motor para um salão', () => {
  const sql = read('supabase/migrations/20261113000700_whaileys_provider.sql');
  assert.match(sql, /CHECK \(provider IN \('evolution', 'meta', 'whaileys'\)\)/);
  assert.match(sql, /p_purpose NOT IN \('status', 'marketing'\) OR provider <> 'whaileys'/);
  assert.match(sql, /whatsapp_instances_whaileys_once ON public\.whatsapp_instances \(instance_name\) WHERE provider = 'whaileys'/);
  assert.ok(sql.indexOf('whatsapp_instances_whaileys_once') < sql.indexOf('COMMIT;'), 'dentro da transação');
  const outbox = read('supabase/functions/_shared/whatsapp/outbox.ts');
  assert.match(outbox, /item\.content_type !== "text" && item\.content_type !== "interactive"\) \{ await finish\("cancelled", "unsupported_on_whaileys"\)/);
  const inst = read('supabase/functions/whatsapp-instances/index.ts');
  assert.match(inst, /whaileys_in_use/); assert.doesNotMatch(inst, /body\.(apiUrl|api_url|url|token)\b/, 'URL e token nunca vêm do navegador');
});
