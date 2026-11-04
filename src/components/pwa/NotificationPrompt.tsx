import { useState, useEffect } from 'react';
import { usePushNotificationsFCM } from '@/hooks/usePushNotificationsFCM';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, BellOff, X, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface NotificationPromptProps {
  salonId?: string;
  clientId?: string;
  onDismiss?: () => void;
}

export const NotificationPrompt = ({ salonId, clientId, onDismiss }: NotificationPromptProps) => {
  const {
    isSupported,
    permission,
    isSubscribed,
    subscribe,
    unsubscribe
  } = usePushNotificationsFCM(salonId, clientId);

  const [showPrompt, setShowPrompt] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('📱 NotificationPrompt montado');
    console.log('   salonId recebido:', salonId || 'undefined');
    console.log('   isSupported:', isSupported);
    console.log('   permission:', permission);

    // Show prompt after a delay if notifications are supported and not decided
    if (isSupported && permission === 'default') {
      const dismissed = localStorage.getItem('notification-prompt-dismissed');
      console.log('   dismissed?:', dismissed ? 'sim' : 'não');
      if (!dismissed) {
        console.log('   ⏰ Timer de 5s iniciado para mostrar prompt');
        const timer = setTimeout(() => {
          console.log('   ✅ Mostrando prompt de notificações');
          setShowPrompt(true);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [isSupported, permission, salonId]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const subscription = await subscribe();
      if (subscription) {
        toast.success('Notificações ativadas com sucesso!');
        setShowPrompt(false);
      } else {
        toast.error('Não foi possível ativar as notificações');
      }
    } catch (error) {
      toast.error('Erro ao ativar notificações');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      await unsubscribe();
      toast.success('Notificações desativadas');
    } catch (error) {
      toast.error('Erro ao desativar notificações');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('notification-prompt-dismissed', Date.now().toString());
    onDismiss?.();
  };

  if (!isSupported) return null;

  return (
    <AnimatePresence>
      {showPrompt && permission === 'default' && (
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
                onClick={handleDismiss}
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
                  <h3 id="notification-prompt-title" className="font-display text-lg font-bold text-foreground mb-1">
                    Ativar notificações?
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Receba lembretes de agendamentos e atualizações importantes
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="brand"
                      size="sm"
                      onClick={handleEnable}
                      disabled={loading}
                      className="flex-1 h-11"
                    >
                      <Bell size={16} className="mr-2" aria-hidden="true" />
                      Ativar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-11"
                      onClick={handleDismiss}
                      disabled={loading}
                    >
                      Agora não
                    </Button>
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

// Settings component for notification management
export const NotificationSettings = () => {
  const {
    isSupported,
    permission,
    isSubscribed,
    subscribe,
    unsubscribe,
  } = usePushNotificationsFCM();

  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (isSubscribed) {
        await unsubscribe();
        toast.success('Notificações desativadas');
      } else {
        const subscription = await subscribe();
        if (subscription) {
          toast.success('Notificações ativadas!');
          // O FCM vai mostrar uma notificação de teste automaticamente
        }
      }
    } catch (error) {
      toast.error('Erro ao alterar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    // Mostrar toast como feedback - notificação real virá via push
    toast.info('Notificações estão ativadas!', {
      description: 'Você receberá notificações do estabelecimento.',
    });
  };

  if (!isSupported) {
    return (
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <AlertCircle size={20} />
            <p className="text-sm">Notificações push não são suportadas neste navegador</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (permission === 'denied') {
    return (
      <Card className="glass-card border-destructive/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <BellOff size={20} className="text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground mb-1">Notificações bloqueadas</p>
              <p className="text-sm text-muted-foreground">
                Você bloqueou as notificações. Para ativá-las, acesse as configurações do seu navegador.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSubscribed ? 'bg-success/10' : 'bg-secondary'
              }`}>
              {isSubscribed ? (
                <Bell size={20} className="text-success" />
              ) : (
                <BellOff size={20} className="text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-medium text-foreground">Notificações Push</p>
              <p className="text-sm text-muted-foreground">
                {isSubscribed ? 'Ativadas' : 'Desativadas'}
              </p>
            </div>
          </div>

          <Button
            variant={isSubscribed ? 'outline' : 'brand'}
            size="sm"
            onClick={handleToggle}
            disabled={loading}
          >
            {loading ? (
              'Processando...'
            ) : isSubscribed ? (
              'Desativar'
            ) : (
              'Ativar'
            )}
          </Button>
        </div>

        {isSubscribed && (
          <div className="mt-4 pt-4 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTestNotification}
              className="w-full"
            >
              Enviar notificação de teste
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
