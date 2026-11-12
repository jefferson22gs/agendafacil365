import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { categoryById } from "./registry/categories";
import { videoPoster, videoSrc, videoTime, type TrainingVideo } from "./registry/videos";

/** Player nativo: só baixa o vídeo quando o cliente dá play (preload="none"); a capa é uma imagem leve. */
export function VideoPlayer({ video, autoPlay = false }: { video: TrainingVideo; autoPlay?: boolean }) {
  return (
    <video
      key={video.slug}
      className="aspect-video w-full rounded-xl border border-border bg-black"
      controls
      playsInline
      autoPlay={autoPlay}
      preload={autoPlay ? "auto" : "none"}
      poster={videoPoster(video)}
      aria-label={`Videoaula: ${video.title}`}
    >
      <source src={videoSrc(video)} type="video/mp4" />
      Seu navegador não reproduz este vídeo. <a href={videoSrc(video)}>Baixar a videoaula</a>.
    </video>
  );
}

/** Grade de videoaulas com player em janela. `videos` já vem filtrado pela busca e pela categoria. */
/** `limit`: quantas aparecem antes de "Ver todas" (sem busca nem filtro, para os tutoriais não ficarem longe). */
export function TrainingVideos({ videos, limit }: { videos: TrainingVideo[]; limit?: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const shown = limit && !expanded ? videos.slice(0, limit) : videos;
  const index = videos.findIndex((v) => v.n === open);
  const current = videos[index];
  const previous = videos[index - 1];
  const next = videos[index + 1];
  if (!videos.length) return null;

  return (
    <section aria-labelledby="training-videos-title" data-tour="training-videos" className="space-y-3">
      <div>
        <h2 id="training-videos-title" className="font-display text-xl font-bold">Videoaulas</h2>
        <p className="text-sm text-muted-foreground">
          {videos.length} {videos.length === 1 ? "aula" : "aulas"} de cerca de 1 minuto, com narração e legenda. Gravadas no ambiente de demonstração, com dados fictícios.
        </p>
      </div>
      <ul className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((v) => (
          <li key={v.slug}>
            <button
              type="button"
              onClick={() => setOpen(v.n)}
              className="group block w-full rounded-xl border border-border bg-card text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="relative block aspect-video overflow-hidden rounded-t-xl bg-muted">
                <img src={videoPoster(v)} alt="" loading="lazy" decoding="async" width={640} height={360} className="h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40" aria-hidden>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"><Play size={20} className="ml-0.5" /></span>
                </span>
                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white">{videoTime(v.seconds)}</span>
              </span>
              <span className="block p-3">
                <span className="block text-xs text-muted-foreground">Aula {String(v.n).padStart(2, "0")}</span>
                <span className="block font-semibold leading-snug">{v.title}</span>
                <span className="mt-1 hidden text-sm text-muted-foreground sm:line-clamp-2">{v.summary}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {limit && videos.length > limit ? (
        <Button variant="outline" className="min-h-11 w-full sm:w-auto" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Mostrar menos" : `Ver todas as ${videos.length} aulas`}
        </Button>
      ) : null}

      <Dialog open={!!current} onOpenChange={(o) => { if (!o) setOpen(null); }}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto overscroll-contain rounded-2xl p-4 sm:p-6">
          {current && (
            <>
              <DialogHeader className="pr-6 text-left">
                <Badge variant="secondary" className="mb-1 w-fit">{categoryById(current.category)?.title}</Badge>
                <DialogTitle>Aula {String(current.n).padStart(2, "0")}: {current.title}</DialogTitle>
                <DialogDescription>{current.summary}</DialogDescription>
              </DialogHeader>
              <VideoPlayer video={current} autoPlay />
              <div className="flex flex-wrap gap-2">
                {current.articleId && <Button size="sm" variant="outline" asChild><Link to={`/admin/training/${current.articleId}`}><BookOpen size={15} className="mr-1.5" aria-hidden /> Ler passo a passo</Link></Button>}
                {current.route && <Button size="sm" variant="outline" asChild><Link to={current.route}><ExternalLink size={15} className="mr-1.5" aria-hidden /> Abrir tela</Link></Button>}
              </div>
              <nav className="flex items-center justify-between gap-2 border-t border-border pt-3" aria-label="Aula anterior e próxima">
                <Button size="sm" variant="ghost" disabled={!previous} onClick={() => previous && setOpen(previous.n)}><ArrowLeft size={15} className="mr-1.5" aria-hidden /> Anterior</Button>
                <span className="text-xs text-muted-foreground" aria-live="polite">{index + 1} de {videos.length}</span>
                <Button size="sm" variant="ghost" disabled={!next} onClick={() => next && setOpen(next.n)}>Próxima <ArrowRight size={15} className="ml-1.5" aria-hidden /></Button>
              </nav>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
