const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '../..');

function demo(storage = new Map()) {
  const modules = new Map();
  const events = [];
  function load(file) {
    file = path.resolve(root, file);
    if (modules.has(file)) return modules.get(file);
    const exports = {};
    modules.set(file, exports);
    const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.MODE', '"demo"').replaceAll('import.meta.env', '({})');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(js, {
      exports, crypto: webcrypto, Date, Response, console,
      sessionStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) },
      window: { dispatchEvent: e => events.push(e) }, CustomEvent: class { constructor(type, data) { this.type = type; this.detail = data?.detail; } },
      require: name => load((name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(file), name)) + '.ts'),
    }, { filename: file });
    return exports;
  }
  return { client: load('src/features/training/demo/mockSupabase.ts').supabase, fixtures: load('src/features/training/demo/fixtures.ts'), storage, events };
}

test('demo seed: relações, datas, preços, agenda sem sobreposição', () => {
  const { createFixtures } = demo().fixtures;
  const db = createFixtures(new Date(2026, 10, 5, 15));
  assert.equal(db.salons[0].slug, 'studio-bella-demo');
  assert.equal(db.clients.length, 25);
  assert.equal(db.services.length, 6);
  assert.equal(db.professionals.length, 4);
  assert.ok(db.appointments.length > 300);
  assert.ok(db.appointments.some(a => a.date === '2026-11-05'));
  assert.ok(db.appointments.some(a => a.date === '2026-11-19'));
  for (const a of db.appointments) {
    assert.ok(db.services.some(s => s.id === a.service_id));
    assert.ok(db.professionals.some(p => p.id === a.professional_id));
    assert.ok(db.clients.some(c => c.id === a.client_id));
    assert.equal(a.final_price, a.price - a.discount);
    assert.ok(['confirmed','pending','completed','cancelled','no_show'].includes(a.status));
    assert.ok(a.start_time < a.end_time);
  }
  const groups = new Map();
  for (const a of db.appointments) {
    const key = `${a.date}/${a.professional_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  for (const rows of groups.values()) {
    rows.sort((a,b) => a.start_time.localeCompare(b.start_time));
    rows.slice(1).forEach((a,i) => assert.ok(rows[i].end_time <= a.start_time));
  }
  assert.ok(db.clients.every(c => c.email.endsWith('@example.com')));
});

test('demo CRUD, joins, upsert composto, views, ordenação, reload e reset', async () => {
  const { client: db, storage, fixtures } = demo();
  const { SALON_ID, USER_ID } = fixtures;
  const { data: c } = await db.from('clients').insert({ name: 'Teste', salon_id: SALON_ID }).select().single();
  assert.match(c.id, /^[a-f\d-]{36}$/);
  await db.from('clients').update({ name: 'Atualizado' }).eq('id', c.id);
  assert.equal((await db.from('clients').select().eq('id', c.id).single()).data.name, 'Atualizado');
  assert.equal((await demo(storage).client.from('clients').select().eq('id', c.id).single()).data.name, 'Atualizado');
  const progress = { user_id: USER_ID, salon_id: SALON_ID, item_key: 'test', item_version: 1 };
  for (const status of ['in_progress', 'completed']) await db.from('user_training_progress').upsert({ ...progress, status }, { onConflict: 'user_id,salon_id,item_key,item_version' });
  const rows = await db.from('user_training_progress').select();
  assert.equal(rows.data.length, 1);
  assert.equal(rows.data[0].status, 'completed');
  const { data: a } = await db.from('appointments').select('*, services:service_id(name), professionals(name), client:clients(name)').limit(1).single();
  assert.ok(a.services.name && a.professionals.name && a.client.name);
  const { data: r } = await db.from('referrals').select('*, referrer:clients!referrer_id(name)').limit(1).single();
  assert.ok(r.referrer.name);
  const packages = await db.from('service_packages_with_items').select();
  assert.equal(packages.data.length, 2);
  assert.ok(packages.data.every(p => p.items[0].service_name && p.items[0].service_price > 0));
  const sorted = await db.from('services').select().order('price', { ascending: false }).range(0,1);
  assert.equal(sorted.data.length,2);
  assert.ok(sorted.data[0].price >= sorted.data[1].price);
  await db.from('clients').delete().eq('id', c.id);
  assert.equal((await db.from('clients').select().eq('id', c.id).maybeSingle()).data, null);
  storage.clear();
  assert.equal((await demo(storage).client.from('clients').select('*', {head:true,count:'exact'})).count,25);
});

test('demo analytics e integrações indisponíveis sem rede', async () => {
  const { client, fixtures, events } = demo();
  const { data } = await client.rpc('get_salon_analytics', { p_salon_id: fixtures.SALON_ID, p_period: 'month' });
  assert.ok(data.total_revenue > 0 && data.completed_appointments > 0);
  assert.equal(data.revenue_by_day.length,7);
  assert.ok(data.top_services.length && data.top_professionals.length);
  assert.equal((await client.auth.getUser()).data.user.email,'demo@example.com');
  const res = await client.functions.invoke('infinitepay-checkout');
  assert.equal(res.error.message,'Indisponível na demonstração');
  assert.equal((await res.error.context.json()).error,'demo_unavailable');
  assert.equal(events.length,0,'InfinitePayButton já mostra o erro, sem toast duplicado');
  assert.equal((await client.storage.from('x').upload()).error.message,'Indisponível na demonstração');
  assert.equal(events[0].type,'demo:blocked');
});
