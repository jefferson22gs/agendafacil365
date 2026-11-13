// Terceira conexão (QR Code com botões / whaileys): robô com botões + números de reserva, cliente HTTP da conexão
// certa, só uma conexão atende o robô e o webhook compara com a conexão que recebeu. Sem rede.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const { Temporal } = require('@js-temporal/polyfill');
const root = path.resolve(__dirname, '../..');
const sh = path.join(root, 'supabase/functions/_shared');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const cache = new Map();
function load(file, env = {}) {
  const key = file + JSON.stringify(env);
  if (cache.has(key)) return cache.get(key);
  const exports = {}; cache.set(key, exports);
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const deno = { env: { get: (k) => env[k] } };
  const req = n => n.startsWith('https://') ? {} : n.startsWith('npm:@js-temporal') ? { Temporal } : n.startsWith('npm:') ? {} : load(path.resolve(path.dirname(file), n), env);
  vm.runInNewContext(out, { exports, require: req, crypto: require('node:crypto').webcrypto, Deno: deno, globalThis: { Deno: deno }, TextEncoder, TextDecoder, Response, URL, AbortSignal, atob, setTimeout, console: { warn() {} }, fetch: () => { throw new Error('rede proibida'); } });
  return exports;
}
const domain = load(path.join(sh, 'whatsapp/chatbot-domain.ts'));
const SALON = '00000000-0000-4000-8000-000000000010';
async function modeFor(provider, saved) {
  const settings = { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { guided_flow_enabled: true, guided_render_mode: saved }, error: null }) }) }) };
  const fake = { from: () => settings, rpc: async () => ({ data: provider, error: null }) };
  return (await domain.automationOf({ db: fake, salonId: SALON })).renderMode;
}

test('robô na conexão com botões: botões e lista com os números no texto (reserva); enquete e só botões respeitados', async () => {
  for (const saved of ['native', 'hybrid', 'numbered']) assert.equal(await modeFor('whaileys', saved), 'hybrid', saved);
  assert.equal(await modeFor('whaileys', 'buttons'), 'buttons');
  assert.equal(await modeFor('whaileys', 'poll'), 'poll');
  assert.equal(await modeFor('evolution', 'native'), 'numbered', 'QR Code comum continua numerado');
  assert.equal(await modeFor('meta', 'hybrid'), 'native', 'oficial inalterada');
});

test('cliente HTTP: cada conexão usa o próprio servidor e chave; nada de provedor desconhecido', () => {
  const env = { EVOLUTION_API_URL: 'https://evo.example.com', EVOLUTION_API_KEY: 'k1', WHAILEYS_API_URL: 'https://btn.example.com', WHAILEYS_API_KEY: 'k2' };
  const evo = load(path.join(sh, 'whatsapp/evolution.ts'), env);
  assert.equal(evo.evolutionClient().base, 'https://evo.example.com');
  assert.equal(evo.evolutionClient('evolution').base, 'https://evo.example.com');
  assert.equal(evo.evolutionClient('whaileys').base, 'https://btn.example.com');
  assert.throws(() => evo.evolutionClient('meta'), e => e.code === 'configuration_missing');
  assert.equal(evo.whaileysConfigured(), true);
  assert.equal(load(path.join(sh, 'whatsapp/evolution.ts'), { EVOLUTION_API_URL: 'https://evo.example.com', EVOLUTION_API_KEY: 'k1' }).whaileysConfigured(), false, 'sem secrets: painel não oferece a conexão');
});

test('migração: provedor whaileys, robô em uma só conexão, Status/Disparador pelos QR Code, recibos pelos dois', () => {
  const sql = read('supabase/migrations/20261113000700_whaileys_provider.sql');
  assert.match(sql, /CHECK \(provider IN \('evolution', 'meta', 'whaileys'\)\)/);
  assert.match(sql, /bot_provider IN \('meta', 'evolution', 'whaileys'\)/);
  assert.match(sql, /p_purpose <> 'status' OR provider IN \('evolution', 'whaileys'\)/);
  assert.match(sql, /\(provider = 'evolution'\) DESC/, 'com as duas, a Evolution faz Disparador e Status');
  assert.match(sql, /UPDATE whatsapp_chatbot_sessions SET current_step = 'IDLE'/, 'trocar reinicia as conversas');
  assert.match(sql, /RETURNS TABLE\([^)]*provider text\)/); assert.match(sql, /w\.provider IN \('evolution', 'whaileys'\)/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /^\s*(DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE)/m);
});

test('webhook, envio e painel seguem a conexão da instância (nunca uma URL do navegador)', () => {
  const hook = read('supabase/functions/evolution-webhook/index.ts');
  assert.match(hook, /botProvider !== \(instance\.provider \?\? "evolution"\)/, 'só a conexão escolhida aciona o robô');
  assert.match(read('supabase/functions/_shared/whatsapp/outbox.ts'), /evolutionClient\(instance\.provider\)/);
  const inst = read('supabase/functions/whatsapp-instances/index.ts');
  assert.match(inst, /const qrProvider = body\.provider === "whaileys" \? "whaileys" : "evolution";/);
  assert.match(inst, /provider: qrProvider, api_url: requiredEnv\(qrProvider === "whaileys" \? "WHAILEYS_API_URL" : "EVOLUTION_API_URL"\)/);
  assert.match(inst, /const remote = instance\.provider === "whaileys" \? evolutionClient\("whaileys"\) : api;/);
  assert.doesNotMatch(inst, /body\.(apiUrl|api_url|url)\b/, 'URL nunca vem do navegador');
});
