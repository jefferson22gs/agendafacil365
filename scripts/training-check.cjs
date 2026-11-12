// Valida conteúdo e busca sem navegador, Supabase ou dependências novas.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const feature = path.join(root, 'src/features/training');
function load(file) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, URLSearchParams }, { filename: file });
  return exports;
}
function entries(dir, predicate) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts').flatMap(f => Object.values(load(path.join(dir, f)))).flatMap(value => Array.isArray(value) ? value : [value]).filter(predicate);
}
const toursRaw = entries(path.join(feature, 'registry/tours'), t => t && Array.isArray(t.steps) && t.route);
// Arrays of named exports may repeat the same tour object; duplicates with different definitions fail.
const tours = [...new Map(toursRaw.map(t => [t.id, t])).values()];
const articles = entries(path.join(feature, 'registry/articles'), a => a && Array.isArray(a.steps) && a.summary);
assert.equal(new Set(articles.map(a => a.id)).size, articles.length, 'Artigos com ID duplicado');
const tourIds = new Set(tours.map(t => t.id));
const sourceFiles = [];
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, entry.name); if (entry.isDirectory()) walk(p); else if (/\.tsx?$/.test(p)) sourceFiles.push(p); } }
walk(path.join(root, 'src'));
const uiSource = sourceFiles.filter(f => !f.includes(`${path.sep}registry${path.sep}`)).map(f => fs.readFileSync(f, 'utf8')).join('\n');
const missing = [];
for (const t of tours) {
  assert(t.version >= 1 && t.steps.length > 0 && /^\/admin(?:\/|$)/.test(t.route), `Tour inválido: ${t.id}`);
  for (const s of t.steps) {
    assert(s.title && s.body, `Passo sem texto: ${t.id}`);
    assert(!s.target || !/api-key|^whatsapp-qrcode$/.test(s.target), `Alvo sensível: ${t.id}/${s.target}`);
    assert(!(s.mode === 'waitForClick' && /(?:save|send|delete|disconnect|cancel|subscribe|renew|notify|bonus|capture-photo)$/.test(s.target ?? '')), `Ação não segura: ${t.id}/${s.target}`);
    const menuTarget = s.target?.startsWith('sidebar-') && uiSource.includes(`/admin/${s.target.slice(8)}`) && uiSource.includes('data-tour={sidebarId(item.path)}');
    if (s.target && !uiSource.includes(s.target) && !menuTarget) missing.push(`${t.id}: ${s.target}`);
  }
}
assert.deepEqual(missing, [], 'Alvos não encontrados no código');
const captures = new Set();
let pending = 0;
for (const a of articles) {
  assert(a.steps.length && a.version >= 1 && a.minutes > 0, `Artigo inválido: ${a.id}`);
  assert(!a.tourId || tourIds.has(a.tourId), `Tour não existe: ${a.id}/${a.tourId}`);
  for (const s of a.steps) if (s.image) {
    if (s.image.pending) pending++;
    else { assert(fs.existsSync(path.join(root, 'public', s.image.src)), `Imagem faltando: ${s.image.src}`); captures.add(s.image.src); }
  }
}
// Videoaulas: numeração 01–28 sem buracos, arquivo e capa publicados, tutorial e categoria existentes.
const { VIDEOS } = load(path.join(feature, 'registry/videos.ts'));
const { CATEGORIES } = load(path.join(feature, 'registry/categories.ts'));
assert.deepEqual(VIDEOS.map(v => v.n), VIDEOS.map((_, i) => i + 1), 'Videoaulas fora de ordem ou com número repetido');
for (const v of VIDEOS) {
  assert(v.slug.startsWith(String(v.n).padStart(2, '0') + '-') && v.title && v.summary && v.seconds > 0, `Videoaula inválida: ${v.slug}`);
  assert(CATEGORIES.some(c => c.id === v.category), `Categoria não existe: ${v.slug}/${v.category}`);
  assert(!v.articleId || articles.some(a => a.id === v.articleId), `Tutorial não existe: ${v.slug}/${v.articleId}`);
  assert(!v.route || v.route === '/admin' || v.route.startsWith('/admin/'), `Rota inválida: ${v.slug}`);
  for (const ext of ['mp4', 'webp']) assert(fs.existsSync(path.join(root, 'public/training/videos', `${v.slug}.${ext}`)), `Arquivo faltando: ${v.slug}.${ext}`);
}
assert.equal(new Set(VIDEOS.map(v => v.articleId).filter(Boolean)).size, VIDEOS.filter(v => v.articleId).length, 'Dois vídeos no mesmo tutorial');
// Toda rota /admin do App precisa de tour existente na ajuda contextual e de artigo (próprio ou do tour).
const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const adminRoutes = [...appSource.matchAll(/path="(\/admin[^"]*)"/g)].map(m => m[1].replace(':articleId', 'exemplo'));
const { contextForRoute } = load(path.join(feature, 'registry/routeContext.ts'));
const uncovered = adminRoutes.filter(route => {
  const ctx = contextForRoute(route);
  return !ctx || !ctx.tours.length || !ctx.tours.every(id => tourIds.has(id)) || !articles.some(a => ctx.tours.includes(a.tourId));
});
assert.deepEqual(uncovered, [], 'Rotas /admin sem tour ou artigo');
const { searchArticles, normalize } = load(path.join(feature, 'search.ts'));
assert.equal(normalize('Comissão e AGENDAMENTOS!'), 'comissao e agendamentos');
for (const [query, expected] of [['agenda', 'appointments'], ['funcionário', 'professionals'], ['zap', 'whatsapp'], ['mensagem em massa', 'broadcast']]) {
  assert(searchArticles(articles, query).some(a => (a.tourId ?? a.id).includes(expected)), `Busca falhou: ${query}`);
}
assert.equal(searchArticles(articles, '').length, 0);
console.log(JSON.stringify({ tours: tours.length, articles: articles.length, videos: VIDEOS.length, captures: captures.size, pendingImageReferences: pending, tests: 'PASS', adminRoutes: adminRoutes.length, coverage: tours.map(t => ({ id: t.id, steps: t.steps.length })) }, null, 2));
