// Vídeo oficial (comercial de 2 min, telas reais da demonstração). Sem autoplay: só carrega ao tocar em play.
// Dois elementos em vez de <source media>: navegadores antigos ignoram `media` e baixariam o formato errado.
const VIDEO_LABEL = "Vídeo de apresentação do Agenda Fácil 365";

export const VideoSection = () => (
  <section id="video" className="scroll-mt-20 bg-background py-16 md:py-24" aria-labelledby="video-title">
    <div className="container px-4">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h2 id="video-title" className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Veja o Agenda Fácil 365 em 2 minutos
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Da agenda de papel ao agendamento pelo link: lembretes, painel, clientes e relatórios em telas reais.
        </p>
      </div>

      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-border bg-black shadow-lg">
        <video
          className="block aspect-[9/16] max-h-[80dvh] w-full md:hidden"
          controls
          playsInline
          preload="none"
          poster="/video/apresentacao-1080x1920.jpg"
          aria-label={VIDEO_LABEL}
        >
          <source src="/video/apresentacao-1080x1920.mp4" type="video/mp4" />
        </video>
        <video
          className="hidden aspect-video w-full md:block"
          controls
          playsInline
          preload="none"
          poster="/video/apresentacao-1920x1080.jpg"
          aria-label={VIDEO_LABEL}
        >
          <source src="/video/apresentacao-1920x1080.mp4" type="video/mp4" />
        </video>
      </div>
      <p className="mt-3 text-center text-sm text-muted-foreground">Telas reais da demonstração, com dados fictícios.</p>
    </div>
  </section>
);
