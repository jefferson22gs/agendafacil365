// Contratos do rebranding Agenda Fácil 365. Rodar: node --test tests/rebrand/*.test.cjs
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');

// Carrega um módulo TS isolado (sem bundler). `stubs` resolve imports externos.
function load(rel, stubs = {}, globals = {}) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8').replaceAll('import.meta.env', '({})');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, require: n => stubs[n] ?? {}, URL, Response, Request, TextEncoder, crypto: require('node:crypto').webcrypto, process: { env: {} }, ...globals });
  return exports;
}

const memStorage = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), dump: () => Object.fromEntries(m) }; };

test('tema: migração de chaves legadas é idempotente e preserva escolhas', () => {
  const t = load('src/lib/themePreferences.ts');
  const s = memStorage({ 'syshair-mode': 'dark', 'syshair-theme': 'gold', 'sb-auth': 'token', 'outra': 'x' });
  t.migratePreferences(s); t.migratePreferences(s);
  assert.equal(s.getItem(t.MODE_KEY), 'dark');
  assert.equal(s.getItem(t.PALETTE_KEY), 'blue', 'antigo padrão gold vira azul');
  assert.equal(s.getItem('syshair-mode'), 'dark', 'chave legada não é apagada');
  assert.equal(s.getItem('sb-auth'), 'token', 'storage alheio intacto');
  const e = memStorage({ 'syshair-theme': 'emerald' }); t.migratePreferences(e);
  assert.equal(t.readPalette(e).id, 'emerald', 'paleta explícita preservada');
  const n = memStorage({ [t.MODE_KEY]: 'light', 'syshair-mode': 'dark' }); t.migratePreferences(n);
  assert.equal(t.readMode(n), 'light', 'chave nova prevalece sobre legada');
  assert.equal(t.readMode(memStorage()), 'light', 'sem preferência: claro');
  assert.equal(t.readPalette(memStorage({ [t.PALETTE_KEY]: '<script>' })).id, 'blue', 'valor inválido cai no azul');
  t.migratePreferences({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }); // não lança
});

test('marca: cor de tenant só valida/fallback, nunca reescreve cor válida', () => {
  const b = load('src/config/brand.ts');
  assert.equal(b.safeHexColor('#D4AF37'), '#D4AF37', 'dourado salvo pelo cliente é mantido');
  assert.equal(b.safeHexColor(' #abc '), '#abc');
  for (const bad of [null, undefined, '', 'red', '#12345', 'url(x)', '#fff;background:url(x)']) assert.equal(b.safeHexColor(bad), '#2563EB');
  assert.equal(b.displayPlanName('SysHair Premium'), 'Agenda Fácil 365 Premium');
  assert.equal(b.displayPlanName(null), 'Agenda Fácil 365 Premium');
  assert.equal(b.displayPlanName('Plano Custom'), 'Plano Custom');
  assert.equal(b.LEGACY_PLAN_NAME, 'SysHair Premium', 'valor persistido legado não muda');
});

test('contratos técnicos preservados', () => {
  const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
  assert.match(read('src/services/mercadoPago.ts'), /id: 'syshair-premium'/);
  assert.match(read('src/components/admin/QRCheckIn.tsx'), /"syshair_checkin"/);
  assert.match(read('supabase/functions/evolution-webhook/index.ts'), /x-syshair-webhook-secret/);
  assert.match(read('supabase/functions/whatsapp-instances/index.ts'), /`syshair_\$\{/);
  assert.match(read('src/features/training/TrainingProvider.tsx'), /syshair\.training\.activeTour:/);
  // Push passou a ser Web Push padrão (VAPID), sem Firebase: só a chave pública vai no front.
  assert.match(read('src/lib/webPush.ts'), /VAPID_PUBLIC_KEY = "B[A-Za-z0-9_-]{86}"/);
});

test('chatbot: código de verificação aceita prefixo legado e novo', () => {
  const c = load('supabase/functions/_shared/whatsapp/chatbot.ts');
  for (const ok of ['123456', 'SysHair 123456', 'syshair  123456', 'Agenda Fácil 365 123456', 'agenda facil 123456', 'AGENDA 123456']) assert.equal(c.parseVerificationCode(ok), '123456', ok);
  for (const bad of ['12345', 'outro 123456', '123456 extra', 'syshair123456x']) assert.equal(c.parseVerificationCode(bad), undefined, bad);
});

test('rpcFallback: só usa caminho antigo quando a RPC não existe', () => {
  const { isMissingRpc } = load('src/lib/rpcFallback.ts');
  assert.equal(isMissingRpc({ code: 'PGRST202' }), true);
  assert.equal(isMissingRpc({ code: '42883' }), true);
  for (const recusa of [{ code: '42501' }, { code: '23505' }, { code: 'P0001' }, null, undefined]) assert.equal(isMissingRpc(recusa), false, JSON.stringify(recusa));
});

test('webhook Mercado Pago: localiza assinatura só com .eq e UUID validado', async () => {
  const { findSubscription } = load('supabase/functions/mercadopago-webhook/index.ts', { 'https://deno.land/std@0.168.0/http/server.ts': { serve() {} }, 'https://esm.sh/@supabase/supabase-js@2': {} });
  const calls = [];
  const db = rows => ({ from: () => { const q = { filters: [], select() { return q; }, eq(c, v) { q.filters.push([c, v]); return q; }, order() { return q; }, limit() { return q; }, or(x) { throw new Error('or() proibido: ' + x); }, async maybeSingle() { calls.push(q.filters); return { data: rows.find(r => q.filters.every(([c, v]) => r[c] === v)) ?? null }; } }; return q; } });
  const salon = '00000000-0000-4000-8000-000000000010';
  const rows = [{ id: 's1', salon_id: salon, mp_preapproval_id: 'pre-1', mp_external_reference: 'qualquer' }];
  assert.equal((await findSubscription(db(rows), 'pre-1', null)).id, 's1', 'por preapproval vinculado');
  assert.equal((await findSubscription(db(rows), 'pre-x', salon)).id, 's1', 'fallback por salon_id');
  assert.equal(await findSubscription(db(rows), null, 'qualquer'), null, 'mp_external_reference gravado pelo cliente não é usado');
  assert.equal(await findSubscription(db(rows), null, `${salon},status.eq.active`), null, 'tentativa de injeção de filtro rejeitada');
  assert.equal(await findSubscription(db(rows), null, undefined), null);
});

test('InfinitePay: payload do link, preço do servidor, confirmação e redirect seguro', () => {
  const ip = load('supabase/functions/_shared/infinitepay/core.ts');
  assert.equal(ip.normalizeHandle(' $Marco-Boggian '), 'marco-boggian');
  const req = ip.buildLinkRequest({ handle: '$marco-boggian', orderNsu: 'n1', plan: 'annual', redirectUrl: 'https://a/x', webhookUrl: 'https://w', customer: { name: 'Ana', email: 'a@b.c', phone: '(11) 98888-7777' } });
  assert.equal(req.handle, 'marco-boggian');
  assert.equal(JSON.stringify(req.items), JSON.stringify([{ quantity: 1, price: 40000, description: 'Agenda Fácil 365 Premium — Anual' }]), 'R$ 400,00 em centavos');
  assert.equal(req.customer.phone_number, '+5511988887777');
  assert.equal(ip.buildLinkRequest({ handle: 'h', orderNsu: 'n', plan: 'monthly', redirectUrl: 'r', webhookUrl: 'w' }).items[0].price, 3990, 'R$ 39,90');
  assert.equal(ip.isPlan('annual'), true); assert.equal(ip.isPlan('vitalicio'), false);
  // Confirmação: precisa de paid=true E valor >= esperado
  assert.equal(ip.isConfirmedPayment({ success: true, paid: true, paid_amount: 3990 }, 3990), true);
  assert.equal(ip.isConfirmedPayment({ success: true, paid: true, paid_amount: 100 }, 3990), false, 'pagou menos');
  assert.equal(ip.isConfirmedPayment({ success: true, paid: false, paid_amount: 3990 }, 3990), false);
  assert.equal(ip.isConfirmedPayment({ success: false }, 3990), false);
  assert.equal(ip.isConfirmedPayment(null, 3990), false);
  // Redirect só para a origem do app
  assert.equal(ip.safeRedirect('https://evil.com/x', ['https://agendafacil365.com.br'], 'F'), 'F');
  assert.equal(ip.safeRedirect('https://agendafacil365.com.br/admin', ['https://agendafacil365.com.br'], 'F'), 'https://agendafacil365.com.br/admin');
  assert.equal(ip.safeRedirect('javascript:alert(1)', ['https://agendafacil365.com.br'], 'F'), 'F');
  // Período: pagamento antecipado não perde dias
  const now = new Date('2026-11-05T12:00:00Z');
  assert.equal(ip.nextPeriodEnd('monthly', '2026-11-20T12:00:00Z', now).toISOString().slice(0, 10), '2026-12-20');
  assert.equal(ip.nextPeriodEnd('annual', null, now).toISOString().slice(0, 10), '2027-11-05');
  // Webhook: exige os 3 identificadores
  assert.equal(ip.parseWebhook({ order_nsu: 'o' }), null);
  assert.equal(ip.parseWebhook({ order_nsu: 'o', transaction_nsu: 't', invoice_slug: 's', amount: 3990 }).amount, 3990);
});

test('safeNext: só aceita caminho interno após login/cadastro', () => {
  const { safeNext } = load('src/lib/safeNext.ts');
  assert.equal(safeNext('/admin/subscription?plano=anual'), '/admin/subscription?plano=anual');
  for (const bad of ['https://evil.com', '//evil.com/x', '/\\evil.com', 'javascript:alert(1)', '', null, undefined]) assert.equal(safeNext(bad), '/dashboard', String(bad));
});

test('manifest por tenant: valida slug, 404, JSON público e cor segura', async () => {
  const m = load('api/manifest/[slug].ts', { '../_pwa.js': load('api/_pwa.ts') });
  const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' };
  const calls = [];
  const fetchOk = rows => async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify(rows), { status: 200 }); };
  const req = slug => new Request(`https://app.test/api/manifest/${slug}`);

  assert.equal((await m.handleManifest(req('..%2Fetc'), env, fetchOk([]))).status, 400);
  assert.equal((await m.handleManifest(req('%E0%A4%A'), env, fetchOk([]))).status, 400, 'URI malformada');
  assert.equal(calls.length, 0, 'slug inválido não consulta banco');
  assert.equal((await m.handleManifest(req('ok'), {}, fetchOk([]))).status, 500, 'sem env não vaza detalhe');
  assert.equal((await m.handleManifest(req('nao-existe'), env, fetchOk([]))).status, 404);

  const res = await m.handleManifest(req('studio-a'), env, fetchOk([{ name: 'Studio A', slug: 'studio-a', primary_color: 'javascript:alert(1)' }]));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/manifest\+json/);
  const body = await res.json();
  assert.equal(body.theme_color, '#2563EB', 'cor inválida cai no padrão');
  assert.equal(body.start_url, '/s/studio-a?source=pwa');
  assert.equal(body.id, '/s/studio-a', 'id distinto do app da plataforma');
  assert.ok(body.icons.some(i => i.purpose === 'maskable' && i.src.startsWith('/api/icon/studio-a')), 'maskable do próprio salão');
  assert.ok(!body.icons.some(i => i.src.startsWith('/pwa-')), 'nenhum ícone da plataforma no app do salão');
  const last = calls.at(-1);
  assert.match(last.url, /select=name,slug,primary_color,logo_url,pwa_[a-z_,]+&slug=eq\.studio-a/, 'só colunas públicas de identidade, escopo por slug');
  assert.match(last.url, /or=\(is_active\.is\.null,is_active\.eq\.true\)/, 'is_active nulo é ativo (igual à RLS pública)');
  const longSlug = 'a'.repeat(120);
  assert.equal((await m.handleManifest(req(longSlug), env, fetchOk([{ name: 'L', slug: longSlug, primary_color: null }]))).status, 200, 'slug longo existente continua válido');
  assert.equal(last.init.headers.apikey, 'anon');

  const b = await (await m.handleManifest(req('b'), env, fetchOk([{ name: 'B', slug: 'b', primary_color: '#D4AF37' }]))).json();
  assert.equal(b.theme_color, '#D4AF37', 'cor salva pelo tenant preservada');
});
