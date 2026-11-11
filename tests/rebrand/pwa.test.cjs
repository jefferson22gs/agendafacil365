const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const { inflateSync } = require('node:zlib');
const root = path.resolve(__dirname, '../..');
function load(rel, stubs = {}, globals = {}) {
  const out = ts.transpileModule(fs.readFileSync(path.join(root, rel), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, require: n => stubs[n] ?? (n.startsWith('node:') ? require(n) : (() => { throw Error(n); })()), URL, Response, Request, URLSearchParams, TextEncoder, Uint8Array, Buffer, btoa, atob, AbortController, setTimeout, clearTimeout, process: { env: {} }, ...globals });
  return exports;
}
const pwa = load('api/_pwa.ts');
const png = load('api/_pwa-png.ts', { './_pwa.js': pwa });
const stubs = { '../_pwa.js': pwa, '../_pwa-png.js': png };
const manifest = load('api/manifest/[slug].ts', stubs), icon = load('api/icon/[slug].ts', stubs);
const STORAGE = 'https://ocbwsaydgkiseeardjga.supabase.co/storage/v1/object/public/gallery/s1/app-icon.png';
const EXTERNAL = 'https://images.example.com/logo.png';
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' };
const row = (o = {}) => ({ name: 'Studio Ana', slug: 'studio-ana', primary_color: '#D4AF37', logo_url: null, pwa_enabled: true, ...o });
const request = (query = '') => new Request(`https://app.test/api/icon/studio-ana${query}`);
const rows = salon => async () => Response.json(salon ? [salon] : []);
const image = png.initialsPng('Ana', '#123456', 192);
const data = `data:image/png;base64,${Buffer.from(image).toString('base64')}`;

// Main checkout has push-security changes not present in this isolated base.
const hasPush = fs.existsSync(path.join(root, 'supabase/functions/_shared/push/core.ts'));
test('push: link só relativo do mesmo site, ícone só do Storage, payload pequeno', { skip: !hasPush }, () => {
  const core = load('supabase/functions/_shared/push/core.ts');
  for (const ok of ['/s/ana', '/avaliar/123', '/admin/appointments?x=1#y']) assert.equal(core.safeRelativeUrl(ok, 'F'), ok);
  for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/a/../admin', '', null, '/x y', '/' + 'a'.repeat(600)]) assert.equal(core.safeRelativeUrl(bad, 'F'), 'F', String(bad));
  assert.equal(core.safeIconUrl('https://evil.com/a.png'), core.DEFAULT_ICON); assert.equal(core.safeIconUrl(STORAGE), STORAGE);
  const p = core.buildPayload({ title: 'Oi\u0000', body: 'b'.repeat(500), url: 'https://evil.com', salonSlug: 'ana', icon: STORAGE });
  assert.equal(p.url, '/s/ana'); assert.equal(p.body.length, 300); assert.equal(p.title, 'Oi'); assert.ok(core.payloadBytes(p) < core.MAX_PAYLOAD_BYTES);
});
test('contratos: front não dispara push anônimo nem escreve na tabela', { skip: !hasPush }, () => {
  const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
  assert.doesNotMatch(read('src/pages/PublicSalon.tsx'), /send-push|functions\.invoke\(['"]send/);
  assert.doesNotMatch(read('src/pages/admin/Appointments.tsx'), /VITE_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(read('src/hooks/usePushNotificationsFCM.tsx'), /from\('push_subscriptions'\)\s*\.(insert|update|upsert|delete)/);
  assert.doesNotMatch(read('src/hooks/usePushNotificationsFCM.tsx'), /firebase\//);
  const sql = read('supabase/migrations/20261106001000_pwa_push_security.sql');
  for (const p of ['push_subscriptions_select_policy', 'push_subscriptions_update_policy', 'push_subscriptions_delete_policy', 'push_subscriptions_insert_policy']) assert.match(sql, new RegExp(`DROP POLICY IF EXISTS ${p}`));
  assert.match(sql, /REVOKE ALL ON public\.push_subscriptions FROM anon, authenticated/);
  assert.doesNotMatch(sql, /GRANT SELECT \([^)]*fcm_token/);
  assert.doesNotMatch(sql.split('-- ROLLBACK')[0], /DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN/i);
  assert.match(read('supabase/functions/send-push/index.ts'), /handleSend/);
});

test('manifest: tenant only, identity, colors, scope, raster 192/512, honest MIME', () => {
  const m = manifest.buildManifest(row({ pwa_name: 'Ana App', pwa_short_name: 'Ana', pwa_description: 'Desc', pwa_theme_color: '#112233', pwa_background_color: '#fff' }), 'x &?');
  assert.equal(m.name, 'Ana App'); assert.equal(m.short_name, 'Ana'); assert.equal(m.description, 'Desc');
  assert.equal(m.theme_color, '#112233'); assert.equal(m.background_color, '#fff');
  assert.equal(m.id, '/s/studio-ana'); assert.equal(m.start_url, '/s/studio-ana?source=pwa'); assert.equal(m.scope, '/s/studio-ana');
  assert.equal(m.icons.length, 3);
  assert.deepEqual({ ...m.icons[2] }, { src: '/api/icon/studio-ana?maskable=1&v=x%20%26%3F', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' });
  for (const [i, size] of [192, 512].entries()) {
    const entry = m.icons[i], url = new URL(entry.src, 'https://app.test');
    assert.equal(url.pathname, '/api/icon/studio-ana'); assert.equal(url.searchParams.get('format'), 'png');
    assert.equal(url.searchParams.get('size'), String(size)); assert.equal(url.searchParams.get('v'), 'x &?');
    assert.equal(entry.sizes, `${size}x${size}`); assert.equal(entry.type, undefined);
  }
  assert.doesNotMatch(JSON.stringify(m), /pwa-\d|maskable-512/);
  const fallback = manifest.buildManifest(row({ pwa_theme_color: 'red', primary_color: 'javascript:1' }));
  assert.equal(fallback.theme_color, '#2563EB'); assert.equal(fallback.background_color, '#FFFFFF');
});

test('central logo resolver: precedence, HTTPS, credentials, local/private IP, data validation', () => {
  for (const good of [STORAGE, EXTERNAL, data]) assert.equal(pwa.resolveLogo(good), good);
  assert.equal(pwa.identity(row({ logo_url: EXTERNAL, pwa_icon_url: STORAGE })).logo, EXTERNAL);
  assert.equal(pwa.identity(row({ logo_url: data, pwa_icon_url: STORAGE })).logo, data);
  assert.equal(pwa.identity(row({ pwa_icon_url: STORAGE })).logo, STORAGE);
  assert.equal(pwa.identity(row()).logo, null);
  for (const bad of [null, '', 'http://example.com/a.png', 'https://u:p@example.com/a.png', 'https://localhost/a', 'https://x.local/a', 'https://x.internal/a', 'https://server/a', 'https://127.1/a', 'https://2130706433/a', 'https://0x7f000001/a', 'https://10.0.0.1/a', 'https://172.16.0.1/a', 'https://192.168.1.1/a', 'https://169.254.169.254/a', 'https://[::1]/a', 'https://[::ffff:127.0.0.1]/a', 'file:///etc/passwd', 'javascript:alert(1)', '//example.com/a', 'https://example.com\\@localhost/a', 'data:image/svg+xml;base64,PHN2Zy8+', 'data:image/png;base64,AAAA', data.replace('image/png', 'image/jpeg'), data + '!', 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024)]) assert.equal(pwa.resolveLogo(bad), null, String(bad).slice(0, 100));
  assert.equal(pwa.storageImage(STORAGE), STORAGE);
  for (const value of [EXTERNAL, data, STORAGE.replace('.co/', '.co.evil.com/'), STORAGE.replace('https://', 'https://u:p@'), STORAGE.replace('/storage/v1/object/public/', '/rest/v1/')]) assert.equal(pwa.storageImage(value), null);
});

test('external redirect never server-fetches URL; SVG does not embed external resources', async () => {
  let calls = 0;
  const fetchFake = async () => { calls++; return Response.json([row({ logo_url: EXTERNAL })]); };
  const res = await icon.handleIcon(request('?format=png&size=180'), env, fetchFake);
  assert.equal(res.status, 302); assert.equal(res.headers.get('location'), EXTERNAL); assert.equal(calls, 1);
  const svg = await (await icon.handleIcon(request(), env, fetchFake)).text();
  assert.doesNotMatch(svg, /<image/); assert.equal(calls, 2);
  assert.equal(await icon.logoDataUri(EXTERNAL, () => { throw Error('SSRF'); }), null);
});

test('Base64 raster preserved, true MIME; no extra fetch', async () => {
  let calls = 0;
  const res = await icon.handleIcon(request('?format=png&size=192'), env, async () => { calls++; return Response.json([row({ logo_url: data })]); });
  assert.equal(res.headers.get('content-type'), 'image/png'); assert.deepEqual(new Uint8Array(await res.arrayBuffer()), image); assert.equal(calls, 1);
  const svg = await (await icon.handleIcon(request(), env, rows(row({ logo_url: data })))).text();
  assert.match(svg, /<image href="data:image\/png;base64,/);
});

test('Storage: 1.6MB works, streaming limit 2MB, timeout, redirects forbidden, invalid MIME/signature rejected', async () => {
  // PNG with a large ancillary tEXt chunk; valid CRC, valid image data.
  const crc = bytes => { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; };
  const text = Buffer.concat([Buffer.from('tEXtComment\0'), Buffer.alloc(1_600_000, 65)]), chunk = Buffer.alloc(text.length + 8);
  chunk.writeUInt32BE(text.length - 4); text.copy(chunk, 4); chunk.writeUInt32BE(crc(text), chunk.length - 4);
  const large = Buffer.concat([Buffer.from(image).subarray(0, -12), chunk, Buffer.from(image).subarray(-12)]);
  let opts;
  const result = await icon.logoDataUri(STORAGE, async (_, options) => { opts = options; return new Response(large, { headers: { 'content-type': 'image/png' } }); });
  assert.ok(result.length > 2_000_000); assert.equal(opts.redirect, 'error'); assert.ok(opts.signal);
  assert.equal(await icon.logoDataUri(STORAGE, async () => new Response(image, { headers: { 'content-type': 'image/svg+xml' } })), null);
  assert.equal(await icon.logoDataUri(STORAGE, async () => new Response('<html/>', { headers: { 'content-type': 'image/png' } })), null);
  assert.equal(await icon.logoDataUri(STORAGE, async () => new Response(image, { headers: { 'content-type': 'image/png', 'content-length': String(pwa.MAX_LOGO_BYTES + 1) } })), null);
  let cancelled = false, pulls = 0;
  const huge = new ReadableStream({ pull(c) { pulls++; c.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { cancelled = true; } });
  assert.equal(await icon.logoDataUri(STORAGE, async () => new Response(huge, { headers: { 'content-type': 'image/png' } })), null);
  assert.ok(cancelled); assert.ok(pulls <= 5);
  const fastTimeout = load('api/icon/[slug].ts', stubs, { setTimeout: fn => setTimeout(fn, 5) });
  assert.equal(await fastTimeout.logoDataUri(STORAGE, async (_, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(Error('aborted'))))), null);
  assert.equal(await icon.logoDataUri(STORAGE, async () => { throw Error('redirect'); }), null);
});

function decodePng(bytes, size) {
  const b = Buffer.from(bytes); assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(b.readUInt32BE(16), size); assert.equal(b.readUInt32BE(20), size);
  const idat = [];
  for (let offset = 8; offset < b.length;) { const length = b.readUInt32BE(offset), type = b.toString('ascii', offset + 4, offset + 8); if (type === 'IDAT') idat.push(b.subarray(offset + 8, offset + 8 + length)); offset += length + 12; }
  const pixels = inflateSync(Buffer.concat(idat)); assert.equal(pixels.length, (size * 3 + 1) * size); return pixels;
}
test('fallback real PNG 180/192/512: salon color, contrasting initials, broken/absent logo', async () => {
  for (const size of [180, 192, 512]) for (const logo_url of [null, 'http://127.0.0.1/x', 'data:image/png;base64,AAAA', STORAGE]) {
    const res = await icon.handleIcon(request(`?format=png&size=${size}`), env, async url => String(url).includes('/rest/v1/') ? Response.json([row({ logo_url })]) : new Response('missing', { status: 404 }));
    assert.equal(res.status, 200); assert.equal(res.headers.get('content-type'), 'image/png');
    const pixels = decodePng(await res.arrayBuffer(), size);
    assert.equal(pixels.subarray(1, 4).toString('hex'), 'd4af37'); assert.ok(pixels.includes(Buffer.from([0x0f, 0x17, 0x2a])), 'iniciais em #0F172A sobre dourado');
  }
  assert.equal(png.initials('Ána Bela'), 'AB');
  const svg = icon.buildIconSvg({ name: '<b>Ana', color: '#fff', logo: null, maskable: true });
  assert.match(svg, />BA<\/text>/, 'pontuação/HTML do nome descartados nas iniciais'); assert.doesNotMatch(svg, /<b>/);
  assert.match(icon.buildIconSvg({ name: 'Ana', color: '#000', logo: data, maskable: true }), /x="106" y="106" width="300"/);
});

test('fetchSalon legacy only missing optional column, never auth/other errors', async () => {
  for (const code of ['42703', 'PGRST204']) {
    const urls = [];
    const result = await pwa.fetchSalon('studio-ana', env, async url => { urls.push(url); return urls.length === 1 ? Response.json({ code, message: 'column salons.pwa_name does not exist' }, { status: 400 }) : Response.json([row()]); });
    assert.equal(result.name, 'Studio Ana'); assert.equal(urls.length, 2); assert.match(urls[0], /pwa_name/); assert.doesNotMatch(urls[1], /pwa_name/);
  }
  for (const [status, code, message] of [[401, '42703', 'pwa_name'], [403, 'PGRST204', 'pwa_name'], [500, '42703', 'pwa_name'], [400, '42703', 'is_active'], [400, '42501', 'pwa_name']]) {
    let calls = 0;
    assert.equal(await pwa.fetchSalon('studio-ana', env, async () => { calls++; return Response.json({ code, message }, { status }); }), 'error'); assert.equal(calls, 1);
  }
});

test('endpoints reject missing/disabled/invalid, errors uncached; contrast exports preserved', async () => {
  for (const handler of [icon.handleIcon, manifest.handleManifest]) {
    assert.equal((await handler(request(), env, rows(null))).status, 404);
    assert.equal((await handler(request(), env, rows(row({ pwa_enabled: false })))).status, 404);
    assert.equal((await handler(new Request('https://app.test/api/icon/a%2F..'), env, () => { throw Error('must not fetch'); })).status, 400);
    const error = await handler(request(), env, async () => { throw Error('network'); }); assert.equal(error.status, 502); assert.equal(error.headers.get('cache-control'), 'no-store');
  }
  for (const query of ['?format=html', '?format=png&size=100000', '?size=NaN']) assert.equal((await icon.handleIcon(request(query), env, rows(row()))).status, 400);
  for (const [color, foreground] of [['#FFFFFF', '#0F172A'], ['#000000', '#FFFFFF'], ['#2563EB', '#FFFFFF'], ['#D4AF37', '#0F172A'], ['#ff0', '#0F172A']]) assert.equal(pwa.textOnColor(color), foreground);
});

test('WCAG 1.4.3: texto sobre qualquer cor do salão atinge 4.5:1 sempre que possível', () => {
  for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) {
    const c = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    const fg = pwa.textOnColor(c), other = fg === '#FFFFFF' ? '#0F172A' : '#FFFFFF';
    assert.ok(pwa.contrastRatio(c, fg) >= pwa.contrastRatio(c, other), c);
    const bg = pwa.accessibleBackground(c);
    assert.ok(pwa.contrastRatio(bg, pwa.textOnColor(bg)) >= 4.5, `${c} -> ${bg}`);
    if (pwa.contrastRatio(c, fg) >= 4.5) assert.equal(bg, c, 'cor que já passa não muda');
  }
});

test('branding central: foto anexada vence, cores e iniciais', () => {
  const b = pwa.getEstablishmentBranding({ name: 'Clínica Ágata Bela', avatar_url: 'https://cdn.exemplo.com.br/a.png', pwa_icon_url: 'https://cdn.exemplo.com.br/old.png', primary_color: '#fafafa', secondary_color: 'lixo' });
  assert.equal(b.logo, 'https://cdn.exemplo.com.br/a.png'); assert.equal(b.initials, 'CA');
  assert.equal(b.primaryForeground, '#0F172A'); assert.equal(b.secondary, '#fafafa');
});

test('iniciais ignoram pontuação e acentos', () => {
  assert.equal(png.initials('Jefferson - Agendamento'), 'JA');
  assert.equal(png.initials('  Ágata & Cia. '), 'AC');
  assert.equal(png.initials('---'), '?');
  assert.equal(pwa.getEstablishmentBranding({ name: 'Studio - Bela' }).initials, 'SB');
});
