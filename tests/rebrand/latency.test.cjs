// Latência do atendente + "nunca responder grupo". Sem rede e sem banco real. Rodar: node --test tests/rebrand/latency.test.cjs
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
  vm.runInNewContext(out, { exports, require: req, crypto: require('node:crypto').webcrypto, Deno: { env: { get: () => undefined } }, TextEncoder, TextDecoder, Response, URL, AbortSignal, setTimeout, console: { warn() {} }, fetch: () => { throw new Error('rede proibida'); } });
  return exports;
}
const L = load(path.join(sh, 'whatsapp/latency.ts'));
const inbound = load(path.join(sh, 'whatsapp/inbound.ts'));
const evo = load(path.join(sh, 'whatsapp/evolution.ts'));
const outbox = load(path.join(sh, 'whatsapp/outbox.ts'));
const domain = load(path.join(sh, 'whatsapp/chatbot-domain.ts'));
const chatbot = load(path.join(sh, 'whatsapp/chatbot.ts'));
const plain = v => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------- gate, prioridade, kick
test('gate: conversa 1 s após o último envio; campanha continua 3 s; pausa (+5 min) vale para todos', () => {
  const t = 1_000_000;
  // Último claim em t: gate normal até t+3 s.
  assert.equal(L.gateOpen('marketing', t + 3000, t, t + 1000), false, 'campanha espera 3 s');
  assert.equal(L.gateOpen('chatbot', t + 3000, t, t + 999), false, 'conversa espera 1 s');
  assert.equal(L.gateOpen('chatbot', t + 3000, t, t + 1000), true);
  assert.equal(L.gateOpen('marketing', t + 3000, t, t + 3000), true);
  // Desconectado/limite: next_available_at = +5 min, além do claim + 3 s -> conversa também espera.
  assert.equal(L.gateOpen('chatbot', t + 300_000, t, t + 5000), false, 'nunca fura pausa');
  assert.equal(L.gateOpen('chatbot', t + 300_000, null, t + 5000), false);
  assert.equal(L.gateOpen('chatbot', t, null, t), true);
});

test('claim: conversa antes de campanha, mesmo agendada depois; ordem estável dentro de cada grupo', () => {
  const q = [
    { id: 'm1', category: 'marketing', scheduledFor: 1, createdAt: 1 },
    { id: 'm2', category: 'marketing', scheduledFor: 2, createdAt: 2 },
    { id: 'c2', category: 'chatbot', scheduledFor: 50.001, createdAt: 50 },
    { id: 'c1', category: 'chatbot', scheduledFor: 50, createdAt: 50 },
    { id: 't1', category: 'transactional', scheduledFor: 3, createdAt: 3 },
  ];
  assert.deepEqual(plain(L.claimOrder(q).map(i => i.id)), ['c1', 'c2', 'm1', 'm2', 't1']);
});

test('claim inbound por conversa: nunca duas mensagens do mesmo telefone em paralelo nem fora de ordem', () => {
  const now = 10_000;
  const ev = (id, phone, createdAt, extra = {}) => ({ id, salonId: 's', phone, status: 'pending', attempts: 0, nextAttemptAt: 0, createdAt, ...extra });
  const a1 = ev('a1', '+551', 1), a2 = ev('a2', '+551', 2), b1 = ev('b1', '+552', 3);
  assert.equal(L.claimInbound([a2, a1, b1], now).id, 'a1', 'mais antigo primeiro');
  // a1 em processamento: a2 espera, b1 (outra conversa) segue em paralelo.
  const busy = { ...a1, status: 'processing', leaseUntil: now + 60_000 };
  assert.equal(L.claimInbound([busy, a2, b1], now).id, 'b1');
  // Lease expirado não trava a conversa (a recuperação devolve para pending antes do claim).
  assert.equal(L.claimInbound([{ ...busy, leaseUntil: now - 1 }, a2], now).id, 'a2');
  // Evento antigo aguardando nova tentativa (next_attempt_at futuro) não bloqueia as seguintes.
  assert.equal(L.claimInbound([{ ...a1, attempts: 1, nextAttemptAt: now + 60_000 }, a2], now).id, 'a2');
});

test('kick coalescido: rajada da mesma conversa aciona um worker só; conversas diferentes, um cada', () => {
  const now = 100_000;
  const ev = (id, phone, createdAt) => ({ id, salonId: 's', phone, status: 'pending', attempts: 0, nextAttemptAt: createdAt, createdAt });
  const rows = [];
  let kicks = 0;
  for (const [i, phone] of [[1, '+551'], [2, '+551'], [3, '+551'], [4, '+552'], [5, '+553'], [6, '+553']]) {
    const e = ev(`e${i}`, phone, now - 10 + i);
    if (L.shouldKick(e, rows, now)) kicks++;
    rows.push(e);
  }
  assert.equal(kicks, 3, '1 por conversa (+551, +552, +553)');
  // Evento parado (pendente há mais de 30 s ou já tentado) não impede novo kick: nada fica esperando só o cron.
  assert.equal(L.shouldKick(ev('n', '+551', now), [{ ...ev('old', '+551', now - 40_000) }], now), true);
  assert.equal(L.shouldKick(ev('n', '+551', now), [{ ...ev('old', '+551', now - 1000), attempts: 1 }], now), true);
});

test('envio imediato: itens esperados e orçamento de espera limitado', () => {
  assert.equal(L.expectedSends({ text: '' }), 0);
  assert.equal(L.expectedSends({ text: 'oi' }), 1);
  assert.equal(L.expectedSends({ text: 'x', messages: [{ type: 'image', text: '' }, { type: 'text', text: 'pix' }, { type: 'text', text: '' }] }), 2, 'igual ao finish_inbound_v2');
  assert.ok(L.drainBudgetMs(1) >= 3000 && L.drainBudgetMs(6) <= 12_000);
});

// ---------------------------------------------------------------- montagem paralela
test('firstMatches em lotes paralelos = laço sequencial com break (mesmos itens e ordem)', async () => {
  const items = Array.from({ length: 21 }, (_, i) => i);
  const ok = i => i % 3 === 1 || i === 20;
  const sequential = []; for (const i of items) { if (sequential.length >= 4) break; if (ok(i)) sequential.push(i); }
  let inFlight = 0, peak = 0;
  const testFn = async i => { inFlight++; peak = Math.max(peak, inFlight); await new Promise(r => setTimeout(r, 1)); inFlight--; return ok(i); };
  assert.deepEqual(plain(await L.firstMatches(items, testFn, 4, 5)), sequential);
  assert.ok(peak > 1 && peak <= 5, `paralelo e limitado (pico ${peak})`);
  assert.equal(L.dayChunk(12), 2); assert.equal(L.dayChunk(1), 24); assert.equal(L.dayChunk(0), 24);
});

test('available_dates: mesmo resultado do sequencial, em paralelo e com fuso lido uma vez', async () => {
  const salon = '00000000-0000-4000-8000-000000000010', service = '00000000-0000-4000-8000-000000000030';
  const today = Temporal.Now.plainDateISO('America/Sao_Paulo');
  const free = new Set([2, 5, 6, 9, 10, 11, 12, 13].map(n => today.add({ days: n }).toString()));
  const calls = []; let inFlight = 0, peak = 0;
  const db = {
    from(table) {
      calls.push(table);
      const q = { select: () => q, eq: () => q, limit: async () => ({ data: [{ id: 'p1' }, { id: 'p2' }], error: null }), single: async () => ({ data: { name: 'S', timezone: 'America/Sao_Paulo' }, error: null }) };
      return q;
    },
    rpc: async (name, args) => {
      inFlight++; peak = Math.max(peak, inFlight); await new Promise(r => setTimeout(r, 1)); inFlight--;
      return { data: free.has(args.p_date) && args.p_professional_id === 'p2' ? ['10:00'] : [], error: null };
    },
  };
  const r = await domain.executeBotTool({ db, salonId: salon, phone: '+5511912345678', preview: true }, 'available_dates', { serviceId: service });
  assert.deepEqual(plain(r.dates), [...free].slice(0, 7));
  assert.ok(peak > 2, `consultas em paralelo (pico ${peak})`);
  assert.equal(calls.filter(t => t === 'salons').length, 1);
});

test('catálogo no prompt só quando pequeno (evita uma ida extra à IA sem estourar o prompt)', () => {
  assert.ok(chatbot.catalogText([{ id: 's', name: 'Corte', price: 50, duration_minutes: 30 }], [{ id: 'p', name: 'Ana' }]).includes('Corte'));
  assert.equal(chatbot.catalogText(Array.from({ length: 41 }, (_, i) => ({ id: i })), []), null);
  assert.equal(chatbot.catalogText([{ id: 's', name: 'x'.repeat(5000) }], []), null);
});

// Banco simulado genérico: registra leituras e concorrência; nenhuma rede.
function mockDb(tables, rpcs = {}) {
  const reads = []; let inFlight = 0, peak = 0;
  const run = async (table, kind) => {
    reads.push(table); inFlight++; peak = Math.max(peak, inFlight);
    await new Promise(r => setTimeout(r, 2)); inFlight--;
    const v = tables[table];
    if (kind === 'count') return { count: v?.count ?? 0, error: null };
    return { data: typeof v === 'function' ? v() : v ?? null, error: null };
  };
  return {
    reads, get peak() { return peak; },
    from(table) {
      let kind = 'rows';
      const q = {
        select: (_c, o) => { if (o?.head) kind = 'count'; return q; }, eq: () => q, gte: () => q, in: () => q, order: () => q, limit: () => q,
        maybeSingle: () => run(table, 'one'), single: () => run(table, 'one'),
        upsert: async () => { reads.push(`upsert:${table}`); return { error: null }; }, update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
        then: (res, rej) => run(table, kind).then(res, rej),
      };
      return q;
    },
    rpc: async (name, args) => { reads.push(`rpc:${name}`); return rpcs[name] ? rpcs[name](args) : { data: null, error: null }; },
  };
}
const ctxOf = (db, extra = {}) => ({ db, salonId: 's1', phone: '+5511912345678', eventId: 'e1', preview: false, ...extra });

test('chatbot: leituras iniciais em paralelo, sem reler estado/config; fora do horário não chama IA', async () => {
  const db = mockDb({
    whatsapp_conversation_state: null,
    chatbot_settings: { enabled: true, active_days: [], out_of_hours_message: 'Fechado agora.' },
    insights_recipients: null, whatsapp_webhook_events: { count: 1 },
    salons: { name: 'Salão', timezone: 'America/Sao_Paulo' },
  }, { whatsapp_review_comment: () => ({ data: false, error: null }) });
  let typing = 0;
  const r = await chatbot.chatbotReply(ctxOf(db, { typing: () => typing++ }), 'oi, tudo bem?');
  assert.equal(r.model, 'out_of_hours'); assert.equal(r.provider, 'deterministic');
  assert.equal(db.reads.filter(t => t === 'whatsapp_conversation_state').length, 1, 'estado lido uma vez');
  assert.equal(db.reads.filter(t => t === 'chatbot_settings').length, 1, 'config lida uma vez');
  assert.ok(db.peak >= 4, `4 leituras iniciais juntas (pico ${db.peak})`);
  assert.equal(typing, 1, '"digitando" uma vez');
});

test('chatbot: equipe no controle ou bot desligado não manda "digitando" nem resposta', async () => {
  for (const [st, cfg, model] of [[{ human_takeover: true }, { enabled: true }, 'paused'], [null, { enabled: false }, 'disabled']]) {
    const db = mockDb({ whatsapp_conversation_state: st, chatbot_settings: cfg, insights_recipients: null, whatsapp_webhook_events: { count: 0 } });
    let typing = 0;
    const r = await chatbot.chatbotReply(ctxOf(db, { typing: () => typing++ }), 'quero agendar');
    assert.equal(r.text, ''); assert.equal(r.model, model); assert.equal(typing, 0);
  }
});

test('chatbot: rajada (mais de 12 mensagens/min) não chama IA nem manda "digitando"', async () => {
  const db = mockDb({ whatsapp_conversation_state: null, chatbot_settings: { enabled: true }, insights_recipients: null, whatsapp_webhook_events: { count: 13 } });
  let typing = 0;
  const r = await chatbot.chatbotReply(ctxOf(db, { typing: () => typing++ }), 'oi');
  assert.equal(r.model, 'rate_limited'); assert.equal(typing, 0);
});

// ---------------------------------------------------------------- "digitando"
test('presence: rota/corpo da Evolution 2.3.7 e falha nunca propaga', async () => {
  const seen = [];
  const ok = new evo.EvolutionClient('k'.repeat(32), 'https://evo.example.com', async (url, init) => { seen.push([url, JSON.parse(init.body)]); return new Response('{}', { status: 201 }); });
  await evo.sendTyping(ok, 'inst_1', '+5511912345678', 6000);
  assert.deepEqual(plain(seen), [['https://evo.example.com/chat/sendPresence/inst_1', { number: '5511912345678', presence: 'composing', delay: 6000 }]]);
  const down = new evo.EvolutionClient('k'.repeat(32), 'https://evo.example.com', async () => { throw new Error('rede'); });
  await evo.sendTyping(down, 'inst_1', '+5511912345678'); // não lança
  const bad = new evo.EvolutionClient('k'.repeat(32), 'https://evo.example.com', async () => new Response('x', { status: 400 }));
  await evo.sendTyping(bad, 'inst_1', '+5511912345678');
  seen.length = 0;
  await evo.sendTyping(ok, 'inst_1', '120363025246125123@g.us');
  assert.equal(seen.length, 0, 'nunca para grupo');
});

// ---------------------------------------------------------------- nunca grupo/comunidade/canal
const individual = (over = {}) => ({ key: { remoteJid: '5511912345678@s.whatsapp.net', fromMe: false, id: 'ABC123', ...over.key }, pushName: 'Cliente', message: { conversation: 'quero agendar', ...over.message }, ...over.row });
const groupEnvelopes = {
  'grupo @g.us com participant': { key: { remoteJid: '120363025246125123@g.us', fromMe: false, id: 'G1', participant: '5511912345678@s.whatsapp.net' }, pushName: 'X', message: { conversation: 'quero agendar' } },
  'grupo formato antigo (com hífen)': { key: { remoteJid: '5511912345678-1600000000@g.us', fromMe: false, id: 'G2' }, message: { conversation: 'quero agendar' } },
  'hífen sem sufixo de grupo': { key: { remoteJid: '5511912345678-1600000000@s.whatsapp.net', fromMe: false, id: 'G3' }, message: { conversation: 'quero agendar' } },
  'anúncio de comunidade': { key: { remoteJid: '120363111111111111@g.us', fromMe: false, id: 'C1', participant: '5511900000000@s.whatsapp.net' }, message: { extendedTextMessage: { text: 'quero agendar', contextInfo: { parentGroupJid: '120363222222222222@g.us' } } } },
  'contextInfo de comunidade em JID individual': individual({ message: { conversation: undefined, extendedTextMessage: { text: 'quero agendar', contextInfo: { parentGroupJid: '120363222222222222@g.us' } } } }),
  'contextInfo.isGroup': individual({ message: { conversation: undefined, extendedTextMessage: { text: 'quero agendar', contextInfo: { isGroup: true } } } }),
  'groupSubject no contexto': individual({ row: { contextInfo: { groupSubject: 'Clientes VIP' } } }),
  'row.isGroup': individual({ row: { isGroup: true } }),
  'key.participant em JID individual': individual({ key: { participant: '5511900000000@s.whatsapp.net' } }),
  'participantAlt': individual({ key: { participantAlt: '5511900000000@s.whatsapp.net' } }),
  'row.participant': individual({ row: { participant: '5511900000000@s.whatsapp.net' } }),
  'status@broadcast': { key: { remoteJid: 'status@broadcast', fromMe: false, id: 'S1', participant: '5511912345678@s.whatsapp.net' }, message: { conversation: 'quero agendar' } },
  'lista de transmissão': { key: { remoteJid: '1234567890@broadcast', fromMe: false, id: 'B1' }, message: { conversation: 'quero agendar' } },
  'canal @newsletter': { key: { remoteJid: '120363333333333333@newsletter', fromMe: false, id: 'N1' }, message: { conversation: 'quero agendar' } },
  '@lid sem número resolvido': { key: { remoteJid: '123456789012345@lid', fromMe: false, id: 'L1' }, message: { conversation: 'quero agendar' } },
  '@call': { key: { remoteJid: '5511912345678@call', fromMe: false, id: 'K1' }, message: { conversation: 'quero agendar' } },
  'convite de grupo': individual({ message: { conversation: undefined, groupInviteMessage: { groupJid: '120363025246125123@g.us', inviteCode: 'abc' } } }),
  'senderKeyDistribution (grupo)': individual({ message: { senderKeyDistributionMessage: { groupId: '120363025246125123@g.us' } } }),
  'JID em maiúsculas de grupo': { key: { remoteJid: '120363025246125123@G.US', fromMe: false, id: 'G4' }, message: { conversation: 'quero agendar' } },
};

test('nunca grupo: nenhum envelope de grupo/comunidade/canal/status/LID vira evento do atendente', () => {
  for (const [name, env] of Object.entries(groupEnvelopes)) {
    assert.equal(inbound.isPrivateChat(env), false, `isPrivateChat: ${name}`);
    assert.equal(inbound.parseIncoming(env), null, `parseIncoming: ${name}`);
  }
});

test('contato individual normal continua aceito (inclusive citando mensagem e respondendo menu)', () => {
  const m = inbound.parseIncoming(individual());
  assert.equal(m.phone, '+5511912345678'); assert.equal(m.text, 'quero agendar');
  const quoted = individual({ message: { conversation: undefined, extendedTextMessage: { text: 'esse horário', contextInfo: { stanzaId: 'Q1', participant: '5511900000000@s.whatsapp.net' } } } });
  assert.equal(inbound.isPrivateChat(quoted), true, 'contextInfo.participant de citação em 1:1 não é grupo');
  assert.equal(inbound.parseIncoming(quoted).quotedMessageId, 'Q1');
  const pick = individual({ message: { conversation: undefined, listResponseMessage: { title: 'Corte', singleSelectReply: { selectedRowId: 'ab12cd.0' } } } });
  assert.equal(inbound.parseIncoming(pick).selection, 'ab12cd.0');
  assert.equal(inbound.isPrivateChat(null), false);
});

test('webhook filtra grupo antes de gravar evento; envio de chatbot recusa número que não é individual', () => {
  const src = fs.readFileSync(path.join(root, 'supabase/functions/evolution-webhook/index.ts'), 'utf8');
  assert.ok(src.indexOf('if (!isPrivateChat(entry)) continue;') > -1 && src.indexOf('if (!isPrivateChat(entry)) continue;') < src.indexOf('whatsapp_webhook_events'), 'filtro antes do upsert do evento');
  for (const n of ['5511912345678', '12025550123', '14155552671']) assert.equal(evo.privateNumber(n), true, n);
  for (const n of ['120363025246125123', '5511912345678-1600000000', '5511912345678@g.us', '+5511912345678', '0511912345678', '1234567', '', null]) assert.equal(evo.privateNumber(n), false, String(n));
});

test('outbox: item de chatbot com destino de grupo é cancelado (not_private_chat) sem chamar a Evolution', async () => {
  const finished = [];
  const db = {
    rpc: async (name, args) => {
      if (name === 'whatsapp_claim_outbox') return { data: [{ id: 'o1', claim_token: 'c', salon_id: 's', instance_id: 'i', category: 'chatbot', content_type: 'text', recipient_phone: '5511912345678-1600000000@g.us', text_content: 'oi' }], error: null };
      if (name === 'whatsapp_finish_outbox') { finished.push(args); return { data: true, error: null }; }
      throw new Error(`rpc inesperada ${name}`);
    },
    from: () => { throw new Error('não deveria consultar nada'); },
  };
  assert.equal(await outbox.processOutboxItem(db), true);
  assert.deepEqual(plain(finished.map(f => [f.p_status, f.p_error_code])), [['cancelled', 'not_private_chat']]);
});

test('outbox: filtro de envio imediato usa o claim v2 só com o evento de origem', async () => {
  const seen = [];
  const db = { rpc: async (name, args) => { seen.push([name, args]); return { data: [], error: null }; } };
  assert.equal(await outbox.processOutboxItem(db, { sourceEvent: 'e1' }), false);
  assert.equal(await outbox.processOutboxItem(db), false);
  assert.deepEqual(plain(seen), [['whatsapp_claim_outbox_v2', { p_source_event: 'e1', p_chatbot_only: false }], ['whatsapp_claim_outbox', null]]);
});

// ---------------------------------------------------------------- migração
test('migração: aditiva, idempotente, gate 1 s só para conversa, 3 s mantidos, guarda de grupo e kick só em INSERT', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261109000100_whatsapp_reply_latency.sql'), 'utf8');
  const body = sql.split('-- Rollback')[0];
  assert.match(body, /^BEGIN;/m); assert.match(body, /^COMMIT;/m);
  assert.doesNotMatch(body, /^\s*(DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE)/m, 'nada destrutivo');
  assert.match(body, /CREATE TRIGGER whatsapp_kick_inbound AFTER INSERT ON public\.whatsapp_webhook_events/);
  assert.match(body, /interval '1 second'/); assert.match(body, /next_available_at=now\(\)\+interval '3 seconds'/);
  assert.match(body, /o\.category<>'chatbot'/, 'fila geral sem chatbot no 2º passo');
  assert.equal((body.match(/sender_phone !~ '\^\\\+\[1-9\]\[0-9\]\{6,14\}\$'/g) ?? []).length, 2, 'guarda nas duas finish');
  assert.match(body, /whatsapp_outbox_chatbot_private/);
  assert.match(body, /make_interval\(secs=>i\*0\.001\)/, 'sem espera artificial de 2 s entre mensagens');
  assert.doesNotMatch(body, /\{\d+,\d{4,}\}/, 'repetição de regex dentro do limite do Postgres');
  assert.match(sql, /-- Rollback/);
});
