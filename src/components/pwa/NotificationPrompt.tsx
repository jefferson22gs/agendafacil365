import { useEffect, useState } from 'react';
import { AlertCircle, Bell, BellOff, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTenantApp } from '@/hooks/usePWA';
import { PUSH_NOT_CONFIGURED_MESSAGE, sendPush, usePushNotificationsFCM } from '@/hooks/usePushNotificationsFCM';

const DISMISS_KEY = 'notification-prompt-dismissed';

/**
 * Lembrete global (App.tsx) para o DONO ativar avisos de novo agendamento neste aparelho.
 * Só aparece com dono logado e salão identificado; nunca nas páginas públicas de salão (/s/*),
 * onde o SalonAppCard cuida de instalar/notificar o app do salão.
 */
export const NotificationPrompt = () => {
  const tenantApp = useTenantApp();
  const { isSupported, permission, isSubscribed, slug, subscribe } = usePushNotificationsFCM();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const onPublicSalon = !!tenantApp || (typeof window !== 'undefined' && window.location.pathname.startsWith('/s/'));

  useEffect(() => {
    if (onPublicSalon || !slug || !isSupported || permission !== 'default' || isSubscribed) return;
    let dismissed = false;
    try { dismissed = !!localStorage.getItem(DISMISS_KEY); } catch { /* modo privado */ }
    if (dismissed) return;
    const timer = setTimeout(() => setShow(true), 5000);
    return () => clearTimeout(timer);
  }, [onPublicSalon, slug, isSupported, permission, isSubscribed]);

  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, Date.now().toString()); } catch { /* modo privado */ }
  };

  const enable = async () => {
    setLoading(true);
    const r = await subscribe();
    setLoading(false);
    if (r === 'ok') { toast.success('Avisos de novos agendamentos ativados neste aparelho.'); setShow(false); }
    else if (r === 'denied') { toast.error('Permissão negada pelo navegador.'); setShow(false); }
    else toast.error('Não foi possível ativar as notificações.');
  };

  return (
    <AnimatePresence>
      {show && !onPublicSalon && permission === 'default' && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[90]"
        >
          <Card role="dialog" aria-labelledby="notification-prompt-title" className="relative bg-card border-border shadow-lg overflow-hidden">
            <CardContent className="p-4">
              <button
                type="button"
                onClick={dismiss}
                aria-label="Fechar aviso de notificações"
                className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X size={18} className="text-muted-foreground" aria-hidden="true" />
              </button>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bell size={24} className="text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0 pr-8">
                  <h3 id="notification-prompt-title" className="font-display text-lg font-bold text-foreground mb-1">Avisos de novos agendamentos</h3>
                  <p className="text-sm text-muted-foreground mb-4">Receba um alerta neste aparelho quando um cliente agendar.</p>
                  <div className="flex items-center gap-2">
                    <Button variant="brand" size="sm" onClick={enable} disabled={loading} className="flex-1 h-11">
                      <Bell size={16} className="mr-2" aria-hidden="true" />
                      Ativar
                    </Button>
                    <Button variant="ghost" size="sm" className="h-11" onClick={dismiss} disabled={loading}>Agora não</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** Card de Configurações: o dono ativa os avisos no próprio aparelho e envia um teste real para os seus dispositivos. */
export const NotificationSettings = ({ salonId }: { salonId?: string }) => {
  const { support, permission, isSubscribed, subscribe, unsubscribe } = usePushNotificationsFCM();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);

  const toggle = async () => {
    setLoading(true);
    if (isSubscribed) {
      if (await unsubscribe()) toast.success('Avisos desativados neste aparelho.');
      else toast.error('Não foi possível desativar.');
    } else {
      const r = await subscribe();
      if (r === 'ok') toast.success('Avisos de novos agendamentos ativados neste aparelho.');
      else if (r === 'denied') toast.error('Permissão negada pelo navegador.');
      else toast.error('Não foi possível ativar. Salve o estabelecimento e tente de novo.');
    }
    setLoading(false);
  };

  const test = async () => {
    if (!salonId) return;
    setTesting(true);
    const r = await sendPush({ salon_id: salonId, audience: 'owner', type: 'test', title: 'Notificação de teste', body: 'Tudo certo! Você receberá os avisos de novos agendamentos aqui.', url: '/admin/appointments' });
    setTesting(false);
    setNotConfigured(r.code === 'push_not_configured');
    if (r.ok && r.sent > 0) toast.success('Teste enviado. Confira a notificação no seu aparelho.');
    else if (r.ok) toast.info('Nenhum aparelho seu está inscrito. Ative os avisos primeiro.');
    else toast.error(r.message);
  };

  if (support === 'ios-needs-install') {
    return (
      <div className="flex items-start gap-3 text-sm text-muted-foreground">
        <AlertCircle size={20} className="shrink-0" aria-hidden />
        <p>No iPhone e iPad (iOS 16.4+), adicione o painel à Tela de Início pelo Safari (Compartilhar &gt; Adicionar à Tela de Início) e ative os avisos pelo app instalado.</p>
      </div>
    );
  }
  if (support === 'unsupported') {
    return (
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <AlertCircle size={20} className="shrink-0" aria-hidden />
        <p>Notificações push não são suportadas neste navegador.</p>
      </div>
    );
  }
  if (permission === 'denied') {
    return (
      <div className="flex items-start gap-3">
        <BellOff size={20} className="text-destructive flex-shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="font-medium text-foreground mb-1">Notificações bloqueadas</p>
          <p className="text-sm text-muted-foreground">Libere as notificações nas permissões do site (ícone ao lado do endereço) e recarregue a página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${isSubscribed ? 'bg-success/10' : 'bg-secondary'}`}>
            {isSubscribed ? <Bell size={20} className="text-success" aria-hidden /> : <BellOff size={20} className="text-muted-foreground" aria-hidden />}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground">Avisos neste aparelho</p>
            <p className="text-sm text-muted-foreground">{isSubscribed ? 'Ativados: você recebe os novos agendamentos aqui' : 'Desativados'}</p>
          </div>
        </div>
        <Button variant={isSubscribed ? 'outline' : 'brand'} className="h-11" onClick={toggle} disabled={loading} data-tour="settings-notifications-toggle">
          {loading ? 'Processando…' : isSubscribed ? 'Desativar' : 'Ativar'}
        </Button>
      </div>
      {isSubscribed && (
        <Button variant="ghost" className="h-11 w-full" onClick={test} disabled={testing || !salonId} data-tour="settings-notifications-test">
          <Send size={16} className="mr-2" aria-hidden />
          {testing ? 'Enviando…' : 'Enviar notificação de teste'}
        </Button>
      )}
      {notConfigured && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden />
          {PUSH_NOT_CONFIGURED_MESSAGE} Sua inscrição fica salva e passa a funcionar quando o envio for liberado.
        </p>
      )}
    </div>
  );
};
