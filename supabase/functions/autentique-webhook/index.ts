// Edge Function: autentique-webhook — eventos de assinatura em tempo real (Autentique → banco).
// Cadastre no painel da Autentique: URL <SUPABASE_URL>/functions/v1/autentique-webhook, formato JSON, eventos
// signature.viewed, signature.accepted, signature.rejected, document.finished, document.deleted. Copie o segredo do
// endpoint para AUTENTIQUE_WEBHOOK_SECRET. Sem segredo ou assinatura inválida: 401 (nada é gravado).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySignature } from "./verify.ts";

const HANDLED = new Set(["signature.viewed", "signature.accepted", "signature.rejected", "document.finished", "document.deleted"]);
const reply = (status: number, body: unknown = { ok: status < 300 }) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405);
  const raw = await req.text();
  if (raw.length > 1_000_000) return reply(413);
  if (!await verifySignature(raw, req.headers.get("x-autentique-signature"), Deno.env.get("AUTENTIQUE_WEBHOOK_SECRET") ?? "")) return reply(401);

  let payload: { event?: { id?: string; type?: string; data?: { object?: Record<string, unknown> } } };
  try { payload = JSON.parse(raw); } catch { return reply(400); }
  const ev = payload.event;
  if (!ev?.id || !ev.type) return reply(400);
  if (!HANDLED.has(ev.type)) return reply(200, { ok: true, ignored: ev.type });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  // Mínimo de dados pessoais no log de eventos: CPF/telefone/aniversário dos signatários não são guardados.
  const obj = { ...(ev.data?.object ?? {}) } as Record<string, unknown>;
  for (const k of ["cpf", "birthday", "phone"]) delete obj[k];
  if (Array.isArray(obj.signatures)) obj.signatures = (obj.signatures as Record<string, unknown>[]).map(({ cpf: _c, birthday: _b, phone: _p, ...s }) => s);
  const { error } = await db.rpc("saas_contract_apply_event", { p_event_id: ev.id, p_type: ev.type, p_object: obj, p_payload: { event: { id: ev.id, type: ev.type, data: { object: obj } } } });
  // Falha de banco: 503 faz a Autentique reenviar; duplicado/desconhecido responde 200 (idempotente).
  if (error) { console.warn("autentique_webhook_persist_failed", error.code); return reply(503); }
  return reply(200);
});
