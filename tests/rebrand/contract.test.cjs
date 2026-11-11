// Contrato SaaS (Autentique): validação, extenso, preenchimento e hash. Rodar: node --test tests/rebrand/contract.test.cjs
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function load(rel, stubs = {}) {
  const out = ts.transpileModule(fs.readFileSync(path.join(root, rel), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, require: (n) => stubs[n] ?? {}, crypto: globalThis.crypto, TextEncoder, Date, URL });
  return exports;
}
const template = load('supabase/functions/_shared/contract/template.ts');
const core = load('supabase/functions/_shared/contract/core.ts', { './template.ts': template });
const hooks = load('supabase/functions/autentique-webhook/verify.ts');

const contratante = {
  estabelecimento_nome: 'Studio Ana Bela', estabelecimento_cnpj: '11.222.333/0001-81', estabelecimento_segmento: 'Salão de Beleza',
  endereco_logradouro: 'Rua das Flores', endereco_numero: '100', endereco_bairro: 'Centro', endereco_cidade: 'Campinas', endereco_uf: 'sp', endereco_cep: '13010-000',
  responsavel_nome: 'Ana Bela Souza', responsavel_cpf: '529.982.247-25', responsavel_email: 'ANA@studio.com.br', responsavel_telefone: '(19) 99999-0000', plan: 'monthly',
};
const contratada = { company_name: 'Código Base Tecnologia', cnpj: '11222333000181', address: 'Av. Paulista, 1000 – São Paulo/SP', representative_name: 'Jefferson Silva',
  representative_cpf: '52998224725', email: 'contato@agendafacil365.com.br', platform_url: 'https://agendafacil365.com.br', city: 'São Paulo', forum: 'São Paulo/SP' };
const ctx = { slug: 'studio-ana', trialDays: 30, trialStart: new Date('2026-11-01T15:00:00Z'), trialEnd: new Date('2026-12-01T15:00:00Z'), now: new Date('2026-11-11T15:00:00Z') };

test('validação: CPF/CNPJ com dígito verificador, UF, CEP, e-mail; normaliza', () => {
  const { value, errors } = core.validateContratante(contratante);
  assert.deepEqual({ ...errors }, {}); assert.equal(value.endereco_uf, 'SP'); assert.equal(value.responsavel_email, 'ana@studio.com.br');
  assert.equal(value.estabelecimento_cnpj, '11222333000181');
  const bad = core.validateContratante({ ...contratante, responsavel_cpf: '111.111.111-11', estabelecimento_cnpj: '11.222.333/0001-80', endereco_uf: 'XX', endereco_cep: '123', responsavel_nome: 'Ana', plan: 'gratis' }).errors;
  for (const k of ['responsavel_cpf', 'estabelecimento_cnpj', 'endereco_uf', 'endereco_cep', 'responsavel_nome', 'plan']) assert.ok(bad[k], k);
  assert.ok(core.validCpf('52998224725')); assert.ok(!core.validCpf('52998224724'));
  assert.equal(core.validateContratante({ ...contratante, estabelecimento_nome: '{{RESPONSAVEL_CPF}}<x>' }).value.estabelecimento_nome.includes('{{'), false, 'sem injeção de variável/HTML');
});

test('valor por extenso e datas', () => {
  assert.equal(core.moneyWords(3990), 'trinta e nove reais e noventa centavos');
  assert.equal(core.moneyWords(40000), 'quatrocentos reais');
  assert.equal(core.moneyWords(100), 'um real'); assert.equal(core.moneyWords(1), 'um centavo');
  assert.equal(core.moneyWords(110050), 'mil e cem reais e cinquenta centavos');
  assert.equal(core.moneyWords(123456), 'mil duzentos e trinta e quatro reais e cinquenta e seis centavos');
  assert.equal(core.money(123456), '1.234,56');
  assert.equal(core.dateLong(ctx.now), '11 de novembro de 2026'); assert.equal(core.dateBr(ctx.trialEnd), '01/12/2026');
});

test('preenchimento: nenhuma variável sobra, dados das duas partes, hash verificável', async () => {
  const { value } = core.validateContratante(contratante);
  const r = await core.renderContract(value, contratada, ctx);
  assert.doesNotMatch(r.text, /\{\{/);
  for (const s of ['Studio Ana Bela', '11.222.333/0001-81', '529.982.247-25', '(19) 99999-0000', 'Código Base Tecnologia', 'R$ 39,90 (trinta e nove reais e noventa centavos)',
    '30 dias corridos — Início em 01/11/2026 e término em 01/12/2026', 'Dia 1 de cada ciclo', 'São Paulo, 11 de novembro de 2026', 'Slug PWA: studio-ana', 'Foro da Comarca de São Paulo/SP'])
    assert.ok(r.text.includes(s), s);
  assert.match(r.hash, /^[0-9a-f]{64}$/); assert.ok(r.text.includes(r.hash));
  assert.ok(await core.verifyContractHash(r.text, r.hash));
  assert.ok(!(await core.verifyContractHash(r.text.replace('Studio Ana Bela', 'Studio Outro'), r.hash)), 'adulteração detectada');
  assert.equal((await core.renderContract(value, contratada, ctx)).hash, r.hash, 'determinístico');
  assert.throws(() => core.fillTemplate({}, 'x {{FALTA}}'));
  assert.deepEqual([...core.missingContratada({ ...contratada, cnpj: ' ' })], ['cnpj']);
});

test('webhook: HMAC-SHA256 hex do corpo cru, comparação em tempo constante', async () => {
  const body = '{"event":{"id":"e1"}}', secret = 's3cr3t';
  const sig = require('node:crypto').createHmac('sha256', secret).update(body).digest('hex');
  assert.ok(await hooks.verifySignature(body, sig, secret));
  assert.ok(await hooks.verifySignature(body, sig.toUpperCase(), secret));
  assert.ok(!(await hooks.verifySignature(body + ' ', sig, secret)));
  assert.ok(!(await hooks.verifySignature(body, null, secret)));
  assert.ok(!(await hooks.verifySignature(body, sig, '')), 'sem segredo configurado: recusa');
});

test('PDF: estrutura válida (xref, páginas), acentos em WinAnsi, conteúdo integral', async () => {
  const pdf = load('supabase/functions/_shared/contract/pdf.ts');
  const { value } = core.validateContratante(contratante);
  const r = await core.renderContract(value, contratada, ctx);
  const bytes = Buffer.from(pdf.contractPdf(r.text, 'Contrato v1.0 — Agenda Fácil 365'));
  const s = bytes.toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4') && s.trimEnd().endsWith('%%EOF'));
  const count = Number(s.match(/\/Count (\d+)/)[1]); assert.ok(count >= 8 && count <= 30, `páginas: ${count}`);
  const xref = Number(s.match(/startxref\n(\d+)/)[1]); assert.equal(s.slice(xref, xref + 4), 'xref');
  for (const m of s.matchAll(/(\d{10}) 00000 n/g)) assert.match(s.slice(Number(m[1])), /^\d+ 0 obj/);
  assert.ok(s.includes('CL' + String.fromCharCode(92) + '301USULA'), 'Á em WinAnsi octal'); assert.ok(!/[\u0080-\u00ff]/.test(s.slice(20)), 'corpo ASCII');
  fs.writeFileSync(path.join(require('node:os').tmpdir(), 'af365-contrato-teste.pdf'), bytes);
});

test('CONTRATADA MEI: qualificação própria, sem CPF do representante, convite para outro e-mail', async () => {
  const { value } = core.validateContratante(contratante);
  const mei = { ...contratada, company_name: 'MARCO ANTONIO BOGGIAN', cnpj: '59760458000191', representative_name: 'Marco Antonio Boggian', representative_cpf: null,
    email: 'avisos@agendafacil365.com.br', address: 'Rua Jacques Pilon, nº 189, Vila Piauí, São Paulo/SP, CEP 05109-160',
    preamble: 'MARCO ANTONIO BOGGIAN, empresário individual enquadrado como Microempreendedor Individual – MEI, inscrito no CNPJ sob nº {{CONTRATADA_CNPJ}}, com endereço comercial na {{CONTRATADA_ENDERECO}}, titular e licenciante da plataforma eletrônica AGENDA FACIL 365 ({{PLATAFORMA_URL}}), neste ato representado por seu titular, {{CONTRATADA_REPRESENTANTE_NOME}}, e-mail oficial {{CONTRATADA_EMAIL}}, doravante denominada simplesmente CONTRATADA; e, de outro lado:' };
  assert.deepEqual([...core.missingContratada(mei)], []);
  const r = await core.renderContract(value, mei, ctx);
  const lines = r.text.split('\n');
  const p = lines.find((l) => l.startsWith('CONTRATADA: MARCO'));
  assert.ok(p && p.includes('Microempreendedor Individual – MEI, inscrito no CNPJ sob nº 59.760.458/0001-91'), p);
  assert.ok(p.includes('Rua Jacques Pilon, nº 189, Vila Piauí, São Paulo/SP, CEP 05109-160') && p.includes('e-mail oficial avisos@agendafacil365.com.br'));
  assert.ok(!lines.some((l) => l.startsWith('CONTRATADA: {{')) && !r.text.includes('{{'));
  const sig = lines.indexOf('CONTRATADA (DONO DO SISTEMA):');
  assert.equal(lines[sig + 3], 'Representante: Marco Antonio Boggian'); assert.equal(lines[sig + 4], 'E-mail: avisos@agendafacil365.com.br', 'sem linha de CPF vazia');
  assert.ok(!/CPF nº ,|CPF: \n/.test(r.text));
  assert.ok(await core.verifyContractHash(r.text, r.hash));
});
