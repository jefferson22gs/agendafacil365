// IA central: custo, cota, erros, chave mascarada, prompt e validação. Sem rede. Rodar: node --test tests/rebrand/ai.test.cjs
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function load(rel) {
  const out = ts.transpileModule(fs.readFileSync(path.join(root, rel), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, require: () => ({}), fetch: () => { throw new Error('rede proibida no teste'); } });
  return exports;
}
const ai = load('supabase/functions/_shared/ai/core.ts');
const cfg = (o = {}) => ({ ...ai.DEFAULT_CONFIG, ...o });
const state = (o = {}) => ({ salon_requests: 0, salon_tokens: 0, month_cost_usd: 0, limit_requests: null, limit_tokens: null, blocked: false, ...o });

test('custo: tabela, prefixo mais longo, preço manual e modelo desconhecido', () => {
  assert.equal(ai.estimateCost('gpt-4o-mini', 1_000_000, 1_000_000), 0.75);
  assert.equal(ai.estimateCost('gpt-4o-2024-08-06', 1_000_000, 0), 2.5, 'gpt-4o, não gpt-4o-mini');
  assert.equal(ai.estimateCost('google/gemini-2.5-flash-lite', 1_000_000, 0), 0.1, 'openrouter: ignora prefixo e prefere -lite');
  assert.equal(ai.estimateCost('gemini-2.5-flash', 1000, 500), 0.00155);
  assert.equal(ai.estimateCost('modelo-x', 1_000_000, 1_000_000), 5, 'desconhecido usa estimativa conservadora');
  assert.equal(ai.estimateCost('modelo-x', 1_000_000, 0, { price_in_per_mtok: 0.2, price_out_per_mtok: 0.8 }), 0.2, 'preço manual vence');
  assert.equal(ai.estimateCost('gpt-4o-mini', -5, 0), 0);
});

test('cota: orçamento global, padrão, exceção do salão, bloqueio e desativado', () => {
  assert.equal(ai.checkQuota(null, cfg(), true).ok, true, 'sem limites');
  assert.equal(ai.checkQuota(state(), cfg({ enabled: false }), true).reason, 'disabled');
  assert.equal(ai.checkQuota(state({ month_cost_usd: 10 }), cfg({ monthly_budget_usd: 10 }), true).reason, 'budget');
  assert.equal(ai.checkQuota(state({ month_cost_usd: 10 }), cfg({ monthly_budget_usd: 10 }), false).reason, 'budget', 'orçamento vale sem salão');
  assert.equal(ai.checkQuota(state({ month_cost_usd: 9.99 }), cfg({ monthly_budget_usd: 10 }), true).ok, true);
  assert.equal(ai.checkQuota(state({ salon_requests: 100 }), cfg({ default_salon_monthly_requests: 100 }), true).reason, 'salon_requests');
  assert.equal(ai.checkQuota(state({ salon_requests: 100, limit_requests: 500 }), cfg({ default_salon_monthly_requests: 100 }), true).ok, true, 'exceção maior vence padrão');
  assert.equal(ai.checkQuota(state({ salon_requests: 5, limit_requests: 5 }), cfg(), true).reason, 'salon_requests', 'exceção menor que padrão');
  assert.equal(ai.checkQuota(state({ salon_tokens: 2000 }), cfg({ default_salon_monthly_tokens: 2000 }), true).reason, 'salon_tokens');
  assert.equal(ai.checkQuota(state({ blocked: true }), cfg(), true).reason, 'salon_blocked');
  assert.equal(ai.checkQuota(state({ salon_requests: 0 }), cfg({ default_salon_monthly_requests: 0 }), true).reason, 'salon_requests', 'zero = sem IA');
});

test('erros dos provedores normalizados sem vazar corpo', () => {
  const n = (s, b, a) => ai.normalizeProviderError(s, b, a).code;
  assert.equal(n(null, null, true), 'timeout');
  assert.equal(n(null, null), 'unavailable');
  assert.equal(n(401, { error: { message: 'Incorrect API key provided: sk-abc' } }), 'invalid_key');
  assert.equal(n(400, { error: { message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }), 'invalid_key', 'Gemini devolve 400 para chave inválida');
  assert.equal(n(429, { error: { code: 'insufficient_quota' } }), 'provider_quota');
  assert.equal(n(402, {}), 'provider_quota');
  assert.equal(n(429, { error: { message: 'Rate limit reached' } }), 'rate_limited');
  assert.equal(ai.normalizeProviderError(429, {}).retryable, true);
  assert.equal(n(404, {}), 'invalid_model');
  assert.equal(n(400, { error: { message: 'The model `llama3-70b-8192` has been decommissioned' } }), 'invalid_model');
  assert.equal(n(400, { error: 'x' }), 'bad_request');
  assert.equal(n(503, 'Service Unavailable'), 'unavailable');
  for (const code of ['invalid_key', 'provider_quota', 'rate_limited', 'invalid_model', 'timeout', 'unavailable']) assert.ok(ai.AI_ERROR_TEXT[code], code);
});

test('chave mascarada mostra só os 4 últimos', () => {
  assert.equal(ai.maskKey('sk-proj-1234567890abcd'), '••••abcd');
  assert.equal(ai.maskKey('  AIzaSyXYZ1234  '), '••••1234');
  assert.equal(ai.maskKey('curta'), '••••', 'chave curta não revela nada');
  assert.equal(ai.maskKey(null), '');
});

test('prompt: plataforma antes do salão; texto/legenda só tom e regras', () => {
  const c = cfg({ base_prompt: 'Seja breve.', tone: 'acolhedor', rules: 'Nunca prometa desconto.', knowledge: 'Cancelamento: 24h.', examples: [{ q: 'Tem estacionamento?', a: 'Vou confirmar com a equipe.' }, { q: '', a: 'ignorado' }] });
  const p = ai.composeSystemPrompt(c, 'Você é a recepção do Salão X.', 'chatbot');
  assert.ok(p.indexOf('[Plataforma]') < p.indexOf('[Estabelecimento]'));
  for (const s of ['Seja breve.', 'acolhedor', 'Nunca prometa desconto.', 'Cancelamento: 24h.', 'P: Tem estacionamento?', 'Salão X']) assert.ok(p.includes(s), s);
  assert.ok(!p.includes('ignorado'), 'exemplo incompleto descartado');
  const t = ai.composeSystemPrompt(c, 'Copywriter.', 'texto');
  assert.ok(t.includes('acolhedor') && t.includes('Nunca prometa desconto.') && t.includes('Copywriter.'));
  assert.ok(!t.includes('Seja breve.') && !t.includes('Cancelamento') && !t.includes('estacionamento'), 'texto não recebe conhecimento do chatbot');
  assert.equal(ai.composeSystemPrompt(cfg(), 'Só salão.', 'chatbot'), 'Só salão.', 'sem treinamento: prompt do salão intacto (legado)');
  assert.equal(ai.composeSystemPrompt(cfg(), '', 'legenda'), '');
  assert.ok(ai.composeSystemPrompt(cfg({ base_prompt: 'x'.repeat(9000) }), '', 'chatbot').length < 4100, 'limite de tamanho');
});

test('adapters: Gemini x OpenAI-compatível, chave só em header', () => {
  const msgs = [{ role: 'system', content: 'S' }, { role: 'user', content: 'Oi' }, { role: 'assistant', content: 'Olá' }];
  const g = ai.buildRequest('gemini', 'gemini-2.5-flash', 'KEY123', msgs, { temperature: 0.5, maxTokens: 100 });
  assert.ok(!g.url.includes('KEY123'), 'chave nunca na URL');
  assert.equal(g.headers['x-goog-api-key'], 'KEY123');
  assert.equal(g.body.systemInstruction.parts[0].text, 'S');
  assert.deepEqual(g.body.contents.map(c => c.role), ['user', 'model']);
  const o = ai.buildRequest('groq', 'llama-3.3-70b-versatile', 'KEY123', msgs, { temperature: 0.2, maxTokens: 50, tools: [{ type: 'function' }] });
  assert.equal(o.headers.Authorization, 'Bearer KEY123');
  assert.equal(o.body.tool_choice, 'auto');
  const img = ai.buildRequest('openai', 'gpt-4o-mini', 'k', [{ role: 'user', content: 'x', image: { mime: 'image/png', data: 'AAA' } }], { temperature: 0, maxTokens: 10 });
  assert.equal(img.body.messages[0].content[1].image_url.url, 'data:image/png;base64,AAA');
  assert.throws(() => ai.buildRequest('desconhecido', 'm', 'k', msgs, { temperature: 0, maxTokens: 1 }));
  const pg = ai.parseResponse('gemini', { candidates: [{ content: { parts: [{ text: 'A' }, { text: 'B' }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 } });
  assert.deepEqual([pg.text, pg.tokensIn, pg.tokensOut], ['AB', 10, 2]);
  const po = ai.parseResponse('openai', { choices: [{ message: { content: null, tool_calls: [{ id: '1' }] } }] }, 40);
  assert.deepEqual([po.text, po.toolCalls.length, po.tokensIn], ['', 1, 10], 'sem usage: estimativa por caracteres');
  assert.equal(ai.supportsTools('gemini'), false);
});

test('config do painel validada na fronteira', () => {
  const ok = ai.sanitizeConfig({ provider: 'openai', model: 'gpt-4o-mini', temperature: '0.3', max_tokens: 400, monthly_budget_usd: '', default_salon_monthly_requests: 300, examples: [{ q: 'a', a: 'b' }, { q: '', a: '' }], fallback_message: '' });
  assert.equal(ok.temperature, 0.3);
  assert.equal(ok.monthly_budget_usd, null, 'vazio = sem limite');
  assert.equal(ok.examples.length, 1);
  assert.equal(ok.fallback_message, ai.DEFAULT_CONFIG.fallback_message);
  assert.equal(ok.on_limit, 'fallback');
  for (const bad of [{ provider: 'perplexity', model: 'x' }, { provider: 'openai', model: 'a b' }, { provider: 'openai', model: 'm', temperature: 2 }, { provider: 'openai', model: 'm', monthly_budget_usd: -1 }, { provider: 'openai', model: 'm', rules: 'x'.repeat(4001) }, { provider: 'openai', model: 'm', examples: Array(21).fill({ q: 'a', a: 'b' }) }])
    assert.throws(() => ai.sanitizeConfig(bad), JSON.stringify(bad).slice(0, 60));
});

test('frontend não fala com provedor nem lê chave; demo responde sem rede', () => {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const offenders = walk(path.join(root, 'src')).filter(f => /\.tsx?$/.test(f) && !f.endsWith(path.join('integrations', 'supabase', 'types.ts')) && !f.endsWith('ChatbotIA.tsx'))
    .filter(f => /api\.openai\.com|generativelanguage\.googleapis|api\.groq\.com|openrouter\.ai\/api|ai_provider_keys|salon_ai_configs/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
  const mock = fs.readFileSync(path.join(root, 'src/features/training/demo/mockSupabase.ts'), 'utf8');
  assert.match(mock, /"generate-text-content"/);
  assert.match(mock, /"generate-image-caption"/);
  assert.match(mock, /get_my_ai_usage/);
  const mig = fs.readFileSync(path.join(root, 'supabase/migrations/20261106003000_ai_central.sql'), 'utf8');
  assert.match(mig, /REVOKE ALL ON ai_private\.platform_keys FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(mig, /^\s*(DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE)/m, 'migração não apaga dados');
});
