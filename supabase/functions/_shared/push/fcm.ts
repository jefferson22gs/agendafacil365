// Envio FCM HTTP v1 (Deno). Conta de serviço do projeto Firebase belezatech-infinite; chave só em Deno.env.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildMessage, isPermanentFcmError, type PushPayloadInput, type Subscription } from "./core.ts";

export const FIREBASE_PROJECT_ID = "belezatech-infinite";
const CLIENT_EMAIL = Deno.env.get("FIREBASE_CLIENT_EMAIL") || `firebase-adminsdk-fbsvc@${FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`;

export class PushError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export const pushConfigured = () => !!Deno.env.get("FIREBASE_PRIVATE_KEY");

const b64url = (bytes: Uint8Array | string) =>
  btoa(typeof bytes === "string" ? bytes : String.fromCharCode(...bytes)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

let cached: { token: string; exp: number } | null = null;
async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const raw = (Deno.env.get("FIREBASE_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
  const pem = raw.match(/-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/)?.[1]?.replace(/\s/g, "");
  if (!pem) throw new PushError("push_not_configured", 503);
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  } catch { throw new PushError("push_not_configured", 503); }
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({
    iss: CLIENT_EMAIL, sub: CLIENT_EMAIL, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  }))}`;
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(sig)}` }),
  });
  const data = await res.json().catch(() => ({}));
  // Chave/conta errada: tratado como "não configurado" para a UI, sem vazar a resposta do Google.
  if (!res.ok || !data.access_token) throw new PushError("push_not_configured", 503);
  cached = { token: data.access_token, exp: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
  return cached.token;
}

/** Envia para cada alvo; desativa somente tokens que o FCM declarou mortos. Nunca loga token nem conteúdo. */
export async function deliver(db: SupabaseClient, targets: Subscription[], input: PushPayloadInput) {
  if (!targets.length) return { total: 0, sent: 0, failed: 0 };
  const token = await accessToken();
  let sent = 0, failed = 0;
  const dead: string[] = [];
  for (const t of targets) {
    try {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildMessage(t.fcm_token!, input)),
      });
      if (res.ok) { sent++; await res.body?.cancel(); continue; }
      failed++;
      if (isPermanentFcmError(res.status, await res.text())) dead.push(t.id);
    } catch { failed++; } // rede: mantém o token ativo
  }
  if (dead.length) await db.from("push_subscriptions").update({ is_active: false, updated_at: new Date().toISOString() }).in("id", dead);
  if (failed) console.warn("push_delivery_partial", { failed, deactivated: dead.length });
  return { total: targets.length, sent, failed };
}
