import { fetchSalon, identity, slugFromRequest, textOnColor, validSlug, storageImage, rasterData, rasterType, MAX_LOGO_BYTES, type Env } from '../_pwa.js';
import { initials, initialsPng } from '../_pwa-png.js';

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const CACHE = 'public, max-age=300, s-maxage=3600';
export async function logoDataUri(url: string | null, fetchImpl: typeof fetch): Promise<string | null> {
  if (rasterData(url)) return url;
  const allowed = storageImage(url);
  if (!allowed) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const res = await fetchImpl(allowed, { redirect: 'error', signal: controller.signal });
    reader = res.body?.getReader();
    const type = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!res.ok || !reader || !['image/png', 'image/jpeg', 'image/webp'].includes(type ?? '') || Number(res.headers.get('content-length') ?? 0) > MAX_LOGO_BYTES) return null;
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_LOGO_BYTES) return null;
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (rasterType(bytes) !== type) return null;
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(binary)}`;
  } catch { return null; }
  finally { clearTimeout(timer); controller.abort(); void reader?.cancel().catch(() => {}); }
}

export function buildIconSvg(opts: { name: string; color: string; logo: string | null; maskable: boolean }): string {
  const box = opts.maskable ? 300 : 360, off = (512 - box) / 2;
  const content = opts.logo
    ? `<image href="${esc(opts.logo)}" x="${off}" y="${off}" width="${box}" height="${box}" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="256" y="256" dy=".35em" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="180" fill="${textOnColor(opts.color)}">${esc(initials(opts.name))}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512"><rect width="512" height="512" fill="${esc(opts.color)}"/>${content}</svg>`;
}
export async function handleIcon(request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const slug = slugFromRequest(request), params = new URL(request.url).searchParams;
  const format = params.get('format') ?? 'svg', size = Number(params.get('size') ?? 512);
  if (!validSlug(slug) || !['svg', 'png'].includes(format) || ![180, 192, 512].includes(size)) return new Response('parâmetros inválidos', { status: 400, headers: { 'Cache-Control': 'no-store' } });
  const salon = await fetchSalon(slug, env, fetchImpl);
  if (salon === 'error') return new Response('ícone indisponível', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  if (!salon) return new Response('não encontrado', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
  const app = identity(salon);
  const headers = { 'Cache-Control': CACHE, 'X-Content-Type-Options': 'nosniff' };
  if (format === 'png' && app.logo?.startsWith('https:') && !storageImage(app.logo)) {
    // ponytail: browser fetches external logos; no server fetch, resize or failure detection.
    // Original MIME/dimensions remain authoritative. Use Storage or Base64 for local fallback on failure.
    return new Response(null, { status: 302, headers: { ...headers, Location: app.logo, 'Referrer-Policy': 'no-referrer' } });
  }
  const logo = await logoDataUri(app.logo, fetchImpl);
  if (format === 'png') {
    // No codec installed: preserve tenant raster bytes/MIME; size applies to the generated fallback only.
    const raster = rasterData(logo);
    return new Response(raster ? raster.bytes : initialsPng(app.name, app.color, size), {
      headers: { ...headers, 'Content-Type': raster?.type ?? 'image/png' },
    });
  }
  return new Response(buildIconSvg({ name: app.name, color: app.color, logo, maskable: params.get('maskable') === '1' }), {
    headers: { ...headers, 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'" },
  });
}
export function GET(request: Request): Promise<Response> {
  return handleIcon(request, { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY });
}
