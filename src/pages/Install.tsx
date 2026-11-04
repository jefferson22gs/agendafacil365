import { useState } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Smartphone, 
  Monitor, 
  Share, 
  MoreVertical, 
  Plus, 
  Download, 
  Check, 
  ChevronRight,
  Chrome,
  ArrowLeft
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { BRAND } from '@/config/brand';

const Install = () => {
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [activeTab, setActiveTab] = useState<'ios' | 'android' | 'desktop'>('ios');

  const handleInstall = async () => {
    const success = await installApp();
    if (!success) {
      // Browser doesn't support direct install, show instructions
    }
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-success/10 flex items-center justify-center">
            <Check size={40} className="text-success" aria-hidden="true" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            App Instalado!
          </h1>
          <p className="text-muted-foreground mb-6">
            O {BRAND.name} já está instalado no seu dispositivo
          </p>
          <Button asChild variant="brand" size="lg">
            <Link to="/">Ir para o app</Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            to="/"
            aria-label="Voltar ao início"
            className="flex h-11 w-11 -ml-2 items-center justify-center rounded-xl hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft size={24} aria-hidden="true" />
          </Link>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Instalar {BRAND.name}</h1>
            <p className="text-sm text-muted-foreground">Tenha o app na sua tela inicial</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-8"
        >
          <img src={BRAND.assets.appIcon} alt="" aria-hidden="true" className="w-24 h-24 mx-auto mb-6 rounded-3xl shadow-md" />
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">
            Instale o {BRAND.name}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Acesse rapidamente, receba notificações e use offline
          </p>
        </motion.div>

        {/* Direct Install Button (if available) */}
        {isInstallable && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-primary/30 bg-card">
              <CardContent className="p-6 text-center">
                <p className="text-foreground mb-4 font-medium">
                  Seu navegador suporta instalação direta!
                </p>
                <Button variant="brand" size="lg" onClick={handleInstall} className="w-full max-w-xs">
                  <Download size={20} className="mr-2" aria-hidden="true" />
                  Instalar Agora
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Platform Tabs */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 hide-scrollbar" role="group" aria-label="Escolha seu dispositivo">
            {([
              { id: 'ios', label: 'iPhone / iPad', icon: Smartphone },
              { id: 'android', label: 'Android', icon: Smartphone },
              { id: 'desktop', label: 'Computador', icon: Monitor },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-11 items-center gap-2 px-4 py-3 rounded-xl whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                <tab.icon size={18} aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* iOS Instructions */}
          {activeTab === 'ios' && (
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone size={20} className="text-primary" />
                  Instalação no iPhone / iPad
                </CardTitle>
                <CardDescription>
                  Use o Safari para instalar o app
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <InstallStep 
                  number={1}
                  title="Abra no Safari"
                  description="Certifique-se de estar usando o navegador Safari"
                  icon={<Chrome size={20} />}
                />
                <InstallStep 
                  number={2}
                  title="Toque no botão Compartilhar"
                  description="Na barra inferior, toque no ícone de compartilhamento (quadrado com seta)"
                  icon={<Share size={20} />}
                />
                <InstallStep 
                  number={3}
                  title="Role e toque em 'Adicionar à Tela de Início'"
                  description="Pode ser necessário rolar para encontrar esta opção"
                  icon={<Plus size={20} />}
                />
                <InstallStep 
                  number={4}
                  title="Confirme tocando em 'Adicionar'"
                  description="O app será adicionado à sua tela inicial"
                  icon={<Check size={20} />}
                />
              </CardContent>
            </Card>
          )}

          {/* Android Instructions */}
          {activeTab === 'android' && (
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone size={20} className="text-primary" />
                  Instalação no Android
                </CardTitle>
                <CardDescription>
                  Use o Chrome para instalar o app
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <InstallStep 
                  number={1}
                  title="Abra no Chrome"
                  description="Certifique-se de estar usando o navegador Chrome"
                  icon={<Chrome size={20} />}
                />
                <InstallStep 
                  number={2}
                  title="Toque no menu (⋮)"
                  description="No canto superior direito, toque nos três pontos verticais"
                  icon={<MoreVertical size={20} />}
                />
                <InstallStep 
                  number={3}
                  title="Selecione 'Instalar app' ou 'Adicionar à tela inicial'"
                  description="Pode aparecer também um banner na parte inferior"
                  icon={<Download size={20} />}
                />
                <InstallStep 
                  number={4}
                  title="Confirme a instalação"
                  description="Toque em 'Instalar' ou 'Adicionar'"
                  icon={<Check size={20} />}
                />
              </CardContent>
            </Card>
          )}

          {/* Desktop Instructions */}
          {activeTab === 'desktop' && (
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor size={20} className="text-primary" />
                  Instalação no Computador
                </CardTitle>
                <CardDescription>
                  Use Chrome, Edge ou outros navegadores compatíveis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <InstallStep 
                  number={1}
                  title="Procure o ícone de instalação"
                  description="Na barra de endereços, procure um ícone de download ou computador"
                  icon={<Download size={20} />}
                />
                <InstallStep 
                  number={2}
                  title="Clique no ícone de instalação"
                  description={`Ou use o menu do navegador (⋮) > 'Instalar ${BRAND.name}'`}
                  icon={<MoreVertical size={20} />}
                />
                <InstallStep 
                  number={3}
                  title="Confirme clicando em 'Instalar'"
                  description="O app será instalado como um aplicativo no seu computador"
                  icon={<Check size={20} />}
                />
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-display text-lg font-bold text-foreground mb-4">
            Vantagens do App
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { title: 'Acesso rápido', description: 'Abra direto da tela inicial' },
              { title: 'Notificações', description: 'Receba lembretes de agendamentos' },
              { title: 'Funciona offline', description: 'Veja sua agenda sem internet' },
              { title: 'Tela cheia', description: 'Experiência de app nativo' },
            ].map((benefit, index) => (
              <Card key={index} className="bg-card">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{benefit.title}</p>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

// Step component for installation instructions
const InstallStep = ({ 
  number, 
  title, 
  description, 
  icon 
}: { 
  number: number; 
  title: string; 
  description: string; 
  icon: React.ReactNode;
}) => (
  <div className="flex items-start gap-4 p-4 bg-secondary/30 rounded-xl">
    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
      {number}
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <h4 className="font-medium text-foreground">{title}</h4>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
    <ChevronRight size={20} className="text-muted-foreground flex-shrink-0 mt-2" />
  </div>
);

export default Install;
