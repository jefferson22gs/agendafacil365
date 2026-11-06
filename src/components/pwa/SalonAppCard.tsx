import { useEffect, useState } from 'react';
import { Bell, BellOff, Check, Download, Share, SquarePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { isIOSDevice, isIOSSafari, setTenantApp, usePWA } from '@/hooks/usePWA';
import { usePushNotificationsFCM } from '@/hooks/usePushNotificationsFCM';
import { textOnColor } from '../../../api/_pwa';
import { safeHexColor } from '@/config/brand';

interface SalonAppCardProps {
  salonName: string;
  salonSlug: string;
  logoUrl?: string | null;
  color?: string | null;
  /** Salão desligou o app próprio: nada de instalar/notificar. */
  enabled?: boolean;
}

const DISMISS_DAYS = 14;
const dismissKey = (slug: string) => `af365:salon-app-dismissed:${slug}`;
const readDismissed = (slug: string) => {
  try { return Date.now() - Number(localStorage.getItem(dismissKey(slug)) || 0) < DISMISS_DAYS * 864e5; } catch { return false; }
};

/**
 * Experiência única na página pública do salão: instalar o app do salão (Chrome/Edge/Android via
 * beforeinstallprompt; iOS com instruções do Safari) e ativar notificações daquele salão.
 * Substitui os antigos SalonInstallPrompt/NotificationPrompt nesta página (sem prompts duplicados).
 */
export function SalonAppCard({ salonName, salonSlug, logoUrl, color, enabled = true }: SalonAppCardProps) {
  const demo = import.meta.env.MODE === 'demo';
  const { isInstallable, isInstalled, installApp } = usePWA();
  const push = usePushNotificationsFCM(salonSlug);
  const [dismissed, setDismissed] = useState(() => readDismissed(salonSlug));
  const [showIOS, setShowIOS] = useState(false);
  const [busy, setBusy] = useState(false);
  const bg = safeHexColor(color);
  const fg = textOnColor(bg);

  // Marca a página como "app do salão": o prompt global de instalar a plataforma não aparece aqui.
  useEffect(() => { setTenantApp(salonSlug); return () => setTenantApp(null); }, [salonSlug]);

  if (!enabled || dismissed) return null;

  const ios = isIOSDevice();
  const canInstall = !isInstalled && (isInstallable || ios || demo);
  const notifState = demo ? 'demo'
    : push.support === 'ios-needs-install' ? 'ios-install-first'
    : push.support === 'unsupported' ? 'unsupported'
    : push.isSubscribed ? 'subscribed'
    : push.permission === 'denied' ? 'denied' : 'available';
  // Nada útil a oferecer: não ocupa espaço.
  if (!canInstall && (notifState === 'subscribed' || notifState === 'unsupported') && !isInstalled) return null;
  if (isInstalled && (notifState === 'subscribed' || notifState === 'unsupported')) return null;

  const dismiss = () => {
    try { localStorage.setItem(dismissKey(salonSlug), String(Date.now())); } catch { /* modo privado */ }
    setDismissed(true);
  };

  const onInstall = async () => {
    if (demo) { toast.info('Na demonstração o app não é instalado.'); return; }
    if (isInstallable) {
      const ok = await installApp();
      if (ok) toast.success(`App de ${salonName} instalado.`);
      return;
    }
    setShowIOS(v => !v);
  };

  const onNotify = async () => {
    if (demo) { toast.info('Na demonstração nenhuma notificação é ativada.'); return; }
    setBusy(true);
    const r = await push.subscribe();
    setBusy(false);
    if (r === 'ok') toast.success(`Pronto! Você vai receber avisos de ${salonName}.`);
    else if (r === 'denied') toast.error('Permissão negada. Veja abaixo como reativar.');
    else toast.error('Não foi possível ativar agora. Tente novamente.');
  };

  return (
    <section
      aria-labelledby="salon-app-title"
      className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-start gap-3 p-4 pr-12" style={{ backgroundColor: bg, color: fg }}>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/90">
          {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            : <span className="text-xl font-bold" style={{ color: bg }} aria-hidden>{salonName.charAt(0).toUpperCase()}</span>}
        </div>
        <div className="min-w-0">
          <h2 id="salon-app-title" className="font-display text-base font-bold leading-tight break-words">
            {isInstalled ? `App de ${salonName}` : `Instale o app de ${salonName}`}
          </h2>
          <p className="mt-1 text-sm opacity-90">Agende em um toque e receba avisos de horários e novidades.</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar aviso do app"
          className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          {canInstall && (
            <Button
              type="button"
              onClick={onInstall}
              className="h-11 flex-1"
              style={{ backgroundColor: bg, color: fg }}
              aria-expanded={!isInstallable && !demo ? showIOS : undefined}
              aria-controls={!isInstallable && !demo ? 'salon-app-ios-steps' : undefined}
            >
              <Download size={16} aria-hidden />
              {isInstallable || demo ? 'Instalar app' : 'Como instalar'}
            </Button>
          )}
          {isInstalled && (
            <p className="flex h-11 flex-1 items-center gap-2 text-sm text-muted-foreground"><Check size={16} aria-hidden /> App instalado neste aparelho</p>
          )}
          {(notifState === 'available' || notifState === 'demo') && (
            <Button type="button" variant="outline" onClick={onNotify} disabled={busy} className="h-11 flex-1">
              <Bell size={16} aria-hidden />
              {busy ? 'Ativando…' : 'Ativar notificações'}
            </Button>
          )}
          {notifState === 'subscribed' && (
            <p className="flex h-11 flex-1 items-center gap-2 text-sm text-muted-foreground"><Bell size={16} aria-hidden /> Notificações ativadas</p>
          )}
        </div>

        {showIOS && !isInstallable && (
          <ol id="salon-app-ios-steps" className="list-decimal space-y-1 rounded-xl bg-secondary/50 p-3 pl-8 text-sm text-foreground">
            {ios && !isIOSSafari() && <li>Abra esta página no <strong>Safari</strong>.</li>}
            {ios ? (
              <>
                <li>Toque em <strong>Compartilhar</strong> <Share size={14} className="inline align-text-bottom" aria-label="ícone Compartilhar" />.</li>
                <li>Escolha <strong>Adicionar à Tela de Início</strong> <SquarePlus size={14} className="inline align-text-bottom" aria-hidden />.</li>
                <li>Toque em <strong>Adicionar</strong>. O app de {salonName} aparece na sua tela inicial.</li>
              </>
            ) : (
              <li>No menu do navegador (⋮), escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
            )}
          </ol>
        )}

        {notifState === 'ios-install-first' && (
          <p className="text-sm text-muted-foreground">
            No iPhone e iPad (iOS 16.4 ou mais recente), as notificações funcionam depois de instalar o app pela Tela de Início. Abra o app instalado e ative por lá.
          </p>
        )}
        {notifState === 'denied' && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground" role="status">
            <BellOff size={16} className="mt-0.5 shrink-0" aria-hidden />
            Notificações bloqueadas. Para reativar, abra as permissões do site (ícone ao lado do endereço ou Ajustes do aparelho), permita Notificações e recarregue a página.
          </p>
        )}
        {notifState === 'unsupported' && !isInstalled && (
          <p className="text-sm text-muted-foreground">Este navegador não recebe notificações. Você ainda pode instalar o app e agendar normalmente.</p>
        )}
      </div>
    </section>
  );
}
