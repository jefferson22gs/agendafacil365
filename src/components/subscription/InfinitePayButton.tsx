import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { createInfinitePayCheckout, type PlanKey } from "@/services/infinitePay";

/** Botão "Pagar com Pix ou cartão (InfinitePay)". Sem login, leva ao cadastro e volta ao checkout. */
export function InfinitePayButton({ plan, className }: { plan: PlanKey; className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    if (!user) {
      toast.info("Crie sua conta (ou entre) para concluir a assinatura.");
      navigate(`/register?next=${encodeURIComponent(`/admin/subscription?plano=${plan === "annual" ? "anual" : "mensal"}`)}`);
      return;
    }
    setBusy(true);
    try {
      const url = await createInfinitePayCheckout(plan);
      window.location.assign(url); // checkout.infinitepay.io (validado no servidor)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível iniciar o pagamento.");
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant="brand" size="lg" onClick={pay} disabled={busy}
      className={className ?? "w-full h-auto min-h-14 whitespace-normal text-base sm:text-lg py-4"}>
      {busy ? <Loader2 size={20} className="mr-2 animate-spin" aria-hidden /> : <QrCode size={20} className="mr-2" aria-hidden />}
      {busy ? "Abrindo pagamento…" : `Pagar ${plan === "annual" ? "Anual" : "Mensal"} com Pix ou cartão`}
      <span className="ml-2 text-xs font-normal opacity-90">(InfinitePay)</span>
    </Button>
  );
}
