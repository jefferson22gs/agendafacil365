// Reconciliação com a Autentique (pull): consulta o documento e aplica as assinaturas como eventos sintéticos
// idempotentes. Cobre webhook não cadastrado, perdido ou atrasado. Mesma função do banco que o webhook usa.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const API = "https://api.autentique.com.br/v2/graphql";
const QUERY = `query($id: UUID!) { document(id: $id) {
  id deleted_at files { signed }
  signatures { public_id email viewed { created_at ip } signed { created_at ip } rejected { created_at ip reason } }
} }`;

interface Ev { created_at?: string | null; ip?: string | null }
interface Sig { public_id: string; viewed?: Ev | null; signed?: Ev | null; rejected?: Ev | null }

/** Link de assinatura de um signatário (quem recebe por e-mail não vem com link no createDocument). */
export async function signatureLink(apiKey: string, publicId: string): Promise<string | null> {
  const res = await fetch(API, {
    method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "mutation($id: UUID!) { createLinkToSignature(public_id: $id) { short_link } }", variables: { id: publicId } }),
  });
  const out = await res.json().catch(() => null) as { data?: { createLinkToSignature?: { short_link?: string } | null } } | null;
  const link = out?.data?.createLinkToSignature?.short_link;
  return res.ok && typeof link === "string" && link.startsWith("https://") ? link : null;
}

export async function syncContract(db: SupabaseClient, apiKey: string, contract: { id: string; autentique_document_id: string }): Promise<string> {
  const res = await fetch(API, {
    method: "POST", signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { id: contract.autentique_document_id } }),
  });
  const out = await res.json().catch(() => null) as { data?: { document?: { id: string; deleted_at?: string | null; files?: { signed?: string | null }; signatures: Sig[] } | null } } | null;
  const doc = out?.data?.document;
  if (!res.ok || !doc) throw new Error(`autentique_sync_${res.status}`);

  const apply = async (type: string, key: string, object: Record<string, unknown>) => {
    const { error } = await db.rpc("saas_contract_apply_event", { p_event_id: `sync:${key}`, p_type: type, p_object: object, p_payload: { source: "sync", type } });
    if (error) throw new Error("persistence_failed");
  };
  for (const s of doc.signatures ?? []) {
    if (s.viewed?.created_at) await apply("signature.viewed", `${s.public_id}:viewed`, { public_id: s.public_id, viewed: s.viewed.created_at, ip: s.viewed.ip });
    if (s.signed?.created_at) await apply("signature.accepted", `${s.public_id}:signed`, { public_id: s.public_id, signed: s.signed.created_at, ip: s.signed.ip });
    if (s.rejected?.created_at) await apply("signature.rejected", `${s.public_id}:rejected`, { public_id: s.public_id, rejected: s.rejected.created_at, ip: s.rejected.ip });
  }
  if (doc.deleted_at) await apply("document.deleted", `${doc.id}:deleted`, { id: doc.id });
  else if ((doc.signatures ?? []).length && doc.signatures.every((s) => s.signed?.created_at)) {
    await apply("document.finished", `${doc.id}:finished`, { id: doc.id, files: { signed: doc.files?.signed ?? null } });
  }
  // Signatário ainda sem link (recebe por e-mail): gera para o botão "Assinar agora".
  const { data: missing } = await db.from("saas_contract_signers").select("id, public_id")
    .eq("contract_id", contract.id).is("short_link", null).not("public_id", "is", null).neq("status", "signed");
  for (const s of missing ?? []) {
    const link = await signatureLink(apiKey, s.public_id).catch(() => null);
    if (link) await db.from("saas_contract_signers").update({ short_link: link, updated_at: new Date().toISOString() }).eq("id", s.id);
  }
  const { data } = await db.from("saas_contracts").select("status").eq("id", contract.id).maybeSingle();
  return data?.status ?? "unknown";
}
