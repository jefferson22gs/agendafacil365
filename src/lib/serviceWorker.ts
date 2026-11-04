/**
 * Só pode existir um service worker por scope. Em produção o VitePWA registra `/sw.js` (precache + offline)
 * e esse worker já importa `firebase-messaging-sw.js` (handlers de push/clique). Registrar outro arquivo em "/"
 * substituiria o worker de precache; por isso o app reutiliza o mesmo URL.
 * Em desenvolvimento o VitePWA não gera worker: cai no arquivo de push indicado.
 */
export const APP_SW_URL = "/sw.js";

export async function registerAppServiceWorker(devFallbackUrl: string): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const url = import.meta.env.PROD ? APP_SW_URL : devFallbackUrl;
  const registration = await navigator.serviceWorker.register(url, { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration;
}
