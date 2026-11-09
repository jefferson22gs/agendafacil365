// App próprio por salão (PWA) e push seguro. Rodar: node --test tests/rebrand/pwa.test.cjs
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function load(rel, stubs = {}) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8').replaceAll('import.meta.env', '({})');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, require: n => stubs[n] ?? {}, URL, Response, Request, URLSearchParams, TextEncoder, btoa, process: { env: {} } });
  return exports;
}
const pwa = load('api/_pwa.ts');
const manifest = load('api/manifest/[slug].ts', { '../_pwa.js': pwa });
const icon = load('api/icon/[slug].ts', { '../_pwa.js': pwa });
const core = load('supabase/functions/_shared/push/core.ts');

const STORAGE = 'https://ocbwsaydgkiseeardjga.supabase.co/storage/v1/object/public/gallery/s1/app-icon.png';
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' };
const row = (o = {}) => ({ name: 'Studio Ana', slug: 'studio-ana', primary_color: '#D4AF37', logo_url: null, pwa_enabled: true, ...o });

test('manifest: campos pwa_* com fallback, cores só HEX, scope/start_url/id do salão', async () => {
  const m = manifest.buildManifest(row({ pwa_name: 'Ana App', pwa_short_name: 'Ana', pwa_description: 'Desc', pwa_theme_color: '#112233', pwa_background_color: '#fff' }));
  assert.equal(m.name, 'Ana App'); assert.equal(m.short_name, 'Ana'); assert.equal(m.description, 'Desc');
  assert.equal(m.theme_color, '#112233'); assert.equal(m.background_color, '#fff');
  assert.equal(m.id, '/s/studio-ana'); assert.equal(m.start_url, '/s/studio-ana?source=pwa');
  assert.equal(m.scope, '/s/studio-ana', 'scope contém página, ?source e /s/slug/profissional');
  assert.ok(!'/appointment/x'.startsWith(m.scope) && !'/avaliar/x'.startsWith(m.scope), 'token e avaliação fora do scope');

  const f = manifest.buildManifest(row({ pwa_theme_color: 'red', pwa_background_color: 'url(x)', primary_color: 'javascript:1' }));
  assert.equal(f.name, 'Studio Ana'); assert.equal(f.short_name, 'Studio Ana');
  assert.equal(f.theme_color, '#2563EB', 'cor inválida cai no padrão'); assert.equal(f.background_color, '#FFFFFF');
  assert.equal(manifest.buildManifest(row({ pwa_theme_color: null })).theme_color, '#D4AF37', 'sem pwa_theme_color usa primary_color');
  assert.ok(f.icons.some(i => i.type === 'image/svg+xml' && i.src.startsWith('/api/icon/studio-ana')), 'ícone do salão');
  assert.ok(f.icons.some(i => i.src === '/pwa-512x512.png') && f.icons.some(i => i.purpose === 'maskable' && i.type === 'image/png'), 'PNG da plataforma como fallback');
});

test('manifest: salão com pwa_enabled=false responde 404 e seleciona colunas pwa_*', async () => {
  let url = '';
  const fetchRows = rows => async (u) => { url = u; return new Response(JSON.stringify(rows), { status: 200 }); };
  const req = new Request('https://app.test/api/manifest/studio-ana');
  assert.equal((await manifest.handleManifest(req, env, fetchRows([row({ pwa_enabled: false })]))).status, 404);
  assert.match(url, /pwa_theme_color/); assert.match(url, /slug=eq\.studio-ana/);
  assert.equal((await manifest.handleManifest(new Request('https://app.test/api/manifest/a%2F..'), env, fetchRows([]))).status, 400);
});

test('ícone: slug inválido, cor do salão, inicial escapada, safe zone', async () => {
  const calls = [];
  const fetchFake = async (u) => { calls.push(String(u)); return new Response(JSON.stringify([row({ name: '<b>Ana' })]), { status: 200 }); };
  assert.equal((await icon.handleIcon(new Request('https://app.test/api/icon/..%2Fx'), env, fetchFake)).status, 400);
  assert.equal(calls.length, 0, 'slug inválido não consulta');
  const res = await icon.handleIcon(new Request('https://app.test/api/icon/studio-ana'), env, fetchFake);
  assert.equal(res.status, 200); assert.match(res.headers.get('content-type'), /image\/svg\+xml/);
  assert.match(res.headers.get('cache-control'), /max-age=\d+/);
  const svg = await res.text();
  assert.match(svg, /fill="#D4AF37"/); assert.match(svg, />&#60;</, 'inicial escapada'); assert.doesNotMatch(svg, /<b>/);
  const mask = icon.buildIconSvg({ name: 'A', color: '#000000', logo: 'data:image/png;base64,AA', maskable: true });
  assert.match(mask, /x="106" y="106" width="300"/, 'logo dentro da safe zone (80%)');
  assert.match(icon.buildIconSvg({ name: 'z', color: '#ffffff', logo: null, maskable: false }), /fill="#000000">Z</, 'texto preto em fundo claro');
});

test('ícone: sem SSRF — só busca imagem do Storage público do projeto', async () => {
  const fetched = [];
  const fetchFake = (salon) => async (u) => {
    const url = String(u); fetched.push(url);
    if (url.includes('/rest/v1/')) return new Response(JSON.stringify([salon]), { status: 200 });
    return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { 'content-type': 'image/png' } });
  };
  for (const bad of ['http://169.254.169.254/latest/meta-data', 'https://evil.com/logo.png', 'https://ocbwsaydgkiseeardjga.supabase.co/rest/v1/x.png',
    'https://ocbwsaydgkiseeardjga.supabase.co.evil.com/storage/v1/object/public/a.png', 'https://u:p@ocbwsaydgkiseeardjga.supabase.co/storage/v1/object/public/a.png', 'file:///etc/passwd']) {
    fetched.length = 0;
    const svg = await (await icon.handleIcon(new Request('https://app.test/api/icon/studio-ana'), env, fetchFake(row({ logo_url: bad, pwa_icon_url: bad })))).text();
    assert.equal(fetched.length, 1, `não buscou ${bad}`); assert.doesNotMatch(svg, /<image/);
  }
  fetched.length = 0;
  const svg = await (await icon.handleIcon(new Request('https://app.test/api/icon/studio-ana'), env, fetchFake(row({ pwa_icon_url: STORAGE })))).text();
  assert.equal(fetched[1], STORAGE); assert.match(svg, /<image href="data:image\/png;base64,/, 'logo embutido (SVG em <img> não carrega URL externa)');
  // Tipo errado ou grande demais: inicial.
  const notImage = async () => new Response('<svg/>', { status: 200, headers: { 'content-type': 'image/svg+xml' } });
  assert.equal(await icon.logoDataUri(STORAGE, notImage), null, 'SVG remoto recusado');
  const huge = async () => new Response('x', { status: 200, headers: { 'content-type': 'image/png', 'content-length': '999999999' } });
  assert.equal(await icon.logoDataUri(STORAGE, huge), null);
});

test('contraste AA: texto preto/branco pela luminância', () => {
  assert.equal(pwa.textOnColor('#FFFFFF'), '#000000'); assert.equal(pwa.textOnColor('#000000'), '#ffffff');
  assert.equal(pwa.textOnColor('#2563EB'), '#ffffff'); assert.equal(pwa.textOnColor('#D4AF37'), '#000000');
  assert.equal(pwa.textOnColor('#ff0'), '#000000'); assert.equal(pwa.textOnColor('lixo'), '#ffffff', 'inválido usa o padrão azul');
  // Para qualquer cor, o contraste escolhido é >= 4.5 (AA texto normal) ou é o melhor possível.
  const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  for (const c of ['#c9a227', '#0d1117', '#7c3aed', '#16a34a', '#e11d48', '#777777']) {
    const fg = pwa.textOnColor(c), other = fg === '#000000' ? '#ffffff' : '#000000';
    assert.ok(ratio(c, fg) >= ratio(c, other), c);
  }
  assert.equal(pwa.storageImage(STORAGE), STORAGE); assert.equal(pwa.storageImage('https://evil.com/a.png'), null);
});

test('push: link só relativo do mesmo site, ícone só do Storage, payload pequeno', () => {
  for (const ok of ['/s/ana', '/avaliar/123', '/admin/appointments?x=1#y']) assert.equal(core.safeRelativeUrl(ok, 'F'), ok);
  for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/a/../admin', '', null, '/x y', '/' + 'a'.repeat(600)]) {
    assert.equal(core.safeRelativeUrl(bad, 'F'), 'F', String(bad));
  }
  assert.equal(core.safeIconUrl('https://evil.com/a.png'), core.DEFAULT_ICON);
  assert.equal(core.safeIconUrl(STORAGE), STORAGE);
  const p = core.buildPayload({ title: 'Oi ', body: 'b'.repeat(500), url: 'https://evil.com', salonSlug: 'ana', icon: STORAGE });
  assert.equal(p.url, '/s/ana', 'URL externa vira a página do salão');
  assert.equal(p.body.length, 300); assert.equal(p.title, 'Oi');
  assert.ok(core.payloadBytes(p) < core.MAX_PAYLOAD_BYTES);
});

test('contratos: front não dispara push anônimo nem escreve na tabela', () => {
  const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
  assert.doesNotMatch(read('src/pages/PublicSalon.tsx'), /send-push|functions\.invoke\(['"]send/);
  assert.doesNotMatch(read('src/pages/admin/Appointments.tsx'), /VITE_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(read('src/hooks/usePushNotificationsFCM.tsx'), /from\('push_subscriptions'\)\s*\.(insert|update|upsert|delete)/);
  assert.doesNotMatch(read('src/hooks/usePushNotificationsFCM.tsx'), /firebase\//, 'push sem Firebase');
  const sql = read('supabase/migrations/20261106001000_pwa_push_security.sql');
  for (const p of ['push_subscriptions_select_policy', 'push_subscriptions_update_policy', 'push_subscriptions_delete_policy', 'push_subscriptions_insert_policy']) assert.match(sql, new RegExp(`DROP POLICY IF EXISTS ${p}`));
  assert.match(sql, /REVOKE ALL ON public\.push_subscriptions FROM anon, authenticated/);
  assert.doesNotMatch(sql, /GRANT SELECT \([^)]*fcm_token/, 'painel nunca lê token');
  assert.doesNotMatch(sql.split('-- ROLLBACK')[0], /DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN/i, 'migração não apaga dados');
  assert.match(read('supabase/functions/send-push/index.ts'), /handleSend/, 'alias legado usa o handler seguro');
});
