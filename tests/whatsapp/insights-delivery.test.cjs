const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const { Temporal } = require('@js-temporal/polyfill');
const root = path.resolve(__dirname, '../../supabase/functions/_shared');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const text = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = path.dirname(file);
  vm.runInNewContext(text, { exports, require: n => n.startsWith('https://') ? {} : n.startsWith('npm:@js-temporal') ? { Temporal } : load(path.join(dir, n).replace(/\\/g, '/')), crypto: require('node:crypto').webcrypto, Deno: { env: { get: () => undefined } }, TextEncoder, TextDecoder, Response, Request, URL, console: { warn() {} } });
  return exports;
}
const svc = load('insights/service.ts');
const SALON_A = 'aaaaaaaa-0000-4000-8000-000000000001', SALON_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const zero = { completed: 0, scheduled_total: 0, cuts: 0, cancelled: 0, no_show: 0, open: 0, revenue: 0, expected_revenue: 0, unique_clients: 0, new_clients: 0, unclassified_services: 0, by_dow: [], by_hour: [], by_service: [], top_professional: null, by_month: null, first_data_date: null };

// Banco em memória com unicidade real de (salon_id, dedupe_key) e (salon_id, idempotency_key).
function memoryDb({ instance = true, recipients = [{ id: 'r1', phone: '+5511900000001', verified_at: 'x', salon_id: SALON_A }] } = {}) {
  const reports = [], outbox = [], metricCalls = [];
  const api = {
    reports, outbox, metricCalls,
    rpc: async (name, args) => { if (name === 'insights_metrics') { metricCalls.push(args); return { data: { ...zero, completed: 8, revenue: 400, start: args.p_start, end_exclusive: args.p_end }, error: null }; } if (name === 'insights_dow_history') return { data: [], error: null }; if (name === 'whatsapp_instance_for') return { data: instance ? 'inst' : null, error: null }; return { data: null, error: null }; },
    from(table) {
      const f = []; let mode = 'select', payload = null, opts = {};
      const rows = () => {
        const src = table === 'insights_reports' ? reports : table === 'whatsapp_outbox' ? outbox : table === 'insights_recipients' ? recipients : table === 'whatsapp_instances' ? (instance ? [{ id: 'inst', salon_id: SALON_A }] : []) : table === 'salons' ? [{ id: SALON_A, name: 'A', timezone: 'America/Sao_Paulo' }, { id: SALON_B, name: 'B', timezone: 'America/Sao_Paulo' }] : [];
        return src.filter(r => f.every(([op, k, v]) => op === 'eq' ? r[k] === v : op === 'notnull' ? r[k] != null : op === 'gte' ? r[k] >= v : true));
      };
      const exec = async (single) => {
        if (mode === 'insert') {
          const target = table === 'insights_reports' ? reports : outbox;
          const dup = target.some(r => r.salon_id === payload.salon_id && r.dedupe_key === payload.dedupe_key && payload.dedupe_key);
          if (dup) return { data: null, error: { code: '23505' } };
          const row = { id: `${table}-${target.length + 1}`, ...payload }; target.push(row); return { data: row, error: null };
        }
        if (mode === 'upsert') {
          const ex = outbox.find(r => r.salon_id === payload.salon_id && r.idempotency_key === payload.idempotency_key);
          if (ex) return { data: opts.ignoreDuplicates ? null : ex, error: null };
          const row = { id: `out-${outbox.length + 1}`, ...payload }; outbox.push(row); return { data: row, error: null };
        }
        if (mode === 'update') { rows().forEach(r => Object.assign(r, payload)); return { data: null, error: null }; }
        const r = rows(); return { data: single ? (r[0] ?? null) : r, error: null };
      };
      const q = {
        select() { return q; }, eq(k, v) { f.push(['eq', k, v]); return q; }, not(k) { f.push(['notnull', k]); return q; }, gte(k, v) { f.push(['gte', k, v]); return q; },
        insert(p) { mode = 'insert'; payload = p; return q; }, upsert(p, o) { mode = 'upsert'; payload = p; opts = o || {}; return q; }, update(p) { mode = 'update'; payload = p; return q; },
        single: () => exec(true), maybeSingle: () => exec(true), then: (res, rej) => exec(false).then(res, rej),
      };
      return q;
    },
  };
  return api;
}
const settings = { weekly_enabled: true, monthly_enabled: false, yearly_enabled: false, alerts_enabled: false, weekly_day: 1, send_time: '08:00', show_professional_ranking: true, alert_drop_pct: 30, alert_growth_pct: 40, alert_cancel_rate_pct: 25, alert_cooldown_days: 7 };
const due = Temporal.Instant.from('2026-10-12T12:00:00Z'); // segunda 09:00 BRT

test('scheduled weekly report is queued once even if worker runs twice (restart)', async () => {
  const db = memoryDb();
  const a = await svc.runScheduled({ db, salonId: SALON_A }, settings, due);
  const b = await svc.runScheduled({ db, salonId: SALON_A }, settings, due);
  assert.equal(a.sent, 1); assert.equal(b.sent, 0);
  assert.equal(db.reports.length, 1); assert.equal(db.outbox.length, 1);
  assert.equal(db.outbox[0].category, 'administrative');
  assert.match(db.outbox[0].text_content, /RESUMO SEMANAL/);
});

test('not due before configured time; disabled reports never sent', async () => {
  const db = memoryDb();
  assert.equal((await svc.runScheduled({ db, salonId: SALON_A }, settings, Temporal.Instant.from('2026-10-12T10:00:00Z'))).sent, 0);
  assert.equal((await svc.runScheduled({ db, salonId: SALON_A }, { ...settings, weekly_enabled: false }, due)).sent, 0);
  assert.equal(db.outbox.length, 0);
});

test('unverified number never receives financial data', async () => {
  const db = memoryDb({ recipients: [{ id: 'r1', phone: '+5511900000001', verified_at: null, salon_id: SALON_A }] });
  const r = await svc.runScheduled({ db, salonId: SALON_A }, settings, due);
  assert.equal(r.reason, 'no_recipient'); assert.equal(db.outbox.length, 0);
});

test('WhatsApp not connected: report recorded as skipped, not queued', async () => {
  const db = memoryDb({ instance: false });
  await svc.runScheduled({ db, salonId: SALON_A }, settings, due);
  assert.equal(db.outbox.length, 0);
  assert.equal(db.reports[0].status, 'skipped'); assert.equal(db.reports[0].error_code, 'instance_missing');
});

test('metrics always requested for the caller salon only, closed period', async () => {
  const db = memoryDb();
  await svc.runScheduled({ db, salonId: SALON_A }, settings, due);
  assert(db.metricCalls.every(c => c.p_salon_id === SALON_A));
  assert(db.metricCalls.some(c => c.p_start === '2026-10-05' && c.p_end === '2026-10-12'));
  assert(db.metricCalls.some(c => c.p_start === '2026-09-28' && c.p_end === '2026-10-05'));
});

test('recipients of other salon are ignored', async () => {
  const db = memoryDb({ recipients: [{ id: 'rb', phone: '+5511900000002', verified_at: 'x', salon_id: SALON_B }] });
  const r = await svc.runScheduled({ db, salonId: SALON_A }, settings, due);
  assert.equal(r.reason, 'no_recipient');
});
