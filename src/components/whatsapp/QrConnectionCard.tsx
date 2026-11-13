import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, Loader2, Megaphone, MousePointerClick, QrCode, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type QrProvider = "evolution" | "whaileys";
export interface QrInstance { id: string; status: "disconnected" | "connecting" | "connected" | "qrcode"; phone_number: string | null }
interface Result { success: boolean; error?: string; status?: QrInstance["status"]; phoneNumber?: string | null; qrcode?: string | null }

const friendlyError = "Não foi possível concluir. Confira a conexão e tente novamente.";
const COPY: Record<QrProvider, { title: string; badge: string; uses: string; botOn: string; botOff: string; create: string; createHelp: string; tip: string; tour: string }> = {
  evolution: {
    title: "QR Code", badge: "QR Code", uses: "Disparador e Status",
    botOn: "Atende os clientes (opções numeradas, sem botões), envia o Disparador e publica Status.",
    botOff: "Envia o Disparador e publica Status. O atendimento automático está em outra conexão.",
    create: "Conectar por QR Code",
    createHelp: "O sistema cria uma conexão exclusiva para Disparador e Status. Depois você escaneia o código pelo celular. Nenhuma mensagem é enviada neste cadastro.",
    tip: "Dica: use um número diferente do oficial (por exemplo, um chip só para divulgação). Envios em massa por QR Code têm risco de bloqueio pelo WhatsApp; mande só para quem autorizou.",
    tour: "whatsapp-qr-card",
  },
  whaileys: {
    title: "QR Code com botões", badge: "Botões (experimental)", uses: "botões e listas",
    botOn: "Atende os clientes com botões e listas clicáveis; os números ficam no texto como reserva. Também faz Disparador e Status.",
    botOff: "Conectada, mas o robô está em outra conexão. Escolha esta em \"Quem atende os clientes no automático\" para usar os botões.",
    create: "Conectar QR Code com botões",
    createHelp: "Cria uma conexão por QR Code que mostra botões e listas no WhatsApp do cliente. Pode ser o mesmo número das outras conexões (o WhatsApp aceita até 4 aparelhos conectados). Nenhuma mensagem é enviada neste cadastro.",
    tip: "Botões pelo QR Code são um recurso não oficial: o WhatsApp pode deixar de exibi-los sem aviso. Por isso cada menu também leva os números no texto, e o cliente sempre consegue responder digitando.",
    tour: "whatsapp-buttons-card",
  },
};

/** Cartão de uma conexão por QR Code (Evolution ou a com botões): cadastrar, gerar QR, acompanhar, desconectar e excluir. */
export function QrConnectionCard({ salonId, provider, instance, botHere, onChanged }: {
  salonId: string; provider: QrProvider; instance: QrInstance | null; botHere: boolean; onChanged: () => Promise<unknown>;
}) {
  const { toast } = useToast();
  const copy = COPY[provider];
  const [state, setState] = useState(instance);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const polling = useRef(false);
  useEffect(() => setState(instance), [instance]);

  const call = useCallback(async (action: string): Promise<Result> => {
    const { data, error: requestError } = await supabase.functions.invoke("whatsapp-instances", { body: { action, salonId, provider } });
    if (requestError) throw new Error(friendlyError);
    const result = data as Result | null;
    if (!result?.success) throw new Error(friendlyError);
    return result;
  }, [salonId, provider]);

  const refresh = useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    try {
      const result = await call("status");
      setState((prev) => prev ? { ...prev, status: result.status ?? prev.status, phone_number: result.phoneNumber ?? prev.phone_number } : prev);
      if (result.status === "connected" || result.status === "disconnected") setQrCode(null);
      setError(null);
    } catch { setError(`Não foi possível consultar a conexão ${copy.title}.`); }
    finally { polling.current = false; }
  }, [call, copy.title]);

  useEffect(() => { if (instance) void refresh(); }, [instance?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!["qrcode", "connecting"].includes(state?.status ?? "")) return;
    const t = window.setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [state?.status, refresh]);

  async function run(action: "create" | "connect" | "disconnect" | "delete") {
    if (busy) return;
    if (action === "delete" && !window.confirm(`Excluir a conexão ${copy.title}? O que ela faz para até conectar de novo.`)) return;
    if (action === "disconnect" && !window.confirm(`Desconectar ${copy.title}? O que ela faz fica indisponível até reconectar.`)) return;
    setBusy(action); setError(null);
    try {
      const result = await call(action);
      if (action === "delete") { setState(null); setQrCode(null); await onChanged(); }
      else if (action === "create") { await onChanged(); setCreating(false); }
      else if (action === "connect") { setQrCode(result.qrcode ?? null); setState((prev) => prev ? { ...prev, status: result.status ?? "connecting" } : prev); }
      else { setState((prev) => prev ? { ...prev, status: "disconnected", phone_number: null } : prev); setQrCode(null); }
      toast({ title: action === "create" ? "Conexão cadastrada" : action === "connect" ? "Conectar pelo celular" : action === "delete" ? "Conexão excluída" : "Desconectado", description: action === "connect" ? "Escaneie o código no WhatsApp do estabelecimento. Aguarde o status conectado." : undefined });
    } catch {
      setError(friendlyError); toast({ title: "Não foi possível concluir", description: friendlyError, variant: "destructive" });
    } finally { setBusy(null); }
  }

  const connected = state?.status === "connected";
  const waiting = state?.status === "connecting" || state?.status === "qrcode";
  const Icon = provider === "whaileys" ? MousePointerClick : Megaphone;
  return (
    <Card data-tour={copy.tour}>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${connected ? "bg-success/10 text-success" : waiting ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`} aria-hidden>
              {connected ? <CheckCircle /> : waiting ? <Loader2 className="animate-spin" /> : <Icon />}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold" data-tour={provider === "evolution" ? "whatsapp-status" : undefined}>{copy.title}{botHere ? " · robô ligado" : ` · ${copy.uses}`}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {state ? <Badge variant={connected ? "success" : waiting ? "warning" : "danger"}>{connected ? "Conectado" : waiting ? "Aguardando leitura do QR Code" : "Desconectado"}</Badge>
                  : <Badge variant="secondary">Não conectado</Badge>}
                <Badge variant="secondary">{copy.badge}</Badge>
                {state?.phone_number && <span className="text-sm text-muted-foreground">+{state.phone_number}</span>}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{botHere ? copy.botOn : copy.botOff}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!state ? <Button variant="outline" disabled={!!busy} onClick={() => setCreating(true)} data-tour={provider === "evolution" ? "whatsapp-create-button" : undefined}><QrCode size={16} className="mr-2" aria-hidden />{copy.create}</Button> : <>
              <Button variant="outline" size="icon" disabled={!!busy} onClick={() => void refresh()} aria-label={`Atualizar conexão ${copy.title}`}><RefreshCw size={18} aria-hidden /></Button>
              {connected ? <Button variant="destructive" disabled={!!busy} onClick={() => void run("disconnect")} data-tour={provider === "evolution" ? "whatsapp-disconnect" : undefined}><WifiOff size={16} className="mr-2" aria-hidden />Desconectar</Button>
                : <Button variant="brand" disabled={!!busy} onClick={() => void run("connect")} data-tour={provider === "evolution" ? "whatsapp-connect-button" : undefined}>{busy === "connect" ? <Loader2 size={16} className="mr-2 animate-spin" aria-hidden /> : <Wifi size={16} className="mr-2" aria-hidden />}{waiting ? "Gerar QR Code" : "Conectar"}</Button>}
            </>}
          </div>
        </div>
        {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p>}
        <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">{copy.tip}</p>
        {qrCode && <div data-tour={provider === "evolution" ? "whatsapp-qrcode" : undefined} className="flex flex-col items-center gap-2 rounded-2xl border p-4 text-center">
          <p className="font-semibold">Escaneie o QR Code</p><p className="text-sm text-muted-foreground">No celular: WhatsApp, Aparelhos conectados, Conectar aparelho.</p>
          <div className="rounded-xl bg-white p-4"><img src={qrCode} alt="Código temporário para conectar o WhatsApp do estabelecimento" className="h-56 w-56 max-w-full sm:h-64 sm:w-64" /></div>
          <p className="text-xs text-muted-foreground">Não compartilhe este código.</p>
          <Button variant="outline" disabled={!!busy} onClick={() => void run("connect")} data-tour={provider === "evolution" ? "whatsapp-new-qrcode" : undefined}>Gerar novo QR Code</Button>
        </div>}
        {state && <div className="flex justify-end"><Button variant="ghost" className="text-destructive" disabled={!!busy} onClick={() => void run("delete")} data-tour={provider === "evolution" ? "whatsapp-delete" : undefined}><Trash2 size={16} className="mr-2" aria-hidden />Excluir conexão {copy.title}</Button></div>}
      </CardContent>
      <Dialog open={creating} onOpenChange={setCreating}><DialogContent><DialogHeader><DialogTitle>{copy.create}</DialogTitle><DialogDescription>{copy.createHelp}</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => setCreating(false)}>Voltar</Button><Button variant="brand" disabled={!!busy} onClick={() => void run("create")} data-tour={provider === "evolution" ? "whatsapp-create-save" : undefined}>{busy === "create" && <Loader2 className="mr-2 animate-spin" size={16} />}Criar conexão</Button></DialogFooter>
      </DialogContent></Dialog>
    </Card>
  );
}
