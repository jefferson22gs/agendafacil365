// Ícones de serviço por segmento: cobre os ramos atendidos, sem repetir emoji no grupo e com nome acessível.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const src = fs.readFileSync(path.join(root, 'src/features/services/serviceIcons.ts'), 'utf8');
const m = { exports: {} };
vm.runInNewContext(ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: m.exports, Map });
const { SERVICE_ICON_GROUPS: G, ALL_SERVICE_ICONS: ALL, iconName } = m.exports;

test('segmentos atendidos e ícones antigos preservados', () => {
  for (const id of ['cabelo', 'barbearia', 'unhas', 'sobrancelha', 'estetica', 'maquiagem', 'bemestar', 'saude', 'pet']) assert.ok(G.some(g => g.id === id), id);
  for (const old of ['✂️', '🧔', '💈', '💆', '👦', '📐', '🪒', '💇']) assert.ok(ALL.some(([e]) => e === old), `ícone já usado por salões: ${old}`);
  assert.ok(ALL.length >= 60, `catálogo amplo (${ALL.length})`);
});

test('cada botão tem nome legível e nenhum emoji repetido dentro do mesmo grupo', () => {
  for (const g of G) {
    const emojis = g.icons.map(([e]) => e);
    assert.equal(new Set(emojis).size, emojis.length, g.id);
    for (const [e, name] of g.icons) { assert.ok(e && name && name !== e, `${g.id}: ${e}`); }
  }
  assert.equal(iconName('💅'), 'Manicure'); assert.equal(iconName('🆕'), '🆕', 'ícone desconhecido mostra ele mesmo');
});

test('só emojis que celulares antigos mostram (sem blocos do Unicode 13+)', () => {
  // U+1FA70–1FAFF ganhou a maior parte dos emojis 13–15; os poucos de 12 usados aqui ficam liberados explicitamente.
  const ok12 = new Set([0x1fa92, 0x1fa79, 0x1fa7a]); // navalha, curativo, estetoscópio (Unicode 12)
  for (const [e, name] of ALL) for (const ch of e) {
    const cp = ch.codePointAt(0);
    assert.ok(!(cp >= 0x1fa70 && cp <= 0x1faff) || ok12.has(cp), `${name} (${e}) pode virar caixa vazia`);
  }
});
