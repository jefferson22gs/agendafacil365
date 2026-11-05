/**
 * Modo demonstração pública (`npm run build:demo`, ver docs/DEMO.md). Vite substitui `import.meta.env.MODE`
 * em tempo de build: no build de produção IS_DEMO vira `false` e o código de demo é eliminado.
 */
export const IS_DEMO = import.meta.env.MODE === "demo";
/** Landing real (produção), destino do botão "Contratar" da demo. */
export const PRODUCTION_URL = "https://agendafacil365.vercel.app";
export const PRODUCTION_PRICING_URL = `${PRODUCTION_URL}/#pricing`;
/** Estado em memória da demo/treinamento salvo por aba (sobrevive a F5; "Reiniciar demonstração" apaga). */
export const DEMO_STORAGE_KEY = "af365-demo-db-v1";
export const DEMO_UNAVAILABLE = "Indisponível na demonstração";
/** Estabelecimento fictício (src/features/training/demo/fixtures.ts). */
export const DEMO_SALON_SLUG = "studio-bella-demo";
