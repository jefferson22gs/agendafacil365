// Substitui src/lib/webPush.ts nos modos demo/training (alias em vite.isolation.ts): sem service worker, sem rede.
export const VAPID_PUBLIC_KEY = "";
export interface WebPushKeys { endpoint: string; p256dh: string; auth: string }
export const webPushAvailable = () => false;
export const currentWebPush = async (): Promise<WebPushKeys | null> => null;
export const ensureWebPush = async (): Promise<WebPushKeys | null> => {
  window.dispatchEvent(new CustomEvent("demo:blocked", { detail: "push" }));
  return null;
};
export const legacyFcmToken = async (): Promise<string | null> => null;
export const forgetLegacyFcm = () => undefined;
