// Lógica pura do envio de push (sem Deno, sem rede): testada em tests/rebrand/pwa.test.cjs.

export const STORAGE_ORIGIN = "https://ocbwsaydgkiseeardjga.supabase.co";
export const DEFAULT_ICON = "/pwa-192x192.png";
export const MAX_TARGETS = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_:.\-]{20,4096}$/;

export type Audience = "clients" | "subscribers" | "owner";
export interface Subscription { id: string; user_id: string | null; client_id: string | null; fcm_token: string | null }

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
export const isFcmToken = (v: unknown): v is string => typeof v === "string" && TOKEN.test(v);

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

/**
 * Quem recebe. Sempre dentro do salão (o chamador já filtrou por salon_id).
 *  - owner: só dispositivos do dono (user_id = owner_id).
 *  - clients: só dispositivos vinculados a client_ids informados ([] ou ausente => ninguém). Nunca o dono.
 *  - subscribers: todos os dispositivos inscritos no salão, exceto o dono (campanha para quem ativou os avisos do salão).
 * Token repetido é enviado uma única vez; limite de MAX_TARGETS.
 */
export function selectTargets(subs: Subscription[], opts: { audience: Audience; ownerId: string; clientIds?: unknown }): Subscription[] {
  const ids = new Set(Array.isArray(opts.clientIds) ? opts.clientIds.filter(isUuid) : []);
  const seen = new Set<string>();
  const out: Subscription[] = [];
  for (const s of subs) {
    if (!s.fcm_token || seen.has(s.fcm_token)) continue;
    const isOwner = s.user_id === opts.ownerId;
    const ok = opts.audience === "owner" ? isOwner
      : opts.audience === "subscribers" ? !isOwner
      : !isOwner && !!s.client_id && ids.has(s.client_id);
    if (!ok) continue;
    seen.add(s.fcm_token);
    out.push(s);
    if (out.length >= MAX_TARGETS) break;
  }
  return out;
}

export function parseAudience(value: unknown): Audience {
  return value === "owner" || value === "subscribers" ? value : "clients";
}

/** Falha permanente do FCM (token morto): desativa. Rede/5xx/quota: mantém ativo para tentar de novo. */
export function isPermanentFcmError(status: number, bodyText: string): boolean {
  if (status === 404) return true;
  if (status !== 400) return false;
  try {
    const e = JSON.parse(bodyText)?.error;
    const codes = (e?.details ?? []).map((d: { errorCode?: string }) => d?.errorCode);
    return codes.includes("UNREGISTERED") || e?.status === "NOT_FOUND" || (e?.status === "INVALID_ARGUMENT" && /registration token/i.test(e?.message ?? ""));
  } catch { return false; }
}

export interface PushPayloadInput { title: string; body: string; icon?: unknown; url?: unknown; type?: unknown; salonSlug: string }
/** Mensagem FCM só com `data` (o SW monta a notificação com título/ícone do salão). */
export function buildMessage(token: string, input: PushPayloadInput) {
  const url = safeRelativeUrl(input.url, `/s/${input.salonSlug}`);
  const data = {
    title: cleanText(input.title, 100), body: cleanText(input.body, 300), icon: safeIconUrl(input.icon), url,
    type: cleanText(input.type, 40) || "generic", salon: input.salonSlug,
  };
  return { message: { token, data, webpush: { headers: { Urgency: "high", TTL: "86400" } } } };
}
