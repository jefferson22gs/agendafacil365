// Fluxo guiado (Typebot) para Evolution 2.3.7: comandos, menus com id fixo, modos de renderização, máquina de estados. Sem rede.
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
  vm.runInNewContext(out, { exports, require: req, crypto: require('node:crypto').webcrypto, Deno: { env: { get: () => undefined } }, TextEncoder, TextDecoder, Response, URL, atob, setTimeout, console: { warn() {} }, fetch: () => { throw new Error('rede proibida'); } });
  return exports;
}
const ui = load(path.join(sh, 'whatsapp/interactive.ts'));
const inbound = load(path.join(sh, 'whatsapp/inbound.ts'));
const sender = load(path.join(sh, 'whatsapp/evolutionSender.ts'));
const guided = load(path.join(sh, 'whatsapp/guided.ts'));
const plain = v => JSON.parse(JSON.stringify(v));

test('comandos rápidos: números, #comandos, voltar, menu e atendente', () => {
  const p = guided.parseCommand;
  for (const t of ['0', 'menu', 'Oi', 'olá', 'bom dia']) assert.equal(p(t), 'menu', t);
  for (const t of ['#agendar', 'agendar', 'quero agendar']) assert.equal(p(t), 'book', t);
  for (const t of ['#meushorarios', 'meus agendamentos']) assert.equal(p(t), 'mine', t);
  for (const t of ['#cancelar', 'remarcar']) assert.equal(p(t), 'cancel', t);
  for (const t of ['#valores', 'preços', 'serviços']) assert.equal(p(t), 'prices', t);
  for (const t of ['v', 'V', 'voltar']) assert.equal(p(t), 'back', t);
  for (const t of ['atendente', 'humano', 'quero falar com uma pessoa real']) assert.equal(p(t), 'human', t);
  assert.equal(p('quero agendar para outra pessoa'), null);
  assert.equal(p('vocês fazem luzes?'), null);
});

test('data e hora digitadas: DD/MM, DD/MM/AAAA, próximo ano, passado recusado; 9h, 14:00, 1430', () => {
  assert.equal(guided.parseTypedDate('15/11', '2026-11-11'), '2026-11-15');
  assert.equal(guided.parseTypedDate('15/11/2026', '2026-11-11'), '2026-11-15');
  assert.equal(guided.parseTypedDate('05/01', '2026-12-20'), '2027-01-05', 'sem ano e já passou = ano seguinte');
  assert.equal(guided.parseTypedDate('10/11/2026', '2026-11-11'), null, 'passado');
  assert.equal(guided.parseTypedDate('31/02', '2026-11-11'), null);
  assert.equal(guided.parseTypedDate('oi', '2026-11-11'), null);
  assert.equal(guided.parseTypedTime('9h'), '09:00'); assert.equal(guided.parseTypedTime('14:00'), '14:00'); assert.equal(guided.parseTypedTime('1430'), '14:30');
  assert.equal(guided.parseTypedTime('25:00'), null); assert.equal(guided.parseTypedTime('2'), '02:00');
});

test('menu com id fixo: botão/lista carrega menu_book; clique resolve pelo id; texto [1] também', () => {
  const { menu, stored } = ui.buildMenu('ab12cd', 'MAIN_MENU', 'Menu', 'x', [
    { id: 'menu_book', title: 'Agendar', value: { go: 'book' } }, { id: 'menu_human', title: 'Atendente', value: { go: 'human' } }, { title: 'Sem id', value: { go: 'x' } },
  ]);
  assert.deepEqual(menu.rows.map(r => r.id), ['menu_book', 'menu_human', 'ab12cd.3']);
  assert.deepEqual(stored.ids, ['menu_book', 'menu_human', '']);
  assert.equal(ui.resolveChoice(stored, '', 'menu_human'), 1);
  assert.equal(ui.resolveChoice(stored, '', 'ab12cd.3'), 2);
  assert.equal(ui.resolveChoice(stored, '', 'menu_zzz'), null);
  assert.equal(ui.resolveChoice(stored, '[2]'), 1);
  assert.equal(ui.resolveChoice(stored, '1️⃣'), 0);
  const key = { remoteJid: '5511912345678@s.whatsapp.net', fromMe: false, id: 'M1' };
  assert.equal(inbound.parseIncoming({ key, message: { buttonsResponseMessage: { selectedButtonId: 'menu_book', selectedDisplayText: 'Agendar' } } }).selection, 'menu_book');
  assert.equal(inbound.parseIncoming({ key, message: { listResponseMessage: { title: 'x', singleSelectReply: { selectedRowId: 'confirm_yes' } } } }).selection, 'confirm_yes');
  assert.equal(inbound.selectionOf({ buttonsResponseMessage: { selectedButtonId: 'DROP TABLE', selectedDisplayText: 'x' } }), null, 'id inválido não vira seleção');
});

test('modos de renderização: híbrido numera o corpo, nativo não, numerado é só texto; rodapé presente', () => {
  const { menu } = ui.buildMenu('ab12cd', 'CONFIRM_BOOKING', 'Confirmar', 'Confira', [{ id: 'confirm_yes', title: 'Confirmar', value: {} }, { id: 'confirm_cancel', title: 'Cancelar', value: {} }]);
  menu.footer = guided.FOOTER;
  const hybrid = plain(sender.renderMenu(menu, 'hybrid'));
  assert.equal(hybrid.type, 'interactive'); assert.equal(hybrid.payload.op, 'buttons');
  assert.match(hybrid.payload.body.description, /\[1\] Confirmar\n\[2\] Cancelar/);
  assert.equal(hybrid.payload.body.footer, guided.FOOTER);
  assert.ok(!('number' in hybrid.payload.body));
  assert.deepEqual(hybrid.payload.body.buttons.map(b => b.id), ['confirm_yes', 'confirm_cancel']);
  assert.match(hybrid.text, /1\. Confirmar[\s\S]*Digite \*V\* para voltar/, 'fallback numerado com rodapé');
  const native = plain(sender.renderMenu(menu, 'native'));
  assert.doesNotMatch(native.payload.body.description, /\[1\]/);
  const numbered = plain(sender.renderMenu(menu, 'numbered'));
  assert.equal(numbered.type, 'text'); assert.match(numbered.text, /2\. Cancelar/);
  const list = ui.buildMenu('ab12cd', 'SELECT_SERVICE', 'Serviços', 'Qual?', Array.from({ length: 5 }, (_, i) => ({ title: `Serviço ${i}`, description: 'R$ 10,00 (30 min)', value: { id: String(i) } }))).menu;
  const l = plain(sender.renderMenu(list, 'hybrid'));
  assert.equal(l.payload.op, 'list'); assert.ok(l.payload.body.buttonText && l.payload.body.sections[0].rows[0].rowId === 'ab12cd.1');
});

test('sendWithFallback: 4xx no interativo cai para texto numerado; 5xx sobe como incerto', async () => {
  const seen = [];
  const api = { request: async (op, inst, body) => { seen.push([op, body]); if (op === 'buttons') { const e = new Error('x'); e.code = 'provider_rejected'; Object.setPrototypeOf(e, load(path.join(sh, 'whatsapp/errors.ts')).WhatsAppError.prototype); throw e; } return { key: { id: 'MSG1' } }; } };
  const r = await sender.sendWithFallback(api, 'inst', '5511912345678', { op: 'buttons', body: { title: 'T', buttons: [] } }, 'texto numerado');
  assert.equal(r.fallback, true); assert.equal(sender.providerMessageId(r.response), 'MSG1');
  assert.deepEqual(seen.map(s => s[0]), ['buttons', 'text']); assert.equal(seen[1][1].text, 'texto numerado'); assert.equal(seen[0][1].number, '5511912345678');
  const down = { request: async () => { const e = new Error('x'); e.code = 'send_uncertain'; Object.setPrototypeOf(e, load(path.join(sh, 'whatsapp/errors.ts')).WhatsAppError.prototype); throw e; } };
  await assert.rejects(() => sender.sendWithFallback(down, 'inst', '5511912345678', { op: 'list', body: {} }, 't'), e => e.code === 'send_uncertain');
});

test('horário de funcionamento a partir de working_hours', () => {
  const t = guided.hoursText({ working_hours: { 0: { isOpen: false }, 1: { isOpen: true, start: '09:00:00', end: '18:30:00' } } });
  assert.match(t, /Domingo: fechado/); assert.match(t, /Segunda: 09:00–18:30/);
  assert.equal(guided.hoursText({ opening_time: '08:00:00', closing_time: '20:00:00' }), 'Todos os dias: 08:00–20:00');
  assert.equal(guided.fillTemplate('Oi {primeiro_nome}, bem-vindo ao {salao}! {x}', { primeiro_nome: 'Ana', salao: 'Studio' }), 'Oi Ana, bem-vindo ao Studio!');
});

// Banco simulado: 2 serviços, 1 profissional (seleção automática), cliente desconhecido.
const SALON = '00000000-0000-4000-8000-000000000010', SVC = '00000000-0000-4000-8000-000000000030', PRO = '00000000-0000-4000-8000-000000000020';
function db({ guided: on = true, mode = 'hybrid', pros = 1, client = null, booking = true, sessionTable = true } = {}) {
  const calls = [], upserts = [], inserts = [];
  const rows = {
    salons: { name: 'Studio X', timezone: 'America/Sao_Paulo', address: 'Rua A, 1', city: 'SP', pix_key: null, slug: 'studio-x', phone: null, working_hours: null, opening_time: '09:00:00', closing_time: '18:00:00' },
    whatsapp_automation_settings: { chatbot_booking_enabled: booking, interactive_enabled: true, guided_flow_enabled: on, guided_render_mode: mode, guided_welcome_message: null, guided_confirmation_message: null, guided_info_text: null, guided_handoff_hours: 2 },
    services: [{ id: SVC, name: 'Corte Degradê', price: 45, duration_minutes: 40 }, { id: 'svc2', name: 'Barba', price: 30, duration_minutes: 20 }],
    professionals: Array.from({ length: pros }, (_, i) => ({ id: i ? `pro${i}` : PRO, name: i ? `Pro ${i}` : 'Ana', specialty: null })), professional_services: [],
    clients: client, whatsapp_chatbot_sessions: null, appointments: [],
  };
  return { calls, upserts, inserts, from(table) {
    const filters = []; calls.push({ table, filters });
    const res = () => Array.isArray(rows[table]) ? rows[table] : [];
    const q = { select() { return q; }, eq(k, v) { filters.push([k, v]); return q; }, in() { return q; }, is() { return q; }, order() { return q; }, gte() { return q; },
      limit() { return Object.assign(Promise.resolve({ data: res(), error: null }), q); },
      maybeSingle: async () => table === 'whatsapp_chatbot_sessions' && !sessionTable ? { data: null, error: { code: '42P01' } } : ({ data: Array.isArray(rows[table]) ? rows[table][0] ?? null : rows[table], error: null }),
      single: async () => ({ data: rows[table], error: null }),
      upsert: async (row) => { upserts.push({ table, row }); if (table === 'whatsapp_chatbot_sessions') rows.whatsapp_chatbot_sessions = { current_step: row.current_step, session_data: row.session_data, client_name: row.client_name, human_takeover_until: row.human_takeover_until, last_interaction_at: row.last_interaction_at }; return { error: null }; },
      insert: async (row) => { inserts.push({ table, row }); return { error: null }; },
      update() { return q; },
      then(res2) { return Promise.resolve({ data: res(), error: null }).then(res2); } };
    return q;
  }, rpc: async (name, args) => { calls.push({ name, args }); if (name === 'get_available_time_slots') return { data: ['09:00', '14:00', '19:00'], error: null }; if (name === 'whatsapp_book_appointment_v2') return { data: { id: 'appt', final_price: 45, status: 'pending' }, error: null }; return { data: null, error: null }; } };
}
const ctx = (d, o = {}) => ({ db: d, salonId: SALON, phone: '+5511912345678', eventId: 'ev', preview: false, name: 'João Silva', ...o });
const send = (d, text, selection = null) => guided.guidedReply(ctx(d), { text, selection });

test('fluxo completo: oi → menu → agendar (1) → serviço → pula profissional único → data → hora → nome do WhatsApp → confirmar → reserva', async () => {
  const d = db();
  let r = await send(d, 'oi');
  assert.equal(r.session.step, 'MAIN_MENU'); assert.match(r.text, /Bem-vindo\(a\) ao \*Studio X\*/); assert.match(r.text, /1\. 📅 Agendar horário/); assert.match(r.text, /5\. 💬 Falar com atendente/);
  assert.equal(r.messages[0].type, 'interactive'); assert.equal(r.messages[0].payload.body.sections[0].rows[0].rowId, 'menu_book');
  r = await send(d, '1');
  assert.equal(r.session.step, 'SELECT_SERVICE'); assert.match(r.text, /1\. Corte Degradê — R\$ 45,00 \(40 min\)/); assert.match(r.text, /Digite \*V\* para voltar/);
  r = await send(d, '', 'ab12cd.1');
  assert.equal(r.session.step, 'SELECT_SERVICE', 'id de menu antigo é ignorado e a etapa se repete');
  r = await send(d, '1');
  assert.equal(r.session.step, 'SELECT_DATE', 'um profissional só: pula a escolha'); assert.equal(r.session.data.flow.professionalId, PRO);
  assert.match(r.text, /1\. Hoje \(\d\d\/\d\d - \w+\)/); assert.match(r.text, /Digitar outra data/);
  r = await send(d, '2');
  assert.equal(r.session.step, 'SELECT_TIME'); assert.match(r.text, /1\. 09:00 — Manhã/); assert.match(r.text, /3\. 19:00 — Noite/);
  r = await send(d, '14:00');
  assert.equal(r.session.step, 'CONFIRM_NAME'); assert.equal(r.session.data.flow.start, '14:00'); assert.match(r.text, /Usar "João Silva"/);
  r = await send(d, '', 'use_pushname');
  assert.equal(r.session.step, 'CONFIRM_BOOKING'); assert.match(r.text, /Procedimento:\* Corte Degradê \(R\$ 45,00\)/); assert.match(r.text, /Cliente:\* João Silva/); assert.match(r.text, /1\. ✅ Confirmar/);
  assert.ok(!d.calls.some(c => c.name === 'whatsapp_book_appointment_v2'), 'nada reservado antes de confirmar');
  r = await send(d, '', 'confirm_yes');
  const call = d.calls.find(c => c.name === 'whatsapp_book_appointment_v2');
  assert.equal(call.args.p_client_name, 'João Silva'); assert.equal(call.args.p_professional_id, PRO); assert.equal(call.args.p_start, '14:00'); assert.equal(call.args.p_event_id, 'ev');
  assert.match(r.text, /Solicitação registrada/); assert.match(r.text, /agendafacil365\.com\.br\/s\/studio-x/); assert.equal(r.session.step, 'IDLE');
  assert.ok(d.upserts.every(u => u.table !== 'whatsapp_chatbot_sessions' || u.row.salon_id === SALON), 'sessão sempre do salão do evento');
});

test('voltar (V) regride uma etapa; 0 volta ao menu; data digitada; profissional "qualquer"', async () => {
  const d = db({ pros: 2 });
  await send(d, 'menu'); await send(d, '1'); await send(d, '1');
  let r = await send(d, 'x');
  assert.equal(r.session.step, 'SELECT_PROFESSIONAL'); assert.match(r.text, /1\. Qualquer profissional/); assert.match(r.text, /3\. Pro 1/);
  r = await send(d, 'v'); assert.equal(r.session.step, 'SELECT_SERVICE');
  r = await send(d, '2'); r = await send(d, '1'); assert.equal(r.session.data.flow.professionalId, null); assert.equal(r.session.step, 'SELECT_DATE');
  r = await send(d, '25/12'); assert.equal(r.session.step, 'SELECT_TIME'); assert.match(r.session.data.flow.date, /-12-25$/);
  r = await send(d, '0'); assert.equal(r.session.step, 'MAIN_MENU'); assert.deepEqual(r.session.data.flow, undefined);
});

test('texto livre: IA responde curto e a etapa é reapresentada; sem IA, só repete', async () => {
  const d = db();
  await send(d, 'oi'); await send(d, '1');
  const r = await guided.guidedReply(ctx(d), { text: 'vocês fazem luzes?' }, { ai: async () => ({ text: 'Fazemos sim, a partir de R$ 120.' }) });
  assert.equal(r.model, 'guided_ai_fallback'); assert.match(r.text, /^Fazemos sim[\s\S]*1\. Corte Degradê/); assert.equal(r.session.step, 'SELECT_SERVICE');
  const r2 = await send(d, 'blablabla'); assert.equal(r2.model, 'guided_repeat'); assert.match(r2.text, /Não entendi/);
});

test('atendente: pausa com prazo, aviso no painel, silêncio até vencer, "0" libera', async () => {
  const d = db();
  let r = await send(d, 'atendente');
  assert.equal(r.handoff, true); assert.equal(r.session.step, 'HUMAN_HANDOFF'); assert.ok(r.session.takeoverUntil);
  assert.ok(d.upserts.some(u => u.table === 'whatsapp_conversation_state' && u.row.human_takeover === true && u.row.taken_over_by === null));
  assert.ok(d.inserts.some(i => i.table === 'admin_notifications' && i.row.type === 'whatsapp_handoff'));
  r = await send(d, 'oi'); assert.equal(r.model, 'guided_paused'); assert.equal(r.messages.length, 0); assert.equal(r.text, '');
  r = await send(d, '0'); assert.equal(r.session.step, 'MAIN_MENU'); assert.equal(r.session.takeoverUntil, null);
});

test('desligado, tabela ausente, mídia ou nota de avaliação: devolve null (caminho clássico assume)', async () => {
  assert.equal(await send(db({ guided: false }), 'oi'), null);
  assert.equal(await send(db({ sessionTable: false }), 'oi'), null);
  assert.equal(await guided.guidedReply(ctx(db()), { text: '', media: { type: 'image' } }), null);
  assert.equal(await guided.guidedReply(ctx(db()), { text: 'Excelente', selection: 'rate.5' }), null);
});

test('modo numerado: só texto; simulador (preview) não grava nem reserva', async () => {
  const d = db({ mode: 'numbered' });
  const r = await send(d, 'oi'); assert.equal(r.messages[0].type, 'text');
  const p = db();
  let s = null;
  for (const t of ['oi', '1', '1', '1', '1', 'Maria Souza', '1']) { const x = await guided.guidedReply(ctx(p, { preview: true, eventId: undefined }), { text: t }, { session: s }); s = x.session; }
  assert.equal(s.step, 'IDLE'); assert.ok(!p.calls.some(c => c.name === 'whatsapp_book_appointment_v2')); assert.equal(p.upserts.length, 0);
});

test('migração: aditiva, idempotente, RLS e índice por salão+telefone', () => {
  const sql = fs.readFileSync(path.join(root, 'MIGRATION_TYPEBOT_EVOLUTION_237.sql'), 'utf8');
  assert.match(sql, /^BEGIN;/m); assert.match(sql, /^COMMIT;/m);
  assert.doesNotMatch(sql, /^\s*(DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE)/m);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.whatsapp_chatbot_sessions/);
  assert.match(sql, /ON public\.whatsapp_chatbot_sessions \(salon_id, client_phone\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/); assert.match(sql, /guided_render_mode IN \('hybrid', 'numbered', 'native'\)/);
  for (const s of guided.STEPS) assert.ok(sql.includes(`'${s}'`), s);
});
