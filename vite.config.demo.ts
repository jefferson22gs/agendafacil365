import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { DEMO_DIR, isolation, isolationAliases } from "./vite.isolation";

/**
 * Demonstração pública (npm run build:demo → dist-demo/). Dados fictícios em memória, sem Supabase, sem PWA,
 * sem variáveis de ambiente (envDir aponta para uma pasta sem .env). Ver docs/DEMO.md.
 */
const outDir = path.resolve(__dirname, "dist-demo");
const fonts = "https://fonts.googleapis.com";
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // guarda síncrono inline (vite.isolation.ts)
  `style-src 'self' 'unsafe-inline' ${fonts}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'" + (process.env.NODE_ENV === "production" ? "" : " ws://127.0.0.1:8082 ws://localhost:8082"),
  "media-src 'self' data: blob:",
  "frame-src 'none'", "object-src 'none'", "worker-src 'none'", "form-action 'self'", "base-uri 'self'",
].join("; ");

export default defineConfig({
  mode: "demo",
  envDir: DEMO_DIR,
  server: { host: "127.0.0.1", port: 8082, strictPort: true },
  preview: { port: 4300 },
  build: { outDir, emptyOutDir: true },
  plugins: [
    isolation({ csp, robots: true, outDir }),
    react(),
  ],
  resolve: { alias: isolationAliases },
});
