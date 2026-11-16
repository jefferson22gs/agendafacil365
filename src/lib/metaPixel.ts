// Pixel da Meta só com consentimento (LGPD). Sem VITE_META_PIXEL_ID nada é carregado.
// Cada evento leva event_id: o servidor (meta-capi) envia o mesmo id e a Meta deduplica.
// ponytail: só PageView, Lead, CompleteRegistration e Contact; adicionar outros eventos quando houver campanha que os use.
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[]; loaded: boolean; version: string; push: unknown };

// ID do Pixel é público (vai no HTML de qualquer site que o usa). A variável sobrescreve; o modo demo nunca carrega.
const PIXEL_ID = import.meta.env.MODE === "demo" || import.meta.env.MODE === "training" ? "" : String(import.meta.env.VITE_META_PIXEL_ID || "1447922076809128").trim();
const KEY = "af365_ads_consent";
export type Consent = "granted" | "denied" | null;
export type MetaEvent = "PageView" | "Lead" | "CompleteRegistration" | "Contact";

export const pixelEnabled = () => /^\d{10,20}$/.test(PIXEL_ID);
export function readConsent(): Consent {
  try { const v = localStorage.getItem(KEY); return v === "granted" || v === "denied" ? v : null; } catch { return null; }
}
let started = false;
function start() {
  if (started || !pixelEnabled() || typeof window === "undefined") return;
  started = true;
  const w = window as unknown as { fbq?: Fbq; _fbq?: Fbq };
  if (!w.fbq) {
    const f = function (...args: unknown[]) { if (f.callMethod) f.callMethod(...args); else f.queue.push(args); } as Fbq;
    f.queue = []; f.loaded = true; f.version = "2.0"; f.push = f;
    w.fbq = f; w._fbq = f;
    const s = document.createElement("script");
    s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  w.fbq!("init", PIXEL_ID);
  w.fbq!("track", "PageView");
}
export function setConsent(v: "granted" | "denied") {
  try { localStorage.setItem(KEY, v); } catch { /* navegador sem armazenamento: vale só nesta visita */ }
  if (v === "granted") start();
}
/** Chamado na abertura do app: só carrega se a pessoa já aceitou antes. */
export function initPixel() { if (readConsent() === "granted") start(); }

/** Evento no navegador + mesmo evento pelo servidor (Conversions API). Sem consentimento, não envia nada. */
export function track(event: Exclude<MetaEvent, "PageView">, data: { email?: string; phone?: string } = {}) {
  if (!pixelEnabled() || readConsent() !== "granted") return;
  const eventId = crypto.randomUUID();
  (window as unknown as { fbq?: Fbq }).fbq?.("track", event, {}, { eventID: eventId });
  const url = `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "")}/functions/v1/meta-capi`;
  const cookie = (n: string) => document.cookie.split("; ").find(c => c.startsWith(`${n}=`))?.slice(n.length + 1) ?? null;
  // keepalive: o evento sai mesmo se a página navegar logo depois (cadastro redireciona).
  void fetch(url, {
    method: "POST", keepalive: true, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, eventId, url: location.href, email: data.email ?? null, phone: data.phone ?? null, fbp: cookie("_fbp"), fbc: cookie("_fbc") }),
  }).catch(() => undefined);
}
