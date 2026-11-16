// Anúncios da Meta: Pixel só com consentimento e só no site de vendas; Conversions API com hash e lista fixa de eventos.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('Pixel: carrega só com consentimento, nunca na demo; evento com event_id para deduplicar', () => {
  const src = read('src/lib/metaPixel.ts');
  assert.ok(src.includes('import.meta.env.MODE === "demo" || import.meta.env.MODE === "training" ? ""'), 'demo e treinamento sem Pixel');
  assert.match(src, /readConsent\(\) === "granted"\) start\(\)/, 'abertura só carrega com aceite anterior');
  assert.match(src, /if \(!pixelEnabled\(\) \|\| readConsent\(\) !== "granted"\) return;/, 'sem aceite, nenhum evento');
  assert.match(src, /eventID: eventId/); assert.match(src, /eventId, url: location\.href/, 'mesmo id no servidor');
  assert.match(src, /keepalive: true/, 'evento sai mesmo com navegação logo depois do cadastro');
  for (const p of ['src/pages/admin', 'src/pages/PublicSalon.tsx', 'src/pages/ClientPortal.tsx', 'src/pages/BookingFlow.tsx']) {
    const files = fs.statSync(path.join(root, p)).isDirectory() ? fs.readdirSync(path.join(root, p)).filter(f => /\.tsx?$/.test(f)).map(f => `${p}/${f}`) : [p];
    for (const f of files) assert.doesNotMatch(read(f), /metaPixel/, `${f}: clientes dos salões não são rastreados`);
  }
  assert.match(read('src/pages/Register.tsx'), /track\("CompleteRegistration"/);
  assert.match(read('src/pages/Index.tsx'), /<ConsentBanner \/>/);
});

test('Conversions API: só eventos permitidos e origem do site; e-mail e telefone normalizados para hash', () => {
  const src = read('supabase/functions/meta-capi/index.ts');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const m = { exports: {} };
  vm.runInNewContext(out, { exports: m.exports, require: () => ({ serve: () => {} }), Deno: { env: { get: () => undefined } }, crypto: require('node:crypto').webcrypto, TextEncoder, URL, Response, console });
  assert.equal(m.exports.normEmail('  Ana@Salao.COM '), 'ana@salao.com');
  assert.equal(m.exports.normEmail('sem-arroba'), null);
  assert.equal(m.exports.normPhone('(11) 91234-5678'), '5511912345678');
  assert.equal(m.exports.normPhone('+55 11 91234-5678'), '5511912345678');
  assert.equal(m.exports.normPhone('123'), null);
  assert.match(src, /new Set\(\["Lead", "CompleteRegistration", "Contact"\]\)/);
  assert.match(src, /if \(!origin \|\| !ORIGINS\.includes\(origin\)\) return reply\(403/);
  assert.match(src, /em: \[await sha256\(email\)\]/); assert.match(src, /ph: \[await sha256\(phone\)\]/);
  assert.doesNotMatch(src, /em: \[email\]|ph: \[phone\]/, 'nunca envia dado pessoal sem hash');
  assert.match(src, /skipped: "not_configured"/, 'sem segredos não faz nada');
  assert.match(read('supabase/config.toml'), /\[functions\.meta-capi\]\s*\r?\nverify_jwt = false/);
});
