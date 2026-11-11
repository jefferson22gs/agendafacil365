// Retorno de procedimentos: mensagem, e-mail Resend (marca do salão, sem injeção), contrato do worker. Rodar: node --test tests/rebrand/returns.test.cjs
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
function load(rel) {
  const out = ts.transpileModule(read(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, require: () => ({}), URL, Date });
  return exports;
}
const core = load('supabase/functions/process-return-alerts/core.ts');
const front = (() => { const src = read('src/lib/procedureReturns.ts').replace(/^import .*$/m, 'const supabase = {};'); const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; const e = {}; vm.runInNewContext(out, { exports: e, Date }); return e; })();

test('mensagem: variáveis, intervalo humano, data BR, padrão quando vazio', () => {
  const v = { cliente: 'Ana', procedimento: 'Botox', salao: 'Clínica Bela', dias: 90, data_procedimento: '2026-08-10', link_agendamento: 'https://x.com/s/bela' };
  assert.equal(core.renderTemplate('{cliente}|{procedimento}|{salao}|{dias}|{data_procedimento}|{link_agendamento}|{outra}', v),
    'Ana|Botox|Clínica Bela|3 meses|10/08/2026|https://x.com/s/bela|{outra}');
  assert.match(core.renderTemplate('', v), /Já faz 3 meses desde seu Botox no Clínica Bela \(10\/08\/2026\)/);
  assert.equal(core.humanDays(7), '1 semana'); assert.equal(core.humanDays(30), '1 mês'); assert.equal(core.humanDays(180), '6 meses'); assert.equal(core.humanDays(15), '15 dias');
  assert.equal(front.humanDays(60), core.humanDays(60), 'front e servidor iguais');
});

test('e-mail: logo/cores do salão, contraste, HTML escapado, link só https', () => {
  const p = core.emailPayload({ from: 'Salão <a@b.com>', to: 'cli@x.com', salon: 'Ana <script>', color: '#fafafa', logo: 'https://cdn.x.com/logo.png',
    message: 'Oi <b>"x"</b>', url: 'https://agendafacil365.com.br/s/ana', procedure: 'Corte' });
  assert.deepEqual([...p.to], ['cli@x.com']);
  assert.match(p.html, /background:#fafafa;color:#0F172A/, 'texto escuro sobre cor clara');
  assert.match(p.html, /<img src="https:\/\/cdn\.x\.com\/logo\.png" alt="Logo de Ana &lt;script&gt;"/);
  assert.doesNotMatch(p.html, /<script>|<b>/); assert.match(p.html, /Agendar meu retorno/);
  assert.match(p.text, /Agendar: https:\/\/agendafacil365\.com\.br\/s\/ana/);
  assert.equal(core.emailPayload({ from: 'a@b.com', to: 'x', salon: 's', message: 'm', url: 'https://a.com', procedure: 'p' }), null, 'e-mail inválido');
  assert.equal(core.emailPayload({ from: 'a@b.com', to: 'c@d.com', salon: 's', message: 'm', url: 'javascript:alert(1)', procedure: 'p' }), null, 'link inseguro');
  assert.doesNotMatch(core.emailPayload({ from: 'a@b.com', to: 'c@d.com', salon: 's', logo: 'http://x/a.png', color: 'red;x', message: 'm', url: 'https://a.com', procedure: 'p' }).html, /<img|red;x/);
});

test('Resend: aceito ≠ entregue; só reenvia em falha temporária', () => {
  assert.equal(core.resendOutcome(200, { id: 'abc' }), 'accepted');
  assert.equal(core.resendOutcome(200, {}), 'retry', 'sem id: incerto, mesma chave de idempotência');
  for (const s of [429, 500, 503, 408, 409]) assert.equal(core.resendOutcome(s, null), 'retry');
  for (const s of [400, 401, 403, 422]) assert.equal(core.resendOutcome(s, null), 'failed');
});

test('prévia da data no painel', () => {
  assert.equal(front.returnDate('2026-01-31', 30), '2026-03-02');
  assert.equal(front.returnDate('2026-11-10', 0), null);
  assert.match(front.returnPreview('2026-11-10', 90), /08\/02\/2027 \(daqui a 3 meses/);
  assert.match(front.returnPreview('2026-11-10', 0), /Sem alerta/);
});

test('segurança: chave do Resend nunca no código; worker autentica; migration multi-tenant', () => {
  for (const f of ['supabase/functions/process-return-alerts/index.ts', 'supabase/functions/process-return-alerts/core.ts', 'MIGRATION_RETORNO_WHITELABEL_WCAG.sql'])
    assert.doesNotMatch(read(f), /re_[A-Za-z0-9]{10,}/, f);
  const idx = read('supabase/functions/process-return-alerts/index.ts');
  assert.match(idx, /authorizeWorker\(req\)/); assert.match(idx, /authorizeSalon\(req, db, body\.salon_id\)/); assert.match(idx, /\.eq\("salon_id", body\.salon_id\)/);
  const sql = read('MIGRATION_RETORNO_WHITELABEL_WCAG.sql');
  assert.match(sql, /CREATE POLICY procedure_return_alerts_managers[\s\S]*whatsapp_can_manage_salon\(salon_id\)/);
  assert.match(sql, /'marketing', r\.client_phone/, 'WhatsApp como marketing: opt-out revalidado no envio');
  assert.match(sql, /extract\(hour FROM now\(\) AT TIME ZONE coalesce\(sl\.timezone/, '09h no fuso do salão');
  assert.match(sql, /status = 'scheduled'/, 'reagendamento converte alertas');
});
