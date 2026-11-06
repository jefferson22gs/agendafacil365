const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
function load(p, requireStub = () => ({})) {
  const js = ts.transpileModule(read(p), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const sandbox = { exports: {}, require: requireStub, atob, Uint8Array, String, Number, Math };
  vm.runInNewContext(js, sandbox);
  return sandbox.exports;
}
const brcode = load('supabase/functions/_shared/pix/brcode.ts');
const payment = load('supabase/functions/_shared/pix/payment.ts', (m) => (m === './brcode.ts' ? brcode : { WhatsAppError: Error, evolutionClient() {} }));

function tlv(s) {
  const out = {};
  for (let i = 0; i < s.length;) { const id = s.slice(i, i + 2); const n = Number(s.slice(i + 2, i + 4)); out[id] = s.slice(i + 4, i + 4 + n); i += 4 + n; }
  return out;
}
const KEY = 'pix@salao.com.br';

describe('PIX BR Code', () => {
  it('CRC16-CCITT-FALSE vetor padrão', () => assert.equal(brcode.crc16ccitt('123456789'), '29B1'));

  it('estrutura EMV, txid em 62/05 e CRC recalculável', () => {
    const code = brcode.pixBRCode({ key: KEY, name: 'João Cabeleireiro', city: 'São Paulo', amount: 50, txid: 'ABC123' });
    const t = tlv(code);
    assert.equal(t['00'], '01');
    assert.deepEqual(tlv(t['26']), { '00': 'BR.GOV.BCB.PIX', '01': KEY });
    assert.equal(t['52'], '0000'); assert.equal(t['53'], '986'); assert.equal(t['54'], '50.00'); assert.equal(t['58'], 'BR');
    assert.equal(t['59'], 'JOAO CABELEIREIRO'); assert.equal(t['60'], 'SAO PAULO');
    assert.deepEqual(tlv(t['62']), { '05': 'ABC123' });
    assert.equal(t['63'], brcode.crc16ccitt(code.slice(0, -4)));
  });

  it('sem valor omite 54 e usa txid ***', () => {
    const t = tlv(brcode.pixBRCode({ key: '+5511987654321', name: 'Loja', city: 'Rio' }));
    assert.equal(t['54'], undefined);
    assert.deepEqual(tlv(t['62']), { '05': '***' });
  });

  it('nome/cidade longos são truncados', () => {
    const t = tlv(brcode.pixBRCode({ key: '12345678901', name: 'A'.repeat(40), city: 'B'.repeat(30) }));
    assert.equal(t['59'].length, 25); assert.equal(t['60'].length, 15);
  });

  it('rejeita entradas inválidas', () => {
    const ok = { key: KEY, name: 'Salao', city: 'Recife' };
    for (const key of ['', 'abc', 'a'.repeat(78), '119876', '1234567890']) assert.throws(() => brcode.pixBRCode({ ...ok, key }), /pix_key_invalid/);
    assert.throws(() => brcode.pixBRCode({ ...ok, name: '  ' }), /pix_name_invalid/);
    assert.throws(() => brcode.pixBRCode({ ...ok, city: '' }), /pix_city_invalid/);
    for (const amount of [0, -5, 10000000, NaN]) assert.throws(() => brcode.pixBRCode({ ...ok, amount }), /pix_amount_invalid/);
    for (const txid of ['', 'a'.repeat(26), 'abc-123']) assert.throws(() => brcode.pixBRCode({ ...ok, txid }), /pix_txid_invalid/);
  });

  it('aceita chaves CPF, CNPJ e EVP', () => {
    for (const key of ['12345678901', '12345678000199', '123e4567-e89b-12d3-a456-426614174000']) assert.ok(brcode.validPixKey(key), key);
  });
});

describe('Comprovante: validação de mídia', () => {
  const b64 = (bytes) => Buffer.from(bytes).toString('base64');
  it('detecta MIME real por magic bytes', () => {
    const m = (a) => payment.detectProofMime(new Uint8Array(a));
    assert.equal(m([0xFF, 0xD8, 0xFF, 0xE0]), 'image/jpeg');
    assert.equal(m([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), 'image/png');
    assert.equal(m([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')]), 'image/webp');
    assert.equal(m([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WAVE')]), null);
    assert.equal(m([...Buffer.from('%PDF-1.7')]), 'application/pdf');
    assert.equal(m([...Buffer.from('GIF89a')]), null);
    assert.equal(m([...Buffer.from('<svg>')]), null);
  });
  it('decodifica base64/data URL e limita 5MB', () => {
    assert.deepEqual([...payment.decodeProof(b64([1, 2, 3])).bytes], [1, 2, 3]);
    assert.deepEqual([...payment.decodeProof('data:image/png;base64,' + b64([9])).bytes], [9]);
    assert.equal(payment.decodeProof(null).error, 'invalid_media');
    assert.equal(payment.decodeProof('***').error, 'invalid_media');
    assert.equal(payment.decodeProof('A'.repeat(Math.ceil(payment.PROOF_MAX_BYTES / 3) * 4 + 4)).error, 'too_large');
  });
});

describe('Comprovante: migration e UI', () => {
  const sql = read('supabase/migrations/20261106004002_payment_proofs.sql');
  it('migration aditiva, sem paid, repetição regex <= 255', () => {
    assert.match(sql, /^BEGIN;/); assert.match(sql, /COMMIT;/);
    assert.match(sql, /UNIQUE INDEX IF NOT EXISTS appointment_payment_proofs_message ON public\.appointment_payment_proofs\(salon_id,provider_message_id\)/);
    assert.match(sql, /auth\.uid\(\) IS NULL/);
    assert.match(sql, /whatsapp_can_manage_salon\(v_salon\)/);
    assert.match(sql, /'payment_proof'/);
    const code = sql.replace(/--.*$/gm, '');
    assert.doesNotMatch(code, /\bpaid\b/);
    assert.doesNotMatch(code, /\bDROP (TABLE|FUNCTION)\b|DELETE FROM/, 'rollback só comentado');
    for (const [, a, b] of sql.matchAll(/\{(\d+)(?:,(\d+))?\}/g)) assert.ok(Number(b ?? a) <= 255);
  });
  it('card tem âncoras de tour, rótulos e alvos de 44px', () => {
    const tsx = read('src/components/whatsapp/PaymentProofsCard.tsx');
    for (const a of ['payment-proofs-card', 'payment-proofs-list', 'payment-proofs-actions']) assert.ok(tsx.includes(`"${a}"`), a);
    assert.match(tsx, /\.eq\("salon_id", salonId!\)/);
    assert.match(tsx, /min-h-11/); assert.match(tsx, /htmlFor="payment-proof-notes"/);
    assert.doesNotMatch(tsx, /\bpaid\b/);
  });
});
