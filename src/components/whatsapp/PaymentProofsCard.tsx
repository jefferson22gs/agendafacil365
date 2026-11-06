import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Clock, Eye, FileText, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppSalon, whatsappDb } from "@/pages/admin/whatsapp/api";

type ProofStatus = "enviado" | "conferido" | "recusado";
interface PaymentProof {
  id: string; appointment_id: string; phone: string; media_path: string; media_mime: string;
  media_name: string; status: ProofStatus; notes: string | null; created_at: string;
}

// Classes estáticas (Tailwind não gera classes montadas em tempo de execução).
const STATUS: Record<ProofStatus, { label: string; icon: typeof Clock; className: string }> = {
  enviado: { label: "Aguardando conferência", icon: Clock, className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  conferido: { label: "Conferido", icon: CheckCircle, className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" },
  recusado: { label: "Recusado", icon: XCircle, className: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200" },
};

/** Comprovantes PIX enviados pelo WhatsApp. Conferir aqui não marca o agendamento como pago. */
export function PaymentProofsCard() {
  const { data: salon } = useWhatsAppSalon();
  const salonId = salon?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [review, setReview] = useState<{ proof: PaymentProof; status: "conferido" | "recusado" } | null>(null);
  const [notes, setNotes] = useState("");

  const proofs = useQuery({
    queryKey: ["payment-proofs", salonId],
    enabled: !!salonId,
    queryFn: async () => {
      const { data, error } = await whatsappDb.from("appointment_payment_proofs")
        .select("id,appointment_id,phone,media_path,media_mime,media_name,status,notes,created_at")
        .eq("salon_id", salonId!).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return (data ?? []) as PaymentProof[];
    },
  });

  const mark = useMutation({
    mutationFn: async (v: { id: string; status: ProofStatus; notes: string }) => {
      const { error } = await whatsappDb.rpc("mark_payment_proof_status", { p_proof_id: v.id, p_status: v.status, p_notes: v.notes.trim() || null });
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast({ title: "Comprovante atualizado", description: `Marcado como ${STATUS[v.status].label.toLowerCase()}.` });
      setReview(null); setNotes("");
      queryClient.invalidateQueries({ queryKey: ["payment-proofs", salonId] });
    },
    onError: () => toast({ title: "Não foi possível salvar", description: "Confira sua conexão e tente novamente.", variant: "destructive" }),
  });

  const open = async (proof: PaymentProof) => {
    // Janela aberta no clique evita bloqueio de pop-up; URL assinada curta (5 min) do bucket privado.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    const { data, error } = await whatsappDb.storage.from("payment-proofs").createSignedUrl(proof.media_path, 300);
    if (error || !data?.signedUrl) {
      tab?.close();
      toast({ title: "Arquivo indisponível", description: "Não foi possível abrir o comprovante agora.", variant: "destructive" });
      return;
    }
    if (tab) tab.location.href = data.signedUrl; else window.location.assign(data.signedUrl);
  };

  const list = proofs.data ?? [];
  const firstPending = list.find((p) => p.status === "enviado")?.id;

  return (
    <Card data-tour="payment-proofs-card">
      <CardHeader>
        <CardTitle>Comprovantes de pagamento</CardTitle>
        <CardDescription>Comprovantes PIX enviados pelos clientes no WhatsApp. Conferir não marca o agendamento como pago.</CardDescription>
      </CardHeader>
      <CardContent>
        {proofs.isLoading && salonId ? (
          <p className="py-6 text-sm text-muted-foreground" role="status">Carregando comprovantes...</p>
        ) : proofs.isError ? (
          <p className="py-6 text-sm text-destructive" role="alert">Não foi possível carregar os comprovantes.</p>
        ) : list.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground" data-tour="payment-proofs-list">
            <FileText className="mx-auto mb-2 h-10 w-10 opacity-50" aria-hidden="true" />
            <p className="text-sm">Nenhum comprovante recebido ainda.</p>
          </div>
        ) : (
          <ul className="space-y-3" data-tour="payment-proofs-list" aria-label="Comprovantes recebidos">
            {list.map((proof) => {
              const s = STATUS[proof.status] ?? STATUS.enviado;
              const Icon = s.icon;
              return (
                <li key={proof.id} className="rounded-lg border p-3 sm:p-4">
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 basis-48">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />{s.label}
                      </span>
                      <p className="mt-1 break-all text-sm font-medium">{proof.media_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {proof.phone} · <time dateTime={proof.created_at}>{new Date(proof.created_at).toLocaleString("pt-BR")}</time>
                      </p>
                      {proof.notes && <p className="mt-1 break-words text-xs italic text-muted-foreground">Observação: {proof.notes}</p>}
                    </div>
                    <div className="flex w-full flex-wrap gap-2 sm:w-auto" data-tour={proof.id === firstPending ? "payment-proofs-actions" : undefined}>
                      <Button variant="ghost" className="min-h-11 flex-1 sm:flex-none" onClick={() => open(proof)} aria-label={`Abrir comprovante ${proof.media_name}`}>
                        <Eye className="mr-1 h-4 w-4" aria-hidden="true" />Ver
                      </Button>
                      {proof.status === "enviado" && (
                        <>
                          <Button variant="outline" className="min-h-11 flex-1 sm:flex-none" onClick={() => setReview({ proof, status: "conferido" })}>
                            <CheckCircle className="mr-1 h-4 w-4" aria-hidden="true" />Conferido
                          </Button>
                          <Button variant="outline" className="min-h-11 flex-1 sm:flex-none" onClick={() => setReview({ proof, status: "recusado" })}>
                            <XCircle className="mr-1 h-4 w-4" aria-hidden="true" />Recusado
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <Dialog open={!!review} onOpenChange={(o) => { if (!o && !mark.isPending) { setReview(null); setNotes(""); } }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{review?.status === "conferido" ? "Marcar como conferido" : "Recusar comprovante"}</DialogTitle>
            <DialogDescription>
              {review?.status === "conferido"
                ? "Confirme que o valor caiu na conta do salão. O pagamento do agendamento continua sendo marcado à parte."
                : "Informe o motivo para o histórico (opcional)."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="payment-proof-notes">Observação (opcional)</Label>
            <Textarea id="payment-proof-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={3} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => { setReview(null); setNotes(""); }} disabled={mark.isPending}>Cancelar</Button>
            <Button className="min-h-11" disabled={mark.isPending || !review}
              onClick={() => review && mark.mutate({ id: review.proof.id, status: review.status, notes })}>
              {mark.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default PaymentProofsCard;
