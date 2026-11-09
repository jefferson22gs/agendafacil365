// Web Push completo (sem Firebase). Rodar: node --test tests/rebrand/push-full.test.cjs
// A MESMA implementação usada nas Edge Functions (supabase/functions/_shared/push/*.ts), transpilada e executada com o
// WebCrypto do Node 22 (globalThis.crypto.subtle).
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function load(rel) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(out, { exports, require: () => ({}), crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob, URL, DataView, Uint8Array });
  return exports;
}
const wp = load('supabase/functions/_shared/push/webpush.ts');
const core = load('supabase/functions/_shared/push/core.ts');
const d = wp.b64urlDecode, e = (u8) => wp.b64urlEncode(u8);
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// RFC 8291, Seção 5 e Apêndice A.
const RFC = {
  plaintext: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  header: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  ciphertext: '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};
const rfcEncrypt = () => wp.encryptPayload(d(RFC.plaintext), d(RFC.uaPublic), d(RFC.auth), { asPrivateD: RFC.asPrivate, asPublic: d(RFC.asPublic), salt: d(RFC.salt) });

test('RFC 8291 Apêndice A: corpo aes128gcm idêntico byte a byte (header 86 bytes + ciphertext)', async () => {
  const body = await rfcEncrypt();
  assert.equal(body.length, 144);
  assert.equal(e(body.slice(0, 86)), RFC.header, 'salt || rs=4096 || idlen=65 || as_public');
  assert.equal(e(body.slice(86)), RFC.ciphertext, 'AES-128-GCM(plaintext || 0x02)');
  assert.equal(e(body), RFC.body, 'mensagem da Seção 5');
});

test('RFC 8291: o navegador (ua_private) decifra o que o servidor cifrou com par/salt aleatórios', async () => {
  const subtle = globalThis.crypto.subtle;
  const plain = new TextEncoder().encode(JSON.stringify({ title: 'Teste', body: 'Olá' }));
  const body = await wp.encryptPayload(plain, d(RFC.uaPublic), d(RFC.auth));
  const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0), idlen = body[20];
  assert.equal(rs, 4096); assert.equal(idlen, 65);
  const asPub = body.slice(21, 86), cipher = body.slice(86);
  assert.notEqual(e(salt), RFC.salt, 'salt aleatório'); assert.notEqual(e(asPub), RFC.asPublic, 'par efêmero novo');
  const jwk = (pub, dd) => ({ kty: 'EC', crv: 'P-256', x: e(pub.slice(1, 33)), y: e(pub.slice(33)), ...(dd ? { d: dd } : {}) });
  const uaPriv = await subtle.importKey('jwk', jwk(d(RFC.uaPublic), RFC.uaPrivate), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const asKey = await subtle.importKey('jwk', jwk(asPub), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, uaPriv, 256));
  const hmac = async (k, m) => new Uint8Array(await subtle.sign('HMAC', await subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), m));
  const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
  const hkdf = async (s, ikm, info, n) => (await hmac(await hmac(s, ikm), cat(info, new Uint8Array([1])))).slice(0, n);
  const te = (t) => new TextEncoder().encode(t);
  const ikm = await hkdf(d(RFC.auth), ecdh, cat(te('WebPush: info\0'), d(RFC.uaPublic), asPub), 32);
  const cek = await hkdf(salt, ikm, te('Content-Encoding: aes128gcm\0'), 16), nonce = await hkdf(salt, ikm, te('Content-Encoding: nonce\0'), 12);
  const out = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cipher));
  assert.equal(out[out.length - 1], 2, 'delimitador de último registro');
  assert.deepEqual(JSON.parse(new TextDecoder().decode(out.slice(0, -1))), { title: 'Teste', body: 'Olá' });
});

test('RFC 8291: chave do navegador fora da curva, auth errado ou payload grande são recusados', async () => {
  const bad = d(RFC.uaPublic); bad[40] ^= 1; // ponto não está em P-256
  await assert.rejects(wp.encryptPayload(new Uint8Array(4), bad, d(RFC.auth)));
  await assert.rejects(wp.encryptPayload(new Uint8Array(4), d(RFC.uaPublic), new Uint8Array(8)), /invalid_auth_secret/);
  await assert.rejects(wp.encryptPayload(new Uint8Array(4000), d(RFC.uaPublic), d(RFC.auth)), /payload_too_large/);
});

test('VAPID (RFC 8292): JWT ES256 verificável com a chave pública, aud = origin, exp <= 12 h, sub', async () => {
  const keys = { publicKey: RFC.asPublic, privateKey: RFC.asPrivate, subject: 'https://agendafacil365.com.br' };
  const now = 1_800_000_000;
  const jwt = await wp.vapidJwt('https://fcm.googleapis.com/fcm/send/abc:def', keys, now, 999_999);
  const [h, c, s] = jwt.split('.');
  assert.deepEqual(JSON.parse(new TextDecoder().decode(d(h))), { typ: 'JWT', alg: 'ES256' });
  const claims = JSON.parse(new TextDecoder().decode(d(c)));
  assert.equal(claims.aud, 'https://fcm.googleapis.com'); assert.equal(claims.sub, keys.subject);
  assert.equal(claims.exp, now + 12 * 3600, 'exp limitado a 12 h');
  const pub = d(keys.publicKey);
  const verifyKey = await globalThis.crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: e(pub.slice(1, 33)), y: e(pub.slice(33)) }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.equal(d(s).length, 64, 'assinatura JWS r||s');
  assert.ok(await globalThis.crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, d(s), new TextEncoder().encode(`${h}.${c}`)));
  await assert.rejects(wp.vapidJwt('https://x.test/a', { ...keys, subject: 'agendafacil' }), /invalid_vapid_subject/);
});

test('requisição de envio: headers RFC 8030/8292, TTL limitado, Topic saneado, corpo cifrado', async () => {
  const keys = { publicKey: RFC.asPublic, privateKey: RFC.asPrivate, subject: 'mailto:ops@example.com' };
  const target = { endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/abc', p256dh: RFC.uaPublic, auth: RFC.auth };
  const r = await wp.buildPushRequest(target, { title: 'Oi' }, keys, { ttl: 99_999_999, urgency: 'high', topic: 'appt:1 / x' });
  assert.equal(r.url, target.endpoint); assert.equal(r.init.method, 'POST');
  const hd = r.init.headers;
  assert.equal(hd['Content-Encoding'], 'aes128gcm'); assert.equal(hd.TTL, '2419200'); assert.equal(hd.Urgency, 'high'); assert.equal(hd.Topic, 'appt1x');
  assert.match(hd.Authorization, new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${RFC.asPublic}$`));
  assert.equal(r.init.body[20], 65, 'idlen da chave efêmera');
  assert.ok(!JSON.stringify(hd).includes(RFC.asPrivate), 'chave privada nunca vai em header');
});

test('respostas do serviço de push: 404/410 desativam, 413 grande, 429/5xx retentam, 401/403 não matam inscrição', () => {
  for (const s of [200, 201, 202]) assert.equal(core.classifyPushResponse(s), 'ok');
  assert.equal(core.classifyPushResponse(404), 'gone'); assert.equal(core.classifyPushResponse(410), 'gone');
  assert.equal(core.classifyPushResponse(413), 'too_large');
  for (const s of [429, 500, 502, 503]) assert.equal(core.classifyPushResponse(s), 'retry');
  for (const s of [401, 403]) assert.equal(core.classifyPushResponse(s), 'auth_error');
  assert.equal(core.classifyPushResponse(400), 'rejected');
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map(core.backoffMinutes), [1, 2, 4, 8, 16, 30, 30]);
});

test('endpoint: só serviços de push conhecidos (sem SSRF)', () => {
  for (const ok of ['https://fcm.googleapis.com/fcm/send/abc123:APA91bXYZ', 'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
    'https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB', 'https://web.push.apple.com/QGuGd8ZcL5a8']) assert.equal(core.isPushEndpoint(ok), true, ok);
  for (const bad of ['http://fcm.googleapis.com/fcm/send/abc123456789012345', 'https://fcm.googleapis.com.evil.com/fcm/send/abc12345',
    'https://evil.com/notify.windows.com/xxxxxxxxxxxxxxxx', 'https://notify.windows.com.evil.com/w/xxxxxxxxxxxxxx', 'https://169.254.169.254/latest/meta-data/xx',
    'https://u:p@fcm.googleapis.com/fcm/send/abc12345678', 'https://fcm.googleapis.com:8443/fcm/send/abc123456', 'javascript:alert(1)', null, 'https://x']) {
    assert.equal(core.isPushEndpoint(bad), false, String(bad));
  }
  // Mesma regra no banco (RPC register_web_push).
  const sql = read('supabase/migrations/20261109000200_web_push.sql');
  assert.match(sql, /fcm\\\.googleapis\\\.com\|updates\\\.push\\\.services\\\.mozilla\\\.com\|web\\\.push\\\.apple\\\.com\|\(\[a-z0-9-\]\+\\\.\)\+notify\\\.windows\\\.com/);
});

test('payload por tipo: URL de destino segura e título/ícone do salão', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const cases = {
    new_appointment: '/admin/appointments', appointment_cancelled: '/admin/appointments', appointment_rescheduled: '/admin/appointments',
    whatsapp_human: '/admin/whatsapp?aba=conversas', payment_proof: '/admin/whatsapp?aba=conversas', new_review: '/admin/reviews',
    review_request: `/avaliar/${id}`, client_reminder: '/s/ana', marketing: '/s/ana',
  };
  for (const [kind, url] of Object.entries(cases)) {
    const p = core.buildPayload({ title: 'T', body: 'B', kind, salonSlug: 'ana', appointmentId: id });
    assert.equal(p.url, url, kind); assert.equal(p.kind, kind); assert.equal(p.salon, 'ana');
    assert.ok(core.payloadBytes(p) < core.MAX_PAYLOAD_BYTES);
  }
  // URL gravada pelo banco vale se for relativa e segura; externa cai no padrão do tipo.
  assert.equal(core.buildPayload({ title: 'T', body: 'B', kind: 'whatsapp_human', salonSlug: 'ana', url: '/admin/whatsapp?aba=conversas&tel=%2B5511999990000' }).url, '/admin/whatsapp?aba=conversas&tel=%2B5511999990000');
  assert.equal(core.buildPayload({ title: 'T', body: 'B', kind: 'new_review', salonSlug: 'ana', url: '//evil.com' }).url, '/admin/reviews');
  assert.equal(core.buildPayload({ title: 'T', body: 'B', kind: 'review_request', salonSlug: 'ana', appointmentId: "x' or 1=1" }).url, '/s/ana');
  assert.equal(core.buildPayload({ title: '', body: 'B', kind: 'x', salonSlug: '../evil' }).salon, '', 'slug inválido não entra');
  assert.equal(core.buildPayload({ title: '', body: 'B', salonSlug: 'ana', icon: 'https://evil.com/i.png' }).icon, core.DEFAULT_ICON);
});

test('banco: eventos idempotentes, preferências, prova de posse, nada de chave para o navegador', () => {
  const sql = read('supabase/migrations/20261109000200_web_push.sql');
  const body = sql.split('-- ROLLBACK')[0];
  assert.doesNotMatch(body, /DELETE FROM|TRUNCATE|DROP TABLE|DROP COLUMN/i, 'migração não apaga dados');
  assert.match(body, /SET is_active = false, deactivated_reason = 'fcm_legacy'/, 'tokens FCM inativos com motivo');
  assert.doesNotMatch(body.match(/GRANT SELECT \(([^)]*)\)/)[1], /p256dh|auth\b|endpoint|fcm_token/, 'painel nunca lê endpoint/chaves');
  for (const t of ['push_on_appointment_update', 'push_on_whatsapp_message', 'push_on_whatsapp_handoff', 'push_on_payment_proof', 'push_on_review', 'push_enqueue_new_appointment']) {
    assert.match(body, new RegExp(`CREATE TRIGGER ${t}`), t);
  }
  for (const k of ['new_appointment', 'appointment_cancelled', 'appointment_rescheduled', 'whatsapp_human', 'payment_proof', 'new_review', 'client_reminder', 'client_status', 'client_review_request']) {
    assert.match(body, new RegExp(`${k} boolean NOT NULL DEFAULT true`), `preferência ${k}`);
  }
  assert.match(body, /ON CONFLICT \(dedupe_key\) DO NOTHING/);
  assert.match(body, /WHERE cancellation_token = p_cancellation_token/, 'vínculo exige o segredo do link');
  assert.match(body, /coalesce\(expires_at, created_at \+ interval '24 hours'\) < now\(\)/, 'atrasado expira');
  assert.match(body, />= 3 THEN\s+RAISE EXCEPTION 'rate_limited'/, 'limite de campanhas');
  assert.match(body, /NOT ps\.marketing_opt_out/, 'campanha respeita opt-out');
  // Funções internas nunca executáveis por anon/authenticated.
  assert.match(body, /public\.push_claim_outbox\(integer\), public\.push_job_targets\(uuid\)[^;]*FROM PUBLIC, anon, authenticated/);
});

test('front: sem Firebase, chave privada nunca no bundle, permissão só por gesto', () => {
  const files = ['src/lib/webPush.ts', 'src/hooks/usePushNotificationsFCM.tsx', 'public/push-sw.js', 'public/firebase-messaging-sw.js', 'vite.config.ts'];
  for (const f of files) {
    const s = read(f);
    assert.doesNotMatch(s, /gstatic\.com\/firebasejs|from ['"]firebase\//, `${f} sem Firebase`);
    assert.doesNotMatch(s, /env[.\[(][^)\n]*VAPID_PRIVATE_KEY|privateKey\s*[:=]\s*["'][A-Za-z0-9_-]{43}["']/, `${f} sem chave privada`);
  }
  assert.ok(!fs.existsSync(path.join(root, 'src/lib/firebase.ts')));
  assert.match(read('vite.config.ts'), /importScripts: \["push-sw\.js"\]/);
  assert.match(read('vite.isolation.ts'), /"@\/lib\/webPush", replacement: WEB_PUSH_STUB/, 'demo usa o stub');
  const hook = read('src/hooks/usePushNotificationsFCM.tsx');
  assert.equal((hook.match(/Notification\.requestPermission\(\)/g) || []).length, 1, 'um único pedido, dentro de subscribe()');
  assert.match(read('src/lib/webPush.ts'), /userVisibleOnly: true/);
  const sw = read('public/push-sw.js');
  assert.match(sw, /addEventListener\('push'/); assert.match(sw, /addEventListener\('notificationclick'/); assert.match(sw, /pushsubscriptionchange/);
});
