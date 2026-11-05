import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { DEMO_STORAGE_KEY, DEMO_UNAVAILABLE, PRODUCTION_PRICING_URL, PRODUCTION_URL } from "@/config/demo";

/*
 * A faixa fica no fluxo (empurra o layout) e é sticky. Cabeçalhos sticky/fixed "top-0" do app descem a altura da faixa
 * para não ficarem por baixo dela. ponytail: ajuste por classe utilitária; se surgir outro padrão de topo, incluir aqui.
 */
const OFFSET_CSS = `
.sticky.top-0,.fixed.top-0,.sticky-header,.fixed.inset-y-0{top:var(--demo-bar-h,0px)!important}
@media (min-width:1024px){.lg\\:sticky.lg\\:top-0{top:var(--demo-bar-h,0px)!important}.lg\\:sticky.lg\\:h-screen{height:calc(100vh - var(--demo-bar-h,0px))!important}}
html{scroll-padding-top:var(--demo-bar-h,0px)}`;

/** Faixa do ambiente de demonstração (só renderizada quando IS_DEMO). Também traduz bloqueios de integração em aviso. */
export function DemoBanner() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const sync = () => root.style.setProperty("--demo-bar-h", `${el.offsetHeight}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);

    let last = 0;
    const notify = () => {
      if (Date.now() - last < 1500) return; // uma ação pode disparar fetch + invoke: um aviso só
      last = Date.now();
      toast.info(DEMO_UNAVAILABLE, { description: "Integrações reais (pagamentos, WhatsApp, push, IA, upload) ficam desligadas aqui." });
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.origin === location.origin || a.protocol === 'blob:' || a.protocol === 'data:') return;
      if (a.origin === PRODUCTION_URL) return;
      e.preventDefault();
      notify();
    };
    window.addEventListener("demo:blocked", notify);
    document.addEventListener("click", onClick, true);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--demo-bar-h");
      window.removeEventListener("demo:blocked", notify);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  const reset = () => {
    try { sessionStorage.removeItem(DEMO_STORAGE_KEY); } catch { /* storage bloqueado: o estado já é só da memória */ }
    location.reload();
  };

  return (
    <>
      <style>{OFFSET_CSS}</style>
      <div
        ref={ref}
        role="region"
        aria-label="Aviso de ambiente de demonstração"
        className="sticky z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-primary/20 bg-brand-navy px-4 py-1.5 text-center text-xs text-white sm:text-sm"
        style={{ top: 0 }}
      >
        <p className="min-w-0">
          <strong className="font-semibold">Ambiente de demonstração</strong> — dados fictícios. Nada é salvo.
        </p>
        <div className="flex items-center gap-2">
          <a
            href={PRODUCTION_PRICING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-8 items-center rounded-md bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Contratar
          </a>
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-white/30 px-3 font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <RotateCcw size={14} aria-hidden />
            Reiniciar demonstração
          </button>
        </div>
      </div>
    </>
  );
}
