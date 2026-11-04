/**
 * Vercel Function (runtime Node, assinatura Web) — GET /api/manifest/:slug
 * Manifest PWA por estabelecimento usado por src/pages/PublicSalon.tsx.
 * Substitui src/pages/api/manifest/[slug].ts (formato Next.js, que a SPA Vite nunca servia).
 *
 * Variáveis server-side (nomes; valores ficam no painel da Vercel):
 *   SUPABASE_URL, SUPABASE_ANON_KEY  — chave pública "anon": lê só o que a RLS já expõe para visitantes.
 * Nunca usar service-role aqui nem prefixo VITE_.
 */

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/i;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const DEFAULT_COLOR = "#2563EB";

export interface PublicSalon {
  name: string;
  slug: string;
  primary_color: string | null;
}

const json = (status: number, body: unknown, cache: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": status === 200 ? "application/manifest+json; charset=utf-8" : "application/json; charset=utf-8",
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
    },
  });

export function buildManifest(salon: PublicSalon) {
  const color = salon.primary_color && HEX.test(salon.primary_color) ? salon.primary_color : DEFAULT_COLOR;
  const name = salon.name.slice(0, 60);
  return {
    // id próprio por estabelecimento: não colide com o app da plataforma (id "/").
    id: `/s/${salon.slug}`,
    name: `${name} | Agendamento`,
    short_name: name.slice(0, 24),
    description: `Agende seu horário em ${name}.`,
    start_url: `/s/${salon.slug}?source=pwa`,
    scope: `/s/${salon.slug}`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: color,
    lang: "pt-BR",
    // ponytail: ícones da plataforma. logo_url do cliente não tem tamanho/MIME/safe zone garantidos;
    // gerar variantes 192/512/maskable no upload do logo e então referenciá-las aqui.
    icons: [
      { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    categories: ["business", "lifestyle"],
  };
}

type Env = { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string };

export async function handleManifest(request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  let slug = "";
  try {
    slug = decodeURIComponent(new URL(request.url).pathname.split("/").filter(Boolean).pop() ?? "");
  } catch {
    /* URI malformada: cai no 400 */
  }
  if (!SLUG.test(slug)) return json(400, { error: "slug inválido" }, "no-store");
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json(500, { error: "manifest indisponível" }, "no-store");

  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/salons?select=name,slug,primary_color&slug=eq.${encodeURIComponent(slug)}&is_active=neq.false&limit=1`;
  let rows: PublicSalon[];
  try {
    const res = await fetchImpl(url, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` } });
    if (!res.ok) return json(502, { error: "manifest indisponível" }, "no-store");
    rows = await res.json();
  } catch {
    return json(502, { error: "manifest indisponível" }, "no-store");
  }
  if (!Array.isArray(rows) || !rows[0]?.name) return json(404, { error: "estabelecimento não encontrado" }, "public, max-age=60");
  return json(200, buildManifest(rows[0]), "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
}

export function GET(request: Request): Promise<Response> {
  return handleManifest(request, { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY });
}
