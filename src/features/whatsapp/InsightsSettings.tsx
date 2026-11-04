import { useCallback, useEffect, useState } from "react";
import { Loader2, BarChart3, Send, Eye, History, Trash2, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { normalizePhone } from "@/features/whatsapp/contacts/phone";

interface Settings {
  weekly_enabled: boolean; monthly_enabled: boolean; yearly_enabled: boolean; alerts_enabled: boolean;
  weekly_day: number; send_time: string; show_professional_ranking: boolean;
  alert_drop_pct: number; alert_growth_pct: number; alert_cancel_rate_pct: number; alert_cooldown_days: number;
}
interface Recipient { id: string; phone: string; verified_at: string | null }
interface Report { id: string; kind: string; period_start: string; status: string; error_code: string | null; created_at: string; message: string }

const DEFAULTS: Settings = {
  weekly_enabled: false, monthly_enabled: false, yearly_enabled: false, alerts_enabled: false,
  weekly_day: 1, send_time: "08:00", show_professional_ranking: true,
  alert_drop_pct: 30, alert_growth_pct: 40, alert_cancel_rate_pct: 25, alert_cooldown_days: 7,
};
const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const KIND_LABEL: Record<string, string> = { weekly: "Semanal", monthly: "Mensal", yearly: "Anual", alert: "Alerta", test: "Teste", on_demand: "Consulta" };

// Tabelas novas ainda fora dos tipos gerados do Supabase.
const table = (name: string) => (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }).from(name);

export function InsightsSettings({ salonId }: { salonId: string }) {
  const { toast } = useToast();
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("insights-reports", { body: { salonId, ...body } });
    if (error || !data?.success) throw new Error(data?.error ?? "Não foi possível concluir. Tente novamente.");
    return data;
  }, [salonId]);

  const reload = useCallback(async () => {
    const [cfg, rec, rep] = await Promise.all([
      table("insights_settings").select("*").eq("salon_id", salonId).maybeSingle(),
      table("insights_recipients").select("id,phone,verified_at").eq("salon_id", salonId).order("created_at"),
      table("insights_reports").select("id,kind,period_start,status,error_code,created_at,message").eq("salon_id", salonId).order("created_at", { ascending: false }).limit(20),
    ]);
    if (cfg.data) setS({ ...DEFAULTS, ...(cfg.data as Partial<Settings>), send_time: String((cfg.data as Settings).send_time).slice(0, 5) });
    setRecipients((rec.data ?? []) as Recipient[]);
    setReports((rep.data ?? []) as Report[]);
  }, [salonId]);

  useEffect(() => { void reload().finally(() => setLoading(false)); }, [reload]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast({ title: e instanceof Error ? e.message : "Erro inesperado.", variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const save = () => run("save", async () => {
    const { error } = await table("insights_settings").upsert({ salon_id: salonId, ...s, updated_at: new Date().toISOString() }, { onConflict: "salon_id" });
    if (error) throw new Error("Não foi possível salvar as preferências.");
    toast({ title: "Preferências de relatórios salvas." });
  });

  const register = () => run("register", async () => {
    const normalized = normalizePhone(phone);
    if (!normalized) throw new Error("Número inválido. Use DDD + número, ex.: (11) 99999-9999.");
    await invoke({ action: "register_phone", phone: normalized });
    setPhone("");
    toast({ title: "Código enviado", description: "Responda no WhatsApp com o código de 6 dígitos para verificar o número." });
    await reload();
  });

  const verified = recipients.some(r => r.verified_at);
  const toggles: { key: keyof Settings; label: string; hint: string }[] = [
    { key: "weekly_enabled", label: "Resumo semanal", hint: "Semana de segunda a domingo, enviado no dia e horário escolhidos." },
    { key: "monthly_enabled", label: "Fechamento mensal", hint: "Enviado no dia 1º, com comparação ao mês anterior." },
    { key: "yearly_enabled", label: "Retrospectiva anual", hint: "Enviada em 1º de janeiro." },
    { key: "alerts_enabled", label: "Alertas inteligentes", hint: "Queda ou alta de atendimentos, muitos cancelamentos e dias fracos. Sem repetir o mesmo aviso." },
    { key: "show_professional_ranking", label: "Mostrar profissional com mais atendimentos", hint: "Desative se não quiser comparar a equipe no relatório." },
  ];

  if (loading) return <Card><CardContent className="p-6 flex justify-center"><Loader2 className="animate-spin" /></CardContent></Card>;

  return (
    <Card data-tour="whatsapp-insights">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 size={20} />Relatórios e Insights pelo WhatsApp</CardTitle>
        <CardDescription>Receba os números do estabelecimento no seu WhatsApp. Faturamento considera apenas atendimentos marcados como concluídos.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium">Número que recebe os relatórios</p>
          {recipients.map(r => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
              <span className="flex flex-wrap items-center gap-2 min-w-0"><span className="font-medium">{r.phone}</span>{r.verified_at
                ? <Badge variant="success" className="gap-1"><CheckCircle2 size={12} aria-hidden />Verificado</Badge>
                : <Badge variant="warning" className="gap-1"><Clock size={12} aria-hidden />Aguardando código</Badge>}</span>
              <Button size="sm" variant="ghost" aria-label="Remover número" disabled={!!busy} onClick={() => void run(`rm-${r.id}`, async () => { await invoke({ action: "remove_phone", recipientId: r.id }); await reload(); })}><Trash2 size={14} aria-hidden /></Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input aria-label="Número de WhatsApp para relatórios" placeholder="(11) 99999-9999" value={phone} onChange={e => setPhone(e.target.value)} />
            <Button variant="outline" disabled={!!busy || !phone.trim()} onClick={() => void register()}>{busy === "register" && <Loader2 className="animate-spin mr-2" size={14} />}Enviar código</Button>
          </div>
          <p className="text-xs text-muted-foreground">Por segurança, o número precisa responder o código no WhatsApp antes de receber dados financeiros.</p>
        </div>

        <div className="space-y-4">
          {toggles.map(t => (
            <div key={t.key} className="flex items-start justify-between gap-4">
              <div><Label htmlFor={`ins-${t.key}`} className="font-medium">{t.label}</Label><p className="text-sm text-muted-foreground">{t.hint}</p></div>
              <Switch id={`ins-${t.key}`} checked={Boolean(s[t.key])} onCheckedChange={v => setS(p => ({ ...p, [t.key]: v }))} />
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="ins-day">Dia do resumo semanal</Label>
            <select id="ins-day" className="w-full h-11 border border-input rounded-[10px] px-3 bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={s.weekly_day} onChange={e => setS(p => ({ ...p, weekly_day: Number(e.target.value) }))}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="ins-time">Horário dos relatórios</Label>
            <Input id="ins-time" type="time" value={s.send_time} onChange={e => setS(p => ({ ...p, send_time: e.target.value }))} /></div>
        </div>

        {s.alerts_enabled && (
          <div className="grid sm:grid-cols-2 gap-4 rounded-lg border p-4">
            {([["alert_drop_pct", "Avisar queda acima de (%)"], ["alert_growth_pct", "Avisar crescimento acima de (%)"], ["alert_cancel_rate_pct", "Avisar cancelamentos acima de (%)"], ["alert_cooldown_days", "Não repetir o mesmo aviso por (dias)"]] as const).map(([k, label]) => (
              <div key={k} className="space-y-1"><Label htmlFor={`ins-${k}`} className="text-sm">{label}</Label><Input id={`ins-${k}`} type="number" min={1} value={s[k]} onChange={e => setS(p => ({ ...p, [k]: Number(e.target.value) }))} /></div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" disabled={!!busy} onClick={() => void run("preview", async () => setPreview((await invoke({ action: "preview", kind: "weekly", mode: "closed" })).text))}><Eye size={14} className="mr-2" />Visualizar semana passada</Button>
          <Button variant="outline" disabled={!!busy} onClick={() => void run("now", async () => setPreview((await invoke({ action: "preview", kind: "monthly", mode: "current" })).text))}><BarChart3 size={14} className="mr-2" />Gerar mês até agora</Button>
          <Button variant="outline" disabled={!!busy || !verified} title={verified ? undefined : "Verifique um número primeiro"} onClick={() => void run("test", async () => { await invoke({ action: "send_test", kind: "weekly" }); toast({ title: "Teste enviado para a fila", description: "Chega no seu WhatsApp em instantes." }); await reload(); })}><Send size={14} className="mr-2" />Enviar teste ao meu WhatsApp</Button>
          <Button variant="outline" onClick={() => setShowHistory(true)}><History size={14} className="mr-2" />Ver histórico</Button>
          <Button variant="brand" disabled={!!busy} onClick={() => void save()}>{busy === "save" && <Loader2 className="animate-spin mr-2" size={14} />}Salvar</Button>
        </div>
        {!verified && (s.weekly_enabled || s.monthly_enabled || s.yearly_enabled || s.alerts_enabled) && <p className="text-sm text-warning" role="status">Nenhum número verificado: os relatórios ficam pausados até a verificação.</p>}
      </CardContent>

      <Dialog open={preview !== null} onOpenChange={o => !o && setPreview(null)}>
        <DialogContent><DialogHeader><DialogTitle>Prévia do relatório</DialogTitle><DialogDescription>Calculado agora com os dados reais do estabelecimento.</DialogDescription></DialogHeader>
          <pre className="whitespace-pre-wrap text-sm bg-muted rounded p-3 max-h-[60vh] overflow-y-auto font-sans">{preview}</pre></DialogContent>
      </Dialog>
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent><DialogHeader><DialogTitle>Histórico de relatórios</DialogTitle><DialogDescription>Últimos 20 envios.</DialogDescription></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {reports.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum relatório enviado ainda.</p> : reports.map(r => (
              <button key={r.id} className="w-full text-left rounded border p-2 text-sm hover:bg-muted" onClick={() => { setShowHistory(false); setPreview(r.message); }}>
                <span className="font-medium">{KIND_LABEL[r.kind] ?? r.kind}</span> · {new Date(r.created_at).toLocaleString("pt-BR")} · {r.status === "queued" ? "enviado para a fila" : r.status === "skipped" ? "não enviado (WhatsApp não conectado)" : "falhou"}
              </button>
            ))}
          </div></DialogContent>
      </Dialog>
    </Card>
  );
}
