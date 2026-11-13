// AgendaFácil 365 Pro IA: níveis, confirmação obrigatória, roteamento gestor x cliente, mídia validada e SQL. Sem rede.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const crypto = require('node:crypto');
const { Temporal } = require('@js-temporal/polyfill');
const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
function load(file, cache = new Map()) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const deno = { env: { get: () => undefined } };
  const req = n => n.startsWith('https://') ? { serve: () => {}, createClient: () => ({}) } : n.startsWith('npm:@js-temporal') ? { Temporal } : n.startsWith('npm:') ? { parsePhoneNumberFromString: () => null } : load(path.resolve(path.dirname(file), n), cache);
  vm.runInNewContext(out, { exports, require: req, crypto: crypto.webcrypto, Deno: deno, globalThis: { Deno: deno }, TextEncoder, TextDecoder, Response, URL, AbortSignal, atob, btoa, Blob, FormData, setTimeout, console: { warn() {} }, fetch: () => { throw new Error('rede proibida'); } });
  return exports;
}
const mgr = load(path.join(root, 'supabase/functions/_shared/whatsapp/managerAssistant.ts'));
const SALON = '00000000-0000-4000-8000-000000000010', PENDING = '00000000-0000-4000-8000-0000000000aa', REQ = '00000000-0000-4000-8000-0000000000bb';

function fakeDb(level, onMutation) {
  const calls = [];
  const chain = (data) => { const q = { select: () => q, eq: () => q, gte: () => q, limit: async () => ({ data: [], error: null }), maybeSingle: async () => ({ data, error: null }), single: async () => ({ data, error: null }) }; return q; };
  return { calls, db: {
    rpc: async (name, params) => {
      calls.push([name, params]);
      if (name === 'manager_authorize') return { data: level, error: null };
      if (name === 'manager_mutation') return onMutation(params);
      return { data: null, error: { message: 'unexpected' } };
    },
    from: (table) => chain(table === 'salons' ? { name: 'Studio', timezone: 'America/Sao_Paulo' } : table === 'manager_pending_actions' ? { id: PENDING, request_key: REQ } : null),
  } };
}
const pending = (status = 'pending') => ({ data: { id: PENDING, action: 'expense_create', request_key: REQ, status, expires_at: '2026-11-13T12:10:00Z', proposal: { title: 'Cadastrar despesa', details: { description: 'Produtos', amount: 180, due_date: '2026-11-20' } }, result: status === 'confirmed' ? { message: 'Operação concluída.' } : null }, error: null });
const ctx = (db, channel = 'panel') => ({ db, salonId: SALON, actor: channel === 'panel' ? '00000000-0000-4000-8000-000000000001' : '+5511912345678', channel, requestId: REQ, eventId: channel === 'whatsapp' ? REQ : undefined });

test('níveis: Básico só lê; Intermediário escreve; mídia só no Avançado', () => {
  assert.equal(mgr.canWrite('basic'), false); assert.equal(mgr.canWrite('intermediate'), true); assert.equal(mgr.canWrite('advanced'), true);
  assert.equal(mgr.canUseMedia('intermediate'), false); assert.equal(mgr.canUseMedia('advanced'), true);
});

test('Básico nunca chama mutação; despesa por texto vira proposta com botões no Intermediário', async () => {
  const basic = fakeDb('basic', () => { throw new Error('não pode mutar'); });
  const r1 = await mgr.managerReply(ctx(basic.db), { text: 'Cadastre despesa Produtos, 180 reais, 2026-11-20' });
  assert.match(r1.text, /Básico permite apenas consultas/);
  assert.equal(basic.calls.some(([n]) => n === 'manager_mutation'), false);
  const mid = fakeDb('intermediate', () => pending());
  const r2 = await mgr.managerReply(ctx(mid.db), { text: 'Cadastre despesa Produtos, 180 reais, 2026-11-20' });
  const call = mid.calls.find(([n]) => n === 'manager_mutation')[1];
  assert.equal(call.p_action, 'expense_create'); assert.equal(call.p_confirm, undefined, 'preparar não confirma');
  assert.equal(r2.pendingId, PENDING); assert.match(r2.text, /Valor: R\$\s?180,00/); assert.match(r2.text, /1\. Confirmar\n2\. Cancelar/);
  assert.equal(r2.messages[0].payload.body.buttons.map(b => b.id).join(','), 'mgr_confirm_yes,mgr_confirm_no');
});

test('confirmação: grava só pela RPC com pendingId; Cancelar não confirma; Básico não confirma', async () => {
  const mid = fakeDb('intermediate', (p) => pending(p.p_confirm ? 'confirmed' : 'cancelled'));
  const ok = await mgr.managerReply(ctx(mid.db), { text: '1', pendingId: PENDING });
  const c = mid.calls.find(([n]) => n === 'manager_mutation')[1];
  assert.equal(c.p_pending, PENDING); assert.equal(c.p_confirm, true); assert.match(ok.text, /Operação concluída/);
  const no = await mgr.managerReply(ctx(mid.db), { text: 'Cancelar', pendingId: PENDING });
  assert.match(no.text, /cancelada/);
  const basic = fakeDb('basic', () => { throw new Error('não pode mutar'); });
  assert.match((await mgr.managerReply(ctx(basic.db), { text: 'Confirmar', pendingId: PENDING })).text, /Básico/);
  const none = fakeDb('advanced', () => { throw new Error('sem proposta'); });
  assert.match((await mgr.managerReply(ctx(none.db), { text: '1' })).text, /Nenhuma proposta ativa/);
});

test('WhatsApp: botão sem a mensagem citada não confirma; nível alterado após roteamento é recusado', async () => {
  const wa = fakeDb('advanced', () => { throw new Error('não pode confirmar'); });
  const r = await mgr.managerReply(ctx(wa.db, 'whatsapp'), { text: '✅ Confirmar', selection: 'mgr_confirm_yes', quoted: null });
  assert.match(r.text, /vincular o botão/);
  const changed = fakeDb('basic', () => { throw new Error('x'); });
  assert.match((await mgr.managerReply(ctx(changed.db, 'whatsapp'), { text: 'Confirmar' }, 'advanced')).text, /não autorizado/);
  const off = fakeDb(null, () => { throw new Error('x'); });
  assert.match((await mgr.managerReply(ctx(off.db, 'whatsapp'), { text: '#gestor' })).text, /não autorizado/);
});

test('mídia: Intermediário recusa sem baixar; anexo validado pelos bytes reais', async () => {
  const mid = fakeDb('intermediate', () => { throw new Error('x'); });
  assert.match((await mgr.managerReply(ctx(mid.db), { text: '', attachment: { mime: 'image/png', data: 'AAAA' } })).text, /exigem o nível Avançado/);
  const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0]).toString('base64');
  assert.equal(mgr.validatedAttachment({ data: png, mime: 'application/pdf' }).mime, 'image/png', 'MIME declarado é ignorado');
  assert.equal(mgr.mediaMime(Buffer.from('OggS\0\0\0')), 'audio/ogg');
  assert.throws(() => mgr.validatedAttachment({ data: Buffer.from('<script>').toString('base64'), mime: 'image/png' }), /Envie JPEG/);
  assert.throws(() => mgr.validatedAttachment({ data: 'A'.repeat(7_000_004), mime: 'image/png' }), /5 MB/);
});

test('intenções sem IA: relatórios por período, recebíveis, retornos, agenda da semana', () => {
  const p = t => mgr.deterministicManagerIntent(t);
  assert.deepEqual(JSON.parse(JSON.stringify(p('Analise a minha operação este ano, faturamento, custo e lucro'))), { name: 'get_operation_report', args: { period: 'year' } });
  assert.equal(p('analise os últimos 6 meses').args.period, '6months');
  assert.equal(p('relatório dos últimos 3 meses').args.period, '3months');
  assert.equal(p('analise a operação deste mês').args.period, 'month');
  assert.equal(p('Quem está me devendo hoje?').name, 'get_overdue_receivables');
  assert.equal(p('Tem alguma pendência de retorno hoje?').name, 'get_maintenance_and_returns');
  assert.equal(p('agenda da semana').args.period, 'week');
  assert.equal(p('Me ajuda a organizar o dia de hoje').name, 'get_daily_overview_and_pendencies');
  assert.equal(p('Cadastre a despesa de produtos, 180 reais').args.amount, 180);
  assert.equal(p('quero agendar um corte'), null, 'texto livre fica com a IA');
});

test('roteamento: gestor antes do cliente; #gestor não autentica; áudio de cliente segue sem resposta', () => {
  const src = read('supabase/functions/_shared/whatsapp/chatbot.ts');
  const start = src.indexOf('export async function chatbotReply');
  const manager = src.indexOf('managerLevel(manager)', start), pre = src.indexOf('await preload(ctx)', start);
  assert.ok(manager > start && manager < pre, 'gestor resolvido antes do fluxo do cliente');
  assert.match(src, /actor: ctx\.phone, channel: "whatsapp"/);
  const code = src.slice(start, pre).split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /#gestor/i, '#gestor sozinho nunca concede acesso');
  assert.match(src, /type === "audio"\) return \{ text: "", provider: "deterministic", model: "audio_ignored" \}/);
  const inbound = load(path.join(root, 'supabase/functions/_shared/whatsapp/inbound.ts'));
  const m = inbound.parseIncoming({ key: { remoteJid: '5511912345678@s.whatsapp.net', id: 'AUD1', fromMe: false }, message: { audioMessage: { mimetype: 'audio/ogg; codecs=opus' } } });
  assert.equal(m.media.type, 'audio');
  const click = inbound.parseIncoming({ key: { remoteJid: '5511912345678@s.whatsapp.net', id: 'CLK1', fromMe: false }, message: { buttonsResponseMessage: { selectedButtonId: 'mgr_confirm_yes', selectedDisplayText: '✅ Confirmar', contextInfo: { stanzaId: 'CARD1' } } } });
  assert.equal(click.selection, 'mgr_confirm_yes'); assert.equal(click.quotedMessageId, 'CARD1', 'clique preserva o cartão respondido');
});

test('SQL: autorização relida, TTL 10 min, trava, revalidação, auditoria única e agregados no banco', () => {
  const sql = read('MIGRATION_ASSISTENTE_GESTOR_WHATSAPP.sql');
  assert.match(sql, /^-- .*\nBEGIN;/); assert.match(sql, /COMMIT;\s*$/);
  assert.match(sql, /manager_access_level text NOT NULL DEFAULT 'advanced' CHECK \(manager_access_level IN \('basic','intermediate','advanced'\)\)/);
  assert.match(sql, /manager_assistant_enabled boolean NOT NULL DEFAULT true/); assert.match(sql, /authorized_manager_phones text\[\]/);
  assert.match(sql, /expires_at timestamptz NOT NULL DEFAULT now\(\)\+interval '10 minutes'/);
  assert.match(sql, /UNIQUE\(salon_id,actor,channel,request_key\)/); assert.match(sql, /manager_one_pending .* WHERE status='pending'/);
  const fn = sql.slice(sql.indexOf('FUNCTION public.manager_mutation'));
  assert.ok(fn.indexOf('pg_advisory_xact_lock') < fn.indexOf('manager_authorize'), 'trava antes de autorizar');
  assert.match(fn, /IF lvl='basic' THEN RAISE EXCEPTION 'read_only'/);
  assert.match(fn, /proposal IS DISTINCT FROM pending\.proposal THEN RAISE EXCEPTION 'data_changed_prepare_again'/);
  assert.match(fn, /pending\.request_key=p_event::text OR NOT EXISTS\(SELECT 1 FROM whatsapp_webhook_events WHERE id=p_event AND created_at>pending\.created_at\)/);
  assert.match(fn, /PERFORM public\.package_order_fulfill\(target\)/, 'pacote libera créditos pelo fluxo existente');
  assert.match(sql, /action_id uuid NOT NULL UNIQUE/); assert.match(fn, /INSERT INTO manager_audit_logs/);
  assert.match(sql, /UPDATE manager_pending_actions SET status='superseded' WHERE salon_id=p_salon AND status='pending'/, 'troca de nível invalida propostas');
  assert.match(sql, /manager_phone_key\(p_actor\)=ANY\(ARRAY\(SELECT public\.manager_phone_key\(x\) FROM unnest\(coalesce\(cfg\.authorized_manager_phones/);
  assert.match(sql, /'\+55'\|\|substr\(p_value,4,2\)\|\|substr\(p_value,7\)/, 'celular com e sem o 9 extra é o mesmo gestor'); assert.match(sql, /IF NOT coalesce\(cfg\.manager_assistant_enabled,true\) THEN RETURN NULL/);
  for (const period of ['month', '3months', '6months', 'year']) assert.match(sql, new RegExp(`'${period}'`));
  assert.match(sql, /payment_status IN \('paid','approved','completed'\)/); assert.doesNotMatch(sql.slice(sql.indexOf("p_tool='get_operation_report'"), sql.indexOf("p_tool='get_overdue_receivables'")), /LIMIT/, 'totais do relatório sem truncar');
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.manager_authorize.* TO service_role/); assert.match(sql, /FROM PUBLIC,anon,authenticated/);
  assert.match(read('supabase/config.toml'), /\[functions\.manager-assistant\]\r?\nverify_jwt = false/);
  const edge = read('supabase/functions/manager-assistant/index.ts');
  assert.match(edge, /authorizeSalon\(req, db, input\.salonId\)/); assert.match(edge, /channel: "panel"/); assert.doesNotMatch(edge, /api_key|GROQ|GEMINI/i, 'painel não recebe segredo');
});
