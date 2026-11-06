import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen, ChevronRight, GraduationCap, ListChecks, MessageCircle, PlayCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getSupportWhatsAppLink } from "@/config/contact";
import { useTraining } from "./TrainingProvider";
import { contextForRoute } from "./registry/routeContext";
import { ARTICLES, articlesByCategory } from "./registry/articles";
import { TOURS, getTour } from "./registry/tours";
import { searchArticles } from "./search";
import { useFirstSteps } from "./useFirstSteps";
import type { Article } from "./types";

function ArticleLink({ article, onOpen }: { article: Article; onOpen: (a: Article) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(article)}
      className="w-full min-h-[44px] flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
    >
      <BookOpen size={16} className="text-muted-foreground flex-shrink-0" aria-hidden />
      <span className="flex-1 min-w-0 truncate">{article.title}</span>
      <span className="text-xs text-muted-foreground flex-shrink-0">{article.minutes} min</span>
    </button>
  );
}

/** Conteúdo do botão Ajuda: tour desta tela, busca, primeiros passos, artigos relacionados e suporte. */
export default function HelpPanel() {
  const { startTour, setHelpOpen, active, progress } = useTraining();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { completed, total, nextTask, hasSalon } = useFirstSteps();

  const context = contextForRoute(location.pathname, location.search);
  const pageTours = (context?.tours ?? []).map((id) => getTour(id)).filter((t): t is NonNullable<typeof t> => !!t);
  const related = useMemo(() => {
    if (!context) return ARTICLES.slice(0, 4);
    const fromTours = ARTICLES.filter((a) => context.tours.includes(a.tourId ?? ""));
    const fromCategory = articlesByCategory(context.category).filter((a) => !fromTours.includes(a));
    return [...fromTours, ...fromCategory].slice(0, 5);
  }, [context]);
  const results = useMemo(() => searchArticles(ARTICLES, query).slice(0, 8), [query]);

  // Tour em andamento que foi interrompido (não concluído nem pulado).
  const resumable = progress.records.find((r) => r.kind === "tour" && r.status === "in_progress" && r.item_key !== active?.tour.id);
  const resumeTour = resumable ? TOURS.find((t) => t.id === resumable.item_key) : undefined;

  const openArticle = (a: Article) => {
    setHelpOpen(false);
    navigate(`/admin/training/${a.id}`);
  };
  const goCenter = () => {
    setHelpOpen(false);
    navigate("/admin/training");
  };

  return (
    <div className="p-4 space-y-4">
      {progress.error && <p role="status" className="text-xs text-muted-foreground">{progress.error}</p>}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="O que você quer fazer? Ex.: cadastrar serviço"
          className="pl-9"
          aria-label="Buscar ajuda"
        />
      </div>

      {query.trim() ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Resultados</p>
          {results.length ? (
            results.map((a) => <ArticleLink key={a.id} article={a} onOpen={openArticle} />)
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Nada encontrado. Tente outra palavra ou fale com o suporte abaixo.
            </p>
          )}
        </div>
      ) : (
        <>
          {pageTours.length > 0 && (
            <div className="space-y-2">
              <Button className="w-full justify-start" onClick={() => void startTour(pageTours[0].id)}>
                <PlayCircle size={18} className="mr-2" aria-hidden />
                Fazer tour desta tela
              </Button>
              {pageTours.slice(1).map((t) => (
                <Button key={t.id} variant="outline" size="sm" className="w-full justify-start" onClick={() => void startTour(t.id)}>
                  <PlayCircle size={16} className="mr-2" aria-hidden />
                  {t.title}
                </Button>
              ))}
            </div>
          )}

          {resumeTour && (
            <Button variant="secondary" className="w-full justify-start" onClick={() => void startTour(resumeTour.id, resumable?.current_step ?? 0)}>
              <PlayCircle size={18} className="mr-2" aria-hidden />
              Continuar: {resumeTour.title}
            </Button>
          )}

          {hasSalon && completed < total && (
            <button
              type="button"
              onClick={() => (nextTask?.tourId ? void startTour(nextTask.tourId) : goCenter())}
              className="w-full flex items-center gap-3 rounded-xl border border-border p-3 text-left hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ListChecks size={20} className="text-primary flex-shrink-0" aria-hidden />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium">Primeiros passos · {completed} de {total}</span>
                {nextTask && <span className="block text-xs text-muted-foreground truncate">Próximo: {nextTask.title}</span>}
              </span>
              <ChevronRight size={16} className="text-muted-foreground" aria-hidden />
            </button>
          )}

          {related.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Sobre esta tela</p>
              {related.map((a) => (
                <ArticleLink key={a.id} article={a} onOpen={openArticle} />
              ))}
            </div>
          )}
        </>
      )}

      <Separator />

      <div className="grid gap-2">
        <Button variant="outline" className="justify-start" onClick={goCenter}>
          <GraduationCap size={18} className="mr-2" aria-hidden />
          Central de Treinamento
        </Button>
        <Button variant="ghost" className="justify-start" asChild>
          <a href={getSupportWhatsAppLink("support")} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={18} className="mr-2" aria-hidden />
            Falar com o suporte
          </a>
        </Button>
      </div>
    </div>
  );
}
