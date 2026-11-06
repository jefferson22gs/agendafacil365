import { useEffect, useState, useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

// Estado único da página: o evento pode chegar antes de qualquer componente montar e só pode ser usado uma vez.
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const standalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

if (typeof window !== 'undefined' && import.meta.env.MODE !== 'demo') {
  installed = standalone();
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BeforeInstallPromptEvent; emit(); });
  window.addEventListener('appinstalled', () => { installed = true; deferred = null; emit(); });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };

// Página de um salão aberta: o app instalável é o DO SALÃO. Prompts globais da plataforma ficam ocultos.
let tenantApp: string | null = null;
export const setTenantApp = (slug: string | null) => { tenantApp = slug; emit(); };
export const useTenantApp = () => useSyncExternalStore(subscribe, () => tenantApp, () => null);

export const isIOSDevice = () =>
  typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
/** Safari no iOS (Chrome/Firefox/Edge no iOS também instalam pelo menu Compartilhar desde o iOS 16.4, mas o Safari é o caminho garantido). */
export const isIOSSafari = () => isIOSDevice() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);

export const usePWA = () => {
  const isInstallable = useSyncExternalStore(subscribe, () => !!deferred, () => false);
  const isInstalled = useSyncExternalStore(subscribe, () => installed, () => false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true), off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const installApp = async () => {
    const event = deferred;
    if (!event) return false;
    deferred = null; // prompt() só pode ser chamado uma vez por evento
    emit();
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === 'accepted') { installed = true; emit(); }
      return outcome === 'accepted';
    } catch {
      return false;
    }
  };

  return { isInstallable, isInstalled, isOnline, installApp };
};
