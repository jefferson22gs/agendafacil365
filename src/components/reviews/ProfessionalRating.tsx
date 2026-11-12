import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface RatingSummary { average: number; total: number }
interface Review { id: string; rating: number; comment: string | null; created_at: string; author: string; service: string | null; response: string | null }

/** Nota média e total por profissional (avaliações públicas). Uma chamada por salão. */
export function useProfessionalRatings(salonId: string | null | undefined): Record<string, RatingSummary> {
  const [map, setMap] = useState<Record<string, RatingSummary>>({});
  useEffect(() => {
    if (!salonId) return;
    let off = false;
    void supabase.rpc("public_professional_ratings" as never, { p_salon_id: salonId } as never).then(({ data }) => {
      if (off || !Array.isArray(data)) return;
      setMap(Object.fromEntries((data as { professional_id: string; average: number; total: number }[]).map(r => [r.professional_id, { average: Number(r.average), total: r.total }])));
    });
    return () => { off = true; };
  }, [salonId]);
  return map;
}

/** Estrelas só de leitura (meia estrela por recorte). `label` acessível com a nota. */
export function Stars({ value, size = 14, className = "" }: { value: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`Nota ${value.toFixed(1).replace(".", ",")} de 5`}>
      {[1, 2, 3, 4, 5].map(i => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }} aria-hidden>
            <Star size={size} className="absolute inset-0 text-muted-foreground/30" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}><Star size={size} className="fill-amber-400 text-amber-400" /></span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * Selo de avaliação no card do profissional: botão próprio que abre as avaliações (não seleciona o profissional).
 * O card deve ser um contêiner com o botão de seleção esticado por baixo (sem botão dentro de botão).
 * Sem avaliações: "Novo por aqui" discreto, sem botão.
 */
export function RatingBadge({ professionalId, name, summary }: { professionalId: string; name: string; summary?: RatingSummary }) {
  const [open, setOpen] = useState(false);
  if (!summary?.total) return <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Novo por aqui</span>;
  return (
    <>
      <button type="button" aria-label={`Ver ${summary.total} ${summary.total === 1 ? "avaliação" : "avaliações"} de ${name}, nota ${summary.average.toFixed(1).replace(".", ",")}`} onClick={() => setOpen(true)}
        className="relative z-10 -ml-1 mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-full px-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Stars value={summary.average} />
        <span className="font-semibold text-foreground">{summary.average.toFixed(1).replace(".", ",")}</span>
        <span className="text-muted-foreground underline underline-offset-2">({summary.total})</span>
      </button>
      {open && <ReviewsDialog professionalId={professionalId} name={name} summary={summary} onClose={() => setOpen(false)} />}
    </>
  );
}

const PAGE = 20;
function ReviewsDialog({ professionalId, name, summary, onClose }: { professionalId: string; name: string; summary: RatingSummary; onClose: () => void }) {
  const [items, setItems] = useState<Review[] | null>(null);
  const [more, setMore] = useState(false);
  const load = async (offset: number) => {
    const { data } = await supabase.rpc("public_professional_reviews" as never, { p_professional_id: professionalId, p_limit: PAGE, p_offset: offset } as never);
    const rows = (Array.isArray(data) ? data : []) as Review[];
    setItems(prev => [...(offset ? prev ?? [] : []), ...rows]);
    setMore(rows.length === PAGE);
  };
  useEffect(() => { void load(0); }, [professionalId]); // eslint-disable-line react-hooks/exhaustive-deps
  const dist = [5, 4, 3, 2, 1].map(n => ({ n, count: (items ?? []).filter(r => r.rating === n).length }));
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-3xl p-0">
        <DialogHeader className="space-y-2 border-b p-5 text-left">
          <DialogTitle className="pr-6">{name}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-foreground">{summary.average.toFixed(1).replace(".", ",")}</span>
              <div><Stars value={summary.average} size={16} /><p className="text-xs text-muted-foreground">{summary.total} {summary.total === 1 ? "avaliação" : "avaliações"} de clientes</p></div>
            </div>
          </DialogDescription>
          {items && items.length > 0 && !more && (
            <div className="space-y-1 pt-1" aria-hidden>
              {dist.map(d => (
                <div key={d.n} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-3">{d.n}</span><Star size={10} className="fill-amber-400 text-amber-400" />
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${(d.count / items.length) * 100}%` }} /></span>
                </div>
              ))}
            </div>
          )}
        </DialogHeader>
        {/* Lista rolável: a rolagem fica presa aqui dentro (não arrasta a página por trás). */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5" tabIndex={0} aria-label="Avaliações">
          {items === null ? <p role="status" className="py-6 text-center text-sm text-muted-foreground">Carregando…</p> : (
            <ul className="space-y-4">
              {items.map(r => (
                <li key={r.id} className="space-y-1.5 border-b pb-4 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{r.author}</span>
                    <time className="text-xs text-muted-foreground" dateTime={r.created_at}>{new Date(r.created_at).toLocaleDateString("pt-BR")}</time>
                  </div>
                  <div className="flex items-center gap-2"><Stars value={r.rating} size={12} />{r.service && <span className="truncate text-xs text-muted-foreground">{r.service}</span>}</div>
                  {r.comment && <p className="text-sm leading-relaxed">{r.comment}</p>}
                  {r.response && <p className="rounded-xl bg-muted p-2.5 text-xs"><span className="font-semibold">Resposta do salão: </span>{r.response}</p>}
                </li>
              ))}
            </ul>
          )}
          {more && <button type="button" onClick={() => void load(items?.length ?? 0)} className="mt-2 min-h-11 w-full rounded-xl text-sm font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Ver mais avaliações</button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
