import { useState, useEffect } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { Button } from '@/components/ui/button';
import { X, Download, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BRAND, DEFAULT_TENANT_COLOR, safeHexColor } from '@/config/brand';

interface SalonInstallPromptProps {
  salonName: string;
  salonSlug: string;
  salonLogo?: string;
  salonThemeColor?: string;
}

export const SalonInstallPrompt = ({
  salonName,
  salonSlug,
  salonLogo,
  salonThemeColor = DEFAULT_TENANT_COLOR
}: SalonInstallPromptProps) => {
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user dismissed this salon's install prompt
    const dismissKey = `pwa-install-dismissed-${salonSlug}`;
    const wasDismissed = localStorage.getItem(dismissKey);

    if (wasDismissed) {
      const dismissedTime = parseInt(wasDismissed);
      // Show again after 7 days
      if (Date.now() - dismissedTime > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem(dismissKey);
      } else {
        setDismissed(true);
      }
    }
  }, [salonSlug]);

  useEffect(() => {
    // Manifest dinâmico do estabelecimento enquanto o componente está montado.
    // Guarda o estado original e restaura no cleanup para não "vazar" para outras rotas.
    const themeColor = safeHexColor(salonThemeColor);
    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const previousHref = manifestLink?.getAttribute('href') ?? null;
    let manifestURL: string | null = null;

    if (manifestLink) {
      const manifestData = {
        name: `${salonName} - Agendamento`,
        short_name: salonName,
        description: `Agende seus serviços no ${salonName}`,
        theme_color: themeColor,
        background_color: '#FFFFFF',
        display: 'standalone',
        orientation: 'portrait',
        scope: `/s/${salonSlug}/`,
        start_url: `/s/${salonSlug}?source=pwa`,
        icons: [
          // Logo do estabelecimento só como "any" (comportamento anterior); senão, ícones padrão.
          { src: salonLogo || BRAND.assets.icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: salonLogo || BRAND.assets.icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          // Maskable nunca usa logo arbitrário (sem garantia de safe zone).
          { src: BRAND.assets.maskable512, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      };
      manifestURL = URL.createObjectURL(new Blob([JSON.stringify(manifestData)], { type: 'application/json' }));
      manifestLink.href = manifestURL;
    }

    let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const createdMeta = !themeColorMeta;
    const previousThemeColor = themeColorMeta?.getAttribute('content') ?? null;
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.content = themeColor;

    return () => {
      // Só restaura se ninguém trocou o href depois de nós.
      if (manifestLink && manifestURL && manifestLink.getAttribute('href') === manifestURL) {
        if (previousHref !== null) manifestLink.setAttribute('href', previousHref);
        else manifestLink.removeAttribute('href');
      }
      if (manifestURL) URL.revokeObjectURL(manifestURL);
      if (themeColorMeta && themeColorMeta.content === themeColor) {
        if (createdMeta) themeColorMeta.remove();
        else if (previousThemeColor !== null) themeColorMeta.content = previousThemeColor;
      }
    };
  }, [salonName, salonSlug, salonLogo, salonThemeColor]);

  useEffect(() => {
    if (isInstallable && !isInstalled && !dismissed) {
      // Show prompt after 5 seconds on salon page
      const timer = setTimeout(() => setShowPrompt(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled, dismissed]);

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      setShowPrompt(false);
      // Store that user installed this salon's app
      localStorage.setItem(`pwa-installed-${salonSlug}`, Date.now().toString());
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem(`pwa-install-dismissed-${salonSlug}`, Date.now().toString());
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[99] glass-card rounded-2xl p-4 border border-primary/20 shadow-brand"
        >
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Fechar aviso de instalação"
            className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors"
          >
            <X size={18} className="text-muted-foreground" aria-hidden="true" />
          </button>

          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: safeHexColor(salonThemeColor) }}
            >
              {salonLogo ? (
                <img src={salonLogo} alt="" className="w-full h-full object-cover" />
              ) : (
                <Smartphone size={24} className="text-white" />
              )}
            </div>

            <div className="flex-1 min-w-0 pr-8">
              <h3 className="font-display text-lg font-bold text-foreground mb-1">
                Instalar {salonName}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Instale o app para agendar rapidamente e receber notificações
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="brand"
                  size="sm"
                  onClick={handleInstall}
                  className="flex-1"
                >
                  <Download size={16} className="mr-2" />
                  Instalar App
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
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
  );
};
