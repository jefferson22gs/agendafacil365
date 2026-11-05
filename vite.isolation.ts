import type { Plugin } from "vite";
import fs from "fs";
import path from "path";

/**
 * Isolamento compartilhado por `training` (dev) e `demo` (build público). Nunca usado por `npm run build`.
 * Troca o client Supabase e o Firebase por stubs locais, injeta CSP e um guarda síncrono que corta rede externa,
 * window.open externo e service workers antes de qualquer módulo do app.
 */
export const DEMO_DIR = path.resolve(__dirname, "src/features/training/demo");
const MOCK = path.join(DEMO_DIR, "mockSupabase.ts");
const FIREBASE_STUB = path.join(DEMO_DIR, "firebaseStub.ts");

export const isolationAliases = [
  { find: "@/integrations/supabase/client", replacement: MOCK },
  { find: "@/lib/firebase", replacement: FIREBASE_STUB },
  { find: "@", replacement: path.resolve(__dirname, "src") },
];

const GUARD = `<script>
window.__TRAINING_DEMO__ = true;
(function () {
  function blocked(what) { try { window.dispatchEvent(new CustomEvent("demo:blocked", { detail: what })); } catch (e) {} }
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = new URL(input instanceof Request ? input.url : String(input), location.href);
    // Mesmo domínio continua (assets); /api e /functions/v1 seriam integrações reais.
    if (url.origin === location.origin && !/\\/(api|functions\\/v1)\\//.test(url.pathname)) return nativeFetch(input, init);
    blocked("fetch");
    return Promise.resolve(new Response(JSON.stringify({ error: "demo_unavailable" }), { status: 403, headers: { "Content-Type": "application/json" } }));
  };
  var nativeOpen = window.open.bind(window);
  window.open = function (u) {
    try { if (u && new URL(String(u), location.href).origin === location.origin) return nativeOpen.apply(window, arguments); } catch (e) {}
    blocked("open");
    return null;
  };
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register = function () { return Promise.reject(new Error("Service worker desabilitado na demonstração")); };
    navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
  }
})();
</script>`;

export function isolation({ csp, robots = false, outDir }: { csp: string; robots?: boolean; outDir?: string }): Plugin {
  return {
    name: "demo-isolation",
    enforce: "pre",
    resolveId(source) {
      if (/integrations\/supabase\/client(?:\.ts)?$/.test(source)) return MOCK;
      if (/(?:^|\/)lib\/firebase(?:\.ts)?$/.test(source)) return FIREBASE_STUB;
      return null;
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        // Depois do <meta charset> (precisa estar nos primeiros 1024 bytes) e antes de qualquer outro script.
        const inject = `\n<meta http-equiv="Content-Security-Policy" content="${csp}">${robots ? '\n<meta name="robots" content="noindex, nofollow">' : ""}\n${GUARD}`;
        // Sem PWA: sem manifest (evita 404/erro de manifest).
        return html.replace(/(<meta charset="UTF-8" \/>)/, `$1${inject}`).replace(/\s*<link rel="manifest"[^>]*>/, "");
      },
    },
    closeBundle() {
      // public/ é copiado inteiro; workers e sitemap de produção não pertencem à demo.
      if (!outDir) return;
      for (const f of ["sw.js", "sw-push.js", "firebase-messaging-sw.js", "sitemap.xml"]) fs.rmSync(path.join(outDir, f), { force: true });
      // robots.txt de produção libera indexação; a demo não deve aparecer em buscadores.
      fs.writeFileSync(path.join(outDir, "robots.txt"), "User-agent: *\nDisallow: /\n");
    },
  };
}
