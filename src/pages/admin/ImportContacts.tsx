import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, Smartphone, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { contactPreview, mapCsv, parseVcf, readCsv, MAX_FILE_BYTES, type CsvData, type PreviewContact, type RawContact } from "@/features/whatsapp/contacts/parse";

interface PickedContact { name?: string[]; tel?: string[]; email?: string[] }
interface ContactPicker { select: (fields: string[], options: { multiple: boolean }) => Promise<PickedContact[]> }
export default function ImportContacts() {
  const { user } = useAuth();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [existing, setExisting] = useState<string[]>([]);
  const [contacts, setContacts] = useState<PreviewContact[]>([]);
  const [csv, setCsv] = useState<CsvData | null>(null);
  const [mapping, setMapping] = useState({ name: "", phone: "", email: "" });
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) return;
      const { data: salon, error } = await supabase.from("salons").select("id").eq("owner_id", user.id).limit(1).maybeSingle();
      if (cancelled) return;
      if (error || !salon) { toast.error("Configure seu estabelecimento antes de importar contatos."); return; }
      setSalonId(salon.id);
      const phones: string[] = [];
      for (let offset = 0; offset < 100_000; offset += 1000) {
        const { data, error: queryError } = await supabase.from("clients").select("phone").eq("salon_id", salon.id).order("id").range(offset, offset + 999);
        if (queryError) { toast.error("Não foi possível conferir os clientes existentes."); return; }
        phones.push(...(data ?? []).map(c => c.phone ?? ""));
        if (!data || data.length < 1000) break;
      }
      if (!cancelled) setExisting(phones);
    }
    void load();
    return () => { cancelled = true; };
  }, [user]);
  const preview = (raw: RawContact[]) => { setContacts(contactPreview(raw, existing)); setResult(null); };
  async function fileSelected(file?: File) {
    if (!file) return;
    setBusy(true); setCsv(null);
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error("Envie arquivo de até 5 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      catch { text = new TextDecoder("windows-1252").decode(bytes); }
      if (/\.vcf$/i.test(file.name)) preview(parseVcf(text));
      else if (/\.csv$/i.test(file.name)) { const data = readCsv(text); setCsv(data); setMapping(data.detected); setContacts([]); }
      else throw new Error("Formatos disponíveis: VCF e CSV.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Arquivo inválido."); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function fromPhone() {
    const picker = (navigator as Navigator & { contacts?: ContactPicker }).contacts;
    if (!picker) { toast.error("Este navegador não oferece seleção de contatos. Exporte VCF pelo celular."); return; }
    try {
      const data = await picker.select(["name", "tel", "email"], { multiple: true });
      preview(data.map(c => ({ name: c.name?.[0] ?? "", phones: c.tel ?? [], email: c.email?.[0] })));
    } catch { toast.error("Seleção cancelada ou indisponível."); }
  }
  async function fromWhatsApp() {
    if (!salonId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-instances", { body: { action: "contacts", salonId } });
      if (error || !data?.success || !Array.isArray(data.contacts)) throw new Error("Conecte o WhatsApp do estabelecimento e tente novamente.");
      preview(data.contacts.map((c: { name: string; phone: string }) => ({ name: c.name, phones: [c.phone] })));
      if (data.truncated) toast.warning("A conexão retornou mais de 10.000 contatos. A lista foi limitada; não é uma sincronização completa.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível buscar contatos."); }
    finally { setBusy(false); }
  }
  const selected = contacts.filter(c => c.selected && c.status === "new" && c.phone);
  async function importSelected() {
    if (!salonId || !selected.length || busy) return;
    if (!window.confirm(`Importar ${selected.length} contatos selecionados como clientes? Isso não autoriza campanhas de marketing.`)) return;
    setBusy(true);
    let imported = 0, already = 0;
    try {
      for (let offset = 0; offset < selected.length; offset += 500) {
        const { data, error } = await supabase.rpc("whatsapp_import_contacts", {
          p_salon_id: salonId, p_contacts: selected.slice(offset, offset + 500).map(c => ({ phone: c.phone!, name: c.name, email: c.email ?? null })),
        });
        if (error) throw new Error("Não foi possível concluir a importação. Lotes já concluídos foram preservados; repetir não duplica os contatos.");
        const summary = data as unknown as { imported: number; existing: number };
        imported += summary.imported; already += summary.existing;
      }
      setResult(`${imported} contatos importados; ${already} já cadastrados.`);
      setExisting(prev => [...prev, ...selected.map(c => c.phone!)]);
      setContacts(prev => prev.map(c => c.selected ? { ...c, status: "existing", selected: false } : c));
      toast.success("Importação concluída.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível importar."); }
    finally { setBusy(false); }
  }
  const filtered = contacts.map((contact, index) => ({ contact, index })).filter(({ contact }) => `${contact.name} ${contact.phone ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const counts = (status: PreviewContact["status"]) => contacts.filter(c => c.status === status).length;
  // Situação de cada contato na prévia: texto + cor semântica (inválido = erro, repetido = aviso).
  const STATUS_BADGE: Record<PreviewContact["status"], { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
    new: { label: "Novo", variant: "success" },
    existing: { label: "Já cadastrado", variant: "secondary" },
    duplicate: { label: "Repetido no arquivo", variant: "warning" },
    invalid: { label: "Inválido", variant: "danger" },
  };
  return <AdminLayout><div className="max-w-5xl mx-auto space-y-6">
    <div data-tour="import-contacts-header"><PageHeader className="mb-0" title="Importar contatos" description="Confira a prévia antes de salvar. Importar um contato não significa consentimento para marketing." /></div>
    <div className="grid gap-4 md:grid-cols-3" data-tour="import-contacts-methods">
      <Card data-tour="import-contacts-vcf"><CardHeader><CardTitle>Arquivo VCF ou CSV</CardTitle><CardDescription>Até 5 MB e 10.000 números. VCF 2.1, 3.0 e 4.0; CSV com mapeamento de colunas.</CardDescription></CardHeader><CardContent><input ref={fileRef} type="file" accept=".vcf,.csv" className="hidden" onChange={e => void fileSelected(e.target.files?.[0])} /><Button variant="brand" disabled={busy || !salonId} onClick={() => fileRef.current?.click()}><Upload size={16} className="mr-2" aria-hidden />Escolher arquivo</Button></CardContent></Card>
      <Card data-tour="import-contacts-phone"><CardHeader><CardTitle>Contatos do celular</CardTitle><CardDescription>Escolha pelo navegador compatível; nenhum acesso silencioso à agenda.</CardDescription></CardHeader><CardContent><Button variant="outline" disabled={busy || !salonId} onClick={() => void fromPhone()}><Smartphone size={16} className="mr-2" aria-hidden />Selecionar contatos</Button></CardContent></Card>
      <Card data-tour="import-contacts-whatsapp"><CardHeader><CardTitle>WhatsApp do estabelecimento</CardTitle><CardDescription>Use a conexão existente. Grupos e status não entram como clientes.</CardDescription></CardHeader><CardContent><Button variant="outline" disabled={busy || !salonId} onClick={() => void fromWhatsApp()}><MessageCircle size={16} className="mr-2" aria-hidden />Buscar contatos</Button></CardContent></Card>
    </div>
    {csv && <Card><CardHeader><CardTitle>Escolha as colunas do CSV</CardTitle></CardHeader><CardContent className="space-y-3">{(["name", "phone", "email"] as const).map(key => <div key={key} className="space-y-1"><Label htmlFor={`csv-map-${key}`}>{key === "name" ? "Nome" : key === "phone" ? "Telefone (obrigatório)" : "E-mail (opcional)"}</Label><select id={`csv-map-${key}`} className="block w-full h-11 border border-input rounded-[10px] px-3 bg-background text-foreground" value={mapping[key]}onChange={e => setMapping(prev => ({ ...prev, [key]: e.target.value }))}><option value="">Não informado</option>{csv.headers.map(h => <option key={h}>{h}</option>)}</select></div>)}<Button onClick={() => { try { preview(mapCsv(csv, mapping)); } catch(error) { toast.error(error instanceof Error ? error.message : "Mapeamento inválido."); } }}>Gerar prévia</Button></CardContent></Card>}
    {busy && <p className="flex gap-2 items-center text-muted-foreground" role="status"><Loader2 className="animate-spin text-primary" aria-hidden />Processando…</p>}
    {result && <p className="rounded-xl border border-success/30 bg-success/10 p-4 text-foreground" role="status" data-tour="import-contacts-results">{result}</p>}
    {contacts.length > 0 && <Card data-tour="import-contacts-preview"><CardHeader><CardTitle>{contacts.length} números encontrados</CardTitle><CardDescription>{counts("new")} novos · {counts("existing")} cadastrados · {counts("duplicate")} repetidos · {counts("invalid")} inválidos</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap gap-2" data-tour="import-contacts-selection"><Input className="flex-1 min-w-[12rem]" aria-label="Buscar nome ou telefone" placeholder="Buscar nome ou telefone" value={search}onChange={e => setSearch(e.target.value)} /><Button variant="outline" onClick={() => setContacts(prev => prev.map(c => ({ ...c, selected: c.status === "new" })))}>Selecionar novos</Button><Button variant="ghost" onClick={() => setContacts(prev => prev.map(c => ({ ...c, selected: false })))}>Nenhum</Button></div>
      <ul className="max-h-96 overflow-y-auto space-y-2">{filtered.map(({ contact: c, index }) => <li key={index} className="flex items-start gap-3 p-3 rounded-xl border border-border"><Checkbox className="mt-1"aria-label={`Selecionar ${c.name}`} disabled={c.status !== "new" || busy} checked={c.selected} onCheckedChange={checked => setContacts(prev => prev.map((item,i) => i === index ? { ...item, selected: checked === true } : item))} /><div className="min-w-0 flex-1"><p className="font-medium truncate">{c.name}</p><p className="text-sm text-muted-foreground break-words">{c.phone ?? c.reason}</p></div><Badge variant={STATUS_BADGE[c.status].variant} className="shrink-0">{STATUS_BADGE[c.status].label}</Badge></li>)}</ul>
      <Button variant="brand" disabled={busy || !selected.length}onClick={() => void importSelected()} data-tour="import-contacts-save">Importar {selected.length} selecionados</Button>
    </CardContent></Card>}
  </div></AdminLayout>;
}
