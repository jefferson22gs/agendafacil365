import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, ShoppingBag, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Order { id: string; client_name: string; client_phone: string; amount_cents: number; method: string; status: string; created_at: string; paid_at: string | null; service_packages: { name: string } | null }
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const METHOD: Record<string, string> = { pix_manual: "Pix (chave do salão)", pix: "Pix", card: "Cartão", link: "Link de pagamento" };
const db = supabase as unknown as import("@supabase/supabase-js").SupabaseClient;

/**
 * Pedidos de pacote feitos pelo link público. Provedor conectado libera os créditos sozinho ao pagar;
 * Pix pela chave do salão precisa de "Confirmar pagamento" depois de conferir o extrato.
 */
export function PackageOrdersCard({ salonId }: { salonId: string }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const { data } = await db.from("package_orders").select("id,client_name,client_phone,amount_cents,method,status,created_at,paid_at,service_packages(name)").eq("salon_id", salonId).order("created_at", { ascending: false }).limit(30);
    setOrders((data ?? []) as unknown as Order[]);
  }, [salonId]);
  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, action: "paid" | "cancel") => {
    if (action === "paid" && !window.confirm("Confirma que o pagamento caiu na conta do salão? Os créditos serão liberados para o cliente.")) return;
    setBusy(id);
    const { error } = await db.rpc("package_order_owner_action", { p_order_id: id, p_action: action });
    setBusy(null);
    if (error) { toast.error("Não foi possível concluir."); return; }
    toast.success(action === "paid" ? "Pagamento confirmado. Créditos liberados e cliente avisado." : "Pedido cancelado.");
    await load();
  };

  return (
    <Card data-tour="packages-orders">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ShoppingBag size={20} aria-hidden />Pedidos de pacotes</CardTitle>
        <CardDescription>Compras feitas pelo link do salão. Com provedor conectado (Configurações &gt; Cobrança), os créditos são liberados sozinhos ao pagar. Pix pela chave do salão: confira o extrato e clique em Confirmar pagamento.</CardDescription>
      </CardHeader>
      <CardContent>
        {orders === null ? <p role="status" className="text-sm text-muted-foreground">Carregando…</p>
          : !orders.length ? <p className="py-4 text-center text-sm text-muted-foreground">Nenhum pedido ainda. Quando um cliente assinar um pacote pelo link, ele aparece aqui.</p>
          : (
            <ul className="divide-y">
              {orders.map(o => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{o.client_name} · {o.service_packages?.name ?? "Pacote"}</p>
                    <p className="text-xs text-muted-foreground">{o.client_phone} · {brl(o.amount_cents)} · {METHOD[o.method] ?? o.method} · {new Date(o.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  {o.status === "paid" ? <span className="inline-flex items-center gap-1 text-sm font-medium text-success"><CheckCircle2 size={16} aria-hidden />Pago, créditos liberados</span>
                    : o.status === "pending" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><Clock size={16} aria-hidden />Aguardando pagamento</span>
                        {o.method === "pix_manual" && <Button size="sm" className="min-h-11" disabled={busy === o.id} onClick={() => void act(o.id, "paid")}>{busy === o.id && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Confirmar pagamento</Button>}
                        <Button size="sm" variant="ghost" className="min-h-11" disabled={busy === o.id} onClick={() => void act(o.id, "cancel")}>Cancelar</Button>
                      </div>
                    ) : <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><XCircle size={16} aria-hidden />{o.status === "cancelled" ? "Cancelado" : "Expirado"}</span>}
                </li>
              ))}
            </ul>
          )}
      </CardContent>
    </Card>
  );
}
