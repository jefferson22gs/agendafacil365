import { useCallback, useEffect, useRef, useState } from "react";
import { Smartphone, QrCode, RefreshCw, CheckCircle, XCircle, Loader2, Wifi, WifiOff, Trash2, AlertCircle, BadgeCheck, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageShell as AdminLayout } from "@/pages/admin/whatsapp/Shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AutomationSettings } from "@/features/whatsapp/AutomationSettings";
import { InsightsSettings } from "@/features/whatsapp/InsightsSettings";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { OfficialConnectCard } from "@/components/whatsapp/OfficialConnectCard";
import { BotProviderChoice } from "@/components/whatsapp/BotProviderChoice";

interface WhatsAppInstance {
  id: string;
  salon_id: string;
  instance_name: string;
  status: "disconnected" | "connecting" | "connected" | "qrcode";
  phone_number: string | null;
  provider: "evolution" | "meta";
}
interface ConnectionResult {
  success: boolean;
  error?: string;
  status?: WhatsAppInstance["status"];
  phoneNumber?: string | null;
  qrcode?: string | null;
}
const columns = "id,salon_id,instance_name,status,phone_number,provider";
const friendlyError = "Não foi possível concluir. Confira a conexão e tente novamente.";

/**
 * Duas conexões por salão: API oficial (atendimento com botões, confirmações e lembretes) e QR Code
 * (Disparador e Status, que a Meta não oferece sem custo por mensagem). Cada uma tem seu próprio cartão.
 */
export default function WhatsAppConnection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [official, setOfficial] = useState<WhatsAppInstance | null>(null);
  const [qr, setQr] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [botProvider, setBotProvider] = useState<"meta" | "evolution" | null>(null);
  const identity = useRef(user?.id);
  identity.current = user?.id;
  const polling = useRef(false);

  const call = useCallback(async (action: string, tenant: string, provider: "evolution" | "meta" = "evolution"): Promise<ConnectionResult> => {
    const { data, error: requestError } = await supabase.functions.invoke("whatsapp-instances", { body: { action, salonId: tenant, provider } });
    if (requestError) throw new Error(friendlyError);
    const result = data as ConnectionResult | null;
    if (!result?.success) throw new Error(result?.error ?? friendlyError);
    return result;
  }, []);

  const loadInstances = useCallback(async (tenant: string) => {
    const { data, error: instanceError } = await supabase.from("whatsapp_instances").select(columns).eq("salon_id", tenant);
    if (instanceError) throw instanceError;
    const rows = (data ?? []) as WhatsAppInstance[];
    setOfficial(rows.find(r => r.provider === "meta") ?? null);
    setQr(rows.find(r => r.provider !== "meta") ?? null);
    const { data: bot } = await supabase.rpc("whatsapp_bot_provider" as never, { p_salon_id: tenant } as never);
    setBotProvider(bot === "meta" || bot === "evolution" ? bot : null);
    return rows;
  }, []);

  const refreshQr = useCallback(async (tenant: string) => {
    if (polling.current) return;
    polling.current = true;
    const owner = identity.current;
    try {
      const result = await call("status", tenant, "evolution");
      if (owner !== identity.current) return;
      setQr((prev) => prev ? { ...prev, status: result.status ?? prev.status, phone_number: result.phoneNumber ?? prev.phone_number } : prev);
      if (result.status === "connected" || result.status === "disconnected") setQrCode(null);
      setError(null);
    } catch { if (owner === identity.current) setError("Não foi possível consultar a conexão por QR Code."); }
    finally { polling.current = false; }
  }, [call]);

  useEffect(() => {
    let cancelled = false;
    setSalonId(null); setOfficial(null); setQr(null); setQrCode(null); setError(null); setLoading(true);
    async function load() {
      try {
        if (!user) return;
        const { data: salon, error: salonError } = await supabase.from("salons").select("id").eq("owner_id", user.id).limit(1).maybeSingle();
        if (salonError) throw salonError;
        if (cancelled) return;
        if (!salon) { setError("Configure seu estabelecimento antes de conectar o WhatsApp."); return; }
        setSalonId(salon.id);
        const rows = await loadInstances(salon.id);
        if (!cancelled && rows.some(r => r.provider !== "meta")) await refreshQr(salon.id);
      } catch { if (!cancelled) setError("Não foi possível carregar o WhatsApp do estabelecimento."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [user, refreshQr, loadInstances]);

  useEffect(() => {
    if (!salonId || !["qrcode", "connecting"].includes(qr?.status ?? "")) return;
    const interval = window.setInterval(() => void refreshQr(salonId), 5000);
    return () => clearInterval(interval);
  }, [salonId, qr?.status, refreshQr]);

  async function run(action: "create" | "connect" | "disconnect" | "delete") {
    if (!salonId || busy) return;
    if (action === "delete" && !window.confirm("Excluir a conexão por QR Code? Disparador e Status param até conectar de novo.")) return;
    if (action === "disconnect" && !window.confirm("Desconectar o QR Code? Disparador e Status ficam indisponíveis até reconectar.")) return;
    const owner = identity.current;
    setBusy(action); setError(null);
    try {
      const result = await call(action, salonId, "evolution");
      if (owner !== identity.current) return;
      if (action === "delete") { setQr(null); setQrCode(null); }
      else if (action === "create") { await loadInstances(salonId); setShowCreateModal(false); }
      else if (action === "connect") {
        setQrCode(result.qrcode ?? null);
        setQr((prev) => prev ? { ...prev, status: result.status ?? "connecting" } : null);
      } else { setQr((prev) => prev ? { ...prev, status: "disconnected", phone_number: null } : null); setQrCode(null); }
      toast({ title: action === "create" ? "Conexão cadastrada" : action === "connect" ? "Conectar pelo celular" : action === "delete" ? "Conexão excluída" : "QR Code desconectado", description: action === "connect" ? "Escaneie o código no WhatsApp do estabelecimento. Aguarde o status conectado." : undefined });
    } catch (err) {
      const message = err instanceof Error && err.message === friendlyError ? err.message : friendlyError;
      setError(message); toast({ title: "Não foi possível concluir", description: message, variant: "destructive" });
    } finally { if (owner === identity.current) setBusy(null); }
  }

  if (loading) return <AdminLayout><div className="flex flex-col items-center justify-center h-96 gap-3" role="status"><Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden /><p className="text-sm text-muted-foreground">Carregando WhatsApp…</p></div></AdminLayout>;
  const qrConnected = qr?.status === "connected";
  const qrWaiting = qr?.status === "connecting" || qr?.status === "qrcode";
  const hasAny = !!official || !!qr;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl mx-auto min-w-0">
        <div data-tour="whatsapp-header">
          <PageHeader className="mb-0" title={<span className="flex items-center gap-2"><Smartphone className="w-6 h-6 text-primary" aria-hidden />Conexão WhatsApp</span>}
            description="Conecte uma ou as duas: escolha qual atende os clientes no automático; o QR Code também faz Disparador e Status." />
        </div>
        {error && <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground" role="alert"><AlertCircle size={18} className="text-destructive shrink-0" aria-hidden />{error}</div>}

        {salonId && (official || qr) && <BotProviderChoice salonId={salonId} current={botProvider} available={[...(official ? ["meta" as const] : []), ...(qr ? ["evolution" as const] : [])]} onChange={setBotProvider} />}

        {/* 1. Oficial: atendimento, bot, confirmações, lembretes, cobranças. */}
        {official ? (
          <Card data-tour="whatsapp-official"><CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${official.status === "connected" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`} aria-hidden>{official.status === "connected" ? <BadgeCheck /> : <XCircle />}</div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">API oficial (Meta){botProvider === "meta" ? " · robô ligado" : ""}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant={official.status === "connected" ? "success" : "danger"}>{official.status === "connected" ? "Conectado" : "Desconectado"}</Badge>
                  <Badge variant="info">Oficial (Meta)</Badge>
                  {official.phone_number && <span className="text-sm text-muted-foreground">+{official.phone_number}</span>}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{botProvider === "meta" ? "Atende com botões: chatbot, confirmações, lembretes, avaliações e cobranças." : "Robô desligado aqui: as mensagens chegam na Caixa de entrada, sem resposta automática."}</p>
              </div>
            </div>
          </CardContent></Card>
        ) : salonId && <OfficialConnectCard salonId={salonId} onConnected={() => void loadInstances(salonId)} />}

        {/* 2. QR Code (Evolution): Disparador e Status. */}
        <Card data-tour="whatsapp-qr-card">
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${qrConnected ? "bg-success/10 text-success" : qrWaiting ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`} aria-hidden>
                  {qrConnected ? <CheckCircle /> : qrWaiting ? <Loader2 className="animate-spin" /> : <Megaphone />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold" data-tour="whatsapp-status">QR Code{botProvider === "evolution" ? " · robô ligado" : " · Disparador e Status"}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {qr ? <Badge variant={qrConnected ? "success" : qrWaiting ? "warning" : "danger"}>{qrConnected ? "Conectado" : qrWaiting ? "Aguardando leitura do QR Code" : "Desconectado"}</Badge>
                      : <Badge variant="secondary">Não conectado</Badge>}
                    <Badge variant="secondary">QR Code</Badge>
                    {qr?.phone_number && <span className="text-sm text-muted-foreground">+{qr.phone_number}</span>}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{botProvider === "evolution" ? "Atende os clientes (opções numeradas, sem botões), envia o Disparador e publica Status." : "Envia o Disparador e publica Status. O atendimento automático está na API oficial."}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!qr ? <Button variant={official ? "brand" : "outline"} disabled={!salonId || !!busy} onClick={() => setShowCreateModal(true)} data-tour="whatsapp-create-button"><QrCode size={16} className="mr-2" aria-hidden />Conectar por QR Code</Button> : <>
                  <Button variant="outline" size="icon" disabled={!!busy} onClick={() => void refreshQr(salonId!)} aria-label="Atualizar conexão por QR Code"><RefreshCw size={18} aria-hidden /></Button>
                  {qrConnected ? <Button variant="destructive" disabled={!!busy} onClick={() => void run("disconnect")} data-tour="whatsapp-disconnect"><WifiOff size={16} className="mr-2" aria-hidden />Desconectar</Button>
                    : <Button variant="brand" disabled={!!busy} onClick={() => void run("connect")} data-tour="whatsapp-connect-button">{busy === "connect" ? <Loader2 size={16} className="animate-spin mr-2" aria-hidden /> : <Wifi size={16} className="mr-2" aria-hidden />}{qrWaiting ? "Gerar QR Code" : "Conectar"}</Button>}
                </>}
              </div>
            </div>
            <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">Dica: use um número diferente do oficial (por exemplo, um chip só para divulgação). Envios em massa por QR Code têm risco de bloqueio pelo WhatsApp; mande só para quem autorizou.</p>
            {qrCode && <div data-tour="whatsapp-qrcode" className="flex flex-col items-center gap-2 rounded-2xl border p-4 text-center">
              <p className="font-semibold">Escaneie o QR Code</p><p className="text-sm text-muted-foreground">No celular: WhatsApp, Aparelhos conectados, Conectar aparelho.</p>
              <div className="rounded-xl bg-white p-4"><img src={qrCode} alt="Código temporário para conectar o WhatsApp do estabelecimento" className="h-56 w-56 max-w-full sm:h-64 sm:w-64" /></div>
              <p className="text-xs text-muted-foreground">Não compartilhe este código.</p>
              <Button variant="outline" disabled={!!busy} onClick={() => void run("connect")} data-tour="whatsapp-new-qrcode">Gerar novo QR Code</Button>
            </div>}
            {qr && <div className="flex justify-end"><Button variant="ghost" className="text-destructive" disabled={!!busy} onClick={() => void run("delete")} data-tour="whatsapp-delete"><Trash2 size={16} className="mr-2" aria-hidden />Excluir conexão por QR Code</Button></div>}
          </CardContent>
        </Card>

        {hasAny && salonId && <AutomationSettings salonId={salonId} />}
        {hasAny && salonId && <InsightsSettings salonId={salonId} />}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}><DialogContent><DialogHeader><DialogTitle>Conectar por QR Code</DialogTitle><DialogDescription>O sistema cria uma conexão exclusiva para Disparador e Status. Depois você escaneia o código pelo celular. Nenhuma mensagem é enviada neste cadastro.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setShowCreateModal(false)}>Voltar</Button><Button variant="brand" disabled={!!busy} onClick={() => void run("create")} data-tour="whatsapp-create-save">{busy === "create" && <Loader2 className="animate-spin mr-2" size={16} />}Criar conexão</Button></DialogFooter></DialogContent></Dialog>
      </div>
    </AdminLayout>
  );
}
