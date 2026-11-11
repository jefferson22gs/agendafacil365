import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;
const env = import.meta.env;
type Settings = Record<"company_name" | "cnpj" | "address" | "representative_name" | "representative_cpf" | "email" | "platform_url" | "city" | "forum", string>;
// Valores iniciais opcionais por variável de ambiente; o servidor sempre usa o que estiver salvo no banco.
const FROM_ENV: Partial<Settings> = {
  company_name: env.VITE_OWNER_COMPANY_NAME, cnpj: env.VITE_OWNER_CNPJ, representative_name: env.VITE_OWNER_NAME,
  representative_cpf: env.VITE_OWNER_CPF, email: env.VITE_OWNER_EMAIL, address: env.VITE_OWNER_ADDRESS,
};
const FIELDS: { key: keyof Settings; label: string; auto?: string }[] = [
  { key: "company_name", label: "Razão social / nome da CONTRATADA", auto: "organization" },
  { key: "cnpj", label: "CNPJ ou CPF" },
  { key: "address", label: "Endereço comercial completo", auto: "street-address" },
  { key: "representative_name", label: "Representante legal (assina os contratos)", auto: "name" },
  { key: "representative_cpf", label: "CPF do representante" },
  { key: "email", label: "E-mail oficial (recebe os links de assinatura)", auto: "email" },
  { key: "platform_url", label: "URL da plataforma", auto: "url" },
  { key: "city", label: "Cidade de assinatura", auto: "address-level2" },
  { key: "forum", label: "Foro (Comarca/UF)" },
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
    const { error } = await db.from("platform_contract_settings").update({ ...form, updated_at: new Date().toISOString() }).eq("id", true);
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
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`pcs-${f.key}`}>{f.label}</Label>
              <Input id={`pcs-${f.key}`} className="h-11" autoComplete={f.auto ?? "off"} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} required />
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
