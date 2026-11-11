// Verificação do webhook Autentique: header X-Autentique-Signature = HMAC-SHA256 (hex) do corpo cru com o segredo do endpoint.
export async function verifySignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!secret || !signature || !/^[0-9a-f]{64}$/i.test(signature.trim())) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const got = signature.trim().toLowerCase();
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}
