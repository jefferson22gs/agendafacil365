// Depois de um deploy, a aba aberta ainda aponta para arquivos (chunks) do build anterior, que deixam de existir.
// O import falha e a tela ficava branca até o F5. Aqui: recarrega sozinho UMA vez por versão; se falhar de novo,
// o ErrorBoundary mostra a tela com botão (sem laço de recarga).
const KEY = "af365_chunk_reload";

export const isChunkError = (e: unknown) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch dynamically|ChunkLoadError|Unable to preload CSS|is not a valid JavaScript MIME type/i
    .test(String((e as { message?: unknown } | null)?.message ?? e));

/** true = vai recarregar agora; false = já tentou nesta versão (deixa o erro aparecer). */
export function reloadOnceForNewVersion(): boolean {
  let last: string | null = null;
  try { last = sessionStorage.getItem(KEY); } catch { /* sem armazenamento: tenta mesmo assim */ }
  // Marca por página: se o reload não resolver em 30 s, não tenta de novo (evita laço com servidor fora).
  if (last && Date.now() - Number(last) < 30_000) return false;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* idem */ }
  window.location.reload();
  return true;
}

export function installChunkReload() {
  // Vite dispara este evento quando um import dinâmico/preload falha.
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadOnceForNewVersion()) event.preventDefault();
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkError(event.reason) && reloadOnceForNewVersion()) event.preventDefault();
  });
}
