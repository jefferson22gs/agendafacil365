// Navegação do painel: item ativo, busca do menu e cobertura de tours. Rodar: node --test tests/rebrand/layout.test.cjs
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function load(rel) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, require: () => ({}), URLSearchParams });
  return exports;
}
const nav = load('src/components/layouts/adminNav.ts');

test('item ativo: rotas, abas do WhatsApp e rotas antigas', () => {
  assert.deepEqual({ ...nav.activeNav('/admin/') }, { path: '/admin' });
  assert.deepEqual({ ...nav.activeNav('/admin/clients') }, { path: '/admin/clients' });
  assert.deepEqual({ ...nav.activeNav('/admin/whatsapp', '?aba=disparador') }, { path: '/admin/whatsapp', aba: 'disparador' });
  assert.deepEqual({ ...nav.activeNav('/admin/whatsapp', '?aba=invalida') }, { path: '/admin/whatsapp' });
  assert.deepEqual({ ...nav.activeNav('/admin/broadcast') }, { path: '/admin/whatsapp', aba: 'disparador' });
  assert.deepEqual({ ...nav.activeNav('/admin/export-contacts') }, { path: '/admin/whatsapp', aba: 'contatos' });
  assert.deepEqual({ ...nav.activeNav('/admin/training/abc') }, { path: '/admin/training' });
});

test('menu: WhatsApp único com abas na ordem pedida; barra inferior com 4 destinos + Menu', () => {
  const labels = nav.NAV_ITEMS.map(i => i.label);
  for (const old of ['Chatbot IA', 'Disparador', 'Agendador Status', 'Importar Contatos']) assert(!labels.includes(old), old);
  assert.deepEqual([...nav.WHATSAPP_TABS.map(t => t.aba)], ['conversas', 'disparador', 'status', 'chatbot', 'contatos', 'conexao']);
  assert(labels.includes('Marketing'));
  assert.deepEqual([...nav.BOTTOM_NAV.map(i => i.label)], ['Início', 'Agenda', 'Clientes', 'WhatsApp']);
  assert.equal(nav.whatsappTabHref('status'), '/admin/whatsapp?aba=status');
});

test('busca do menu: sem acento, palavra-chave e subitens', () => {
  const flat = q => [...nav.filterNav(nav.NAV_GROUPS, q).flatMap(g => g.items.map(i => i.label + (i.children ? `[${i.children.map(c => c.label).join(',')}]` : '')))];
  assert.equal(nav.filterNav(nav.NAV_GROUPS, '  ').length, nav.NAV_GROUPS.length);
  assert.deepEqual(flat('servicos'), ['Serviços']);
  assert.deepEqual(flat('comissao'), ['Financeiro']);
  assert.deepEqual(flat('conexao'), ['WhatsApp[Conexão]']);
  assert.deepEqual(flat('xyz'), []);
});

test('título do cabeçalho', () => {
  assert.equal(nav.pageTitle('/admin'), 'Dashboard');
  assert.equal(nav.pageTitle('/admin/whatsapp', '?aba=chatbot'), 'WhatsApp · Chatbot IA');
  assert.equal(nav.pageTitle('/admin/broadcast'), 'Disparador');
  assert.equal(nav.pageTitle('/admin/training/x'), 'Central de Treinamento');
});

test('todas as rotas /admin do App têm ajuda contextual', () => {
  const { contextForRoute } = load('src/features/training/registry/routeContext.ts');
  const routes = [...fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8').matchAll(/path="(\/admin[^"]*)"/g)].map(m => m[1].replace(':articleId', 'x'));
  assert(routes.length >= 20);
  for (const r of routes) assert(contextForRoute(r)?.tours.length, r);
});
