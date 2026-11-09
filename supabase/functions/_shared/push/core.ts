// Lógica pura do push (sem Deno, sem rede): testada em tests/rebrand/push-full.test.cjs e pwa.test.cjs.

export const STORAGE_ORIGIN = "https://ocbwsaydgkiseeardjga.supabase.co";
export const DEFAULT_ICON = "/pwa-192x192.png";
/** Payload cifrado cabe em 1 registro de 4096 bytes; serviços de push aceitam ~4 KB. Margem para o JSON. */
export const MAX_PAYLOAD_BYTES = 3000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/**
 * Endpoint de push aceito (o servidor faz POST nele: lista fechada evita SSRF).
 * Chrome/Android: fcm.googleapis.com · Firefox: updates.push.services.mozilla.com · Edge: *.notify.windows.com · Safari/iOS: web.push.apple.com.
 * Mesma regra na RPC register_web_push (migração 20261109000200).
 */
export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 30 || value.length > 2048) return false;
  let u: URL;
  try { u = new URL(value); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  const h = u.hostname.toLowerCase();
  return h === "fcm.googleapis.com" || h === "updates.push.services.mozilla.com" || h === "web.push.apple.com" ||
    /^[a-z0-9-]+(\.[a-z0-9-]+)*\.notify\.windows\.com$/.test(h);
}

/** Só caminho relativo do próprio site: "/x", sem "//", "\\", esquema, controle ou "..". Qualquer outro valor cai no fallback. */
export function safeRelativeUrl(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) return fallback;
  if (!/^\/(?![/\\])[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/.test(value)) return fallback;
  if (value.split(/[?#]/)[0].split("/").some(s => s === ".." || s === ".")) return fallback;
  return value;
}

/** Ícone da notificação: só imagem do Storage público do projeto; senão o PNG da plataforma. */
export function safeIconUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) return DEFAULT_ICON;
  try {
    const u = new URL(value);
    const ok = u.origin === STORAGE_ORIGIN && !u.username && !u.password && u.pathname.startsWith("/storage/v1/object/public/") && /\.(png|jpe?g|webp)$/i.test(u.pathname);
    return ok ? u.href : DEFAULT_ICON;
  } catch { return DEFAULT_ICON; }
}

export function cleanText(value: unknown, max: number): string {
  // deno-lint-ignore no-control-regex
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}

export const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$/;

/** Destino padrão por tipo de aviso (o banco já grava a URL; isto é a rede de segurança). */
export function defaultUrl(kind: string, salonSlug: string, appointmentId?: string | null): string {
  switch (kind) {
    case "new_appointment": case "appointment_cancelled": case "appointment_rescheduled": case "test": return "/admin/appointments";
    case "whatsapp_human": case "payment_proof": return "/admin/whatsapp?aba=conversas";
    case "new_review": return "/admin/reviews";
    case "review_request": return isUuid(appointmentId) ? `/avaliar/${appointmentId}` : `/s/${salonSlug}`;
    default: return `/s/${salonSlug}`;
  }
}

export interface PushPayloadInput {
  title: unknown; body: unknown; url?: unknown; icon?: unknown; kind?: unknown; tag?: unknown; salonSlug: string; appointmentId?: string | null;
}
/** JSON lido pelo service worker (public/push-sw.js). Pequeno, sem dado pessoal além do texto do aviso. */
export function buildPayload(input: PushPayloadInput) {
  const kind = cleanText(input.kind, 40) || "generic";
  const slug = SLUG.test(input.salonSlug) ? input.salonSlug : "";
  const payload = {
    title: cleanText(input.title, 100) || "Agenda Fácil 365",
    body: cleanText(input.body, 300),
    url: safeRelativeUrl(input.url, defaultUrl(kind, slug, input.appointmentId)),
    icon: safeIconUrl(input.icon),
    tag: cleanText(input.tag, 80) || `${kind}:${slug}`,
    kind,
    salon: slug,
  };
  return payload;
}
export const payloadBytes = (p: unknown) => new TextEncoder().encode(JSON.stringify(p)).length;

export type PushOutcome = "ok" | "gone" | "too_large" | "retry" | "auth_error" | "rejected";
/**
 * Resposta do serviço de push (RFC 8030):
 * 201/200/202 entregue · 404/410 inscrição morta (desativar) · 413 payload grande · 429/5xx tentar de novo depois ·
 * 401/403 chave VAPID recusada (configuração; não desativa a inscrição) · demais 4xx recusado.
 */
export function classifyPushResponse(status: number): PushOutcome {
  if (status >= 200 && status < 300) return "ok";
  if (status === 404 || status === 410) return "gone";
  if (status === 413) return "too_large";
  if (status === 429 || status >= 500) return "retry";
  if (status === 401 || status === 403) return "auth_error";
  return "rejected";
}

/** Backoff exponencial (minutos) entre tentativas do worker: 1, 2, 4, 8, 16 (teto 30). */
export const backoffMinutes = (attempt: number) => Math.min(30, 2 ** Math.max(0, attempt - 1));

/** Marketing: no máximo N campanhas push por salão a cada 24 h. */
export const MARKETING_DAILY_LIMIT = 3;
