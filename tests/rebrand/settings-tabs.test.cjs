const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const exported = {};
vm.runInNewContext(ts.transpileModule(read('src/features/training/registry/routeContext.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exported, URLSearchParams });

test('configurações: cada aba tem painel e ajuda contextual correspondente', () => {
  const source = read('src/pages/admin/SalonSettings.tsx');
  for (const [tab, tour] of Object.entries({ dados: 'settings-info', horarios: 'settings-hours', agendamento: 'settings-public-link', aparencia: 'settings-branding', aplicativo: 'settings-myapp', cobranca: 'whatsapp-payments', avisos: 'settings-notifications' })) {
    assert.ok(source.includes(`<TabsContent value="${tab}"`), tab);
    assert.ok(exported.contextForRoute('/admin/settings', `?aba=${tab}`).tours.includes(tour), tour);
  }
  assert.equal(exported.contextForRoute('/admin/settings', '?aba=inexistente').tours[0], 'settings-info');
  assert.ok(source.includes('useState<SalonData>'), 'dados ficam no pai ao trocar abas');
});

test('cobrança: endereço antigo redireciona, tutorial abre configurações', () => {
  assert.match(read('src/pages/admin/whatsapp/WhatsAppCentral.tsx'), /Navigate to="\/admin\/settings\?aba=cobranca" replace/);
  assert.match(read('src/features/training/registry/tours/whatsapp-payments.ts'), /route: "\/admin\/settings\?aba=cobranca"/);
  assert.match(read('src/features/training/registry/tours/settings.ts'), /target: "settings-slug",\s+route: "\/admin\/settings\?aba=dados"/);
});
