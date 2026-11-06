// Identidade do app de cada salão. Fonte única para as Vercel Functions (manifest/ícone) e para o front
// (contraste do cartão e prévia no painel). Sem dependências: roda no Node, no browser e nos testes.
export interface PwaIdentity {
  name: string; slug?: string; primary_color?: string | null; logo_url?: string | null;
  pwa_name?: string | null; pwa_short_name?: string | null; pwa_description?: string | null;
  pwa_theme_color?: string | null; pwa_background_color?: string | null;
  pwa_icon_url?: string | null; pwa_enabled?: boolean | null;
}
export const validSlug = (s: unknown): s is string => typeof s === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$/i.test(s);
export const hexColor = (value: unknown, fallback = '#2563EB'): string =>
  typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value.trim()) ? value.trim() : fallback;
export function textOnColor(color: string): '#000000' | '#ffffff' {
  const hex = hexColor(color).slice(1);
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  const rgb = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff';
}
export function storageImage(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const u = new URL(value);
    return u.origin === 'https://ocbwsaydgkiseeardjga.supabase.co' && !u.username && !u.password &&
      u.pathname.startsWith('/storage/v1/object/public/') && /\.(png|jpe?g|webp)$/i.test(u.pathname) ? u.href : null;
  } catch { return null; }
}
export function identity(s: PwaIdentity) {
  const name = (s.pwa_name?.trim() || s.name).slice(0, 60);
  return {
    name, shortName: (s.pwa_short_name?.trim() || name).slice(0, 24),
    description: (s.pwa_description?.trim() || `Agende seu horário em ${s.name}.`).slice(0, 300),
    color: hexColor(s.pwa_theme_color, hexColor(s.primary_color)),
    background: hexColor(s.pwa_background_color, hexColor(s.primary_color, '#FFFFFF')),
    logo: storageImage(s.pwa_icon_url) || storageImage(s.logo_url),
  };
}

const COLUMNS = "name,slug,primary_color,logo_url,pwa_name,pwa_short_name,pwa_description,pwa_theme_color,pwa_background_color,pwa_icon_url,pwa_enabled";
export type PublicSalon = PwaIdentity & { slug: string };
export type Env = { SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string };

export async function fetchSalon(slug: string, env: Env, fetchImpl: typeof fetch): Promise<PublicSalon | null | "error"> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return "error";
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/salons?select=${COLUMNS}&slug=eq.${encodeURIComponent(slug)}&or=(is_active.is.null,is_active.eq.true)&limit=1`;
  try {
    const res = await fetchImpl(url, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` } });
    if (!res.ok) return "error";
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    return row?.name && row.pwa_enabled !== false ? row : null;
  } catch { return "error"; }
}

export function slugFromRequest(request: Request): string {
  try { return decodeURIComponent(new URL(request.url).pathname.split("/").filter(Boolean).pop() ?? ""); } catch { return ""; }
}

