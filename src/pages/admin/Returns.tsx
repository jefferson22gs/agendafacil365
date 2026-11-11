import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { CalendarClock, CalendarPlus, Loader2, Mail, MessageCircle, RefreshCw, Send, Smartphone, X } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { humanDays, isMissingSchema, RETURNS_MIGRATION_NOTICE } from "@/lib/procedureReturns";

// Tabela/RPCs novas ainda fora dos tipos gerados: cliente sem tipagem estrita só aqui.
const db = supabase as unknown as SupabaseClient;

interface ReturnRow {
  id: string; client_id: string | null; appointment_id: string; service_id: string; client_name: string | null; client_phone: string | null;
  client_email: string | null; procedure_name: string; performed_at: string; return_days: number; alert_date: string;
  status: "pending" | "notified" | "scheduled" | "dismissed";
  channels_sent: Record<string, { status?: string; reason?: string }>;
  whatsapp_status: string | null; push_status: string | null; notified_at: string | null;
}
type Kpis = { today: number; next7: number; overdue: number; notified: number; converted: number };

const STATUS: Record<ReturnRow["status"], string> = { pending: "Pendente", notified: "Notificado", scheduled: "Convertido (reagendou)", dismissed: "Descartado" };
const CHANNEL_LABEL: Record<string, string> = {
  queued: "na fila", sending: "enviando", accepted: "aceito pelo provedor", delivered: "entregue", read: "lido", sent: "enviado",
  failed: "falhou", retry: "nova tentativa", uncertain: "incerto", skipped: "não enviado", cancelled: "cancelado", expired: "expirado", processing: "enviando", pending: "na fila",
};
const REASON: Record<string, string> = { disabled: "desativado no serviço", opt_out: "cliente pediu para não receber", no_phone: "sem WhatsApp", no_email: "sem e-mail", no_instance: "WhatsApp não conectado", no_device: "app não instalado", not_configured: "e-mail não configurado", retry_window_closed: "prazo de reenvio esgotado" };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const br = (s: string) => s.split("-").reverse().join("/");

function ChannelBadge({ icon: Icon, label, state }: { icon: typeof Mail; label: string; state?: { status?: string; reason?: string } | string | null }) {
  const st = typeof state === "string" ? { status: state } : state ?? undefined;
  const text = !st?.status ? "aguardando" : `${CHANNEL_LABEL[st.status] ?? st.status}${st.reason ? ` (${REASON[st.reason] ?? st.reason})` : ""}`;
  const tone = !st?.status ? "bg-muted text-foreground" : ["accepted", "delivered", "read", "sent"].includes(st.status) ? "bg-success/15 text-foreground border-success/40"
    : ["failed", "uncertain", "cancelled", "expired"].includes(st.status) ? "bg-destructive/10 text-foreground border-destructive/40" : "bg-secondary text-foreground";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${tone}`}>
      <Icon size={12} aria-hidden /> <span className="sr-only">{label}:</span>{text}
    </span>
  );
}

const Returns = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const clientFilter = params.get("client");
  const [salonId, setSalonId] = useState<string | null>(null);
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("open");
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 30 * 864e5)));
  const [to, setTo] = useState(() => iso(new Date(Date.now() + 60 * 864e5)));

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let sid = salonId;
      if (!sid) {
        const { data } = await supabase.from("salons").select("id").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
        sid = data?.id ?? null; setSalonId(sid);
      }
      if (!sid) return;
      const [list, k] = await Promise.all([
        db.rpc("procedure_returns_list", { p_salon: sid, p_from: from || null, p_to: to || null,
          p_status: ["pending", "notified", "scheduled", "dismissed"].includes(status) ? status : null, p_client: clientFilter }),
        db.rpc("procedure_returns_kpis", { p_salon: sid }),
      ]);
      if (isMissingSchema(list.error) || isMissingSchema(k.error)) { setMissing(true); return; }
      if (list.error) throw list.error;
      const data = (list.data ?? []) as ReturnRow[];
      setRows(status === "open" ? data.filter((r) => r.status === "pending" || r.status === "notified") : data);
      setKpis(k.data as Kpis);
    } catch (e) {
      console.error("returns_load", e);
      toast.error("Não foi possível carregar os retornos.");
    } finally {
      setLoading(false);
    }
  }, [user, salonId, from, to, status, clientFilter]);

  useEffect(() => { void load(); }, [load]);

  const fireNow = async (row: ReturnRow) => {
    if (!salonId) return;
    setBusy(row.id);
    const { data, error } = await supabase.functions.invoke("process-return-alerts", { body: { id: row.id, salon_id: salonId } });
    setBusy(null);
    if (error || !data?.success) { toast.error(data?.error ?? "Não foi possível disparar agora."); return; }
    toast.success(data.processed ? "Lembrete enviado para as filas dos canais ativos." : "Nada a enviar: canais já usados ou desativados.");
    void load();
  };

  const dismiss = async (row: ReturnRow) => {
    setBusy(row.id);
    const { error } = await db.rpc("procedure_return_update", { p_id: row.id, p_status: "dismissed" });
    setBusy(null);
    if (error) { toast.error("Não foi possível descartar."); return; }
    toast.success("Lembrete descartado."); void load();
  };

  const whatsappLink = (row: ReturnRow) => {
    const digits = (row.client_phone ?? "").replace(/\D/g, "");
    if (!digits) return null;
    const text = `Olá, ${row.client_name ?? ""}! Já faz ${humanDays(row.return_days)} desde seu ${row.procedure_name}. Que tal agendar seu retorno?`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  };

  const cards = useMemo(() => kpis ? [
    { label: "Vencendo hoje", value: kpis.today }, { label: "Próximos 7 dias", value: kpis.next7 },
    { label: "Atrasados", value: kpis.overdue }, { label: "Notificados", value: kpis.notified }, { label: "Convertidos", value: kpis.converted },
  ] : [], [kpis]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader title="Retornos & Lembretes" className="mb-0"
          description="Clientes que estão no prazo de retorno/manutenção do procedimento. O lembrete sai automaticamente às 09h (WhatsApp, e-mail e app)."
          actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className="mr-2" aria-hidden />Atualizar</Button>} />

        {missing ? (
          <Card><CardContent className="p-6" role="status">{RETURNS_MIGRATION_NOTICE}</CardContent></Card>
        ) : (<>
          <section aria-label="Indicadores de retorno" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {cards.map((c) => (
              <Card key={c.label}><CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold tabular-nums" aria-live="polite">{c.value}</p>
              </CardContent></Card>
            ))}
          </section>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(3,minmax(0,200px))_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="returns-status">Situação</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="returns-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Em aberto</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(STATUS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="returns-from">De</Label><Input id="returns-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="returns-to">Até</Label><Input id="returns-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            {clientFilter && <Button variant="ghost" onClick={() => { params.delete("client"); setParams(params); }}><X size={16} className="mr-2" aria-hidden />Todos os clientes</Button>}
          </div>

          {loading ? (
            <div role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" size={18} aria-hidden />Carregando…</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nenhum retorno neste período"
              description="Configure o retorno padrão em Serviços. Cada atendimento concluído passa a gerar o lembrete automático." />
          ) : (
            <ul className="space-y-3" aria-label="Lista de retornos">
              {rows.map((r) => {
                const wa = whatsappLink(r);
                const scheduleUrl = `/admin/appointments?${new URLSearchParams({ novo: "1", cliente: r.client_name ?? "", tel: r.client_phone ?? "", servico: r.service_id })}`;
                return (
                  <li key={r.id}><Card><CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold">{r.client_name || "Cliente"} · {r.procedure_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Atendimento em {br(r.performed_at)} · retorno de {humanDays(r.return_days)} · alerta em <strong className="text-foreground">{br(r.alert_date)}</strong> · {STATUS[r.status]}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <ChannelBadge icon={MessageCircle} label="WhatsApp" state={r.whatsapp_status ?? r.channels_sent.whatsapp} />
                        <ChannelBadge icon={Mail} label="E-mail" state={r.channels_sent.email} />
                        <ChannelBadge icon={Smartphone} label="App" state={r.push_status ?? r.channels_sent.push} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(r.status === "pending" || r.status === "notified") && (
                        <Button size="sm" className="h-11" onClick={() => void fireNow(r)} disabled={busy === r.id}>
                          {busy === r.id ? <Loader2 className="mr-2 animate-spin" size={16} aria-hidden /> : <Send size={16} className="mr-2" aria-hidden />}Disparar agora
                        </Button>
                      )}
                      {wa && <Button size="sm" variant="outline" className="h-11" asChild>
                        <a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} className="mr-2" aria-hidden />Chamar no WhatsApp<span className="sr-only"> (abre em nova aba)</span></a>
                      </Button>}
                      <Button size="sm" variant="outline" className="h-11" asChild>
                        <a href={scheduleUrl}><CalendarPlus size={16} className="mr-2" aria-hidden />Agendar retorno</a>
                      </Button>
                      {r.status === "pending" && (
                        <Button size="sm" variant="ghost" className="h-11" onClick={() => void dismiss(r)} disabled={busy === r.id}>Descartar</Button>
                      )}
                    </div>
                  </CardContent></Card></li>
                );
              })}
            </ul>
          )}
        </>)}
      </div>
    </AdminLayout>
  );
};

export default Returns;
