// Tela branca que só voltava com F5: chunk antigo após deploy, papéis do login ainda carregando e erro sem tela.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function loadChunkReload() {
  const out = ts.transpileModule(read('src/lib/chunkReload.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const store = new Map(); let reloads = 0;
  const ctx = { exports: {}, Date, String, Number, sessionStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }, window: { location: { reload: () => { reloads++; } } } };
  vm.runInNewContext(out, ctx);
  return { m: ctx.exports, reloads: () => reloads, store };
}

test('chunk antigo: reconhece o erro de import e recarrega uma vez só (sem laço)', () => {
  const { m, reloads, store } = loadChunkReload();
  for (const msg of ['Failed to fetch dynamically imported module: https://x/assets/A-1.js', 'Importing a module script failed.', "'text/html' is not a valid JavaScript MIME type", 'error loading dynamically imported module']) assert.equal(m.isChunkError(new Error(msg)), true, msg);
  assert.equal(m.isChunkError(new Error('Cannot read properties of undefined')), false, 'erro comum não recarrega');
  assert.equal(m.reloadOnceForNewVersion(), true); assert.equal(reloads(), 1);
  assert.equal(m.reloadOnceForNewVersion(), false, 'segunda falha logo depois mostra a tela de erro'); assert.equal(reloads(), 1);
  store.set('af365_chunk_reload', String(Date.now() - 60_000));
  assert.equal(m.reloadOnceForNewVersion(), true, 'nova versão mais tarde pode recarregar de novo');
});

test('arquivos /assets inexistentes não viram index.html; app inteiro sob ErrorBoundary', () => {
  const rw = JSON.parse(read('vercel.json')).rewrites.find(r => r.destination === '/');
  assert.equal(rw.source, '/((?!api/|assets/).*)', 'chunk antigo responde 404, não HTML');
  const main = read('src/main.tsx');
  assert.match(main, /installChunkReload\(\);/); assert.match(main, /<AppErrorBoundary><App \/><\/AppErrorBoundary>/);
  const app = read('src/App.tsx');
  assert.ok(!/<Suspense(?![^>]*fallback=\{<)/.test(app), 'todo Suspense mostra carregamento');
});

test('login: carregamento só termina com perfil e papéis (rota protegida não redireciona antes)', () => {
  const auth = read('src/hooks/useAuth.tsx');
  assert.match(auth, /if \(session\?\.user\) await fetchUserData\(session\.user\.id\);/);
  assert.match(auth, /\.finally\(\(\) => setLoading\(false\)\)/, 'mesmo com erro, sai do carregamento');
});
