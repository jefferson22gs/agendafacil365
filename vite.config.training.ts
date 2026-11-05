import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { DEMO_DIR, isolation, isolationAliases } from "./vite.isolation";

/** Exclusivo desenvolvimento: NÃO é usado por npm run build/deploy. Sem .env, sem PWA. */
const csp = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://127.0.0.1:8081 ws://localhost:8081; font-src 'self' data:; frame-src 'none'; form-action 'none'; worker-src 'none'";

export default defineConfig({
  envDir: DEMO_DIR,
  server: { host: "127.0.0.1", port: 8081, strictPort: true },
  plugins: [isolation({ csp }), react()],
  resolve: { alias: isolationAliases },
});
