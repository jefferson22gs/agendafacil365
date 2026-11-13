import { useState } from "react";
import { Bot, Check, Loader2, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type BotProvider = "meta" | "evolution" | "whaileys";
/** O que cada conexão faz no atendimento automático (limitações reais das ferramentas). */
const OPTIONS: { id: BotProvider; title: string; subtitle: string; yes: string[]; no: string[] }[] = [
  {
    id: "meta", title: "API oficial (Meta)", subtitle: "Botões e listas clicáveis",
    yes: ["Botões e menus clicáveis", "Número verificado, sem risco de bloqueio", "Confirmações, lembretes, avaliações e cobranças"],
    no: ["Não publica Status", "Disparador só para quem falou com o salão nas últimas 24 h"],
  },
  {
    id: "evolution", title: "QR Code", subtitle: "Atende 100%, opções numeradas",
    yes: ["Atende o fluxo completo (opções numeradas ou enquete)", "Disparador para toda a lista", "Agendador de Status"],
    no: ["Sem botões clicáveis", "Risco de bloqueio do número em envios em massa"],
  },
  {
    id: "whaileys", title: "QR Code com botões", subtitle: "Botões e listas pelo QR Code (experimental)",
    yes: ["Botões e listas clicáveis, com os números no texto como reserva", "Mesmo fluxo, regras, pacotes e cobranças do robô"],
    no: ["Não publica Status nem faz Disparador (use o QR Code para isso)", "Recurso não oficial: o WhatsApp pode deixar de mostrar os botões a qualquer momento"],
  },
];

/**
 * Qual conexão atende o robô. Só uma por vez: escolher uma desliga o robô nas outras automaticamente
 * (as mensagens das outras continuam chegando na Caixa de entrada, sem resposta automática).
 */
export function BotProviderChoice({ salonId, current, available, onChange }: { salonId: string; current: BotProvider | null; available: BotProvider[]; onChange: (p: BotProvider) => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<BotProvider | null>(null);
  // Só aparecem as opções conectadas e a escolhida (a com botões fica fora enquanto o serviço não existir).
  const shown = OPTIONS.filter(o => o.id !== "whaileys" || available.includes("whaileys") || current === "whaileys");
  const titleOf = (p: BotProvider) => OPTIONS.find(o => o.id === p)!.title;
  const choose = async (p: BotProvider) => {
    if (p === current) return;
    const others = shown.filter(o => o.id !== p).map(o => o.title).join(" e ");
    if (!window.confirm(`Ligar o atendimento automático na ${titleOf(p)}?\n\nO robô na ${others} será desligado automaticamente. Conversas em andamento recomeçam no menu.`)) return;
    setBusy(p);
    const { error } = await supabase.rpc("whatsapp_set_bot_provider" as never, { p_salon_id: salonId, p_provider: p } as never);
    setBusy(null);
    if (error) { toast({ title: "Não foi possível trocar", description: "Conecte essa opção primeiro.", variant: "destructive" }); return; }
    onChange(p);
    toast({ title: "Atendimento automático trocado", description: `O robô agora responde pela ${titleOf(p)}.` });
  };
  return (
    <Card data-tour="whatsapp-bot-provider">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot size={20} aria-hidden />Quem atende os clientes no automático</CardTitle>
        <CardDescription>Escolha uma conexão para o robô. Nunca duas ao mesmo tempo: ao ligar uma, as outras são desligadas sozinhas.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`grid gap-3 ${shown.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"}`} role="radiogroup" aria-label="Conexão do atendimento automático">
          {shown.map(o => {
            const on = current === o.id, can = available.includes(o.id);
            return (
              <div key={o.id} className={`flex flex-col gap-3 rounded-2xl border-2 p-4 ${on ? "border-primary bg-primary/5" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div><p className="font-semibold">{o.title}</p><p className="text-xs text-muted-foreground">{o.subtitle}</p></div>
                  {on && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Robô ligado</span>}
                </div>
                <ul className="space-y-1 text-sm">
                  {o.yes.map(t => <li key={t} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden /><span>{t}</span></li>)}
                  {o.no.map(t => <li key={t} className="flex gap-2 text-muted-foreground"><X size={16} className="mt-0.5 shrink-0 text-destructive" aria-hidden /><span>{t}</span></li>)}
                </ul>
                <Button role="radio" aria-checked={on} variant={on ? "secondary" : "outline"} className="mt-auto min-h-11" disabled={on || !can || !!busy} onClick={() => void choose(o.id)}>
                  {busy === o.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                  {on ? "Em uso pelo robô" : can ? "Usar no atendimento" : "Conecte esta opção abaixo"}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Disparador e Status sempre usam a conexão QR Code (sem botões) quando ela existe, independentemente desta escolha.</p>
      </CardContent>
    </Card>
  );
}
