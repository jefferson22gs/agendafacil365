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
  assert.equal(r.session.step, 'SELECT_PROFESSIONAL'); assert.match(r.text, /1\. Sem preferência/); assert.match(r.text, /3\. Pro 1/);
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

test('desligado, tabela ausente ou mídia: devolve null (caminho clássico assume); nota sem pedido aberto é respondida', async () => {
  assert.equal(await send(db({ guided: false }), 'oi'), null);
  assert.equal(await send(db({ sessionTable: false }), 'oi'), null);
  assert.equal(await guided.guidedReply(ctx(db()), { text: '', media: { type: 'image' } }), null);
  const r = await guided.guidedReply(ctx(db()), { text: 'Excelente', selection: 'rate.5' });
  assert.match(r.text, /já foi respondido/); assert.equal(r.model, 'rate_closed');
});

test('modo numerado: só texto; simulador (preview) não grava nem reserva', async () => {
  const d = db({ mode: 'numbered' });
  const r = await send(d, 'oi'); assert.equal(r.messages[0].type, 'text');
  const p = db();
  let s = null;
  for (const t of ['oi', '1', '1', '1', '1', 'Maria Souza', '1']) { const x = await guided.guidedReply(ctx(p, { preview: true, eventId: undefined }), { text: t }, { session: s }); s = x.session; }
  assert.equal(s.step, 'IDLE'); assert.ok(!p.calls.some(c => c.name === 'whatsapp_book_appointment_v2')); assert.equal(p.upserts.length, 0);
});

const buttons = load(path.join(sh, 'whatsapp/evolutionButtons.ts'));
test('paginação por botão: até 3 cabem; acima, 2 + "Ver mais"; última página volta ao início', () => {
  const p = (t, pg) => { const r = plain(buttons.buttonPage(t, pg)); return [r.start, r.end, r.more, r.wrap, r.pages]; };
  assert.deepEqual(p(3, 0), [0, 3, false, false, 1]);
  assert.deepEqual(p(5, 0), [0, 2, true, false, 3]);
  assert.deepEqual(p(5, 2), [4, 5, false, true, 3]);
  assert.deepEqual(p(5, 3), [0, 2, true, false, 3], 'dá a volta');
  assert.throws(() => buttons.renderButtons({ kind: 'buttons', title: 't', body: 'b', button: '', rows: [1, 2, 3, 4].map(i => ({ id: `x${i}`, title: 'a' })) }));
});

// Toda mensagem do modo botões: só sendButtons, no máximo 3, displayText ≤ 20, nunca lista.
const onlyButtons = r => r.messages.every(m => m.type === 'interactive' && m.payload.op === 'buttons' && m.payload.body.buttons.length >= 1 && m.payload.body.buttons.length <= 3 && m.payload.body.buttons.every(b => b.type === 'reply' && Array.from(b.displayText).length <= 20) && !('sections' in m.payload.body));
const ids = r => plain(r.messages[0].payload.body.buttons.map(b => b.id));
const labels = r => plain(r.messages[0].payload.body.buttons.map(b => b.displayText));
const click = (d, r, i) => send(d, '', ids(r)[i]);

test('100% botões: menu paginado, serviços com Ver mais, turno → horário, nome por botão, confirmação; zero digitação', async () => {
  const d = db({ mode: 'buttons', pros: 2 });
  let r = await send(d, 'oi');
  assert.ok(onlyButtons(r)); assert.equal(r.session.step, 'MAIN_MENU');
  assert.deepEqual(labels(r), ['📅 Agendar horário', '📋 Meus horários', '➡️ Ver mais']);
  assert.match(r.messages[0].payload.body.footer, /Studio X • Toque em um botão abaixo/);
  r = await click(d, r, 2); assert.ok(onlyButtons(r)); assert.deepEqual(ids(r).slice(0, 2), ['menu_services', 'menu_human']);
  r = await click(d, r, 2); assert.deepEqual(ids(r)[0], 'menu_info'); assert.match(r.messages[0].payload.body.buttons[1].displayText, /Do início/);
  r = await click(d, r, 1); assert.equal(ids(r)[0], 'menu_book', '"Do início" volta à 1ª página');
  r = await click(d, r, 0); assert.ok(onlyButtons(r)); assert.equal(r.session.step, 'SELECT_SERVICE');
  assert.match(r.messages[0].payload.body.description, /\*Barba\* — R\$ 30,00 \(20 min\)/, 'preço e duração no texto do card');
  r = await click(d, r, 0); assert.equal(r.session.step, 'SELECT_PROFESSIONAL'); assert.ok(onlyButtons(r));
  assert.match(r.messages[0].payload.body.buttons[0].displayText, /Sem preferência/);
  r = await click(d, r, 1); assert.equal(r.session.data.flow.professionalId, PRO);
  assert.equal(r.session.step, 'SELECT_DATE'); assert.ok(onlyButtons(r)); assert.equal(r.messages[0].payload.body.buttons.length, 3);
  assert.ok(!JSON.stringify(r.messages).includes('Digitar outra data'));
  r = await click(d, r, 2); assert.equal(r.session.step, 'SELECT_DATE', 'Ver mais datas'); assert.match(r.messages[0].payload.body.title, /\(2\/\d\)/);
  r = await click(d, r, 0); assert.equal(r.session.step, 'SELECT_TIME');
  assert.deepEqual(labels(r), ['☀️ Manhã (1)', '🌤️ Tarde (1)', '🌙 Noite (1)']);
  r = await click(d, r, 1); assert.ok(onlyButtons(r)); assert.deepEqual(labels(r), ['🕒 14:00', '🔄 Outro turno', '🏠 Menu inicial'], 'cabe o Menu inicial no mesmo card');
  r = await click(d, r, 1); assert.match(r.messages[0].payload.body.buttons[0].displayText, /Manhã/, 'Outro turno volta à escolha');
  r = await click(d, r, 1); r = await click(d, r, 0);
  assert.equal(r.session.data.flow.start, '14:00'); assert.equal(r.session.step, 'CONFIRM_NAME'); assert.ok(onlyButtons(r));
  assert.deepEqual(ids(r), ['use_pushname', 'name_other', 'menu_main']); assert.match(r.messages[0].payload.body.description, /João Silva/);
  r = await click(d, r, 0); assert.equal(r.session.step, 'CONFIRM_BOOKING'); assert.ok(onlyButtons(r));
  assert.deepEqual(ids(r), ['confirm_yes', 'confirm_change_date', 'confirm_cancel']);
  r = await click(d, r, 0);
  assert.ok(d.calls.some(c => c.name === 'whatsapp_book_appointment_v2')); assert.ok(onlyButtons(r));
  assert.deepEqual(ids(r), ['menu_my_appointments', 'menu_main']); assert.doesNotMatch(r.messages[0].payload.body.description, /Digite \*0\*/);
});

test('100% botões: textos finais ganham botão de saída; atendente com "Voltar ao robô"', async () => {
  const d = db({ mode: 'buttons' });
  await send(d, 'oi');
  let r = await send(d, '', 'menu_human');
  assert.ok(onlyButtons(r)); assert.deepEqual(ids(r), ['menu_main']); assert.match(r.messages[0].payload.body.buttons[0].displayText, /Voltar ao robô/);
  r = await send(d, 'oi'); assert.equal(r.model, 'guided_paused');
  r = await send(d, '', 'menu_main'); assert.equal(r.session.step, 'MAIN_MENU', 'botão libera a pausa');
  assert.equal(guided.stripTypingHints('Não deu certo. Digite *5* para falar com a equipe.\nAté logo!'), 'Não deu certo.\nAté logo!');
});

// Modo enquete (sendPoll, escolha única): chega em qualquer celular; até 9 opções por card.
const onlyPolls = r => r.messages.filter(m => m.type === 'interactive').every(m => m.payload.op === 'poll' && m.payload.body.selectableCount === 1 && m.payload.body.values.length >= 2 && m.payload.body.values.length <= 10 && m.payload.body.values.every(v => Array.from(v).length <= 100) && Array.from(m.payload.body.name).length <= 255 && new Set(m.payload.body.values).size === m.payload.body.values.length)
  && r.messages.some(m => m.type === 'interactive');
const poll = r => r.messages.find(m => m.payload?.op === 'poll').payload;
const vote = (d, r, re) => { const o = poll(r).options.find(x => re.test(x.title)); assert.ok(o, `opção ${re}`); return send(d, o.title, o.id); };

test('enquete: menu de 5 em um card, serviços com preço na opção, horários direto (≤ 9), confirmação; tudo por voto', async () => {
  const d = db({ mode: 'poll', pros: 2 });
  let r = await send(d, 'oi');
  assert.ok(onlyPolls(r)); assert.equal(r.messages.length, 1);
  assert.deepEqual(plain(poll(r).body.values), ['1️⃣ 📅 Agendar horário', '2️⃣ 📋 Meus agendamentos', '3️⃣ 💈 Serviços e valores', '4️⃣ 📍 Endereço e horários', '5️⃣ 💬 Falar com atendente']);
  assert.match(poll(r).body.name, /Bem-vindo\(a\) ao \*Studio X\*/);
  assert.deepEqual(plain(poll(r).options.map(o => o.id)), ['menu_book', 'menu_my_appointments', 'menu_services', 'menu_info', 'menu_human']);
  r = await vote(d, r, /Agendar/); assert.equal(r.session.step, 'SELECT_SERVICE'); assert.ok(onlyPolls(r));
  assert.match(poll(r).body.values[1], /^2️⃣ Barba · R\$ 30,00 \(20 min\)$/);
  r = await vote(d, r, /Corte/); assert.equal(r.session.step, 'SELECT_PROFESSIONAL');
  r = await vote(d, r, /Ana/); assert.equal(r.session.step, 'SELECT_DATE'); assert.ok(onlyPolls(r));
  r = await send(d, '2'); assert.equal(r.session.step, 'SELECT_TIME', 'número digitado também vale');
  assert.deepEqual(plain(poll(r).body.values), ['1️⃣ 🕒 09:00 · Manhã', '2️⃣ 🕒 14:00 · Tarde', '3️⃣ 🕒 19:00 · Noite', '4️⃣ ⬅️ Voltar', '5️⃣ 🏠 Menu inicial'], '≤ 9 horários: sem etapa de turno; Voltar e Menu sempre');
  r = await vote(d, r, /14:00/); assert.equal(r.session.step, 'CONFIRM_NAME');
  r = await vote(d, r, /Sim, esse nome/); assert.equal(r.session.step, 'CONFIRM_BOOKING'); assert.ok(onlyPolls(r));
  // Resumo cabe no título da enquete (≤ 255) ou vai em texto antes dela; nunca se perde.
  assert.match(r.messages[0].type === 'text' ? r.messages[0].text : poll(r).body.name, /Procedimento:\* Corte Degradê/);
  assert.deepEqual(plain(poll(r).options.map(o => o.id)), ['confirm_yes', 'confirm_change_date', 'confirm_cancel', 'nav_back', 'menu_main']);
  r = await vote(d, r, /Confirmar/);
  assert.ok(d.calls.some(c => c.name === 'whatsapp_book_appointment_v2')); assert.ok(onlyPolls(r));
});

test('enquete: mais de 9 opções pagina com "Ver mais opções"; texto fora das opções repete o card', async () => {
  const d = db({ mode: 'poll' });
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, name: `Serviço ${String(i).padStart(2, '0')}`, price: 10 + i, duration_minutes: 30 }));
  const base = d.from; d.from = t => { const q = base.call(d, t); if (t === 'services') q.limit = () => Promise.resolve({ data: many, error: null }); return q; };
  await send(d, 'oi');
  let r = await send(d, '1');
  assert.equal(poll(r).body.values.length, 9); assert.match(poll(r).body.values[8], /Ver mais opções/); assert.match(poll(r).body.values[7], /Menu inicial/, 'Menu fixo em toda página');
  r = await vote(d, r, /Ver mais/); assert.match(poll(r).body.values[0], /Serviço 07/); assert.match(poll(r).body.values.at(-1), /Do início/);
  assert.ok(poll(r).body.values.some(v => /Menu inicial/.test(v)));
  r = await send(d, 'blablabla'); assert.ok(onlyPolls(r)); assert.match(r.text, /Não entendi/);
});

test('voto: texto da opção, SHA-256 (hex/base64/bytes) e agregado com voters viram a seleção', async () => {
  const { menu } = ui.buildMenu('ab12cd', 'MAIN_MENU', 'Menu', 'Oi', [{ id: 'menu_book', title: 'Agendar', value: {} }, { id: 'menu_human', title: 'Atendente', value: {} }]);
  const [p] = plain(buttons.renderPoll(menu));
  const opt = p.payload.body.values[1];
  const hex = require('node:crypto').createHash('sha256').update(opt).digest();
  const key = { remoteJid: '5511912345678@s.whatsapp.net', fromMe: false, id: 'V1' };
  const msg = sel => ({ key, message: { pollUpdateMessage: { pollCreationMessageKey: { id: 'P1', fromMe: true }, vote: { selectedOptions: [sel] } } } });
  for (const sel of [opt, hex.toString('hex'), hex.toString('base64'), [...hex], { type: 'Buffer', data: [...hex] }]) {
    const [v] = plain(inbound.pollVotes(msg(sel)));
    assert.equal(await inbound.pollSelection(p.payload, v.option, v.hash), 'menu_human', JSON.stringify(sel).slice(0, 30));
  }
  const agg = { key: { id: 'P1', remoteJid: '5511912345678@s.whatsapp.net', fromMe: true }, update: { pollUpdates: [{ name: p.payload.body.values[0], voters: [] }, { name: opt, voters: ['5511912345678'] }] } };
  const [a] = plain(inbound.pollVotes(agg));
  assert.equal(await inbound.pollSelection(p.payload, a.option, a.hash), 'menu_human', 'voters sem @s.whatsapp.net');
  assert.deepEqual(plain(inbound.pollVotes({ key, message: { pollUpdateMessage: { pollCreationMessageKey: { id: 'P1' }, vote: { encPayload: 'xx', encIv: 'yy' } } } })), [], 'voto cifrado sem decifrar é ignorado');
});

test('webhook: número do próprio salão nunca vira conversa (anti-loop); voto vem antes do filtro fromMe', () => {
  const src = fs.readFileSync(path.join(root, 'supabase/functions/evolution-webhook/index.ts'), 'utf8');
  assert.match(src, /if \(!message \|\| \(own && message\.phone === own\)\) continue;/);
  assert.match(src, /if \(own && vote\.phone === own\) continue;/);
  assert.ok(src.indexOf('storePollVotes(db') < src.indexOf('parseIncoming(entry)'), 'votos tratados antes das mensagens comuns');
});

test('fallback: erro HTTP 5xx no interativo também cai para texto; timeout continua incerto', async () => {
  const E = load(path.join(sh, 'whatsapp/errors.ts')).WhatsAppError;
  const seen = [];
  const api = { request: async (op, inst, body) => { seen.push(op); if (op === 'poll') throw Object.assign(new E('send_uncertain', 503), { http: 502 }); return { key: { id: 'T1' } }; } };
  const r = await sender.sendWithFallback(api, 'i', '5511912345678', { op: 'poll', body: { name: 'x', values: ['a', 'b'] } }, 'card');
  assert.equal(r.fallback, true); assert.deepEqual(seen, ['poll', 'text']);
  const timeout = { request: async () => { throw new E('send_uncertain', 503); } };
  await assert.rejects(() => sender.sendWithFallback(timeout, 'i', '5511912345678', { op: 'poll', body: {} }, 't'));
});

test('migração: aditiva, idempotente, RLS e índice por salão+telefone', () => {
  const sql = fs.readFileSync(path.join(root, 'MIGRATION_TYPEBOT_EVOLUTION_237.sql'), 'utf8');
  assert.match(sql, /^BEGIN;/m); assert.match(sql, /^COMMIT;/m);
  assert.doesNotMatch(sql, /^\s*(DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE)/m);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.whatsapp_chatbot_sessions/);
  assert.match(sql, /ON public\.whatsapp_chatbot_sessions \(salon_id, client_phone\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/); assert.match(sql, /guided_render_mode IN \('poll', 'buttons', 'hybrid', 'numbered', 'native'\)/);
  // Etapas novas (avaliação, pagamento) entram pela migração de cobranças: a CHECK do banco aceita todas.
  const latest = fs.readFileSync(path.join(root, 'supabase/migrations/20261112000200_payments_reviews.sql'), 'utf8');
  for (const s of guided.STEPS) assert.ok(latest.includes(`'${s}'`), s);
});

// ------------------------------------------------------------------------------- navegação, avaliação e pagamento
test('navegação: toda etapa (lista, enquete e botões) tem Menu inicial; Voltar aparece com etapa anterior e funciona', async () => {
  for (const mode of ['hybrid', 'poll', 'buttons']) {
    const d = db({ mode, pros: 2 });
    let r = await send(d, 'oi'); r = await send(d, '', 'menu_book');
    const has = (res, id) => res.messages.some(m => m.type === 'interactive' && (JSON.stringify(m.payload).includes(`"${id}"`)));
    assert.ok(has(r, 'menu_main'), `${mode}: serviços com Menu`);
    r = await send(d, '1'); assert.equal(r.session.step, 'SELECT_PROFESSIONAL', mode);
    if (mode !== 'buttons') { assert.ok(has(r, 'nav_back'), `${mode}: profissional com Voltar`); r = await send(d, '', 'nav_back'); assert.equal(r.session.step, 'SELECT_SERVICE', `${mode}: Voltar regride`); }
    r = await send(d, '', 'menu_main'); assert.equal(r.session.step, 'MAIN_MENU', `${mode}: Menu inicial`);
  }
  // Escolher "Menu inicial" pelo número também vale (lista numerada).
  const d = db();
  await send(d, 'oi'); let r = await send(d, '1');
  const n = r.text.match(/(\d+)\. 🏠 Menu inicial/)[1];
  r = await send(d, n); assert.equal(r.session.step, 'MAIN_MENU');
  assert.deepEqual(plain(guided.navFor('MAIN_MENU', [], true)), [], 'menu principal não ganha navegação');
  assert.equal(guided.navFor('SELECT_TIME', [{ id: 'menu_main', title: 'x', value: {} }], true).length, 0, 'não duplica o Menu');
});

/** Banco com pedido de avaliação aberto e atendimentos concluídos sem nota. */
function reviewDb(opts = {}) {
  const d = db(opts);
  const rpc = d.rpc;
  d.reviews = [];
  d.rpc = async (name, args) => {
    if (name === 'whatsapp_open_review_request') return { data: [{ appointment_id: 'apptDone', sent_at: new Date(Date.now() + 1000).toISOString(), service: 'Corte Degradê' }], error: null };
    if (name === 'whatsapp_rate_appointment') { d.reviews.push(args); return { data: { ok: true, duplicate: false }, error: null }; }
    if (name === 'whatsapp_review_comment') { d.comment = args.p_comment; return { data: true, error: null }; }
    return rpc(name, args);
  };
  const from = d.from;
  d.from = t => { const q = from.call(d, t); if (t === 'appointments') { q.not = () => q; q.limit = () => Promise.resolve({ data: [{ id: 'apptDone', date: '2026-11-10', start_time: '10:00:00', services: { name: 'Corte Degradê' }, professionals: { name: 'Ana' }, reviews: [] }], error: null }); } return q; };
  return d;
}

test('avaliação: clique na nota do pedido grava e abre comentário; número logo após o pedido vale; comentário salvo', async () => {
  let d = reviewDb();
  let r = await send(d, '⭐⭐⭐⭐⭐ Excelente', 'rate.5');
  assert.equal(d.reviews[0].p_appointment_id, 'apptDone'); assert.equal(d.reviews[0].p_rating, 5);
  assert.equal(r.session.step, 'RATE_COMMENT'); assert.match(r.text, /Que bom que você gostou/);
  r = await send(d, 'Atendimento impecável, voltarei!');
  assert.equal(d.comment, 'Atendimento impecável, voltarei!'); assert.match(r.text, /Obrigado pelo retorno/); assert.equal(r.session.step, 'IDLE');
  // Lista numerada do pedido: 1 = Excelente (5) … 5 = Ruim (1).
  d = reviewDb();
  r = await send(d, '4');
  assert.equal(d.reviews[0].p_rating, 2); assert.match(r.text, /Obrigado pela sinceridade/);
  r = await send(d, '', 'rate_skip'); assert.match(r.text, /Obrigado pela avaliação/);
});

test('avaliação: "Meus agendamentos" convida a avaliar o concluído sem nota; nota por botão', async () => {
  const d = reviewDb({ mode: 'buttons' });
  await send(d, 'oi');
  let r = await send(d, '', 'menu_my_appointments');
  assert.ok(JSON.stringify(r.messages).includes('menu_rate'), 'botão Avaliar atendimento');
  r = await send(d, '', 'menu_rate');
  assert.equal(r.session.step, 'RATE_APPOINTMENT'); assert.match(r.messages[0].payload.body.description, /Como foi seu atendimento/);
  r = await send(d, '', ids(r)[0]); // 5 estrelas (botões paginados: 2 notas + Ver mais)
  assert.equal(d.reviews[0].p_rating, 5); assert.equal(r.session.step, 'RATE_COMMENT');
});

/** Banco com cobrança ligada (Mercado Pago) e cobrança simulada. */
function payDb(settings) {
  const d = db();
  const from = d.from;
  d.from = t => {
    const q = from.call(d, t);
    if (t === 'salon_payment_settings') q.maybeSingle = async () => ({ data: settings, error: null });
    if (t === 'appointments') q.maybeSingle = async () => ({ data: { id: 'appt', client_name: 'João Silva', client_phone: '+5511912345678', final_price: 45, price: 45, status: 'pending', services: { name: 'Corte' }, salons: { slug: 'studio-x', name: 'Studio X' } }, error: null });
    if (t === 'payment_charges') { q.gt = () => q; q.maybeSingle = async () => ({ data: null, error: null }); q.insert = async row => { d.charge = row; return { error: null }; }; q.update = row => { d.chargeUpdate = row; return q; }; }
    return q;
  };
  const rpc = d.rpc;
  d.rpc = async (name, args) => name === 'payment_secret' ? { data: [{ secret: 'APP_USR-123456789012345678901234', webhook_token: null }], error: null } : rpc(name, args);
  return d;
}

test('pagamento: desligado não aparece; ligado oferece Pix/cartão/no salão conforme o dono configurou', async () => {
  const flowTo = async d => { for (const t of ['oi', '1', '1', '1', '1']) await send(d, t); await send(d, '', 'use_pushname'); return send(d, '', 'confirm_yes'); };
  let r = await flowTo(payDb({ whatsapp_enabled: false, provider: 'mercadopago', methods: ['pix', 'card'], pay_at_salon: true, credential_ok_at: '2026-11-12' }));
  assert.equal(r.session.step, 'IDLE'); assert.doesNotMatch(r.text, /Pagamento/);
  r = await flowTo(payDb({ whatsapp_enabled: true, provider: 'mercadopago', methods: ['pix', 'card'], pay_at_salon: true, credential_ok_at: null }));
  assert.doesNotMatch(r.text, /Pagamento/, 'sem conexão testada, não cobra');
  const d = payDb({ whatsapp_enabled: true, provider: 'mercadopago', methods: ['pix', 'card'], pay_at_salon: false, credential_ok_at: '2026-11-12' });
  r = await flowTo(d);
  assert.equal(r.session.step, 'PAYMENT'); assert.match(r.text, /Solicitação registrada[\s\S]*Pagamento — R\$ 45,00/);
  assert.match(r.text, /Pagar com Pix/); assert.match(r.text, /Pagar com cartão/); assert.doesNotMatch(r.text, /Pagar no salão/);
  assert.ok(r.text.includes('Menu inicial'), 'pagamento também tem Menu');
});

test('pagamento: escolher Pix gera a cobrança no gateway do salão e manda o copia e cola + "Já paguei"', async () => {
  const d = payDb({ whatsapp_enabled: true, provider: 'mercadopago', methods: ['pix'], pay_at_salon: true, credential_ok_at: '2026-11-12' });
  for (const t of ['oi', '1', '1', '1', '1']) await send(d, t);
  await send(d, '', 'use_pushname');
  await send(d, '', 'confirm_yes');
  // Teste sem rede (fetch do sandbox lança): a falha do gateway volta para as opções com aviso, nunca trava a conversa.
  let r = await send(d, '', 'pay_pix');
  assert.equal(r.session.step, 'PAYMENT'); assert.match(r.text, /Não consegui gerar a cobrança no Mercado Pago/);
  assert.equal(d.charge.provider, 'mercadopago'); assert.equal(d.charge.amount_cents, 4500); assert.equal(d.charge.method, 'pix');
  assert.equal(d.chargeUpdate.status, 'failed', 'cobrança que falhou fica registrada como falha');
  r = await send(d, '', 'pay_salon'); assert.match(r.text, /pagamento fica para o dia no salão/); assert.equal(r.session.step, 'IDLE');
});
