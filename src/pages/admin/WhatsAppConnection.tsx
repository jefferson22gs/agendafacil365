import { useCallback, useEffect, useRef, useState } from "react";
import { Smartphone, QrCode, RefreshCw, CheckCircle, XCircle, Loader2, Wifi, WifiOff, MessageSquare, Trash2, AlertCircle } from "lucide-react";
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
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { OfficialConnectCard } from "@/components/whatsapp/OfficialConnectCard";

interface WhatsAppInstance {
  id: string;
  salon_id: string;
  instance_name: string;
  status: "disconnected" | "connecting" | "connected" | "qrcode";
  phone_number: string | null;
  provider?: "evolution" | "meta";
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

export default function WhatsAppConnection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const identity = useRef(user?.id);
  identity.current = user?.id;
  const polling = useRef(false);

  const call = useCallback(async (action: string, tenant: string): Promise<ConnectionResult> => {
    const { data, error: requestError } = await supabase.functions.invoke("whatsapp-instances", { body: { action, salonId: tenant } });
    if (requestError) throw new Error(friendlyError);
    const result = data as ConnectionResult | null;
    if (!result?.success) throw new Error(result?.error ?? friendlyError);
    return result;
  }, []);

  const refreshStatus = useCallback(async (tenant: string) => {
    if (polling.current) return;
    polling.current = true;
    const owner = identity.current;
    try {
      const result = await call("status", tenant);
      if (owner !== identity.current) return;
      setInstance((prev) => prev?.salon_id === tenant ? { ...prev, status: result.status ?? prev.status, phone_number: result.phoneNumber ?? prev.phone_number } : prev);
      if (result.status === "connected" || result.status === "disconnected") setQrCode(null);
      setError(null);
    } catch { if (owner === identity.current) setError("Não foi possível consultar a conexão do WhatsApp."); }
    finally { polling.current = false; }
  }, [call]);

  useEffect(() => {
    let cancelled = false;
    setSalonId(null); setInstance(null); setQrCode(null); setError(null); setLoading(true);
    async function load() {
      try {
        if (!user) return;
        const { data: salon, error: salonError } = await supabase.from("salons").select("id").eq("owner_id", user.id).limit(1).maybeSingle();
        if (salonError) throw salonError;
        if (cancelled) return;
        if (!salon) { setError("Configure seu estabelecimento antes de conectar o WhatsApp."); return; }
        setSalonId(salon.id);
        const { data, error: instanceError } = await supabase.from("whatsapp_instances").select(columns).eq("salon_id", salon.id).maybeSingle();
        if (instanceError) throw instanceError;
        if (cancelled) return;
        setInstance(data as WhatsAppInstance | null);
        if (data) await refreshStatus(salon.id);
      } catch { if (!cancelled) setError("Não foi possível carregar o WhatsApp do estabelecimento."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [user, refreshStatus]);

  useEffect(() => {
    if (!salonId || !["qrcode", "connecting"].includes(instance?.status ?? "")) return;
    const interval = window.setInterval(() => void refreshStatus(salonId), 5000);
    return () => clearInterval(interval);
  }, [salonId, instance?.status, refreshStatus]);

  async function run(action: "create" | "connect" | "disconnect" | "delete") {
    if (!salonId || busy) return;
    if (action === "delete" && !window.confirm("Excluir esta conexão? Será necessário configurar e conectar novamente.")) return;
    if (action === "disconnect" && !window.confirm("Desconectar o WhatsApp? Mensagens automáticas ficarão indisponíveis até reconectar.")) return;
    const owner = identity.current;
    setBusy(action); setError(null);
    try {
      const result = await call(action, salonId);
      if (owner !== identity.current) return;
      if (action === "delete") { setInstance(null); setQrCode(null); }
      else if (action === "create") {
        const { data, error: reloadError } = await supabase.from("whatsapp_instances").select(columns).eq("salon_id", salonId).single();
        if (reloadError) throw reloadError;
        setInstance(data as WhatsAppInstance); setShowCreateModal(false);
      } else if (action === "connect") {
        setQrCode(result.qrcode ?? null);
        setInstance((prev) => prev ? { ...prev, status: result.status ?? "connecting" } : null);
      } else {
        setInstance((prev) => prev ? { ...prev, status: "disconnected", phone_number: null } : null); setQrCode(null);
      }
      toast({ title: action === "create" ? "Conexão cadastrada" : action === "connect" ? "Conectar pelo celular" : action === "delete" ? "Conexão excluída" : "WhatsApp desconectado", description: action === "connect" ? "Escaneie o código no WhatsApp do estabelecimento. Aguarde o status conectado." : undefined});
    } catch (err) {
      const message = err instanceof Error && err.message === friendlyError ? err.message : friendlyError;
      setError(message); toast({ title: "Não foi possível concluir", description: message, variant: "destructive" });
    } finally { if (owner === identity.current) setBusy(null); }
  }

  if (loading) return <AdminLayout><div className="flex flex-col items-center justify-center h-96 gap-3" role="status"><Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden /><p className="text-sm text-muted-foreground">Carregando WhatsApp…</p></div></AdminLayout>;
  const connected = instance?.status === "connected";
  const waiting = instance?.status === "connecting" || instance?.status === "qrcode";
  const official = instance?.provider === "meta";
  // Depois do cadastro oficial, relê a conexão (o servidor trocou o provedor do salão).
  const reload = async () => {
    if (!salonId) return;
    const { data } = await supabase.from("whatsapp_instances").select(columns).eq("salon_id", salonId).maybeSingle();
    setInstance(data as WhatsAppInstance | null); setQrCode(null);
  };
  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl mx-auto min-w-0">
        <div data-tour="whatsapp-header">
          <PageHeader className="mb-0" title={<span className="flex items-center gap-2"><Smartphone className="w-6 h-6 text-primary" aria-hidden />Conexão WhatsApp</span>} description="Conecte o WhatsApp do estabelecimento para mensagens, campanhas e atendimento automático." />
        </div>
        {error && <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground" role="alert"><AlertCircle size={18} className="text-destructive shrink-0" aria-hidden />{error}</div>}
        {/* Oficial: oferecido a quem ainda não conectou ou está no QR code. */}
        {salonId && !official && <OfficialConnectCard salonId={salonId} onConnected={() => void reload()} />}
        {!instance ? (
          <div data-tour="whatsapp-empty">
            <EmptyState
              icon={MessageSquare}
              title="Ou conecte por QR Code"
              description="Alternativa temporária: conecta como WhatsApp Web. Mensagens com opções numeradas (sem botões) e risco de bloqueio do número pelo WhatsApp."
              action={<Button variant="outline" disabled={!salonId} onClick={() => setShowCreateModal(true)} data-tour="whatsapp-create-button">Conectar por QR Code</Button>}
            />
          </div>
        ) : (
          <>
            <Card><CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${connected ? "bg-success/10 text-success" : waiting ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"}`} aria-hidden>
                  {connected ? <CheckCircle /> : waiting ? <Loader2 className="animate-spin" /> : <XCircle />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold" data-tour="whatsapp-status">{connected ? "WhatsApp conectado" : waiting ? "Aguardando conexão" : "WhatsApp desconectado"}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {/* Status com texto, ícone e cor semântica: conectado = sucesso, aguardando = aviso, desconectado = erro */}
                    <Badge variant={connected ? "success" : waiting ? "warning" : "danger"}>{connected ? "Conectado" : waiting ? "Aguardando leitura do QR Code" : "Desconectado"}</Badge>
                    <Badge variant={official ? "info" : "secondary"}>{official ? "Oficial (Meta)" : "QR Code"}</Badge>
                    {instance.phone_number && <span className="text-sm text-muted-foreground">+{instance.phone_number}</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="icon" disabled={!!busy} onClick={() => void refreshStatus(salonId!)} aria-label="Atualizar conexão"><RefreshCw size={18} aria-hidden /></Button>
                {official ? null : connected ? <Button variant="destructive" disabled={!!busy} onClick={() => void run("disconnect")} data-tour="whatsapp-disconnect"><WifiOff size={16} className="mr-2" aria-hidden />Desconectar</Button>
                : <Button variant="brand" disabled={!!busy} onClick={() => void run("connect")} data-tour="whatsapp-connect-button">{busy === "connect" ? <Loader2 size={16} className="animate-spin mr-2" aria-hidden /> : <Wifi size={16} className="mr-2" aria-hidden />}Reconectar</Button>}
              </div>
            </CardContent></Card>
            {qrCode && <Card data-tour="whatsapp-qrcode"><CardHeader className="text-center"><CardTitle className="flex justify-center gap-2"><QrCode aria-hidden />Escaneie o QR Code</CardTitle><CardDescription>No celular: WhatsApp, Aparelhos conectados, Conectar aparelho.</CardDescription></CardHeader>
              <CardContent className="flex flex-col items-center"><div className="p-4 bg-white rounded-xl"><img src={qrCode} alt="Código temporário para conectar o WhatsApp do estabelecimento"className="w-56 h-56 max-w-full sm:w-64 sm:h-64" /></div><p className="text-xs text-muted-foreground mt-3">Não compartilhe este código.</p><Button className="mt-4" variant="outline" disabled={!!busy} onClick={() => void run("connect")} data-tour="whatsapp-new-qrcode">Gerar novo QR Code</Button></CardContent>
            </Card>}
            {salonId && <AutomationSettings salonId={salonId} />}
            {salonId && <InsightsSettings salonId={salonId} />}
            {!official && <Card data-tour="whatsapp-tips"><CardContent className="p-6 flex gap-3"><AlertCircle className="text-primary flex-shrink-0" aria-hidden /><div><h3 className="font-semibold">Mantenha sua conexão funcionando</h3><p className="text-sm text-muted-foreground mt-2">Confira o status antes de usar automações. Se desconectar, escaneie um novo código. O chatbot responde apenas quando você o habilita.</p></div></CardContent></Card>}
            {!official && <div className="flex justify-end"><Button variant="ghost" className="text-destructive" disabled={!!busy} onClick={() => void run("delete")} data-tour="whatsapp-delete"><Trash2 size={16} className="mr-2" aria-hidden />Excluir conexão</Button></div>}
          </>
        )}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}><DialogContent><DialogHeader><DialogTitle>Configurar conexão do estabelecimento</DialogTitle><DialogDescription>O sistema cria uma conexão exclusiva. Depois você escaneia o código pelo celular. Nenhuma mensagem será enviada neste cadastro.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setShowCreateModal(false)}>Voltar</Button><Button variant="brand" disabled={!!busy} onClick={() => void run("create")} data-tour="whatsapp-create-save">{busy === "create" && <Loader2 className="animate-spin mr-2" size={16} />}Criar conexão</Button></DialogFooter></DialogContent></Dialog>
      </div>
    </AdminLayout>
  );
}
