// Conversions API da Meta: o mesmo evento do Pixel, enviado pelo servidor (mesmo event_id, a Meta deduplica).
// Público e sem login (a landing chama antes de existir sessão), então: só eventos de uma lista fixa, origem do
// próprio site, dados pessoais só em hash SHA-256 e limite por IP. Sem META_PIXEL_ID/META_CAPI_TOKEN, não faz nada.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const EVENTS = new Set(["Lead", "CompleteRegistration", "Contact"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORIGINS = (Deno.env.get("APP_PUBLIC_URL") ?? "https://agendafacil365.com.br").split(",").map(s => s.trim().replace(/\/$/, "")).filter(Boolean);
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ORIGINS.includes(origin) ? origin : ORIGINS[0],
  "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin",
});
// ponytail: limite em memória por instância (rajada de um mesmo IP); trocar por tabela se houver abuso distribuído.
const hits = new Map<string, number[]>();
const limited = (ip: string) => {
  const now = Date.now(), recent = (hits.get(ip) ?? []).filter(t => now - t < 60_000);
  recent.push(now); hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 10;
};
async function sha256(v: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)))).map(b => b.toString(16).padStart(2, "0")).join("");
}
/** Normalização exigida pela Meta antes do hash: e-mail minúsculo; telefone só dígitos com DDI. */
export const normEmail = (v: unknown) => (typeof v === "string" && /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(v.trim()) ? v.trim().toLowerCase() : null);
export function normPhone(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  if (/^55[1-9]\d{9,10}$/.test(d)) return d;
  if (/^[1-9]\d{9,10}$/.test(d)) return `55${d}`;
  return null;
}
const cookieVal = (v: unknown, prefix: string) => (typeof v === "string" && v.length <= 300 && v.startsWith(prefix) && /^[\w.-]+$/.test(v) ? v : undefined);

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });
  if (req.method !== "POST") return reply(405, { ok: false });
  if (!origin || !ORIGINS.includes(origin)) return reply(403, { ok: false });
  const pixel = Deno.env.get("META_PIXEL_ID") ?? "", token = Deno.env.get("META_CAPI_TOKEN") ?? "";
  if (!/^\d{10,20}$/.test(pixel) || !token) return reply(200, { ok: true, skipped: "not_configured" });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (limited(ip || "unknown")) return reply(429, { ok: false });
  const raw = await req.text();
  if (raw.length > 4000) return reply(413, { ok: false });
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw); } catch { return reply(400, { ok: false }); }
  if (!EVENTS.has(String(b.event)) || !UUID.test(String(b.eventId))) return reply(400, { ok: false });
  let url: URL;
  try { url = new URL(String(b.url)); } catch { return reply(400, { ok: false }); }
  if (!ORIGINS.includes(url.origin)) return reply(400, { ok: false });
  const email = normEmail(b.email), phone = normPhone(b.phone);
  const user_data = {
    ...(email ? { em: [await sha256(email)] } : {}), ...(phone ? { ph: [await sha256(phone)] } : {}),
    ...(ip ? { client_ip_address: ip } : {}), client_user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400),
    ...(cookieVal(b.fbp, "fb.") ? { fbp: b.fbp } : {}), ...(cookieVal(b.fbc, "fb.") ? { fbc: b.fbc } : {}),
  };
  const body = {
    data: [{ event_name: b.event, event_time: Math.floor(Date.now() / 1000), event_id: b.eventId, action_source: "website", event_source_url: url.href.slice(0, 1000), user_data }],
    ...(Deno.env.get("META_CAPI_TEST_CODE") ? { test_event_code: Deno.env.get("META_CAPI_TEST_CODE") } : {}),
  };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pixel}/events`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(8_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    });
    if (!res.ok) console.warn("meta_capi_rejected", res.status);
    return reply(200, { ok: res.ok });
  } catch { console.warn("meta_capi_unavailable"); return reply(200, { ok: false }); }
});
