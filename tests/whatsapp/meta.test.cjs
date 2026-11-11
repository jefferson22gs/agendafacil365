// WhatsApp oficial (Meta Cloud API): assinatura do webhook, leitura de mensagens/cliques/status e conversão para botões/lista. Sem rede.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const sh = path.join(root, 'supabase/functions/_shared');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const req = n => n.startsWith('https://') || n.startsWith('npm:') ? {} : load(path.resolve(path.dirname(file), n));
  vm.runInNewContext(out, { exports, require: req, crypto: crypto.webcrypto, Deno: { env: { get: () => undefined } }, TextEncoder, TextDecoder, Response, URL, AbortSignal, console: { warn() {} }, fetch: () => { throw new Error('rede proibida'); } });
  return exports;
}
const meta = load(path.join(sh, 'whatsapp/meta.ts'));
const plain = v => JSON.parse(JSON.stringify(v));

test('assinatura X-Hub-Signature-256: HMAC do corpo bruto com o App Secret; errada ou ausente é recusada', async () => {
  const raw = Buffer.from('{"object":"whatsapp_business_account"}');
  const sig = 'sha256=' + crypto.createHmac('sha256', 'segredo').update(raw).digest('hex');
  assert.equal(await meta.validMetaSignature(new Uint8Array(raw), sig, 'segredo'), true);
  assert.equal(await meta.validMetaSignature(new Uint8Array(raw), sig, 'outro'), false);
  assert.equal(await meta.validMetaSignature(new Uint8Array(raw), null, 'segredo'), false);
  assert.equal(await meta.validMetaSignature(new Uint8Array(raw), 'sha256=xyz', 'segredo'), false);
});

const env = (value) => ({ object: 'whatsapp_business_account', entry: [{ id: 'WABA', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '15551793501', phone_number_id: '1516976681488434' }, ...value } }] }] });
const W = 'wamid.HBgNNTUxMTk2MTYyNjg5NxUCABIYFDNBQTM5MTk3';

test('webhook: texto, clique em botão, item da lista, mídia e status de entrega', () => {
  const [c] = plain(meta.parseMetaWebhook(env({
    contacts: [{ wa_id: '5511961626897', profile: { name: 'Jefferson' } }],
    messages: [
      { from: '5511961626897', id: W + 'A', timestamp: '1794422293', type: 'text', text: { body: 'oi' } },
      { from: '5511961626897', id: W + 'B', timestamp: '1794422294', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'confirm_yes', title: '✅ Confirmar' } } },
      { from: '5511961626897', id: W + 'C', timestamp: '1794422295', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'ab12cd.3', title: '14:00' } } },
      { from: '5511961626897', id: W + 'D', timestamp: '1794422296', type: 'image', image: { id: '1234567890', mime_type: 'image/jpeg', caption: 'comprovante' } },
      { from: '5511961626897', id: W + 'E', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'DROP TABLE', title: 'x' } } },
    ],
    statuses: [{ id: W + 'F', status: 'read', recipient_id: '5511961626897' }, { id: W + 'G', status: 'failed', errors: [{ code: 131047 }] }],
  })));
  assert.equal(c.phoneNumberId, '1516976681488434');
  assert.deepEqual(c.incoming.map(m => [m.text, m.selection]), [['oi', null], ['✅ Confirmar', 'confirm_yes'], ['14:00', 'ab12cd.3'], ['comprovante', null], ['x', null]]);
  assert.equal(c.incoming[0].phone, '+5511961626897'); assert.equal(c.incoming[0].name, 'Jefferson');
  assert.equal(c.incoming[3].mediaId, '1234567890'); assert.equal(c.incoming[3].media.type, 'image');
  assert.equal(c.incoming[4].selection, null, 'id fora do padrão não vira seleção');
  assert.deepEqual(c.statuses, [{ id: W + 'F', status: 'read' }, { id: W + 'G', status: 'failed', error: 131047 }]);
  assert.equal(c.inbox[1].type, 'buttons_reply'); assert.equal(c.inbox[2].type, 'list_reply');
});

test('webhook: ignora grupo/número inválido, id fora do padrão e outros campos', () => {
  assert.deepEqual(plain(meta.parseMetaWebhook(env({ messages: [{ from: '120363000000@g.us', id: W, type: 'text', text: { body: 'x' } }, { from: '5511961626897', id: 'falso', type: 'text', text: { body: 'x' } }] })))[0].incoming, []);
  assert.deepEqual(plain(meta.parseMetaWebhook({ entry: [{ changes: [{ field: 'account_update', value: {} }] }] })), []);
  assert.deepEqual(plain(meta.parseMetaWebhook(null)), []);
});

test('conversão: até 3 opções curtas = botões; mais ou com descrição = lista "☰ Menu"; enquete vira lista', () => {
  const b = plain(meta.toMetaInteractive({ op: 'buttons', body: { title: 'Confirmar', description: 'Confira os dados', footer: 'Studio', buttons: [{ type: 'reply', displayText: '✅ Confirmar', id: 'confirm_yes' }, { type: 'reply', displayText: '❌ Cancelar', id: 'confirm_cancel' }] } }, 'x'));
  assert.equal(b.interactive.type, 'button');
  assert.deepEqual(b.interactive.action.buttons.map(x => [x.reply.id, x.reply.title]), [['confirm_yes', '✅ Confirmar'], ['confirm_cancel', '❌ Cancelar']]);
  assert.equal(b.interactive.body.text, 'Confira os dados'); assert.equal(b.interactive.footer.text, 'Studio'); assert.equal(b.interactive.header.text, 'Confirmar');
  const rows = Array.from({ length: 5 }, (_, i) => ({ title: `Serviço ${i}`, description: 'R$ 45,00 (40 min)', rowId: `ab12cd.${i + 1}` }));
  const l = plain(meta.toMetaInteractive({ op: 'list', body: { title: 'Serviços', description: 'Qual serviço?', buttonText: '☰ Menu', footerText: 'Digite V para voltar', sections: [{ title: 'Serviços', rows }] } }, 'x'));
  assert.equal(l.interactive.type, 'list'); assert.equal(l.interactive.action.button, '☰ Menu');
  assert.equal(l.interactive.action.sections[0].rows.length, 5); assert.equal(l.interactive.action.sections[0].rows[0].id, 'ab12cd.1');
  assert.equal(l.interactive.action.sections[0].rows[0].description, 'R$ 45,00 (40 min)');
  const p = plain(meta.toMetaInteractive({ op: 'poll', body: { name: 'Menu', values: ['1️⃣ A', '2️⃣ B'] }, options: [{ id: 'menu_book', title: '1️⃣ 📅 Agendar horário' }, { id: 'menu_human', title: '2️⃣ 💬 Falar com atendente' }] }, 'x'));
  assert.equal(p.interactive.type, 'list', 'rótulo > 20 caracteres não cabe em botão');
  assert.deepEqual(p.interactive.action.sections[0].rows.map(x => [x.id, x.title]), [['menu_book', '📅 Agendar horário'], ['menu_human', '💬 Falar com atendente']], 'sem o número 1️⃣ da enquete');
  assert.equal(meta.toMetaInteractive({ op: 'list', body: { sections: [{ rows: Array.from({ length: 11 }, (_, i) => ({ rowId: `a${i}x`, title: 't' })) }] } }, 'x'), null, 'mais de 10 linhas: texto');
});

test('limites da Cloud API: títulos cortados (botão 20, linha 24, descrição 72), corpo ≤ 1024', () => {
  const long = 'x'.repeat(2000);
  const l = plain(meta.toMetaInteractive({ op: 'list', body: { description: long, sections: [{ rows: [{ rowId: 'ab12cd.1', title: 'T'.repeat(40), description: 'D'.repeat(100) }, { rowId: 'ab12cd.2', title: 'y' }] }] } }, 'x'));
  const row = l.interactive.action.sections[0].rows[0];
  assert.ok(Array.from(row.title).length <= 24 && Array.from(row.description).length <= 72);
  assert.ok(Array.from(l.interactive.body.text).length <= 1024);
});

test('envio: 4xx recusado (nada saiu), limite = rate_limited, 5xx/rede = incerto; id da mensagem devolvido', async () => {
  const E = load(path.join(sh, 'whatsapp/errors.ts')).WhatsAppError;
  const mk = (status, body) => new meta.MetaClient('tok', async () => ({ ok: status < 300, status, json: async () => body }));
  assert.equal(await mk(200, { messages: [{ id: 'wamid.X' }] }).send('1516976681488434', { to: '1', type: 'text', text: { body: 'a' } }), 'wamid.X');
  await assert.rejects(() => mk(400, { error: { code: 131047 } }).send('1516976681488434', {}), e => e.code === 'provider_rejected');
  await assert.rejects(() => mk(429, { error: { code: 130429 } }).send('1516976681488434', {}), e => e.code === 'provider_rate_limited');
  await assert.rejects(() => mk(503, {}).send('1516976681488434', {}), e => e.code === 'send_uncertain');
  await assert.rejects(() => new meta.MetaClient('t', async () => { throw new Error('rede'); }).send('1516976681488434', {}), e => e.code === 'send_uncertain');
  await assert.rejects(() => mk(200, {}).send('abc', {}), e => e instanceof E);
});

test('migração Meta: aditiva, provider com check, Phone Number ID único, janela de 24h só para o servidor', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261111000200_whatsapp_meta_cloud.sql'), 'utf8');
  assert.match(sql, /^BEGIN;/m); assert.match(sql, /^COMMIT;/m);
  assert.doesNotMatch(sql, /^\s*(DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE)/m);
  assert.match(sql, /provider IN \('evolution', 'meta'\)/);
  assert.match(sql, /UNIQUE INDEX IF NOT EXISTS whatsapp_instances_meta_phone_unique/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.whatsapp_service_window_open\(uuid, text\) FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /token/i, 'token nunca vai para o banco');
});
