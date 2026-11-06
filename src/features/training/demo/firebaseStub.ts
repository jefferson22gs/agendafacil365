// Substitui src/lib/firebase.ts nos modos demo/training (alias em vite.isolation.ts): sem SDK, sem rede, sem service worker.
export const getMessagingInstance = async () => null;
export const requestFCMToken = async (): Promise<string | null> => {
  window.dispatchEvent(new CustomEvent("demo:blocked", { detail: "push" }));
  return null;
};
export const currentFCMToken = async (): Promise<string | null> => null;
export const onForegroundMessage = (_callback: (payload: unknown) => void) => undefined;
export const app = null;
