import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { CheckCircle2, Clock, ExternalLink, FileSignature, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CONTRACT_PLANS, SEGMENTS, digits, money, validateContratante, type ContractPlan } from "../../../supabase/functions/_shared/contract/core.ts";

const db = supabase as unknown as SupabaseClient;

type Form = Record<"estabelecimento_nome" | "estabelecimento_cnpj" | "estabelecimento_segmento" | "endereco_logradouro" | "endereco_numero" |
  "endereco_bairro" | "endereco_cidade" | "endereco_uf" | "endereco_cep" | "responsavel_nome" | "responsavel_cpf" | "responsavel_email" | "responsavel_telefone", string> & { plan: ContractPlan };
interface ContractRow { id: string; status: string; created_at: string; signed_at: string | null; contratante_signed_at: string | null; contratada_signed_at: string | null; content_sha256: string; autentique_document_id: string | null; sandbox: boolean; signed_file_url: string | null }
interface SignerRow { short_link: string | null; status: string }

const EMPTY: Form = { estabelecimento_nome: "", estabelecimento_cnpj: "", estabelecimento_segmento: "", endereco_logradouro: "", endereco_numero: "",
  endereco_bairro: "", endereco_cidade: "", endereco_uf: "", endereco_cep: "", responsavel_nome: "", responsavel_cpf: "", responsavel_email: "", responsavel_telefone: "", plan: "monthly" };
const DRAFT_KEY = "af365:contract-draft";
const STATUS: Record<string, { label: string; tone: string; icon: typeof Clock }> = {
  generating: { label: "Gerando documento", tone: "text-foreground", icon: Loader2 },
  sent: { label: "Aguardando assinaturas", tone: "text-foreground", icon: Clock },
  partially_signed: { label: "Assinado por uma das partes", tone: "text-foreground", icon: Clock },
  signed: { label: "Assinado pelas duas partes", tone: "text-success", icon: CheckCircle2 },
  rejected: { label: "Recusado", tone: "text-destructive", icon: XCircle },
  cancelled: { label: "Cancelado", tone: "text-destructive", icon: XCircle },
  error: { label: "Falha ao enviar", tone: "text-destructive", icon: XCircle },
  uncertain: { label: "Envio sem confirmação — fale com o suporte antes de tentar de novo", tone: "text-destructive", icon: XCircle },
};
const FIELDS: { key: keyof Form; label: string; auto?: string; mode?: "numeric" | "tel" | "email"; type?: string; span?: boolean }[] = [
  { key: "estabelecimento_nome", label: "Nome fantasia / razão social", auto: "organization", span: true },
  { key: "estabelecimento_cnpj", label: "CNPJ ou CPF do estabelecimento", mode: "numeric" },
  { key: "endereco_cep", label: "CEP", auto: "postal-code", mode: "numeric" },
  { key: "endereco_logradouro", label: "Rua / avenida", auto: "address-line1", span: true },
  { key: "endereco_numero", label: "Número" },
  { key: "endereco_bairro", label: "Bairro", auto: "address-level3" },
  { key: "endereco_cidade", label: "Cidade", auto: "address-level2" },
  { key: "endereco_uf", label: "UF", auto: "address-level1" },
  { key: "responsavel_nome", label: "Nome completo do responsável legal", auto: "name", span: true },
  { key: "responsavel_cpf", label: "CPF do responsável", mode: "numeric" },
  { key: "responsavel_telefone", label: "WhatsApp / telefone", auto: "tel", mode: "tel", type: "tel" },
  { key: "responsavel_email", label: "E-mail do responsável (recebe o link de assinatura)", auto: "email", mode: "email", type: "email", span: true },
];

const Contract = () => {
  const { user, profile } = useAuth();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [salonId, setSalonId] = useState<string | null>(null);
  const [contract, setContract] = useState<ContractRow | null>(null);
  const [signer, setSigner] = useState<SignerRow | null>(null);
  const [missing, setMissing] = useState(false);
  const [noSalon, setNoSalon] = useState(false);
  const [preview, setPreview] = useState<{ text: string; hash: string } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState<"preview" | "create" | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [params] = useSearchParams();
  useEffect(() => { const p = params.get("plano"); if (p === "annual" || p === "monthly") setForm((f) => ({ ...f, plan: p })); }, [params]);

  const loadContract = useCallback(async (sid: string) => {
    const { data, error } = await db.from("saas_contracts").select("id,status,created_at,signed_at,contratante_signed_at,contratada_signed_at,content_sha256,autentique_document_id,sandbox,signed_file_url")
      .eq("salon_id", sid).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) { if (/does not exist|schema cache/i.test(error.message)) setMissing(true); return; }
    setContract(data as ContractRow | null);
    if (data) {
      const { data: s } = await db.from("saas_contract_signers").select("short_link,status").eq("contract_id", data.id).eq("role", "contratante").maybeSingle();
      setSigner(s as SignerRow | null);
    }
  }, []);

  // Entrada redundante (WCAG 3.3.7): pré-preenche com o que o sistema já sabe do salão e do dono.
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data: salon } = await supabase.from("salons").select("id,name,business_name,cnpj,address,city,state,zip_code,phone,whatsapp,email")
        .eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
      let draft: Partial<Form> = {};
      try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}"); } catch { /* sem storage */ }
      setForm((f) => ({
        ...f,
        estabelecimento_nome: salon?.business_name || salon?.name || "", estabelecimento_cnpj: salon?.cnpj ?? "",
        endereco_logradouro: salon?.address ?? "", endereco_cidade: salon?.city ?? "", endereco_uf: salon?.state ?? "", endereco_cep: salon?.zip_code ?? "",
        responsavel_nome: profile?.full_name ?? (user.user_metadata?.full_name as string) ?? "", responsavel_email: user.email ?? salon?.email ?? "",
        responsavel_telefone: profile?.phone || salon?.whatsapp || salon?.phone || "",
        ...Object.fromEntries(Object.entries(draft).filter(([, v]) => typeof v === "string" && v)),
      }));
      if (salon) { setSalonId(salon.id); await loadContract(salon.id); } else setNoSalon(true);
    })();
  }, [user, profile, loadContract]);

  // Status em tempo real (webhook da Autentique atualiza a linha).
  useEffect(() => {
    if (!salonId) return;
    const ch = supabase.channel(`contract-${salonId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "saas_contracts", filter: `salon_id=eq.${salonId}` }, () => void loadContract(salonId))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [salonId, loadContract]);

  const set = (k: keyof Form, v: string) => {
    const next = { ...form, [k]: v } as Form;
    setForm(next);
    if (errors[k]) setErrors((e) => { const { [k]: _, ...rest } = e; return rest; });
    try { const { plan: _p, ...save } = next; localStorage.setItem(DRAFT_KEY, JSON.stringify(save)); } catch { /* sem storage */ }
  };

  const fillCep = async () => {
    const cep = digits(form.endereco_cep);
    if (cep.length !== 8 || (form.endereco_logradouro && form.endereco_cidade)) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      if (d?.erro) return;
      setForm((f) => ({ ...f, endereco_logradouro: f.endereco_logradouro || d.logradouro || "", endereco_bairro: f.endereco_bairro || d.bairro || "",
        endereco_cidade: f.endereco_cidade || d.localidade || "", endereco_uf: f.endereco_uf || d.uf || "" }));
    } catch { /* preenchimento manual continua disponível */ }
  };

  const call = async (action: "preview" | "create") => {
    const { errors: e } = validateContratante(form);
    setErrors(e);
    if (Object.keys(e).length) { setTimeout(() => errorRef.current?.focus(), 0); return null; }
    setBusy(action);
    const { data, error } = await supabase.functions.invoke("autentique-contract", { body: { action, data: form } });
    setBusy(null);
    const code = (data?.error ?? (error as { context?: { status?: number } } | null)?.context?.status) as string | number | undefined;
    if (data?.fields && data.error === "invalid_fields") { setErrors(data.fields); setTimeout(() => errorRef.current?.focus(), 0); return null; }
    if (error || data?.error) {
      const msg: Record<string, string> = {
        contratada_incomplete: "Os dados da empresa do sistema ainda não foram configurados. Avise o suporte.",
        autentique_not_configured: "A assinatura eletrônica ainda não está habilitada. Avise o suporte.",
        contract_in_progress: "Já existe um contrato em andamento. Assine pelo link enviado ao seu e-mail.",
        migration_missing: "Recurso ainda não ativado no banco de dados.",
        provider_uncertain: "Não tivemos confirmação da Autentique. Confira seu e-mail antes de tentar de novo.",
      };
      toast.error(msg[String(code)] ?? "Não foi possível concluir agora. Tente novamente.");
      return null;
    }
    return data;
  };

  const refreshStatus = async () => {
    setBusy("preview");
    const { data } = await supabase.functions.invoke("autentique-contract", { body: { action: "sync" } });
    setBusy(null);
    if (data?.error) toast.error("Não foi possível consultar a Autentique agora.");
    if (salonId) await loadContract(salonId);
  };

  const openPreview = async () => { const d = await call("preview"); if (d) { setPreview({ text: d.text, hash: d.hash }); setAccepted(false); } };
  const send = async () => {
    const d = await call("create");
    if (!d) return;
    setPreview(null);
    toast.success("Contrato enviado! O link de assinatura chegou no seu e-mail.");
    if (salonId) await loadContract(salonId);
    if (d.sign_url) window.open(d.sign_url, "_blank", "noopener,noreferrer");
  };

  const active = contract && ["generating", "sent", "partially_signed", "signed", "uncertain"].includes(contract.status);
  const st = contract ? STATUS[contract.status] ?? STATUS.sent : null;
  const errorList = Object.entries(errors);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader title="Contrato e assinatura eletrônica" className="mb-0"
          description="Confirme os dados do seu estabelecimento. O contrato é preenchido automaticamente e assinado eletronicamente pelas duas partes na Autentique." />

        {missing && <Card><CardContent className="p-6" role="status">Recurso ainda não ativado neste banco (aplique MIGRATION_RETORNO_WHITELABEL_WCAG.sql).</CardContent></Card>}

        {contract && st && (
          <Card aria-live="polite">
            <CardContent className="space-y-3 p-5">
              <p className={`flex items-center gap-2 font-semibold ${st.tone}`}>
                <st.icon size={18} aria-hidden className={contract.status === "generating" ? "animate-spin motion-reduce:animate-none" : ""} />{st.label}
                {contract.sandbox && <span className="rounded bg-secondary px-2 py-0.5 text-xs">teste</span>}
              </p>
              <dl className="grid gap-1 text-sm sm:grid-cols-2">
                <div><dt className="inline text-muted-foreground">Você: </dt><dd className="inline">{contract.contratante_signed_at ? `assinou em ${new Date(contract.contratante_signed_at).toLocaleString("pt-BR")}` : "pendente"}</dd></div>
                <div><dt className="inline text-muted-foreground">Agenda Fácil 365: </dt><dd className="inline">{contract.contratada_signed_at ? `assinou em ${new Date(contract.contratada_signed_at).toLocaleString("pt-BR")}` : "pendente"}</dd></div>
                <div className="sm:col-span-2 break-all"><dt className="inline text-muted-foreground">SHA-256 do texto: </dt><dd className="inline font-mono text-xs">{contract.content_sha256}</dd></div>
              </dl>
              <div className="flex flex-wrap gap-2">
                {!contract.contratante_signed_at && signer?.short_link && ["sent", "partially_signed"].includes(contract.status) && (
                  <Button asChild className="h-11"><a href={signer.short_link} target="_blank" rel="noopener noreferrer"><FileSignature size={16} className="mr-2" aria-hidden />Assinar agora<span className="sr-only"> (abre a Autentique em nova aba)</span></a></Button>
                )}
                {contract.status !== "signed" && contract.autentique_document_id && (
                  <Button variant="outline" className="h-11" onClick={() => void refreshStatus()} disabled={!!busy}>
                    {busy ? <Loader2 size={16} className="mr-2 animate-spin" aria-hidden /> : <Clock size={16} className="mr-2" aria-hidden />}Atualizar status
                  </Button>
                )}
                {contract.signed_file_url && (
                  <Button asChild variant="outline" className="h-11"><a href={contract.signed_file_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} className="mr-2" aria-hidden />Baixar contrato assinado</a></Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {noSalon && (
          <Card><CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between" role="status">
            <p>Cadastre seu estabelecimento antes de gerar o contrato.</p>
            <Button asChild className="h-11"><a href="/admin/settings">Cadastrar estabelecimento</a></Button>
          </CardContent></Card>
        )}

        {!active && !missing && !noSalon && (
          <form noValidate onSubmit={(e) => { e.preventDefault(); void openPreview(); }} className="space-y-6" aria-busy={!!busy}>
            {errorList.length > 0 && (
              <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm">
                <p className="font-semibold">Corrija {errorList.length === 1 ? "o campo" : `os ${errorList.length} campos`}:</p>
                <ul className="mt-1 list-disc pl-5">{errorList.map(([k, m]) => <li key={k}><a className="underline" href={`#ct-${k}`}>{m}</a></li>)}</ul>
              </div>
            )}

            <fieldset className="space-y-3">
              <legend className="mb-2 text-lg font-semibold">Plano</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(CONTRACT_PLANS) as ContractPlan[]).map((p) => (
                  <label key={p} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-4 focus-within:ring-2 focus-within:ring-ring ${form.plan === p ? "border-primary bg-primary/5" : "border-border"}`}>
                    <input type="radio" name="plan" value={p} checked={form.plan === p} onChange={() => setForm({ ...form, plan: p })} className="h-5 w-5" />
                    <span><span className="block font-semibold">{CONTRACT_PLANS[p].cycle}</span><span className="text-sm text-muted-foreground">R$ {money(CONTRACT_PLANS[p].cents)}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-2 text-lg font-semibold">Estabelecimento e responsável legal</legend>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ct-estabelecimento_segmento">Segmento</Label>
                <Select value={form.estabelecimento_segmento} onValueChange={(v) => set("estabelecimento_segmento", v)}>
                  <SelectTrigger id="ct-estabelecimento_segmento" aria-invalid={!!errors.estabelecimento_segmento} aria-describedby={errors.estabelecimento_segmento ? "ct-estabelecimento_segmento-err" : undefined}><SelectValue placeholder="Escolha" /></SelectTrigger>
                  <SelectContent>{SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
                {errors.estabelecimento_segmento && <p id="ct-estabelecimento_segmento-err" className="text-sm text-destructive">{errors.estabelecimento_segmento}</p>}
              </div>
              {FIELDS.map((f) => (
                <div key={f.key} className={`space-y-1.5 ${f.span ? "sm:col-span-2" : ""}`}>
                  <Label htmlFor={`ct-${f.key}`}>{f.label}</Label>
                  <Input id={`ct-${f.key}`} name={f.key} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} onBlur={f.key === "endereco_cep" ? () => void fillCep() : undefined}
                    autoComplete={f.auto ?? "off"} inputMode={f.mode} type={f.type ?? "text"} required className="h-11"
                    aria-invalid={!!errors[f.key]} aria-describedby={errors[f.key] ? `ct-${f.key}-err` : undefined} />
                  {errors[f.key] && <p id={`ct-${f.key}-err`} className="text-sm text-destructive">{errors[f.key]}</p>}
                </div>
              ))}
            </fieldset>

            <Button type="submit" variant="brand" size="lg" className="w-full" disabled={!!busy}>
              {busy === "preview" ? <Loader2 className="mr-2 animate-spin" size={18} aria-hidden /> : <FileSignature className="mr-2" size={18} aria-hidden />}
              Revisar contrato preenchido
            </Button>
          </form>
        )}

        <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
          <DialogContent className="max-h-[92dvh] max-w-3xl overflow-hidden p-0">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Revise o contrato antes de assinar</DialogTitle>
              <DialogDescription>Este é exatamente o texto que será enviado para assinatura das duas partes.</DialogDescription>
            </DialogHeader>
            <div tabIndex={0} role="document" aria-label="Texto do contrato" className="mx-6 max-h-[50dvh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {preview?.text}
            </div>
            <div className="space-y-3 px-6 pb-6">
              <p className="flex items-start gap-2 break-all text-xs text-muted-foreground"><ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden />SHA-256: {preview?.hash}</p>
              <div className="flex min-h-11 items-start gap-3">
                <Checkbox id="ct-accept" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-1" />
                <Label htmlFor="ct-accept" className="text-sm leading-snug">Li o contrato e declaro ter poderes para representar o estabelecimento (Cláusula 21.3).</Label>
              </div>
              <Button variant="brand" size="lg" className="w-full" disabled={!accepted || busy === "create"} onClick={() => void send()}>
                {busy === "create" ? <Loader2 className="mr-2 animate-spin" size={18} aria-hidden /> : <FileSignature className="mr-2" size={18} aria-hidden />}
                Gerar e Assinar Contrato Digitalmente (Autentique)
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default Contract;
