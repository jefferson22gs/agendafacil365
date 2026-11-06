import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, GraduationCap, PlayCircle, Clock, CheckCircle2, RotateCcw, MessageCircle, BookOpen } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getSupportWhatsAppLink } from "@/config/contact";
import { useTraining } from "../TrainingProvider";
import { FirstStepsChecklist } from "../FirstStepsChecklist";
import { ARTICLES } from "../registry/articles";
import { CATEGORIES } from "../registry/categories";
import { searchArticles } from "../search";

export default function TrainingCenter() {
  const { startTour, progress, isAdminArea } = useTraining();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [resetting, setResetting] = useState(false);
  const filtered = useMemo(() => {
    const matches = query.trim() ? searchArticles(ARTICLES, query) : ARTICLES;
    return category === "all" ? matches : matches.filter((a) => a.category === category);
  }, [query, category]);
  const viewed = ARTICLES.filter((a) => !!progress.get(`article:${a.id}`, a.version)).length;

  if (!isAdminArea) return <AdminLayout><p>O treinamento é destinado à administração do estabelecimento.</p></AdminLayout>;

  const reset = async () => {
    setResetting(true);
    try { await progress.resetAll(); } finally { setResetting(false); }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <GraduationCap className="text-primary" size={30} aria-hidden />
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Central de Treinamento</h1>
            </div>
            <p className="text-muted-foreground mt-2">Aprenda a usar o Agenda Fácil 365 passo a passo. Comece pelo que precisa hoje.</p>
          </div>
          <Button variant="outline" data-tour="training-overview-button" onClick={() => void startTour("overview")}>
            <PlayCircle size={18} className="mr-2" aria-hidden /> Conheça o Agenda Fácil 365
          </Button>
        </header>

        {progress.error && <p role="status" className="rounded-lg border border-border p-3 text-sm text-muted-foreground">{progress.error}</p>}
        <div data-tour="training-first-steps"><FirstStepsChecklist variant="center" /></div>

        <div className="space-y-4">
          <div className="relative max-w-2xl" data-tour="training-search">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input className="pl-10 h-12 text-base" placeholder="Como podemos ajudar?" aria-label="Buscar tutorial" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Categorias de treinamento" data-tour="training-categories">
            <Button size="sm" variant={category === "all" ? "default" : "outline"} onClick={() => setCategory("all")} aria-pressed={category === "all"}>Todos</Button>
            {CATEGORIES.map((c) => (
              <Button key={c.id} size="sm" variant={category === c.id ? "default" : "outline"} onClick={() => setCategory(c.id)} aria-pressed={category === c.id}>{c.title}</Button>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "tutorial" : "tutoriais"} · {viewed} de {ARTICLES.length} vistos
        </p>
        {filtered.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-tour="training-articles">
            {filtered.map((a) => {
              const read = progress.get(`article:${a.id}`, a.version);
              const tourDone = a.tourId && progress.get(a.tourId, a.version)?.status === "completed";
              return (
                <Card key={a.id} className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <Badge variant="secondary">{CATEGORIES.find((c) => c.id === a.category)?.title}</Badge>
                      {(read || tourDone) && <CheckCircle2 size={18} className="text-success flex-shrink-0" aria-label={tourDone ? "Tour concluído" : "Artigo visto"} />}
                    </div>
                    <Link to={`/admin/training/${a.id}`} className="font-semibold text-lg hover:text-primary focus-visible:outline-ring">{a.title}</Link>
                    <p className="text-sm text-muted-foreground mt-2 flex-1">{a.summary}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-4">
                      <span className="inline-flex items-center gap-1"><Clock size={14} aria-hidden /> {a.minutes} min</span>
                      <span className="capitalize">{a.difficulty}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button size="sm" variant="outline" asChild><Link to={`/admin/training/${a.id}`}><BookOpen size={15} className="mr-1" aria-hidden /> Ler tutorial</Link></Button>
                      {a.tourId && <Button size="sm" variant="ghost" onClick={() => void startTour(a.tourId!)}><PlayCircle size={15} className="mr-1" aria-hidden /> Me mostre</Button>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card><CardContent className="p-8 text-center"><p className="font-medium">Nenhum tutorial encontrado.</p><p className="text-sm text-muted-foreground mt-2">Tente uma palavra diferente, como “agenda”, “zap” ou “equipe”.</p><Button variant="ghost" className="mt-3" onClick={() => { setQuery(""); setCategory("all"); }}>Limpar busca</Button></CardContent></Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6" data-tour="training-support">
          <div><p className="font-medium">Ainda precisa de ajuda?</p><Button variant="link" className="px-0" asChild><a href={getSupportWhatsAppLink()} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} className="mr-2" aria-hidden /> Falar com o suporte</a></Button></div>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" disabled={resetting}><RotateCcw size={16} className="mr-2" aria-hidden /> Reiniciar treinamento</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Recomeçar o treinamento?</AlertDialogTitle><AlertDialogDescription>Isso reinicia apenas seus tours e boas-vindas. Os dados do estabelecimento, clientes e agendamentos não serão alterados. O checklist continua refletindo o que você já configurou.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={() => void reset()}>Reiniciar</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </AdminLayout>
  );
}
