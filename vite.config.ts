import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // og:image/og:url absolutos só quando a origem de produção for configurada (VITE_PUBLIC_APP_URL, só em Production).
    // Preview/local ficam relativos. Sem <link rel=canonical> global: o index.html é servido para todas as rotas da SPA
    // e apontaria /s/:slug para a home. ponytail: canonical por rota exige HTML por rota (prerender da landing) — fase B.
    {
      name: "public-origin-meta",
      transformIndexHtml(html: string) {
        const raw = process.env.VITE_PUBLIC_APP_URL;
        if (!raw) return html;
        const origin = new URL(raw).origin; // valor inválido falha o build em vez de publicar meta errada
        return html
          .replace("</head>", `    <meta property="og:url" content="${origin}/" />\n  </head>`)
          .replaceAll('content="/og-image.png"', `content="${origin}/og-image.png"`);
      },
    },
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "favicon.svg", "apple-touch-icon.png", "pwa-192x192.png", "pwa-512x512.png", "pwa-maskable-512x512.png"],
      manifest: {
        // id/start_url/scope preservados ("/"): o PWA já instalado continua sendo o mesmo app.
        id: "/",
        name: "Agenda Fácil 365",
        short_name: "Agenda Fácil",
        description: "Agendamento online e gestão para negócios de serviços.",
        lang: "pt-BR",
        theme_color: "#2563EB",
        background_color: "#F4F8FF",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
        // ponytail: screenshots removidos (arquivos nunca existiram em public/). Adicionar capturas reais da UI nova quando houver.
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Workers próprios de push/FCM e o legado sw.js não entram no precache; /api/* nunca cai no fallback SPA.
        globIgnores: ["**/firebase-messaging-sw.js", "**/push-sw.js", "**/sw-push.js", "**/brand/*.png"],
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // Worker único no scope "/": os handlers de Web Push (push/notificationclick, sem Firebase) entram no SW gerado,
        // em vez de outro arquivo registrado no mesmo scope substituir o precache. Ver src/lib/serviceWorker.ts.
        importScripts: ["push-sw.js"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
