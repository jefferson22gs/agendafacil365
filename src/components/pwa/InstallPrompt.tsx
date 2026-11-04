import { useState, useEffect } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { Button } from '@/components/ui/button';
import { X, Download, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BRAND } from '@/config/brand';

export const InstallPrompt = () => {
  const { isInstallable, isInstalled, isOnline, installApp } = usePWA();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const wasDismissed = localStorage.getItem('pwa-install-dismissed');
    if (wasDismissed) {
      const dismissedTime = parseInt(wasDismissed);
      // Show again after 3 days
      if (Date.now() - dismissedTime > 3 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem('pwa-install-dismissed');
      } else {
        setDismissed(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isInstallable && !isInstalled && !dismissed) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled, dismissed]);

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  return (
    <>
      {/* Offline Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            role="status"
            aria-live="polite"
            className="fixed top-0 left-0 right-0 z-[100] bg-warning text-warning-foreground py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium text-center"
          >
            <WifiOff size={16} className="flex-shrink-0" aria-hidden="true" />
            <span>Você está offline. Alguns recursos podem estar indisponíveis.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Install Prompt */}
      <AnimatePresence>
        {showPrompt && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            role="dialog"
            aria-labelledby="install-prompt-title"
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[99] rounded-2xl bg-card p-4 border border-border shadow-lg"
          >
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Fechar aviso de instalação"
              className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={18} className="text-muted-foreground" aria-hidden="true" />
            </button>

            <div className="flex items-start gap-4">
              <img src={BRAND.assets.appIcon} alt="" aria-hidden="true" className="w-12 h-12 rounded-xl flex-shrink-0" />

              <div className="flex-1 min-w-0 pr-8">
                <h3 id="install-prompt-title" className="font-display text-lg font-bold text-foreground mb-1">
                  Instalar {BRAND.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Instale o app para acesso rápido e funcionamento offline
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="brand"
                    size="sm"
                    onClick={handleInstall}
                    className="flex-1 h-11"
                  >
                    <Download size={16} className="mr-2" aria-hidden="true" />
                    Instalar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11"
                    onClick={handleDismiss}
                  >
                    Agora não
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
