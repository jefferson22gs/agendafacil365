import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { X, ArrowLeft, ArrowRight, MousePointerClick, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTraining } from "./TrainingProvider";
import { prefersReducedMotion, waitForTarget, findTarget } from "./dom";
import { isAtRoute } from "./registry/routeContext";
import type { TourStep } from "./types";

const WAIT_MS = 4000;
// Mesmo ponto de quebra do AdminLayout (lg): abaixo dele há barra inferior e menu em gaveta.
const COMPACT_QUERY = "(max-width: 1023px)";

function useCompactLayout() {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(COMPACT_QUERY);
    const sync = () => setCompact(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return compact;
}
const PAD = 8;

type Phase = "locating" | "ready";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const toRect = (el: HTMLElement): Rect => {
  const r = el.getBoundingClientRect();
  return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
};

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

function stepApplies(step: TourStep, isMobile: boolean) {
  if (step.mobileOnly && !isMobile) return false;
  if (step.desktopOnly && isMobile) return false;
  return true;
}

export default function TourOverlay() {
  const { active, next, back, pause, skip, goTo } = useTraining();
  const isMobile = useCompactLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const titleId = useId();
  const bodyId = useId();

  const [phase, setPhase] = useState<Phase>("locating");
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);
  const [dialogHost, setDialogHost] = useState<HTMLElement | null>(null);
  const direction = useRef<1 | -1>(1);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState({ w: 340, h: 200 });

  const tour = active?.tour;
  const stepIndex = active?.step ?? 0;
  const step = tour?.steps[stepIndex];
  const total = tour?.steps.length ?? 0;
  const isLast = stepIndex >= total - 1;

  const move = useCallback(
    (dir: 1 | -1) => {
      direction.current = dir;
      if (dir === 1) next();
      else back();
    },
    [next, back],
  );

  // Passos exclusivos de mobile/desktop são pulados no sentido em que o usuário estava indo.
  useEffect(() => {
    if (!step || stepApplies(step, isMobile)) return;
    if (direction.current === -1 && stepIndex === 0) {
      direction.current = 1;
      goTo(1);
      return;
    }
    if (direction.current === 1 && isLast) skip();
    else move(direction.current);
  }, [step, stepIndex, isMobile, isLast, move, skip, goTo]);

  // Navega até a rota do passo e espera o alvo aparecer.
  useEffect(() => {
    if (!step || !stepApplies(step, isMobile)) return;
    const controller = new AbortController();
    setPhase("locating");
    setTarget(null);
    setRect(null);
    setMissing(false);

    const route = step.route ?? tour?.route;
    const onRoute = !!route && isAtRoute(route, location.pathname, location.search) || (!step.route && !!tour?.matchSubroutes && location.pathname.startsWith(`${route}/`));
    if (route && !onRoute) {
      navigate(route);
      return () => controller.abort();
    }

    if (!step.target) {
      setPhase("ready");
      return () => controller.abort();
    }

    void waitForTarget(step.target, WAIT_MS, controller.signal).then((el) => {
      if (controller.signal.aborted) return;
      if (el) {
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
        setTarget(el);
        setRect(toRect(el));
        setPhase("ready");
        return;
      }
      if (import.meta.env.DEV) {
        console.warn(`[training] alvo "${step.target}" não encontrado no tour "${tour?.id}" passo ${stepIndex + 1}`);
      }
      if (step.fallbackBody) {
        setMissing(true);
        setPhase("ready");
      } else if (direction.current === 1 && isLast) {
        skip();
      } else if (direction.current === -1 && stepIndex === 0) {
        setMissing(true);
        setPhase("ready");
      } else {
        move(direction.current);
      }
    });
    return () => controller.abort();
  }, [step, stepIndex, location.pathname, location.search, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Acompanha scroll, resize e animações do alvo.
  useEffect(() => {
    if (!target) return;
    let raf = 0;
    const loop = () => {
      if (!target.isConnected) {
        const again = step?.target ? findTarget(step.target) : null;
        if (again) setTarget(again);
        else setRect(null);
      } else {
        const r = toRect(target);
        setRect((prev) => (sameRect(prev, r) ? prev : r));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target, step?.target]);

  // Passo "clique aqui": avança quando o usuário clica no próprio elemento. O tour nunca clica sozinho.
  useEffect(() => {
    if (!target || step?.mode !== "waitForClick") return;
    const onClick = () => {
      direction.current = 1;
      // Deixa o clique abrir o dialog/aba antes de procurar o próximo alvo.
      requestAnimationFrame(() => next());
    };
    target.addEventListener("click", onClick, { once: true });
    return () => target.removeEventListener("click", onClick);
  }, [target, step?.mode, next]);

  // Teclado: Esc fecha, setas navegam (exceto quando o passo pede um clique).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); pause(); return; }
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (typing || step?.mode === "waitForClick") return;
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft" && stepIndex > 0) move(-1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pause, move, step?.mode, stepIndex]);

  // Renderiza dentro do dialog real para respeitar o focus trap e o bloqueio de cliques do Radix.
  useEffect(() => {
    const sync = () => {
      const host = target?.closest<HTMLElement>('[role="dialog"]') ?? null;
      setDialogHost(host?.isConnected ? host : null);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [target]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setCardSize((prev) => Math.abs(r.width - prev.w) > 1 || Math.abs(r.height - prev.h) > 1 ? { w: r.width, h: r.height } : prev);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [stepIndex, isMobile]);

  // Foco no card a cada passo (se não houver dialog do sistema prendendo o foco).
  useEffect(() => {
    if (phase !== "ready") return;
    if (document.querySelector('[role="dialog"][data-state="open"]:not([data-tour-card])')) return;
    cardRef.current?.querySelector<HTMLElement>("[data-tour-focus]")?.focus({ preventScroll: true });
  }, [phase, stepIndex]);

  if (!tour || !step) return null;

  const reduced = prefersReducedMotion();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 12;

  let cardStyle: React.CSSProperties;
  if (isMobile || !rect) {
    // Mobile ou passo sem alvo: card ancorado embaixo, ou em cima se o alvo estiver na metade de baixo.
    const targetLow = rect ? rect.top + rect.height / 2 > vh / 2 : false;
    cardStyle = isMobile
      ? { left: margin, right: margin, maxHeight: Math.max(160, vh - margin * 2 - 72), ...(targetLow ? { top: margin } : { bottom: margin + 72 }) }
      : { left: (vw - cardSize.w) / 2, top: Math.max(margin, (vh - cardSize.h) / 2) };
  } else {
    const below = rect.top + rect.height + margin;
    const above = rect.top - cardSize.h - margin;
    const right = rect.left + rect.width + margin;
    let top: number;
    let left: number;
    if (step.placement === "right" && right + cardSize.w < vw) {
      top = rect.top;
      left = right;
    } else if (below + cardSize.h <= vh - margin || above < margin) {
      top = Math.min(below, vh - cardSize.h - margin);
      left = rect.left;
    } else {
      top = above;
      left = rect.left;
    }
    left = Math.min(Math.max(margin, left), vw - cardSize.w - margin);
    top = Math.min(Math.max(margin, top), vh - cardSize.h - margin);
    cardStyle = { top, left };
  }

  const body = missing && step.fallbackBody ? step.fallbackBody : step.body;
  const waitingClick = step.mode === "waitForClick" && !missing && !!target;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] pointer-events-none"
      style={dialogHost ? { position: "absolute", top: -dialogHost.getBoundingClientRect().top, left: -dialogHost.getBoundingClientRect().left, width: vw, height: vh, right: "auto", bottom: "auto" } : undefined}
      aria-live="polite"
      onClick={(event) => event.stopPropagation()}
    >
      {/* Fundo escurecido com recorte no elemento ensinado. Não bloqueia o uso do sistema. */}
      {rect ? (
        <div
          className={cn("absolute rounded-xl ring-2 ring-primary", !reduced && "transition-all duration-200 ease-out")}
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: "0 0 0 9999px hsl(var(--background) / 0.6)",
          }}
        />
      ) : (
        phase === "ready" && <div className="absolute inset-0 bg-background/60" />
      )}

      <div
        ref={cardRef}
        data-tour-card
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className={cn(
          "absolute pointer-events-auto overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card text-card-foreground shadow-2xl p-4 max-h-[calc(100dvh-24px)]",
          isMobile ? "" :"w-[340px] max-w-[calc(100vw-24px)]",
          !reduced && "transition-[top,left] duration-200 ease-out",
          phase === "locating" && "opacity-0",
        )}
        style={{ ...cardStyle, pointerEvents: "auto" }}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              {tour.title} · {stepIndex + 1} de {total}
            </p>
            <h2 id={titleId} tabIndex={-1} data-tour-focus className="text-base font-semibold leading-snug outline-none">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={pause}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center -m-2 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            aria-label="Fechar tour"
          >
            <X size={18} />
          </button>
        </div>

        <p id={bodyId} className="text-sm text-muted-foreground leading-relaxed">
          {body}
        </p>

        {step.tip && !missing && (
          <p className="mt-2 flex gap-2 text-xs text-foreground/80 bg-muted rounded-lg p-2">
            <Lightbulb size={14} className="flex-shrink-0 mt-0.5 text-primary" aria-hidden />
            <span>{step.tip}</span>
          </p>
        )}

        {waitingClick && (
          <p className="mt-2 flex items-center gap-2 text-xs font-medium text-primary">
            <MousePointerClick size={14} aria-hidden /> Clique no item destacado para continuar.
          </p>
        )}

        <div className="mt-3 h-1 rounded-full bg-muted overflow-hidden" aria-hidden>
          <div className="h-full bg-primary" style={{ width: `${((stepIndex + 1) / total) * 100}%` }} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={skip}>
            Pular
          </Button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <Button variant="outline" size="sm" onClick={() => move(-1)} aria-label="Passo anterior">
                <ArrowLeft size={16} className="mr-1" /> Voltar
              </Button>
            )}
            <Button size="sm" onClick={() => move(1)} aria-label={isLast ? "Concluir tour" : "Próximo passo"}>
              {isLast ? "Concluir" : waitingClick ? "Pular passo" : "Próximo"}
              {!isLast && <ArrowRight size={16} className="ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    dialogHost ?? document.body,
  );
}
