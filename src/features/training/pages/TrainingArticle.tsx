import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Clock, ExternalLink, PlayCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useTraining } from "../TrainingProvider";
import { ARTICLES, getArticle } from "../registry/articles";
import { categoryById } from "../registry/categories";
import type { ArticleImage } from "../types";

function Screenshot({ image }: { image: ArticleImage }) {
  const [failed, setFailed] = useState(false);
  if (image.pending || failed) return (
    <div className="rounded-xl border border-dashed border-border p-4 bg-muted/30 text-sm text-muted-foreground">
      Imagem deste passo em preparação. Siga as instruções acima ou use “Me mostre onde fazer”.
    </div>
  );
  return (
    <figure className="mt-3">
      <div className="relative rounded-xl overflow-hidden border border-border">
        <img src={image.src} alt={image.alt} loading="lazy" decoding="async" className="w-full h-auto" onError={() => setFailed(true)} />
        {image.hotspots?.map((hotspot, i) => (
          <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold ring-2 ring-background shadow-lg" style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }} title={hotspot.label}>{i + 1}</span>
        ))}
      </div>
      <figcaption className="text-xs text-muted-foreground mt-2">{image.alt} · Tela com dados fictícios para demonstração.</figcaption>
    </figure>
  );
}

export default function TrainingArticle() {
  const { articleId = "" } = useParams();
  const { progress, startTour, isAdminArea } = useTraining();
  const article = getArticle(articleId);
  const [feedback, setFeedback] = useState<boolean | undefined>();
  const index = ARTICLES.findIndex((a) => a.id === articleId);
  const previous = ARTICLES[index - 1];
  const next = ARTICLES[index + 1];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setFeedback(undefined);
    if (!article || !isAdminArea) return;
    void progress.save({ key: `article:${article.id}`, version: article.version, kind: "article", status: "viewed" });
  }, [articleId, article, isAdminArea, progress.save]); // save é estável para o usuário/salão atual.

  const rate = (helpful: boolean) => {
    if (!article) return;
    setFeedback(helpful);
    void progress.save({ key: `article:${article.id}`, version: article.version, kind: "article", status: "viewed", metadata: { helpful } });
  };

  if (!article) return (
    <AdminLayout><div className="max-w-3xl mx-auto"><p className="text-lg font-medium">Tutorial não encontrado.</p><Button variant="link" asChild><Link to="/admin/training">Voltar à Central de Treinamento</Link></Button></div></AdminLayout>
  );
  if (!isAdminArea) return <AdminLayout><p>O treinamento é destinado à administração do estabelecimento.</p></AdminLayout>;

  return (
    <AdminLayout>
      <article className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" className="-ml-3" asChild><Link to="/admin/training"><ArrowLeft size={16} className="mr-2" aria-hidden /> Central de Treinamento</Link></Button>
        <header>
          <Badge variant="secondary" className="mb-3">{categoryById(article.category)?.title}</Badge>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{article.title}</h1>
          <p className="text-muted-foreground mt-2">{article.summary}</p>
          <div className="flex gap-4 items-center text-sm text-muted-foreground mt-3"><span className="inline-flex items-center gap-1"><Clock size={15} aria-hidden /> Cerca de {article.minutes} min</span><span className="capitalize">{article.difficulty}</span><span>Versão {article.version}</span></div>
          <div className="flex flex-wrap gap-2 mt-4">
            {article.tourId && <Button variant="brand" onClick={() => void startTour(article.tourId!)}><PlayCircle size={18} className="mr-2" aria-hidden /> Me mostre onde fazer</Button>}
            {article.route && <Button variant="outline" asChild><Link to={article.route}><ExternalLink size={16} className="mr-2" aria-hidden /> Abrir tela</Link></Button>}
          </div>
        </header>

        {article.notes?.length ? <Card className="border-primary/30 bg-primary/5"><CardContent className="p-4"><p className="font-medium text-sm mb-2">Antes de começar</p><ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">{article.notes.map((note, i) => <li key={i}>{note}</li>)}</ul></CardContent></Card> : null}

        <ol className="space-y-6">
          {article.steps.map((step, i) => (
            <li key={`${article.id}:${i}`} className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="flex gap-3 items-start">
                <span className="flex-shrink-0 rounded-full bg-primary/15 text-primary font-bold text-sm w-7 h-7 flex items-center justify-center" aria-hidden>{i + 1}</span>
                <div className="flex-1 min-w-0"><h2 className="text-xs font-medium text-muted-foreground mb-1">Passo {i + 1}</h2><p className="text-sm sm:text-base leading-relaxed whitespace-pre-line">{step.text}</p>{step.image && <Screenshot key={step.image.src} image={step.image} />}</div>
              </div>
            </li>
          ))}
        </ol>

        <div className="rounded-xl border border-border p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Foi útil?</span>
          <Button size="sm" variant={feedback === true ? "default" : "outline"} onClick={() => rate(true)} aria-pressed={feedback === true}><ThumbsUp size={16} className="mr-1" aria-hidden /> Sim</Button>
          <Button size="sm" variant={feedback === false ? "default" : "outline"} onClick={() => rate(false)} aria-pressed={feedback === false}><ThumbsDown size={16} className="mr-1" aria-hidden /> Não</Button>
          {feedback !== undefined && <span className="text-xs text-muted-foreground" role="status">Obrigado! Sua resposta ajuda a melhorar os tutoriais.</span>}
        </div>

        <nav className="grid sm:grid-cols-2 gap-3 border-t border-border pt-5" aria-label="Tutoriais anterior e próximo">
          {previous ? <Link to={`/admin/training/${previous.id}`} className="p-3 rounded-lg border border-border hover:bg-secondary"><span className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft size={14} aria-hidden /> Anterior</span><span className="text-sm font-medium">{previous.title}</span></Link> : <span />}
          {next && <Link to={`/admin/training/${next.id}`} className="p-3 rounded-lg border border-border hover:bg-secondary text-right"><span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">Próximo <ArrowRight size={14} aria-hidden /></span><span className="text-sm font-medium">{next.title}</span></Link>}
        </nav>
        <Button variant="link" asChild><Link to="/admin/training"><BookOpen size={16} className="mr-2" aria-hidden /> Ver todos os tutoriais</Link></Button>
      </article>
    </AdminLayout>
  );
}
