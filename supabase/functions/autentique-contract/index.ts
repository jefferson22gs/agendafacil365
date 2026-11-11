// Edge Function: autentique-contract — gera o contrato SaaS preenchido e envia para assinatura bilateral na Autentique.
// POST { action: "preview" | "create", data: {...formulário} } com JWT do dono/admin do salão.
// O texto/valores/hash são calculados AQUI (o navegador só envia o formulário): a prévia é exatamente o que será assinado.
// Segredos: AUTENTIQUE_API_KEY (obrigatório para "create"), AUTENTIQUE_SANDBOX ("true" = documento de teste, sem crédito).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CONTRACT_PLANS, CONTRACT_VERSION, missingContratada, renderContract, sha256Hex, validateContratante, type ContratadaInfo } from "../_shared/contract/core.ts";
import { contractPdf } from "../_shared/contract/pdf.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const API = "https://api.autentique.com.br/v2/graphql";
const MUTATION = `mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
  createDocument(sandbox: SANDBOX, document: $document, signers: $signers, file: $file) {
    id name created_at signatures { public_id name email action { name } link { short_link } }
  }
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "configuration_missing" }, 503);
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    const { data: auth } = token ? await db.auth.getUser(token) : { data: { user: null } };
    const user = auth.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({})) as { action?: string; data?: Record<string, unknown> };
    if (body.action !== "preview" && body.action !== "create") return json({ error: "invalid_request" }, 400);

    const { data: salon } = await db.from("salons").select("id, slug, owner_id, created_at").eq("owner_id", user.id)
      .order("created_at").limit(1).maybeSingle();
    if (!salon) return json({ error: "salon_missing" }, 409);

    const { value, errors } = validateContratante(body.data ?? {});
    if (Object.keys(errors).length) return json({ error: "invalid_fields", fields: errors }, 422);

    const { data: settings, error: settingsError } = await db.from("platform_contract_settings").select("*").eq("id", true).maybeSingle();
    if (settingsError) return json({ error: "migration_missing" }, 503);
    const missing = missingContratada(settings);
    if (missing.length) return json({ error: "contratada_incomplete", fields: missing }, 503);

    const { data: sub } = await db.from("subscriptions").select("trial_start_date, trial_end_date").eq("salon_id", salon.id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const trialStart = new Date(sub?.trial_start_date ?? salon.created_at);
    const trialEnd = new Date(sub?.trial_end_date ?? trialStart.getTime() + 30 * 864e5);
    const trialDays = Math.max(0, Math.round((trialEnd.getTime() - trialStart.getTime()) / 864e5));
    const rendered = await renderContract(value, settings as ContratadaInfo, { slug: salon.slug ?? "", trialDays, trialStart, trialEnd, now: new Date() });

    if (body.action === "preview") {
      return json({ text: rendered.text, hash: rendered.hash, version: CONTRACT_VERSION, plan: { ...CONTRACT_PLANS[value.plan] } });
    }

    const apiKey = Deno.env.get("AUTENTIQUE_API_KEY")?.trim();
    if (!apiKey) return json({ error: "autentique_not_configured" }, 503);
    const sandbox = Deno.env.get("AUTENTIQUE_SANDBOX") === "true";

    // Reserva: o índice único impede dois contratos em andamento para o mesmo salão (clique duplo / abas).
    const { data: contract, error: insertError } = await db.from("saas_contracts").insert({
      salon_id: salon.id, created_by: user.id, version: CONTRACT_VERSION, status: "generating", plan: value.plan,
      contract_data: value, content_text: rendered.text, content_sha256: rendered.hash, sandbox,
    }).select("id").single();
    if (insertError) return json({ error: insertError.code === "23505" ? "contract_in_progress" : "persistence_failed" }, insertError.code === "23505" ? 409 : 503);

    const pdf = contractPdf(rendered.text, `Contrato SaaS v${CONTRACT_VERSION} · SHA-256 ${rendered.hash.slice(0, 16)}… · Agenda Fácil 365`);
    const pdfHash = await sha256Hex(pdf);
    const signers = [
      // Ordem de assinatura não é exigida (sortable=false): cada parte recebe o próprio link por e-mail.
      { email: settings!.email, name: settings!.representative_name, action: "SIGN" },
      { email: value.responsavel_email, name: value.responsavel_nome, action: "SIGN" },
    ];
    const form = new FormData();
    form.append("operations", JSON.stringify({
      query: MUTATION.replace("SANDBOX", sandbox ? "true" : "false"),
      variables: {
        document: {
          name: `Contrato SaaS Agenda Fácil 365 — ${value.estabelecimento_nome}`.slice(0, 180),
          message: "Contrato de licenciamento do Agenda Fácil 365 para assinatura eletrônica.",
          refusable: true, stop_on_rejected: true, sortable: false, footer: "BOTTOM",
          locale: { country: "BR", language: "pt-BR", timezone: "America/Sao_Paulo", date_format: "DD_MM_YYYY" },
        },
        signers, file: null,
      },
    }));
    form.append("map", JSON.stringify({ file: ["variables.file"] }));
    form.append("file", new Blob([pdf], { type: "application/pdf" }), `contrato-agendafacil365-${contract.id}.pdf`);

    let res: Response;
    try {
      res = await fetch(API, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(30_000) });
    } catch {
      // Sem resposta: o documento pode ter sido criado. Não reenvia sozinho (evita contrato duplicado).
      await db.from("saas_contracts").update({ status: "uncertain", error_code: "network", pdf_sha256: pdfHash, updated_at: new Date().toISOString() }).eq("id", contract.id);
      return json({ error: "provider_uncertain", contract_id: contract.id }, 502);
    }
    const out = await res.json().catch(() => null) as { data?: { createDocument?: { id: string; signatures: { public_id: string; email: string; name: string; link?: { short_link?: string } | null }[] } }; errors?: unknown[] } | null;
    const doc = out?.data?.createDocument;
    if (!res.ok || !doc?.id) {
      console.warn("autentique_create_failed", res.status, Array.isArray(out?.errors) ? out!.errors.length : 0);
      await db.from("saas_contracts").update({ status: "error", error_code: `http_${res.status}`, updated_at: new Date().toISOString() }).eq("id", contract.id);
      return json({ error: "provider_rejected" }, 502);
    }

    const lower = (s: string) => s.trim().toLowerCase();
    const find = (email: string) => doc.signatures.find((s) => lower(s.email ?? "") === lower(email));
    const rows = [
      { role: "contratada", name: settings!.representative_name, email: settings!.email, sig: find(settings!.email) },
      { role: "contratante", name: value.responsavel_nome, email: value.responsavel_email, sig: find(value.responsavel_email) },
    ];
    await db.from("saas_contract_signers").insert(rows.map((r) => ({
      contract_id: contract.id, role: r.role, name: r.name, email: r.email, public_id: r.sig?.public_id ?? null, short_link: r.sig?.link?.short_link ?? null,
    })));
    await db.from("saas_contracts").update({ status: "sent", autentique_document_id: doc.id, pdf_sha256: pdfHash, updated_at: new Date().toISOString() }).eq("id", contract.id);
    return json({ contract_id: contract.id, document_id: doc.id, status: "sent", sign_url: rows[1].sig?.link?.short_link ?? null, sandbox, hash: rendered.hash });
  } catch (e) {
    console.warn("autentique_contract_error", e instanceof Error ? e.name : "unknown");
    return json({ error: "internal_error" }, 500);
  }
});
