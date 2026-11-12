// Alertas por e-mail ao cliente: um texto por tipo (assunto, botão, destino) e regras da fila na migração. Sem rede.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const out = ts.transpileModule(fs.readFileSync(path.join(root, 'supabase/functions/client-emails/core.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const core = {}; vm.runInNewContext(out, { exports: core, Date });
const salon = { name: 'Studio X', address: 'Rua A, 1', city: 'SP', phone: '11999990000' };
const appt = { client_name: 'Ana Souza', service: 'Corte', professional: 'Bia', date: '2026-11-16', start: '14:00', final_price: 45, salon };
const t = (kind, extra = {}) => core.emailText({ ...appt, kind, ...extra });

test('cada alerta tem assunto, texto, botão e destino próprios', () => {
  assert.match(t('confirmed').subject, /agendamento confirmado para 16\/11\/2026 às 14:00/);
  const rem = t('reminder'); assert.match(rem.subject, /lembrete do seu horário em 16\/11\/2026 às 14:00/); assert.match(rem.message, /segunda-feira, 16\/11\/2026 às 14:00/); assert.equal(rem.target, 'portal');
  const can = t('cancelled', { credit: true }); assert.match(can.subject, /cancelado/); assert.match(can.message, /crédito do seu pacote voltou/); assert.equal(can.target, 'book');
  const res = t('rescheduled', { payload: { old_date: '2026-11-14', old_start: '10:00' } });
  assert.match(res.message, /Antes: sábado, 14\/11\/2026 às 10:00/); assert.match(res.message, /Novo horário: segunda-feira, 16\/11\/2026 às 14:00/);
  const pay = t('payment', { payload: { amount_cents: 4500, method: 'pix' } }); assert.match(pay.subject, /pagamento de R\$ 45,00 recebido/); assert.match(pay.message, /Valor pago: R\$ 45,00 \(Pix\)/);
  const rev = t('review'); assert.match(rev.message, /de Corte com Bia/); assert.equal(rev.cta, 'Avaliar atendimento'); assert.equal(rev.marketing, true);
});

test('pacote, créditos e aniversário não dependem de agendamento', () => {
  const base = { client_name: 'Ana Souza', salon };
  const pkg = core.emailText({ ...base, kind: 'package', payload: { package: 'Clube', amount_cents: 15000, validity_days: 90, items: [{ service: 'Corte', quantity: 4 }] } });
  assert.match(pkg.subject, /pacote Clube liberado/); assert.match(pkg.message, /• 4x Corte/); assert.match(pkg.message, /Validade: 90 dias/); assert.equal(pkg.target, 'book');
  const cr = core.emailText({ ...base, kind: 'credits', payload: { items: [{ service: 'Corte', remaining: 1, expires_at: '2026-11-20T03:00:00Z' }, { service: 'Barba', remaining: 3, expires_at: null }] } });
  assert.match(cr.message, /• Corte: 1 crédito \(vale até 20\/11\/2026\)/); assert.match(cr.message, /• Barba: 3 créditos$/m); assert.equal(cr.marketing, true);
  const bd = core.emailText({ ...base, kind: 'birthday' }); assert.equal(bd.subject, 'Feliz aniversário, Ana! 🎉'); assert.equal(bd.marketing, true);
});

test('dados faltando: nada é enviado', () => {
  for (const kind of ['confirmed', 'reminder', 'cancelled', 'rescheduled', 'payment', 'review']) assert.equal(core.emailText({ kind, client_name: 'Ana', salon }), null, kind);
  assert.equal(core.emailText({ kind: 'package', salon, payload: {} }), null);
  assert.equal(core.emailText({ kind: 'credits', salon, payload: { items: [] } }), null);
});

test('migração: uma vez por chave, opt-out nos promocionais, aviso vencido não sai, fila só para o servidor', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261113000500_client_email_alerts.sql'), 'utf8');
  for (const k of ['confirmed', 'reminder', 'cancelled', 'rescheduled', 'payment', 'package', 'credits', 'review', 'birthday']) assert.ok(sql.includes(`'${k}'`), k);
  assert.match(sql, /UNIQUE INDEX IF NOT EXISTS client_email_outbox_dedupe/); assert.match(sql, /ON CONFLICT \(dedupe_key\) DO NOTHING/);
  assert.ok((sql.match(/marketing_opt_out/g) ?? []).length >= 3, 'avaliação, créditos e aniversário respeitam opt-out');
  assert.match(sql, /error_code = 'stale'/); assert.match(sql, /interval '24 hours'/);
  for (const fn of ['client_email_enqueue\\([^)]*\\)', 'client_email_enqueue_scheduled\\(\\)', 'client_email_claim\\(\\)']) assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn} FROM PUBLIC, anon, authenticated`));
  assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /^\s*(DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE)/m);
});
