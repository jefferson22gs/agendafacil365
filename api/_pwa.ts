// Shared by server endpoints and browser: no Node-only imports here.
export interface PwaIdentity {
  name: string; slug?: string; primary_color?: string | null; logo_url?: string | null;
  avatar_url?: string | null; photo_url?: string | null; image_url?: string | null;
  secondary_color?: string | null; theme_color?: string | null; background_color?: string | null;
  pwa_name?: string | null; pwa_short_name?: string | null; pwa_description?: string | null;
  pwa_theme_color?: string | null; pwa_background_color?: string | null;
  pwa_icon_url?: string | null; pwa_enabled?: boolean | null;
}
export type PublicSalon = PwaIdentity & { slug: string };
export type Env = { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string };
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const validSlug = (s: unknown): s is string => typeof s === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$/i.test(s);
export const hexColor = (value: unknown, fallback = '#2563EB'): string =>
  typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value.trim()) ? value.trim() : fallback;
/** Luminância relativa WCAG 2.2 (sRGB). */
export function luminance(color: string): number {
  const hex = hexColor(color).slice(1);
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  const rgb = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
export const contrastRatio = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
export const DARK_TEXT = '#0F172A';
export const LIGHT_TEXT = '#FFFFFF';
/** Texto sobre a cor do salão (WCAG 1.4.3): o de maior contraste entre #FFFFFF e #0F172A. */
export function textOnColor(color: string): typeof DARK_TEXT | typeof LIGHT_TEXT {
  return contrastRatio(color, LIGHT_TEXT) >= contrastRatio(color, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
}
/**
 * Cor do salão ajustada para fundo de botão/badge: se nem branco nem #0F172A atingem 4.5:1 (tons médios),
 * escurece (ou clareia) mantendo a matiz até atingir. Cores que já passam ficam idênticas.
 */
export function accessibleBackground(color: string): string {
  let hex = hexColor(color);
  if (hex.length === 4) hex = '#' + hex.slice(1).split('').map(c => c + c).join('');
  if (contrastRatio(hex, textOnColor(hex)) >= 4.5) return hex;
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const toward = textOnColor(hex) === LIGHT_TEXT ? 0 : 255;
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = '#' + rgb.map(v => Math.round(v + (toward - v) * t).toString(16).padStart(2, '0')).join('');
    if (contrastRatio(c, textOnColor(c)) >= 4.5) return c;
  }
  return toward ? '#FFFFFF' : '#000000';
}

// Server-fetch allowlist. Never replace this guard with resolveLogo (browser URLs).
export function storageImage(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const u = new URL(value);
    return u.origin === 'https://ocbwsaydgkiseeardjga.supabase.co' && !u.username && !u.password &&
      u.pathname.startsWith('/storage/v1/object/public/') && /\.(png|jpe?g|webp)$/i.test(u.pathname) ? u.href : null;
  } catch { return null; }
}

export function rasterType(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 45 && ascii(0, 8) === '\x89PNG\r\n\x1a\n' && ascii(12, 16) === 'IHDR' && ascii(bytes.length - 8, bytes.length - 4) === 'IEND') return 'image/png';
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217) return 'image/jpeg';
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(ascii(12, 16))) return 'image/webp';
  return null;
}

export function rasterData(value: unknown): { bytes: Uint8Array; type: string } | null {
  if (typeof value !== 'string' || value.length > Math.ceil(MAX_LOGO_BYTES / 3) * 4 + 40) return null;
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match || match[2].length % 4 !== 0) return null;
  try {
    const binary = atob(match[2]);
    if (!binary.length || binary.length > MAX_LOGO_BYTES || btoa(binary) !== match[2]) return null;
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const type = rasterType(bytes);
    return type === match[1].toLowerCase() ? { bytes, type } : null;
  } catch { return null; }
}

// Client-only URL validation, not a server SSRF allowlist. IP literals are deliberately excluded.
export function resolveLogo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.startsWith('data:')) return rasterData(value) ? value : null;
  if (value.length > 2048 || /[\s\\]/.test(value)) return null;
  try {
    const u = new URL(value), host = u.hostname.toLowerCase().replace(/\.$/, '');
    if (u.protocol !== 'https:' || u.username || u.password || !host.includes('.') ||
      /^[\d.]+$/.test(host) || host.includes(':') ||
      /(?:^|\.)(?:localhost|local|internal|lan|home|localdomain|invalid)$/.test(host) ||
      !host.split('.').every(part => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(part))) return null;
    return u.href;
  } catch { return null; }
}

export function identity(s: PwaIdentity) {
  const name = (s.pwa_name?.trim() || s.name).slice(0, 60);
  return {
    name, shortName: (s.pwa_short_name?.trim() || name).slice(0, 24),
    description: (s.pwa_description?.trim() || `Agende seu horário em ${s.name}.`).slice(0, 300),
    color: hexColor(s.pwa_theme_color, hexColor(s.primary_color, hexColor(s.theme_color))),
    background: hexColor(s.pwa_background_color, hexColor(s.background_color, hexColor(s.primary_color, '#FFFFFF'))),
    // Foto/logo anexada pelo salão sempre vence o ícone PWA antigo.
    logo: [s.logo_url, s.avatar_url, s.photo_url, s.image_url, s.pwa_icon_url].map(resolveLogo).find(Boolean) ?? null,
  };
}

/** Identidade visual do estabelecimento (fonte única para página pública, área do cliente, PWA e e-mail). */
export function getEstablishmentBranding(s: PwaIdentity) {
  const app = identity(s);
  const primary = accessibleBackground(hexColor(s.primary_color, hexColor(s.theme_color, app.color)));
  return {
    ...app, primary, primaryForeground: textOnColor(primary),
    secondary: hexColor(s.secondary_color, primary),
    initials: s.name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map(w => Array.from(w)[0].toUpperCase()).join('') || '?',
  };
}

const LEGACY_COLUMNS = 'name,slug,primary_color,logo_url';
const COLUMNS = `${LEGACY_COLUMNS},pwa_name,pwa_short_name,pwa_description,pwa_theme_color,pwa_background_color,pwa_icon_url,pwa_enabled`;
export async function fetchSalon(slug: string, env: Env, fetchImpl: typeof fetch): Promise<PublicSalon | null | 'error'> {
  if (!validSlug(slug) || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return 'error';
  const query = (columns: string) => fetchImpl(`${env.SUPABASE_URL!.replace(/\/$/, '')}/rest/v1/salons?select=${columns}&slug=eq.${encodeURIComponent(slug)}&or=(is_active.is.null,is_active.eq.true)&limit=1`, {
    headers: { apikey: env.SUPABASE_ANON_KEY!, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
  });
  try {
    let res = await query(COLUMNS);
    if (!res.ok) {
      const error = await res.json();
      // Only missing optional columns justify a legacy query. Never retry authentication failures.
      if (res.status !== 400 || !['42703', 'PGRST204'].includes(error?.code) ||
        !/\bpwa_(?:name|short_name|description|theme_color|background_color|icon_url|enabled)\b/.test(error?.message ?? '')) return 'error';
      res = await query(LEGACY_COLUMNS);
    }
    if (!res.ok) return 'error';
    const rows = await res.json(), row = Array.isArray(rows) ? rows[0] : null;
    return typeof row?.name === 'string' && row.name && row.pwa_enabled !== false ? row : null;
  } catch { return 'error'; }
}
export function slugFromRequest(request: Request): string {
  try { return decodeURIComponent(new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? ''); } catch { return ''; }
}
