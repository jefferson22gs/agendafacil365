// Web Push padrão (sem Firebase): PushManager do navegador + chave pública VAPID do servidor.
// A chave PRIVADA fica só nas Edge Functions (VAPID_PRIVATE_KEY). Demo/treinamento: alias para demo/webPushStub.ts.
import { registerAppServiceWorker } from "./serviceWorker";

export const VAPID_PUBLIC_KEY = "BLJf7B0U5q0alp2G8EMxEBTi2fFqWvAONwP0LYEtdAyNwDmy4qWoeF0WTlDrJd6UNW3V1Ni_u-jMMo5jjYF2SKs";

export interface WebPushKeys { endpoint: string; p256dh: string; auth: string }

const b64url = (buf: ArrayBuffer | null) => {
  if (!buf) return "";
  let s = "";
  new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
};
function keyBytes(): Uint8Array {
  const b64 = VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export const webPushAvailable = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function registration(): Promise<ServiceWorkerRegistration | null> {
  try { return await registerAppServiceWorker("/push-sw.js"); } catch { return null; }
}

const toKeys = (sub: PushSubscription | null): WebPushKeys | null => {
  if (!sub) return null;
  const p256dh = b64url(sub.getKey("p256dh")), auth = b64url(sub.getKey("auth"));
  return p256dh && auth ? { endpoint: sub.endpoint, p256dh, auth } : null;
};
/** Inscrição feita com outra chave (ex.: a do Firebase antigo) não aceita mensagens com a nossa. */
const sameKey = (sub: PushSubscription) => {
  const k = sub.options?.applicationServerKey;
  return !k || b64url(k) === VAPID_PUBLIC_KEY;
};

/** Inscrição atual deste aparelho com a nossa chave; nunca pede permissão nem cria inscrição. */
export async function currentWebPush(): Promise<WebPushKeys | null> {
  if (!webPushAvailable() || Notification.permission !== "granted") return null;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && sameKey(sub) ? toKeys(sub) : null;
}

/**
 * Garante uma inscrição com a nossa chave. Só com permissão já concedida (o pedido acontece no clique, no hook):
 * troca a inscrição antiga do Firebase pela nova sem novo pedido ao usuário.
 */
export async function ensureWebPush(): Promise<WebPushKeys | null> {
  if (!webPushAvailable() || Notification.permission !== "granted") return null;
  const reg = await registration();
  if (!reg) return null;
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub)) { await sub.unsubscribe().catch(() => false); sub = null; }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes() });
  return toKeys(sub);
}

/** Token FCM que o SDK antigo guardou neste aparelho (IndexedDB do Firebase). Usado só para a migração automática. */
export async function legacyFcmToken(): Promise<string | null> {
  try {
    if (typeof indexedDB === "undefined" || !indexedDB.databases) return null;
    if (!(await indexedDB.databases()).some((d) => d.name === "firebase-messaging-database")) return null;
    const db = await new Promise<IDBDatabase>((ok, fail) => {
      const r = indexedDB.open("firebase-messaging-database");
      r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error);
    });
    try {
      if (!db.objectStoreNames.contains("firebase-messaging-store")) return null;
      const all = await new Promise<unknown[]>((ok, fail) => {
        const r = db.transaction("firebase-messaging-store", "readonly").objectStore("firebase-messaging-store").getAll();
        r.onsuccess = () => ok(r.result as unknown[]); r.onerror = () => fail(r.error);
      });
      const token = (all.find((v) => typeof (v as { token?: unknown })?.token === "string") as { token?: string } | undefined)?.token;
      return token ?? null;
    } finally { db.close(); }
  } catch { return null; }
}

/** Remove os dados do SDK antigo depois da migração (não guarda mais o token FCM). */
export function forgetLegacyFcm() {
  try { indexedDB.deleteDatabase("firebase-messaging-database"); } catch { /* sem IndexedDB */ }
}
