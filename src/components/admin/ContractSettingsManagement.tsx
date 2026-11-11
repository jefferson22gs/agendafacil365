import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;
const env = import.meta.env;
type Settings = Record<"company_name" | "cnpj" | "address" | "representative_name" | "representative_cpf" | "email" | "signer_email" | "platform_url" | "city" | "forum" | "preamble", string>;
// Valores iniciais opcionais por variável de ambiente; o servidor sempre usa o que estiver salvo no banco.
const FROM_ENV: Partial<Settings> = {
  company_name: env.VITE_OWNER_COMPANY_NAME, cnpj: env.VITE_OWNER_CNPJ, representative_name: env.VITE_OWNER_NAME,
  representative_cpf: env.VITE_OWNER_CPF, email: env.VITE_OWNER_EMAIL, address: env.VITE_OWNER_ADDRESS,
};
const FIELDS: { key: keyof Settings; label: string; auto?: string; optional?: boolean; long?: boolean }[] = [
  { key: "company_name", label: "Razão social / nome da CONTRATADA", auto: "organization" },
  { key: "cnpj", label: "CNPJ ou CPF" },
  { key: "address", label: "Endereço comercial completo", auto: "street-address" },
  { key: "representative_name", label: "Representante legal (assina os contratos)", auto: "name" },
  { key: "representative_cpf", label: "CPF do representante (opcional)", optional: true },
  { key: "email", label: "E-mail oficial (impresso no contrato)", auto: "email" },
  { key: "signer_email", label: "E-mail que recebe o convite de assinatura (se diferente)", auto: "email", optional: true },
  { key: "platform_url", label: "URL da plataforma", auto: "url" },
  { key: "city", label: "Cidade de assinatura", auto: "address-level2" },
  { key: "forum", label: "Foro (Comarca/UF)" },
  { key: "preamble", label: "Qualificação da CONTRATADA no contrato (opcional; aceita {{CONTRATADA_CNPJ}} etc.)", optional: true, long: true },
];

/** Super admin: dados da CONTRATADA usados no preenchimento automático do contrato SaaS. */
export function ContractSettingsManagement() {
  const [form, setForm] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void db.from("platform_contract_settings").select("*").eq("id", true).maybeSingle().then(({ data, error }) => {
      if (error) { toast.error("Aplique a migration de contratos para configurar."); return; }
      const row = (data ?? {}) as Partial<Settings>;
      setForm(Object.fromEntries(FIELDS.map(({ key }) => [key, row[key] || FROM_ENV[key] || ""])) as Settings);
    });
  }, []);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
    const { error } = await db.from("platform_contract_settings").update({ ...clean, updated_at: new Date().toISOString() }).eq("id", true);
    setSaving(false);
    if (error) toast.error("Não foi possível salvar."); else toast.success("Dados da CONTRATADA salvos.");
  };

  if (!form) return <div role="status" className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="animate-spin" size={18} aria-hidden />Carregando…</div>;
  return (
    <Card>
      <CardHeader><CardTitle>Contrato SaaS — dados da CONTRATADA</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          {FIELDS.map((f) => (
            <div key={f.key} className={`space-y-1.5 ${f.long ? "sm:col-span-2" : ""}`}>
              <Label htmlFor={`pcs-${f.key}`}>{f.label}</Label>
              {f.long
                ? <Textarea id={`pcs-${f.key}`} rows={5} maxLength={2000} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                : <Input id={`pcs-${f.key}`} className="h-11" autoComplete={f.auto ?? "off"} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} required={!f.optional} />}
            </div>
          ))}
          <p className="text-sm text-muted-foreground sm:col-span-2">Chave da Autentique e segredo do webhook ficam só nos segredos das Edge Functions (AUTENTIQUE_API_KEY, AUTENTIQUE_WEBHOOK_SECRET).</p>
          <Button type="submit" disabled={saving} className="h-11 sm:col-span-2">
            {saving ? <Loader2 className="mr-2 animate-spin" size={16} aria-hidden /> : <Save className="mr-2" size={16} aria-hidden />}Salvar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
