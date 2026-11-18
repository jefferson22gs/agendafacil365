import { Component, type ReactNode } from "react";
import { isChunkError, reloadOnceForNewVersion } from "@/lib/chunkReload";

/** Erro de renderização nunca deixa tela branca: versão nova recarrega sozinha; outros erros mostram como continuar. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  componentDidCatch(error: unknown) {
    if (isChunkError(error)) reloadOnceForNewVersion();
    else console.error("app_render_error", error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const update = isChunkError(this.state.error);
    return (
      <main role="alert" className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-md">
          <h1 className="text-xl font-semibold text-foreground">{update ? "Nova versão disponível" : "Algo deu errado nesta tela"}</h1>
          <p className="mt-3 text-muted-foreground">{update ? "O Agenda Fácil 365 foi atualizado. Recarregue para continuar de onde parou." : "Recarregue a página. Se continuar, volte ao início ou fale com o suporte."}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-lg bg-primary px-5 font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Recarregar</button>
            <a href="/" className="inline-flex min-h-11 items-center rounded-lg border px-5 font-medium text-foreground hover:bg-muted">Ir para o início</a>
          </div>
        </div>
      </main>
    );
  }
}
