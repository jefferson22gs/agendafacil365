import { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, Copy, ExternalLink, Gift, Loader2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export interface CreditRow { credit_id: string; service_id: string; service: string; package: string | null; remaining: number; expires_at: string | null }
const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Créditos ativos do telefone neste salão (pacotes comprados). Só saldo/serviço/validade. */
export async function fetchCredits(salonId: string, phone: string): Promise<CreditRow[]> {
  const { data } = await supabase.rpc("public_client_credits" as never, { p_salon_id: salonId, p_phone: phone } as never);
  return Array.isArray(data) ? data as CreditRow[] : [];
}

type Stage = "ask" | "form" | "paying" | "paid";
interface Checkout { orderId: string; mode: "gateway" | "pix_manual"; provider?: string; pixCode: string | null; pixKey?: string; url: string | null; amountCents: number }

/**
 * Compra de pacote pelo link público. Pergunta se quer agendar hoje:
 *  - Sim: o pacote vai para o pedido e segue o agendamento normal (onBookToday).
 *  - Não: só assina — dados do cliente e pagamento (Pix do salão ou link do provedor configurado).
 */
export function PackagePurchase({ open, onOpenChange, pkg, color, onColor, onBookToday }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  pkg: { id: string; name: string; price: number } | null; color: string; onColor: string; onBookToday: () => void;
}) {
  const [stage, setStage] = useState<Stage>("ask");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<Checkout | null>(null);

  useEffect(() => { if (open) { setStage("ask"); setCheckout(null); } }, [open, pkg?.id]);

  // Aguardando pagamento: confere a cada 5 s (o servidor consulta o provedor; Pix manual depende do salão).
  useEffect(() => {
    if (stage !== "paying" || !checkout || checkout.mode !== "gateway") return;
    const t = setInterval(async () => {
      const { data } = await supabase.functions.invoke("package-checkout", { body: { action: "status", orderId: checkout.orderId } });
      if (data?.status === "paid") { setStage("paid"); clearInterval(t); }
    }, 5000);
    return () => clearInterval(t);
  }, [stage, checkout]);

  if (!pkg) return null;
  const buy = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("package-checkout", { body: { packageId: pkg.id, name, phone, method } });
    setBusy(false);
    let msg = data?.message as string | undefined;
    if (error && !msg) try { msg = (await (error as { context?: Response }).context?.json())?.message; } catch { /* sem corpo */ }
    if (!data?.success) { toast.error(msg ?? "Não foi possível gerar o pagamento."); return; }
    setCheckout(data as Checkout);
    setStage("paying");
    if (data.url && !data.pixCode) window.open(data.url, "_blank", "noopener");
  };
  const copy = async (v: string) => { try { await navigator.clipboard.writeText(v); toast.success("Copiado!"); } catch { toast.error("Não foi possível copiar."); } };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2"><Gift size={20} aria-hidden />{pkg.name}</DialogTitle>
          <DialogDescription>{brl(Math.round(pkg.price * 100))}</DialogDescription>
        </DialogHeader>

        {stage === "ask" && (
          <div className="space-y-3">
            <p className="font-medium">Quer agendar um horário hoje?</p>
            <Button className="h-auto min-h-12 w-full justify-start gap-3 whitespace-normal rounded-2xl py-3 text-left" style={{ backgroundColor: color, color: onColor }} onClick={() => { onOpenChange(false); onBookToday(); }}>
              <CalendarCheck size={20} className="shrink-0" aria-hidden /><span className="min-w-0"><span className="block font-semibold">Sim, agendar agora</span><span className="block text-xs font-normal opacity-90">O pacote entra no pedido e você escolhe o horário</span></span>
            </Button>
            <Button variant="outline" className="h-auto min-h-12 w-full justify-start gap-3 whitespace-normal rounded-2xl py-3 text-left" onClick={() => setStage("form")}>
              <Wallet size={20} className="shrink-0" aria-hidden /><span className="min-w-0"><span className="block font-semibold">Não, só assinar o pacote</span><span className="block text-xs font-normal text-muted-foreground">Pague agora e use os créditos quando quiser</span></span>
            </Button>
          </div>
        )}

        {stage === "form" && (
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); void buy(); }}>
            <div className="space-y-1.5"><Label htmlFor="pkg-name">Seu nome completo</Label><Input id="pkg-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label htmlFor="pkg-phone">WhatsApp</Label><Input id="pkg-phone" type="tel" autoComplete="tel" placeholder="(00) 00000-0000" value={phone} onChange={e => setPhone(e.target.value)} required />
              <p className="text-xs text-muted-foreground">Os créditos ficam neste número. Use o mesmo ao agendar.</p></div>
            <fieldset className="space-y-2"><legend className="text-sm font-medium">Forma de pagamento</legend>
              <div className="grid grid-cols-2 gap-2">
                {([["pix", "Pix"], ["card", "Cartão"]] as const).map(([v, l]) => (
                  <label key={v} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${method === v ? "border-current" : "border-border"}`} style={method === v ? { color } : undefined}>
                    <input type="radio" name="pkg-method" value={v} checked={method === v} onChange={() => setMethod(v)} className="sr-only" />{l}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Cartão depende do salão ter um provedor conectado; senão o pagamento é por Pix.</p>
            </fieldset>
            <Button type="submit" disabled={busy || !name.trim() || !phone.trim()} className="min-h-12 w-full rounded-2xl text-base font-semibold" style={{ backgroundColor: color, color: onColor }}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Ir para o pagamento
            </Button>
            <Button type="button" variant="ghost" className="min-h-11 w-full" onClick={() => setStage("ask")}>Voltar</Button>
          </form>
        )}

        {stage === "paying" && checkout && (
          <div className="space-y-4" role="status">
            <p className="text-sm">Valor: <strong>{brl(checkout.amountCents)}</strong></p>
            {checkout.pixCode && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Pix copia e cola</p>
                <div className="break-all rounded-xl bg-muted p-3 font-mono text-xs">{checkout.pixCode}</div>
                <Button variant="outline" className="min-h-11 w-full" onClick={() => void copy(checkout.pixCode!)}><Copy size={16} className="mr-2" aria-hidden />Copiar código Pix</Button>
              </div>
            )}
            {checkout.mode === "pix_manual" && checkout.pixKey && <p className="text-xs text-muted-foreground">Chave Pix do salão: <span className="font-mono">{checkout.pixKey}</span></p>}
            {checkout.url && !checkout.pixCode && (
              <Button asChild className="min-h-12 w-full rounded-2xl" style={{ backgroundColor: color, color: onColor }}>
                <a href={checkout.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} className="mr-2" aria-hidden />Abrir página de pagamento{checkout.provider ? ` (${checkout.provider})` : ""}</a>
              </Button>
            )}
            <p className="rounded-xl bg-muted p-3 text-sm">
              {checkout.mode === "gateway"
                ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />Aguardando a confirmação do pagamento. Pode deixar esta janela aberta; você também recebe a confirmação no WhatsApp.</>
                : "Depois de pagar, o salão confere e libera seus créditos. Você recebe a confirmação no WhatsApp."}
            </p>
          </div>
        )}

        {stage === "paid" && (
          <div className="space-y-3 py-4 text-center" role="status">
            <CheckCircle2 size={48} className="mx-auto text-success" aria-hidden />
            <p className="text-lg font-semibold">Pacote liberado! 🎉</p>
            <p className="text-sm text-muted-foreground">Ao agendar, responda que é assinante e use o mesmo WhatsApp para usar seus créditos.</p>
            <Button className="min-h-11 w-full rounded-2xl" style={{ backgroundColor: color, color: onColor }} onClick={() => { onOpenChange(false); onBookToday(); }}>Agendar agora</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
