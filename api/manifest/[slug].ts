import { fetchSalon, identity, slugFromRequest, validSlug, type Env, type PublicSalon } from '../_pwa.js';
export type { PublicSalon };
const json = (status: number, body: unknown, cache: string) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': status === 200 ? 'application/manifest+json; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' },
});
export function buildManifest(salon: PublicSalon, version = '') {
  const app = identity(salon), base = `/s/${salon.slug}`;
  const suffix = version ? `&v=${encodeURIComponent(version)}` : '';
  return {
    id: base, name: app.name, short_name: app.shortName, description: app.description,
    start_url: `${base}?source=pwa`, scope: base,
    display: 'standalone', orientation: 'portrait', background_color: app.background, theme_color: app.color, lang: 'pt-BR',
    // No MIME declaration: tenant rasters may be PNG, JPEG or WebP (or browser redirects).
    // Requested sizes are exact for generated initials; original logos are not resized server-side.
    icons: [
      ...[192, 512].map(size => ({ src: `/api/icon/${salon.slug}?format=png&size=${size}${suffix}`, sizes: `${size}x${size}`, purpose: 'any' })),
      // Android recorta ícones "maskable": versão do salão com logo dentro da safe zone (80%).
      { src: `/api/icon/${salon.slug}?maskable=1${suffix}`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    categories: ['business', 'lifestyle'],
  };
}
export async function handleManifest(request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const slug = slugFromRequest(request);
  if (!validSlug(slug)) return json(400, { error: 'slug inválido' }, 'no-store');
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return json(500, { error: 'manifest indisponível' }, 'no-store');
  const salon = await fetchSalon(slug, env, fetchImpl);
  if (salon === 'error') return json(502, { error: 'manifest indisponível' }, 'no-store');
  if (!salon) return json(404, { error: 'estabelecimento não encontrado' }, 'public, max-age=60');
  return json(200, buildManifest(salon, new URL(request.url).searchParams.get('v')?.slice(0, 40) ?? ''), 'public, max-age=300, s-maxage=3600');
}
export function GET(request: Request): Promise<Response> {
  return handleManifest(request, { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY });
}
