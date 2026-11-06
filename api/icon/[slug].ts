/**
 * Vercel Function — GET /api/icon/:slug[?maskable=1]. Ícone SVG do app de cada estabelecimento.
 *
 * Escolha (docs/PWA_SALAO.md): sem dependências novas não há como compor PNG no servidor, então o ícone é SVG
 * (sizes "any"). SVG usado como imagem NÃO carrega recursos externos; por isso o logo é embutido como data URI.
 * Anti-SSRF: só busca a URL se ela for do Storage público deste projeto (origem fixa, caminho /storage/v1/object/public,
 * extensão png/jpg/webp), sem redirecionamento, com limite de tamanho e tipo conferido. Qualquer outro caso: inicial do nome.
 * O manifest mantém os PNG da plataforma como fallback (iOS ignora SVG).
 */
import { fetchSalon, identity, slugFromRequest, textOnColor, validSlug, type Env } from "../_pwa.js";

const MAX_LOGO = 400_000;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

export async function logoDataUri(url: string | null, fetchImpl: typeof fetch): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetchImpl(url, { redirect: "error" });
    const type = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (!res.ok || !IMAGE_TYPES.has(type) || Number(res.headers.get("content-length") ?? 0) > MAX_LOGO) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_LOGO) return null;
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  } catch { return null; }
}

export function buildIconSvg(opts: { name: string; color: string; logo: string | null; maskable: boolean }): string {
  // Maskable: conteúdo dentro do círculo de 80% (safe zone). "any": cantos arredondados e logo maior.
  const size = 512, box = opts.maskable ? 300 : 360, off = (size - box) / 2;
  const fg = textOnColor(opts.color);
  const bg = opts.maskable ? `<rect width="512" height="512" fill="${opts.color}"/>` : `<rect width="512" height="512" rx="112" fill="${opts.color}"/>`;
  const content = opts.logo
    ? `<clipPath id="c"><rect x="${off}" y="${off}" width="${box}" height="${box}" rx="${box * 0.18}"/></clipPath><image href="${esc(opts.logo)}" x="${off}" y="${off}" width="${box}" height="${box}" preserveAspectRatio="xMidYMid meet" clip-path="url(#c)"/>`
    : `<text x="256" y="256" dy=".35em" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="${opts.maskable ? 220 : 260}" fill="${fg}">${esc((opts.name.trim()[0] || "A").toUpperCase())}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${bg}${content}</svg>`;
}

const svg = (body: string, status: number, cache: string) => new Response(body, {
  status, headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": cache, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'" },
});

export async function handleIcon(request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const slug = slugFromRequest(request);
  if (!validSlug(slug)) return new Response("slug inválido", { status: 400, headers: { "Cache-Control": "no-store" } });
  const maskable = new URL(request.url).searchParams.get("maskable") === "1";
  const salon = await fetchSalon(slug, env, fetchImpl);
  if (salon === "error") return new Response("ícone indisponível", { status: 502, headers: { "Cache-Control": "no-store" } });
  if (!salon) return new Response("não encontrado", { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  const app = identity(salon);
  const logo = await logoDataUri(app.logo, fetchImpl);
  return svg(buildIconSvg({ name: app.name, color: app.color, logo, maskable }), 200, "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
}

export function GET(request: Request): Promise<Response> {
  return handleIcon(request, { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY });
}
