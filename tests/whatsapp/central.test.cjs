// Central WhatsApp: público do disparador, envelopes Evolution para a caixa de entrada e demo. Rodar: npm test
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const cache = new Map();
function load(rel) {
  const file = path.resolve(root, rel);
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const src = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const req = (n) => n.startsWith('@/') ? load(`src/${n.slice(2)}.ts`) : n.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(file), n)) + '.ts') : require(n);
  vm.runInNewContext(out, { exports, require: req, URL, crypto: require('node:crypto').webcrypto, Date, console }, { filename: file });
  return exports;
}
// Objetos do vm vêm de outro realm: compara por valor serializado.
const same = (a, b, m) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b, m);
const A = load('src/pages/admin/whatsapp/audience.ts');
const I = load('supabase/functions/_shared/whatsapp/inbound.ts');

test('telefones BR: com/sem 9º dígito, com/sem DDI, fixo, internacional, inválidos com motivo', () => {
  const ok = (raw, phone) => same(A.canonicalPhone(raw), { phone }, raw);
  const bad = (raw, reason) => same(A.canonicalPhone(raw), { reason }, raw);
  ok('(11) 99876-5432', '+5511998765432');
  ok('11 9876-5432', '+5511998765432');          // celular antigo sem 9º dígito
  ok('5511987654321', '+5511987654321');
  ok('551198765432', '+5511998765432');          // DDI sem +, sem 9º
  ok('+55 11 9876-5432', '+5511998765432');
  ok('0055 11 98765-4321', '+5511987654321');
  ok('(11) 3333-4444', '+551133334444');          // fixo não ganha 9
  ok('+1 415 555 2671', '+14155552671');         // internacional
  ok('5511987654321@s.whatsapp.net', '+5511987654321');
  bad('98765-4321', 'invalid');                  // sem DDD: não adivinha
  bad('', 'invalid'); bad('abc', 'invalid'); bad('+55 00 91234-5678', 'invalid');
  bad('120363000000@g.us', 'group'); bad('status@broadcast', 'broadcast'); bad('123@newsletter', 'broadcast'); bad('123456@lid', 'lid');
});

test('público: dedupe por número normalizado, opt-out e primeira ocorrência vence', () => {
  const { recipients, rejected } = A.buildAudience([
    { name: 'Ana', phone: '(11) 99876-5432', source: 'clientes' },
    { name: 'Ana WhatsApp', phone: '5511998765432@s.whatsapp.net', source: 'whatsapp' },
    { name: 'Ana antiga', phone: '11 9876-5432', source: 'arquivo' },
    { name: 'Saiu', phone: '+5511912345678', source: 'manual' },
    { name: 'Grupo', phone: '1203@g.us', source: 'whatsapp' },
    { name: 'Sem', phone: null, source: 'arquivo' },
  ], ['+5511912345678']);
  same(recipients.map(r => [r.name, r.phone, r.source]), [['Ana', '+5511998765432', 'clientes']]);
  same(rejected.map(r => r.reason), ['duplicate', 'duplicate', 'suppressed', 'group', 'invalid']);
  for (const r of rejected) assert.ok(A.REJECT_LABEL[r.reason]);
});

test('lotes: 1.000 por chamada, chave estável para reenvio idempotente', () => {
  const recipients = Array.from({ length: 2501 }, (_, i) => ({ name: `C${i}`, phone: `+55119${String(10000000 + i)}`, source: 'manual' }));
  let n = 0; const id = () => `id-${n++}`;
  const first = A.campaignBatches(recipients, [], id);
  same(first.map(b => b.recipients.length), [1000, 1000, 501]);
  same(Object.keys(first[0].recipients[0]), ['phone', 'name'], 'origem não vai ao servidor');
  const retry = A.campaignBatches(recipients, first.map(b => b.submissionId), id);
  same(retry.map(b => b.submissionId), JSON.parse(JSON.stringify(first.map(b => b.submissionId))));
  assert.equal(A.estimatedMinutes(2501), 126);
});

test('mensagem: mesmo contrato do servidor para {nome}', () => {
  assert.equal(A.templateError(''), 'Escreva a mensagem.');
  assert.match(A.templateError('Oi {{email}}'), /nome/);
  assert.equal(A.templateError('Oi {nome} e {{nome}}'), null);
  assert.equal(A.templateError('x'.repeat(4097)), 'A mensagem passa de 4.096 caracteres.');
  assert.equal(A.previewText('Olá {nome}!', 'Maria da Silva'), 'Olá Maria!');
  assert.equal(A.previewText('Olá, {nome}!', ''), 'Olá!');
});

test('Evolution: contatos sem grupos, listas, canais e @lid; dedupe por jid', () => {
  const { contacts, excluded } = I.evolutionContacts([
    { remoteJid: '5511987654321@s.whatsapp.net', pushName: 'Ana' }, { id: '5511987654321@s.whatsapp.net', name: 'Ana 2' },
    { remoteJid: '1203@g.us' }, { remoteJid: 'status@broadcast' }, { remoteJid: '1@newsletter' }, { remoteJid: '999@lid' }, { remoteJid: 'lixo' }, null,
    { remoteJid: '14155552671@s.whatsapp.net' },
  ]);
  same(contacts.map(c => [c.phone, c.name]), [['+5511987654321', 'Ana'], ['+14155552671', 'Contato do WhatsApp']]);
  same({ ...excluded }, { group: 1, broadcast: 2, lid: 1, invalid: 2 });
});

test('Evolution: envelopes de mensagem para a caixa de entrada', () => {
  const base = { key: { remoteJid: '5511987654321@s.whatsapp.net', fromMe: false, id: 'ABC123' }, pushName: 'Ana', messageTimestamp: 1762430000 };
  const text = I.parseInboxMessage({ ...base, message: { conversation: ' Oi ' } });
  assert.equal(text.direction, 'in'); assert.equal(text.body, 'Oi'); assert.equal(text.phone, '+5511987654321'); assert.equal(text.name, 'Ana');
  assert.equal(text.createdAt, new Date(1762430000 * 1000).toISOString());
  const out = I.parseInboxMessage({ ...base, key: { ...base.key, fromMe: true }, message: { extendedTextMessage: { text: 'Resposta' } } });
  assert.equal(out.direction, 'out'); assert.equal(out.name, null);
  const img = I.parseInboxMessage({ ...base, message: { imageMessage: { caption: 'Foto', mimetype: 'image/jpeg', url: 'https://mmg.whatsapp.net/x.enc' } } });
  assert.equal(img.type, 'image'); assert.equal(img.body, 'Foto'); assert.equal(img.mediaUrl, null, 'URL criptografada do CDN não vira link');
  const doc = I.parseInboxMessage({ ...base, message: { documentWithCaptionMessage: { message: { documentMessage: { fileName: 'tabela.pdf', mimetype: 'application/pdf' } } } }, mediaUrl: 'https://s3.example.com/a.pdf' });
  assert.equal(doc.type, 'document'); assert.equal(doc.body, 'tabela.pdf'); assert.equal(doc.mediaUrl, 'https://s3.example.com/a.pdf');
  const audio = I.parseInboxMessage({ ...base, message: { audioMessage: { mimetype: 'audio/ogg' } } });
  assert.equal(audio.type, 'audio'); assert.equal(audio.body, '');
  assert.equal(img.kind, 'media'); assert.equal(text.kind, 'text');
  const list = I.parseInboxMessage({ ...base, key: { ...base.key, fromMe: true }, message: { listMessage: { title: 'Escolha o serviço', sections: [] } } });
  assert.equal(list.kind, 'interactive'); assert.equal(list.type, 'list'); assert.equal(list.body, 'Escolha o serviço');
  const reply = I.parseInboxMessage({ ...base, message: { listResponseMessage: { title: 'Corte', singleSelectReply: { selectedRowId: 'svc1' } } } });
  assert.equal(reply.kind, 'interactive'); assert.equal(reply.type, 'list_reply'); assert.equal(reply.body, 'Corte');
  const btn = I.parseInboxMessage({ ...base, message: { buttonsResponseMessage: { selectedButtonId: 'b1', selectedDisplayText: 'Confirmar' } } });
  assert.equal(btn.type, 'buttons_reply'); assert.equal(btn.body, 'Confirmar');
  for (const bad of [
    { ...base, key: { ...base.key, remoteJid: '1203@g.us' }, message: { conversation: 'x' } },
    { ...base, key: { ...base.key, remoteJid: '99@lid' }, message: { conversation: 'x' } },
    { ...base, message: { protocolMessage: {} } }, { ...base, message: { reactionMessage: { text: '👍' } } },
    { ...base, message: { conversation: '' } }, { ...base, key: { ...base.key, id: 'bad id!' }, message: { conversation: 'x' } },
  ]) assert.equal(I.parseInboxMessage(bad), null);
  assert.equal(I.messageRecords({ messages: { records: [1, 2] } }).length, 2);
  assert.equal(I.messageRecords([1]).length, 1);
  assert.equal(I.messageRecords({}).length, 0);
});

test('resposta manual: texto obrigatório e limite', () => {
  const { replyText, inboxRow } = load('supabase/functions/_shared/whatsapp/inbox.ts');
  assert.equal(replyText('  oi\r\n  '), 'oi');
  for (const bad of ['', '   ', 'x'.repeat(4097), null, 5]) assert.equal(replyText(bad), null);
  const row = inboxRow('s', { id: 'X', phone: '+5511987654321', direction: 'out', kind: 'text', type: 'text', body: 'b', mediaUrl: null, mediaMime: null, mediaName: null, name: null, createdAt: null });
  assert.equal(row.author, 'human'); assert.equal(row.kind, 'text'); assert.equal(row.source, 'phone'); assert.equal('created_at' in row, false);
});

test('rotas antigas abrem a aba correta; aba desconhecida cai em Conversas', () => {
  const src = fs.readFileSync(path.join(root, 'src/pages/admin/whatsapp/WhatsAppCentral.tsx'), 'utf8');
  for (const [route, tab] of [['broadcast', 'aba=disparador'], ['status-scheduler', 'aba=status'], ['chatbot', 'aba=chatbot'], ['import-contacts', 'aba=contatos&contatos=importar'], ['export-contacts', 'aba=contatos&contatos=exportar']])
    assert.ok(src.includes(`"/admin/${route}": "${tab}"`), route);
  for (const tab of ['conversas', 'disparador', 'status', 'chatbot', 'contatos', 'conexao']) assert.ok(src.includes(`["${tab}",`), tab);
  const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  for (const route of ['broadcast', 'status-scheduler', 'chatbot', 'import-contacts', 'export-contacts']) assert.match(app, new RegExp(`path="/admin/${route}"[\\s\\S]{0,160}<LegacyWhatsAppRedirect />`), route);
});

test('migração: aditiva, RLS, realtime e rollback', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261106002000_whatsapp_inbox.sql'), 'utf8');
  assert.match(sql, /^BEGIN;/); assert.match(sql, /COMMIT;\s*\n\s*-- Rollback/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/); assert.match(sql, /GRANT SELECT ON public\.whatsapp_messages TO authenticated/);
  assert.match(sql, /ADD TABLE public\.whatsapp_messages/);
  assert.match(sql, /kind text NOT NULL DEFAULT 'text' CHECK\(kind IN\('text','interactive','media'\)\)/); assert.match(sql, /payload jsonb/);
  const body = sql.split('-- Rollback')[0];
  assert.doesNotMatch(body, /DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i);
});

test('demo: conversas, resposta idempotente, contatos Evolution e disparo simulado', () => {
  const W = load('src/features/training/demo/whatsapp.ts');
  const { SALON_ID } = load('src/features/training/demo/fixtures.ts');
  const db = { whatsapp_instances: [], clients: [] };
  W.seedWhatsAppDemo(db);
  assert.equal(db.whatsapp_instances[0].status, 'connected');
  const list = W.whatsappDemoRpc(db, 'whatsapp_inbox_conversations', { p_salon_id: SALON_ID }).data;
  assert.equal(list.length, 4);
  assert.ok(list.some(c => c.human_takeover) && list.some(c => !c.human_takeover));
  const send = (ref) => W.whatsappDemoFunction(db, 'whatsapp-reply', { action: 'send', phone: '+5511900000001', text: 'Oi', clientRef: ref }).data;
  const first = send('r1'); assert.equal(first.status, 'sent'); assert.equal(send('r1').duplicate, true);
  assert.equal(db.whatsapp_messages.filter(m => m.client_ref === 'r1').length, 1);
  assert.equal(W.whatsappDemoRpc(db, 'whatsapp_inbox_conversations', { p_salon_id: SALON_ID }).data.find(c => c.phone === '+5511900000001').human_takeover, true);
  const contacts = W.whatsappDemoFunction(db, 'whatsapp-instances', { action: 'contacts' }).data;
  assert.equal(contacts.contacts.length, 4); assert.equal(contacts.excluded.group, 1);
  const create = (key) => W.whatsappDemoFunction(db, 'broadcast-messages-v2', { action: 'create_broadcast', submissionId: key, message: 'Oi', recipients: [{ phone: '+1', name: 'a' }, { phone: '+2', name: 'b' }, { phone: '+3', name: 'c' }] }).data;
  const b1 = create('k'); assert.equal(create('k').broadcastId, b1.broadcastId);
  assert.equal(db.broadcasts.length, 1); assert.equal(db.broadcasts[0].failed_count, 1);
  assert.equal(W.whatsappDemoFunction(db, 'whatsapp-instances', { action: 'delete' }), undefined, 'ações destrutivas seguem bloqueadas');
});
