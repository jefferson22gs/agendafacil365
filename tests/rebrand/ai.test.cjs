// IA central: custo, reserva/fail-closed, erros, chave mascarada, prompt, ferramentas Gemini e modelos. Sem rede.
// Rodar: node --test tests/rebrand/ai.test.cjs  (SQL da reserva: tests/rebrand/ai-reserve.sql, manual)
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const noNet = () => { throw new Error('rede proibida no teste'); };
function load(rel, stubs = {}, globals = {}) {
  const out = ts.transpileModule(fs.readFileSync(path.join(root, rel), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, require: n => stubs[n] ?? {}, fetch: noNet, Response, AbortSignal, DOMException, JSON, Date, console: { warn() {} }, ...globals });
  return exports;
}
const ai = load('supabase/functions/_shared/ai/core.ts');
const plain = v => JSON.parse(JSON.stringify(v)); // objetos do vm têm outro protótipo
const cfg = (o = {}) => ({ ...ai.DEFAULT_CONFIG, ...o });
const env = {};
const gw = load('supabase/functions/_shared/ai/gateway.ts', { './core.ts': ai, '../whatsapp/errors.ts': { corsHeaders: {} } }, { Deno: { env: { get: k => env[k] } } });

test('custo: preços oficiais Gemini, cache, raciocínio, vigência e preço manual', () => {
  const jan = new Date('2027-01-02T00:00:00Z'), now = new Date('2026-11-06T00:00:00Z');
  assert.equal(ai.estimateCost('gemini-3.6-flash', { tokensIn: 1e6, tokensOut: 1e6 }, null, now), 4.5, '0,75 + 3,75 até 31/12/2026');
  assert.equal(ai.estimateCost('gemini-3.6-flash', { tokensIn: 1e6, tokensOut: 1e6 }, null, jan), 9, '1,50 + 7,50 a partir de 2027');
  assert.equal(ai.estimateCost('gemini-3.5-flash-lite', { tokensIn: 1e6, tokensOut: 0 }, null, now), 0.3, 'flash-lite não confunde com flash');
  assert.equal(ai.estimateCost('gemini-3.6-flash', { tokensIn: 1e6, tokensOut: 0, tokensCached: 1e6 }, null, now), 0.075, 'cache pelo preço de cache');
  assert.equal(ai.estimateCost('gemini-4-argon', { tokensIn: 0, tokensOut: 1e6 }, null, new Date('2026-12-02')), 20);
  assert.equal(ai.estimateCost('modelo-x', { tokensIn: 1e6, tokensOut: 1e6 }), 24, 'desconhecido usa o maior preço');
  assert.equal(ai.estimateCost('gemini-9-flash', { tokensIn: 1e6, tokensOut: 0, tokensCached: 5e5 }, { price_in_per_mtok: 1, price_out_per_mtok: 2, price_cache_per_mtok: 0.1 }), 0.55, 'preço manual vence');
  assert.equal(ai.estimateCost('gemini-3.6-flash', { tokensIn: -5, tokensOut: 0 }), 0);
});

test('uso Gemini: raciocínio conta como saída, cache e prompt de ferramenta como entrada', () => {
  const r = ai.parseResponse('gemini', { candidates: [{ content: { parts: [{ text: 'Oi' }] } }], usageMetadata: { promptTokenCount: 100, toolUsePromptTokenCount: 10, cachedContentTokenCount: 40, candidatesTokenCount: 5, thoughtsTokenCount: 30, totalTokenCount: 145 } });
  assert.deepEqual([r.tokensIn, r.tokensOut, r.tokensCached, r.tokensThoughts, r.exactUsage], [110, 35, 40, 30, true]);
  const s = ai.parseResponse('gemini', { candidates: [{ content: { parts: [{ text: 'abcd' }] } }] }, 40);
  assert.deepEqual([s.tokensIn, s.tokensOut, s.exactUsage], [10, 1, false], 'sem usageMetadata: estimativa, liquidação mantém reserva');
});

test('reserva estimada cobre saída máxima, ferramentas e imagem', () => {
  const r = ai.reservationEstimate('gemini-3.6-flash', [{ content: 'x'.repeat(300) }, { content: 'y', image: {} }], 1000, [{ function: { name: 'a' } }]);
  assert.ok(r.tokens >= 100 + 1500 + 1000, String(r.tokens));
  assert.ok(r.cost > 0);
  assert.equal(ai.reservationEstimate('m', [{ content: 'x'.repeat(10_000_000) }], 1000).tokens, ai.MAX_RESERVED_TOKENS);
});

test('erros normalizados sem vazar corpo; cobrança incerta preserva reserva', () => {
  const n = (s, b, a) => plain(ai.normalizeProviderError(s, b, a));
  assert.deepEqual(n(null, null, true), { code: 'timeout', retryable: true, charged: true });
  assert.equal(n(null, null).charged, true, 'rede: pode ter sido processado');
  assert.equal(n(503, 'x').charged, true);
  assert.deepEqual([n(400, { error: { message: 'API key not valid.' } }).code, n(400, { error: { message: 'API key not valid.' } }).charged], ['invalid_key', false]);
  assert.equal(n(429, { error: { code: 'insufficient_quota' } }).code, 'provider_quota');
  assert.deepEqual([n(429, {}).code, n(429, {}).charged], ['rate_limited', false]);
  assert.equal(n(404, {}).code, 'invalid_model');
  assert.equal(n(400, { error: 'x' }).code, 'bad_request');
  for (const code of ['invalid_key', 'provider_quota', 'rate_limited', 'invalid_model', 'timeout', 'unavailable', 'persistence_failed', 'quota_exceeded']) assert.ok(ai.AI_ERROR_TEXT[code], code);
});

test('chave mascarada mostra só os 4 últimos', () => {
  assert.equal(ai.maskKey('AIzaSy-1234567890abcd'), '••••abcd');
  assert.equal(ai.maskKey('curta'), '••••');
  assert.equal(ai.maskKey(null), '');
});

test('prompt: plataforma antes do salão; texto/legenda só tom e regras', () => {
  const c = cfg({ base_prompt: 'Seja breve.', tone: 'acolhedor', rules: 'Nunca prometa desconto.', knowledge: 'Cancelamento: 24h.', examples: [{ q: 'Tem estacionamento?', a: 'Vou confirmar.' }, { q: '', a: 'ignorado' }] });
  const p = ai.composeSystemPrompt(c, 'Você é a recepção do Salão X.', 'chatbot');
  assert.ok(p.indexOf('[Plataforma]') < p.indexOf('[Estabelecimento]'));
  for (const s of ['Seja breve.', 'acolhedor', 'Nunca prometa desconto.', 'Cancelamento: 24h.', 'P: Tem estacionamento?', 'Salão X']) assert.ok(p.includes(s), s);
  assert.ok(!p.includes('ignorado'));
  const t = ai.composeSystemPrompt(c, 'Copywriter.', 'texto');
  assert.ok(t.includes('acolhedor') && !t.includes('Seja breve.') && !t.includes('Cancelamento'));
  assert.equal(ai.composeSystemPrompt(cfg(), 'Só salão.', 'chatbot'), 'Só salão.');
});

const TOOLS = [{ type: 'function', function: { name: 'available_slots', description: 'Horários', parameters: { type: 'object', properties: { date: { type: 'string' } }, required: ['date'], additionalProperties: false } } }, { type: 'function', function: { name: 'services', description: 'Serviços', parameters: { type: 'object', properties: {}, additionalProperties: false } } }];

test('Gemini: ferramentas na ida (functionDeclarations, AUTO, thinkingLevel, sem temperature no 3.x)', () => {
  const req = ai.buildRequest('gemini', 'gemini-3.6-flash', 'KEY123', [{ role: 'system', content: 'S' }, { role: 'user', content: 'Oi' }], { temperature: 0.2, maxTokens: 800, tools: TOOLS, thinkingLevel: 'LOW' });
  const b = plain(req.body);
  assert.ok(!req.url.includes('KEY123') && req.headers['x-goog-api-key'] === 'KEY123', 'chave só no header');
  assert.equal(b.tools[0].functionDeclarations[0].name, 'available_slots');
  assert.deepEqual(b.tools[0].functionDeclarations[0].parametersJsonSchema.required, ['date'], 'JSON Schema intacto');
  assert.equal(b.toolConfig.functionCallingConfig.mode, 'AUTO');
  assert.deepEqual(b.generationConfig, { maxOutputTokens: 800, thinkingConfig: { thinkingLevel: 'LOW' } });
  assert.equal(b.systemInstruction.parts[0].text, 'S');
  const old = plain(ai.buildRequest('gemini', 'gemini-2.5-flash-lite', 'k', [{ role: 'user', content: 'x' }], { temperature: 0.3, maxTokens: 10 }).body);
  assert.deepEqual(old.generationConfig, { maxOutputTokens: 10, temperature: 0.3 }, '2.x: temperature, sem thinkingLevel (daria erro)');
});

test('Gemini: functionCall -> toolCalls (formato OpenAI) e volta com functionResponse + thoughtSignature', () => {
  const parts = [{ text: 'Vou ver.', thought: false }, { functionCall: { name: 'available_slots', args: { date: '2026-11-10' }, id: 'fc1' }, thoughtSignature: 'SIG-A' }, { functionCall: { name: 'services', args: {} }, thoughtSignature: 'SIG-B' }, { text: 'pensando', thought: true }];
  const r = ai.parseResponse('gemini', { candidates: [{ content: { role: 'model', parts } }] });
  assert.equal(r.text, 'Vou ver.', 'partes de raciocínio não vão para o texto');
  assert.deepEqual(plain(r.toolCalls).map(c => [c.id, c.type, c.function.name, JSON.parse(c.function.arguments)]), [['fc1', 'function', 'available_slots', { date: '2026-11-10' }], ['gemini_call_1', 'function', 'services', {}]]);
  // Turno seguinte: assistente intacto + respostas das ferramentas (mesmo turno, mesma ordem, id/nome casados).
  const history = [
    { role: 'system', content: 'S' }, { role: 'user', content: 'Tem horário dia 10?' },
    ai.assistantTurn(r.message, r.toolCalls),
    { role: 'tool', tool_call_id: 'fc1', content: JSON.stringify({ slots: ['09:00'] }) },
    { role: 'tool', tool_call_id: 'gemini_call_1', content: JSON.stringify([{ name: 'Corte' }]) },
  ];
  const c = plain(ai.toGeminiContents(history));
  assert.equal(c.length, 3);
  assert.deepEqual(c[1], { role: 'model', parts }, 'partes do modelo reenviadas sem alteração (thoughtSignature preservado)');
  assert.deepEqual(c[2], { role: 'user', parts: [
    { functionResponse: { name: 'available_slots', id: 'fc1', response: { slots: ['09:00'] } } },
    { functionResponse: { name: 'services', response: { result: [{ name: 'Corte' }] } } },
  ] }, 'array vira objeto {result}; sem id inventado quando o Gemini não mandou');
  // Histórico salvo sem partes originais (texto do banco): reconstrói texto, sem functionCall falso.
  assert.deepEqual(plain(ai.toGeminiContents([{ role: 'assistant', content: 'Olá' }])), [{ role: 'model', parts: [{ text: 'Olá' }] }]);
});

test('Gemini: OpenAI-compatível não recebe campos internos (gemini_parts/gemini_id)', () => {
  const m = [{ role: 'assistant', content: null, tool_calls: [{ id: 'a', type: 'function', function: { name: 'x', arguments: '{}' }, gemini_id: 'a' }], gemini_parts: [{}] }];
  const b = plain(ai.buildRequest('openai', 'gpt-4o-mini', 'k', m, { temperature: 0, maxTokens: 1 }).body);
  assert.ok(!JSON.stringify(b).includes('gemini_'));
});

test('modelos: filtra estáveis com generateContent e ordena por versão', () => {
  const list = { models: [
    ['gemini-2.5-flash', 1], ['gemini-3.6-flash', 1], ['gemini-3.8-flash', 1], ['gemini-3.5-flash-lite', 1], ['gemini-3.1-pro-preview', 1],
    ['gemini-3.8-flash-tts', 1], ['gemini-3.8-live', 1], ['gemini-3.1-flash-image', 1], ['gemini-embedding-001', 0], ['gemini-flash-latest', 1],
    ['gemini-2.5-pro', 1], ['gemini-4-argon', 1], ['gemini-10-flash', 0], ['gemini-3.10-flash', 1],
  ].map(([n, gc]) => ({ name: `models/${n}`, displayName: n, supportedGenerationMethods: gc ? ['generateContent', 'countTokens'] : ['embedContent'] })) };
  const p = plain(ai.pickModels(list));
  assert.equal(p.flash, 'gemini-3.10-flash', 'ordem numérica (3.10 > 3.8), sem generateContent fica fora');
  assert.equal(p.pro, 'gemini-4-argon', 'pro = maior tier não-flash estável (preview fora)');
  assert.ok(!p.models.some(m => /preview|tts|live|image|embedding|latest/.test(m.id)));
  assert.ok(p.models.some(m => m.id === 'gemini-3.5-flash-lite' && m.family === null), 'flash-lite listado, fora do automático');
  assert.equal(ai.pickModels({}).flash, null);
});

test('modelos: cache 24h, troca de família invalida, fallback', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  const c = cfg({ model_mode: 'auto', model_family: 'flash', resolved_model: 'gemini-3.8-flash', resolved_family: 'flash', resolved_at: '2026-11-06T00:00:00Z' });
  assert.equal(ai.cachedModel(c, now), 'gemini-3.8-flash');
  assert.equal(ai.cachedModel({ ...c, resolved_at: '2026-11-04T00:00:00Z' }, now), null, 'expirado');
  assert.equal(ai.cachedModel({ ...c, model_family: 'pro' }, now), null, 'família mudou');
  assert.equal(ai.cachedModel({ ...c, model_mode: 'fixed', model: 'gemini-3.5-flash-lite' }, now), 'gemini-3.5-flash-lite');
  assert.equal(ai.staleModel({ ...c, resolved_at: '2020-01-01' }), 'gemini-3.8-flash', 'último resolvido');
  assert.equal(ai.staleModel(cfg({ model_family: 'pro' })), ai.FALLBACK_MODEL);
});

test('config do painel validada: só Gemini', () => {
  const ok = ai.sanitizeConfig({ provider: 'gemini', model: 'gemini-3.6-flash', model_mode: 'auto', model_family: 'pro', thinking_level: 'MEDIUM', max_tokens: 2000, monthly_budget_usd: '', examples: [{ q: 'a', a: 'b' }] });
  assert.deepEqual([ok.provider, ok.model_family, ok.thinking_level, ok.monthly_budget_usd], ['gemini', 'pro', 'MEDIUM', null]);
  for (const bad of [{ provider: 'openai' }, { model: 'gpt-4o' }, { model: 'gemini-x y' }, { thinking_level: 'MAX' }, { max_tokens: 10 }, { monthly_budget_usd: -1 }, { examples: Array(21).fill({ q: 'a', a: 'b' }) }])
    assert.throws(() => ai.sanitizeConfig({ provider: 'gemini', model: 'gemini-3.6-flash', ...bad }), JSON.stringify(bad));
});

// ---- Gateway: banco e fetch falsos -------------------------------------------------------------
function fakeDb({ config = { data: null, error: null }, key = { data: 'AIzaKEY12345678', error: null }, reserve = { data: [{ reservation_id: 7, reason: null }], error: null }, settle = { data: true, error: null } } = {}) {
  const calls = [];
  const q = res => { const o = { select: () => o, eq: () => o, update: () => o, maybeSingle: async () => res, then: r => r({ error: null }) }; return o; };
  return {
    calls,
    from: t => { calls.push(['from', t]); return q(t === 'ai_platform_config' ? config : { data: [], error: null }); },
    rpc: async (fn, args) => { calls.push([fn, args]); return fn === 'ai_reserve' ? reserve : fn === 'ai_settle' ? settle : fn === 'ai_platform_secret' ? key : { data: null, error: null }; },
  };
}
const central = (o = {}) => ({ mode: 'central', cfg: cfg({ model_mode: 'fixed' }), provider: 'gemini', model: 'gemini-3.6-flash', key: 'k', temperature: 0.5, maxTokens: 500, ...o });
const okFetch = body => async () => new Response(JSON.stringify(body), { status: 200 });
const call = { salonId: 's1', feature: 'chatbot', messages: [{ role: 'user', content: 'oi' }] };

test('fail-closed: erro de banco na config/chave não cai no legado', async () => {
  let legacyCalled = false;
  const legacy = async () => { legacyCalled = true; return { provider: 'gemini', model: 'm', key: 'x' }; };
  await assert.rejects(gw.resolveAI(fakeDb({ config: { data: null, error: { code: '57014' } } }), legacy), e => e.code === 'persistence_failed');
  assert.equal(legacyCalled, false);
  assert.equal(await gw.loadPlatformConfig(fakeDb({ config: { data: null, error: { code: '42P01' } } })), null, 'só tabela ausente é legado');
  await assert.rejects(gw.resolveAI(fakeDb({ config: { data: { enabled: true }, error: null }, key: { data: null, error: { code: 'XX000' } } }), legacy), e => e.code === 'persistence_failed');
  const leg = await gw.resolveAI(fakeDb(), legacy);
  assert.equal(leg.mode, 'legacy', 'sem linha de config: legado explícito');
});

test('reserva antes de cada chamada; bloqueio não chama o provedor', async () => {
  let fetched = 0;
  const db = fakeDb({ reserve: { data: [{ reservation_id: null, reason: 'salon_requests' }], error: null } });
  await assert.rejects(gw.aiChat(db, central(), call, async () => { fetched++; }), e => e.code === 'quota_exceeded' && e.reason === 'salon_requests');
  assert.equal(fetched, 0);
  const db2 = fakeDb({ reserve: { data: null, error: { code: '40P01' } } });
  await assert.rejects(gw.aiChat(db2, central(), call, async () => { fetched++; }), e => e.code === 'persistence_failed');
  assert.equal(fetched, 0, 'erro na reserva fecha');
  const db3 = fakeDb({ reserve: { data: null, error: { code: 'PGRST202' } } });
  await assert.rejects(gw.aiChat(db3, central(), call, async () => { fetched++; }), e => e.code === 'persistence_failed', 'central sem RPC também fecha');
  assert.equal(fetched, 0);
  const db4 = fakeDb({ reserve: { data: null, error: { code: 'PGRST202' } } });
  const out = await gw.aiChat(db4, central({ mode: 'legacy' }), call, okFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }));
  assert.equal(out.text, 'ok', 'legado sem migração: única exceção');
});

test('liquidação: sucesso com uso real; 4xx devolve; timeout mantém; falha de liquidação não é ignorada', async () => {
  const db = fakeDb();
  await gw.aiChat(db, central(), call, okFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2, thoughtsTokenCount: 3, totalTokenCount: 15 } }));
  const s = plain(db.calls.find(c => c[0] === 'ai_settle')[1]);
  assert.deepEqual([s.p_id, s.p_status, s.p_tokens_in, s.p_tokens_out, s.p_tokens_thoughts, s.p_exact, s.p_charged], [7, 'ok', 10, 5, 3, true, true]);
  const reserve = plain(db.calls.find(c => c[0] === 'ai_reserve')[1]);
  assert.ok(reserve.p_tokens >= 500 && reserve.p_cost > 0, 'reserva cobre a saída máxima');

  const db4xx = fakeDb();
  await assert.rejects(gw.aiChat(db4xx, central(), call, async () => new Response('{"error":{"message":"API key not valid"}}', { status: 400 })), e => e.code === 'invalid_key');
  assert.equal(plain(db4xx.calls.find(c => c[0] === 'ai_settle')[1]).p_charged, false);

  const dbTo = fakeDb();
  await assert.rejects(gw.aiChat(dbTo, central(), call, async () => { throw new DOMException('t', 'TimeoutError'); }), e => e.code === 'timeout');
  assert.equal(plain(dbTo.calls.find(c => c[0] === 'ai_settle')[1]).p_charged, true, 'gasto incerto continua contando');

  const dbBad = fakeDb({ settle: { data: null, error: { code: '08006' } } });
  await assert.rejects(gw.aiChat(dbBad, central(), call, okFetch({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })), e => e.code === 'persistence_failed');
  const dbGone = fakeDb({ settle: { data: false, error: null } });
  await assert.rejects(gw.aiChat(dbGone, central(), call, okFetch({ candidates: [] })), e => e.code === 'persistence_failed', 'reserva já liquidada/inexistente');

  const dbNoKey = fakeDb();
  await assert.rejects(gw.aiChat(dbNoKey, central({ key: '' }), call, async () => { throw new Error('não deveria chamar'); }), e => e.code === 'not_configured');
  assert.equal(plain(dbNoKey.calls.find(c => c[0] === 'ai_settle')[1]).p_charged, false, 'sem chave: reserva devolvida');
});

test('modelo automático: lista, grava cache, cai no último resolvido', async () => {
  const db = fakeDb();
  const c = cfg({ model_mode: 'auto', model_family: 'flash' });
  const list = { models: [{ name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] }] };
  let url = '', headers = {};
  assert.equal(await gw.effectiveModel(db, c, 'KEY', async (u, init) => { url = u; headers = init.headers; return new Response(JSON.stringify(list), { status: 200 }); }), 'gemini-3.8-flash');
  assert.ok(url.endsWith('/v1beta/models?pageSize=1000') && headers['x-goog-api-key'] === 'KEY' && !url.includes('KEY'));
  assert.equal(c.resolved_model, 'gemini-3.8-flash');
  assert.equal(await gw.effectiveModel(db, c, 'KEY', noNet), 'gemini-3.8-flash', 'cache: sem rede');
  const stale = cfg({ model_mode: 'auto', model_family: 'flash', resolved_model: 'gemini-3.6-flash', resolved_family: 'flash', resolved_at: '2020-01-01T00:00:00Z' });
  assert.equal(await gw.effectiveModel(db, stale, 'KEY', async () => new Response('{}', { status: 500 })), 'gemini-3.6-flash');
  assert.equal(await gw.effectiveModel(db, cfg({ model_mode: 'auto' }), 'KEY', async () => { throw new TypeError('rede'); }), ai.FALLBACK_MODEL);
});

test('frontend não fala com provedor nem lê chave; demo responde sem rede; migração não apaga dados', () => {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const offenders = walk(path.join(root, 'src')).filter(f => /\.tsx?$/.test(f) && !f.endsWith(path.join('integrations', 'supabase', 'types.ts')) && !f.endsWith('ChatbotIA.tsx'))
    .filter(f => /api\.openai\.com|generativelanguage\.googleapis|api\.groq\.com|openrouter\.ai\/api|ai_provider_keys|salon_ai_configs/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
  const mock = fs.readFileSync(path.join(root, 'src/features/training/demo/mockSupabase.ts'), 'utf8');
  for (const s of ['"generate-text-content"', '"generate-image-caption"', 'get_my_ai_usage']) assert.ok(mock.includes(s), s);
  const mig = fs.readFileSync(path.join(root, 'supabase/migrations/20261106003000_ai_central.sql'), 'utf8');
  assert.match(mig, /REVOKE ALL ON ai_private\.platform_keys FROM PUBLIC, anon, authenticated/);
  assert.match(mig, /pg_advisory_xact_lock/);
  assert.doesNotMatch(mig, /^\s*(DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE)/m);
  const chatbot = fs.readFileSync(path.join(root, 'supabase/functions/_shared/whatsapp/chatbot.ts'), 'utf8');
  assert.doesNotMatch(chatbot, /provider === "gemini"/, 'sem atalho sem ferramentas para Gemini');
  assert.doesNotMatch(chatbot, /fetch\(/, 'chatbot só chama IA pelo gateway');
});
