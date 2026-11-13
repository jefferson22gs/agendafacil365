import { useCallback, useEffect, useState } from "react";
import { Smartphone, XCircle, Loader2, AlertCircle, BadgeCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell as AdminLayout } from "@/pages/admin/whatsapp/Shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AutomationSettings } from "@/features/whatsapp/AutomationSettings";
import { InsightsSettings } from "@/features/whatsapp/InsightsSettings";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { OfficialConnectCard } from "@/components/whatsapp/OfficialConnectCard";
import { BotProviderChoice, type BotProvider } from "@/components/whatsapp/BotProviderChoice";
import { QrConnectionCard, type QrInstance } from "@/components/whatsapp/QrConnectionCard";

interface WhatsAppInstance extends QrInstance { salon_id: string; instance_name: string; provider: BotProvider }
const columns = "id,salon_id,instance_name,status,phone_number,provider";

/**
 * Até três conexões por salão: API oficial (botões, sem Status), QR Code (Disparador e Status) e QR Code com botões
 * (experimental). O robô atende por UMA delas, escolhida pelo dono.
 */
export default function WhatsAppConnection() {
  const { user } = useAuth();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [rows, setRows] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [botProvider, setBotProvider] = useState<BotProvider | null>(null);
  // A conexão com botões só aparece quando o serviço está instalado no servidor (ou se já existir).
  const [buttonsService, setButtonsService] = useState(false);

  const loadInstances = useCallback(async (tenant: string) => {
    const { data, error: instanceError } = await supabase.from("whatsapp_instances").select(columns).eq("salon_id", tenant);
    if (instanceError) throw instanceError;
    setRows((data ?? []) as WhatsAppInstance[]);
    const { data: bot } = await supabase.rpc("whatsapp_bot_provider" as never, { p_salon_id: tenant } as never);
    setBotProvider(bot === "meta" || bot === "evolution" || bot === "whaileys" ? bot : null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSalonId(null); setRows([]); setError(null); setLoading(true);
    async function load() {
      try {
        if (!user) return;
        const { data: salon, error: salonError } = await supabase.from("salons").select("id").eq("owner_id", user.id).limit(1).maybeSingle();
        if (salonError) throw salonError;
        if (cancelled) return;
        if (!salon) { setError("Configure seu estabelecimento antes de conectar o WhatsApp."); return; }
        setSalonId(salon.id);
        await loadInstances(salon.id);
        const { data: caps } = await supabase.functions.invoke("whatsapp-instances", { body: { action: "capabilities", salonId: salon.id } });
        if (!cancelled) setButtonsService((caps as { whaileysConfigured?: boolean } | null)?.whaileysConfigured === true);
      } catch { if (!cancelled) setError("Não foi possível carregar o WhatsApp do estabelecimento."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [user, loadInstances]);

  if (loading) return <AdminLayout><div className="flex flex-col items-center justify-center h-96 gap-3" role="status"><Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden /><p className="text-sm text-muted-foreground">Carregando WhatsApp…</p></div></AdminLayout>;
  const official = rows.find(r => r.provider === "meta") ?? null;
  const qr = rows.find(r => r.provider === "evolution") ?? null;
  const buttons = rows.find(r => r.provider === "whaileys") ?? null;
  const hasAny = rows.length > 0;
  const reload = () => salonId ? loadInstances(salonId) : Promise.resolve();

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-4xl mx-auto min-w-0">
        <div data-tour="whatsapp-header">
          <PageHeader className="mb-0" title={<span className="flex items-center gap-2"><Smartphone className="w-6 h-6 text-primary" aria-hidden />Conexão WhatsApp</span>}
            description="Conecte uma ou mais: escolha qual atende os clientes no automático; o QR Code também faz Disparador e Status." />
        </div>
        {error && <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground" role="alert"><AlertCircle size={18} className="text-destructive shrink-0" aria-hidden />{error}</div>}

        {salonId && hasAny && <BotProviderChoice salonId={salonId} current={botProvider} available={rows.map(r => r.provider)} onChange={setBotProvider} />}

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
        ) : salonId && <OfficialConnectCard salonId={salonId} onConnected={() => void reload()} />}

        {/* 2. QR Code (Evolution): Disparador e Status; robô com opções numeradas. */}
        {salonId && <QrConnectionCard salonId={salonId} provider="evolution" instance={qr} botHere={botProvider === "evolution"} onChanged={reload} />}

        {/* 3. QR Code com botões (whaileys): só com o serviço instalado no servidor. */}
        {salonId && (buttonsService || buttons) && <QrConnectionCard salonId={salonId} provider="whaileys" instance={buttons} botHere={botProvider === "whaileys"} onChanged={reload} />}

        {hasAny && salonId && <AutomationSettings salonId={salonId} />}
        {hasAny && salonId && <InsightsSettings salonId={salonId} />}
      </div>
    </AdminLayout>
  );
}
