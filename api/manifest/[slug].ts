/**
 * Vercel Function — GET /api/manifest/:slug. Manifest PWA próprio de cada estabelecimento.
 * Server-side: SUPABASE_URL, SUPABASE_ANON_KEY (lê apenas o que a RLS pública expõe; nunca service role).
 */
import { fetchSalon, identity, slugFromRequest, validSlug, type Env, type PublicSalon } from "../_pwa.js";
export type { PublicSalon };


const json = (status: number, body: unknown, cache: string) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": status === 200 ? "application/manifest+json; charset=utf-8" : "application/json; charset=utf-8", "Cache-Control": cache, "X-Content-Type-Options": "nosniff" },
});

export function buildManifest(salon: PublicSalon, version = "") {
  const app = identity(salon), base = `/s/${salon.slug}`, v = version ? `?v=${encodeURIComponent(version)}` : "";
  return {
    id: base, // estável: mudar nome/cor não cria outro app instalado
    name: app.name, short_name: app.shortName, description: app.description,
    // scope sem barra final: contém start_url (/s/slug?source=pwa), a página, o fluxo de agendamento e /s/slug/:profissional.
    // /appointment/:token e /avaliar/:id ficam fora: abrem na aba do navegador, sem quebrar o app.
    start_url: `${base}?source=pwa`, scope: base,
    display: "standalone", orientation: "portrait", background_color: app.background, theme_color: app.color, lang: "pt-BR",
    // SVG do tenant primeiro (Chrome/Edge/Android); PNG da plataforma como fallback para quem ignora SVG.
    icons: [
      { src: `/api/icon/${salon.slug}${v}`, sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: `/api/icon/${salon.slug}${v ? `${v}&` : "?"}maskable=1`, sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["business", "lifestyle"],
  };
}

export async function handleManifest(request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const slug = slugFromRequest(request);
  if (!validSlug(slug)) return json(400, { error: "slug inválido" }, "no-store");
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json(500, { error: "manifest indisponível" }, "no-store");
  const salon = await fetchSalon(slug, env, fetchImpl);
  if (salon === "error") return json(502, { error: "manifest indisponível" }, "no-store");
  if (!salon) return json(404, { error: "estabelecimento não encontrado" }, "public, max-age=60");
  const version = new URL(request.url).searchParams.get("v")?.slice(0, 40) ?? "";
  return json(200, buildManifest(salon, version), "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
}

export function GET(request: Request): Promise<Response> {
  return handleManifest(request, { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY });
}
