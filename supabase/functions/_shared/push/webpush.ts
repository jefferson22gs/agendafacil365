// Web Push padrão, sem Firebase e sem dependências: só WebCrypto (Deno e Node 22 têm crypto.subtle).
//  - RFC 8291: criptografia do payload (ECDH P-256 + HKDF-SHA256 + AES-128-GCM, content-encoding aes128gcm, RFC 8188).
//  - RFC 8292: VAPID (JWT ES256 com aud = origin do endpoint, exp <= 12 h, sub = contato do servidor).
//  - RFC 8030: POST no endpoint com TTL/Urgency/Topic.
// Funções puras (chaves e fetch por parâmetro): testadas com os vetores do Apêndice A da RFC 8291 em tests/rebrand/push-full.test.cjs.

export const RECORD_SIZE = 4096;
const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
export function b64urlDecode(value: string): Uint8Array {
  const clean = value.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*$/.test(clean)) throw new Error("invalid_base64url");
  const bin = atob(clean + "=".repeat((4 - (clean.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
/** HKDF (RFC 5869) com um único bloco de saída (<= 32 bytes), como na RFC 8291. */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const prk = await hmac(salt, ikm);
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, length);
}

/** Chave pública P-256 não comprimida (65 bytes, 0x04||X||Y) → JWK. */
function publicJwk(raw: Uint8Array) {
  if (raw.length !== 65 || raw[0] !== 4) throw new Error("invalid_public_key");
  return { kty: "EC", crv: "P-256", x: b64urlEncode(raw.slice(1, 33)), y: b64urlEncode(raw.slice(33, 65)), ext: true };
}
/** Escalar d (32 bytes, base64url) + pública → chave privada importável (WebCrypto não importa d "cru"). */
function privateJwk(dB64: string, publicRaw: Uint8Array) {
  const d = b64urlDecode(dB64);
  if (d.length !== 32) throw new Error("invalid_private_key");
  return { ...publicJwk(publicRaw), d: b64urlEncode(d) };
}

export interface EncryptOptions {
  /** Só para teste (vetores da RFC): par fixo do servidor e salt. Em produção são aleatórios a cada mensagem. */
  asPrivateD?: string; asPublic?: Uint8Array; salt?: Uint8Array;
}
/**
 * Cifra o payload para uma inscrição (RFC 8291 §3.4 + RFC 8188), um único registro:
 * header = salt(16) || rs(4, BE) || idlen(1)=65 || as_public(65); corpo = AES-GCM(plaintext || 0x02).
 * A importação da chave do navegador valida que o ponto está na curva P-256 (RFC 8291 §7).
 */
export async function encryptPayload(plaintext: Uint8Array, uaPublic: Uint8Array, authSecret: Uint8Array, opts: EncryptOptions = {}): Promise<Uint8Array> {
  if (authSecret.length !== 16) throw new Error("invalid_auth_secret");
  if (plaintext.length + 1 + 16 > RECORD_SIZE - 86) throw new Error("payload_too_large");
  const uaKey = await crypto.subtle.importKey("jwk", publicJwk(uaPublic), { name: "ECDH", namedCurve: "P-256" }, false, []);

  let asPrivate: CryptoKey, asPublic: Uint8Array;
  if (opts.asPrivateD && opts.asPublic) {
    asPublic = opts.asPublic;
    asPrivate = await crypto.subtle.importKey("jwk", privateJwk(opts.asPrivateD, asPublic), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  } else {
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
    asPrivate = pair.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  }
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
  if (salt.length !== 16) throw new Error("invalid_salt");

  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPrivate, 256));
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const key = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, key, concat(plaintext, new Uint8Array([2]))));
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false);
  header[20] = asPublic.length;
  return concat(header, asPublic, cipher);
}

export interface VapidKeys { publicKey: string; privateKey: string; subject: string }

/** JWT VAPID (RFC 8292): ES256, aud = origin do serviço de push, exp <= 12 h, sub = mailto:/https: do servidor. */
export async function vapidJwt(endpoint: string, keys: VapidKeys, nowSeconds = Math.floor(Date.now() / 1000), ttlSeconds = 12 * 3600): Promise<string> {
  if (!/^(mailto:|https:\/\/)/.test(keys.subject)) throw new Error("invalid_vapid_subject");
  const pub = b64urlDecode(keys.publicKey);
  const key = await crypto.subtle.importKey("jwk", privateJwk(keys.privateKey, pub), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSeconds + Math.min(ttlSeconds, 12 * 3600), sub: keys.subject })));
  const unsigned = `${header}.${claims}`;
  // WebCrypto devolve a assinatura ECDSA já no formato JWS (r||s, 64 bytes).
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(unsigned)));
  return `${unsigned}.${b64urlEncode(sig)}`;
}

export interface WebPushTarget { endpoint: string; p256dh: string; auth: string }
export interface SendOptions { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high"; topic?: string; jwt?: string }

/** Monta a requisição (sem enviar): headers RFC 8030/8292 e corpo aes128gcm. */
export async function buildPushRequest(target: WebPushTarget, payload: unknown, keys: VapidKeys, opts: SendOptions = {}) {
  const body = await encryptPayload(enc.encode(JSON.stringify(payload)), b64urlDecode(target.p256dh), b64urlDecode(target.auth));
  const headers: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "Content-Encoding": "aes128gcm",
    TTL: String(Math.max(0, Math.min(Math.floor(opts.ttl ?? 86400), 2419200))),
    Urgency: opts.urgency ?? "normal",
    Authorization: `vapid t=${opts.jwt ?? await vapidJwt(target.endpoint, keys)}, k=${keys.publicKey}`,
  };
  // Topic substitui no serviço de push uma mensagem pendente com o mesmo tópico (máx. 32 caracteres base64url).
  const topic = (opts.topic ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  if (topic) headers.Topic = topic;
  return { url: target.endpoint, init: { method: "POST", headers, body } };
}
