import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
    Lock,
    CreditCard,
    Clock,
    AlertTriangle,
    Sparkles,
    Crown,
    ArrowRight,
    RefreshCw,
    X
} from "lucide-react";
import { BRAND, displayPlanName } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSubscription } from "@/hooks/useSubscription";
import { Logo } from "@/components/icons/Logo";

interface PaywallProps {
    children: React.ReactNode;
}

export const Paywall = ({ children }: PaywallProps) => {
    const { subscription, isLoading, isBlocked, checkSubscription } = useSubscription();
    const navigate = useNavigate();

    // Show loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center" role="status" aria-live="polite">
                    <div aria-hidden="true" className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-primary border-t-transparent animate-spin motion-reduce:animate-none" />
                    <p className="text-muted-foreground">Verificando assinatura...</p>
                </div>
            </div>
        );
    }

    // If subscription is active, show children
    if (subscription?.isActive) {
        return <>{children}</>;
    }

    // Trial expired or subscription blocked
    const isTrialExpired = subscription?.isTrial && !subscription?.isActive;
    const isSubscriptionExpired = subscription?.status === 'expired' || subscription?.status === 'cancelled';
    const isPendingPayment = subscription?.status === 'pending';
    // Teste vencido/pagamento pendente = atenção (warning); expirada/bloqueada = erro (destructive).
    const tone = isTrialExpired || isPendingPayment
        ? { box: "bg-warning/10 border-warning/30", icon: "bg-warning/15 text-warning" }
        : { box: "bg-destructive/10 border-destructive/30", icon: "bg-destructive/15 text-destructive" };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="w-full max-w-lg"
            >
                <Card className="bg-card overflow-hidden shadow-md">
                    {/* Header */}
                    <div role="alert" className={`${tone.box} p-6 text-center border-b`}>
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${tone.icon}`}>
                            {isTrialExpired ? (
                                <Clock className="w-8 h-8" aria-hidden="true" />
                            ) : isPendingPayment ? (
                                <RefreshCw className="w-8 h-8" aria-hidden="true" />
                            ) : (
                                <Lock className="w-8 h-8" aria-hidden="true" />
                            )}
                        </div>
                        <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                            {isTrialExpired && "Seu período de teste expirou"}
                            {isSubscriptionExpired && "Sua assinatura expirou"}
                            {isPendingPayment && "Pagamento pendente"}
                            {subscription?.status === 'blocked' && "Acesso bloqueado"}
                        </h1>
                        <p className="text-muted-foreground">
                            {isTrialExpired && "Seu período de teste gratuito chegou ao fim."}
                            {isSubscriptionExpired && "Renove sua assinatura para continuar usando."}
                            {isPendingPayment && "Estamos aguardando a confirmação do seu pagamento."}
                            {subscription?.status === 'blocked' && "Entre em contato com o suporte para regularizar."}
                        </p>
                    </div>

                    <CardContent className="p-6 space-y-6">
                        {/* What you're missing */}
                        <div className="space-y-3">
                            <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                <AlertTriangle size={16} className="text-warning" aria-hidden="true" />
                                O que você está perdendo:
                            </p>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                {[
                                    "Acesso ao dashboard de gestão",
                                    "Agendamentos online",
                                    "Gestão de clientes e equipe",
                                    "Relatórios financeiros",
                                    "Integrações com WhatsApp",
                                ].map((item) => (
                                    <li key={item} className="flex items-center gap-2">
                                        <X size={14} className="text-destructive flex-shrink-0" aria-hidden="true" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Pricing options */}
                        <div className="space-y-3">
                            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-foreground flex items-center gap-2">
                                            <Crown size={18} className="text-primary" aria-hidden="true" />
                                            {displayPlanName(null)}
                                        </p>
                                        <p className="text-sm text-muted-foreground">Mensal - cancele quando quiser</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-primary">R$ 39,90</p>
                                        <p className="text-xs text-muted-foreground">/mês</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-success/10 border border-success/30 relative">
                                <div className="absolute -top-2 -right-2 bg-success text-success-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                                    -15%
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-foreground flex items-center gap-2">
                                            <Sparkles size={18} className="text-success" aria-hidden="true" />
                                            Plano Anual
                                        </p>
                                        <p className="text-sm text-success">Economia de R$ 78,80/ano</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-success">R$ 400,00</p>
                                        <p className="text-xs text-muted-foreground">/ano</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CTA Button */}
                        <Button
                            variant="brand"
                            size="lg"
                            className="w-full"
                            onClick={() => navigate('/checkout')}
                        >
                            <CreditCard size={18} className="mr-2" />
                            {isTrialExpired ? "Assinar agora" : "Renovar assinatura"}
                            <ArrowRight size={18} className="ml-2" />
                        </Button>

                        {/* Retry button for pending payments */}
                        {isPendingPayment && (
                            <Button
                                variant="outline"
                                size="lg"
                                className="w-full"
                                onClick={() => checkSubscription()}
                            >
                                <RefreshCw size={18} className="mr-2" />
                                Verificar pagamento novamente
                            </Button>
                        )}

                        {/* Support link */}
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">
                                Precisa de ajuda?{" "}
                                <a
                                    href={`https://wa.me/5511986262240?text=${encodeURIComponent(`Olá! Preciso de ajuda com minha assinatura do ${BRAND.name}.`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    Fale com a Código Base
                                </a>
                            </p>
                        </div>

                        {/* Logo */}
                        <div className="flex justify-center pt-4 border-t border-border/50">
                            <Logo size="sm" variant="auto" />
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
};

// Trial warning banner to show when trial is about to expire
export const TrialWarningBanner = () => {
    const { subscription } = useSubscription();
    const navigate = useNavigate();

    if (!subscription?.isTrial || !subscription?.isActive) return null;
    if (subscription.daysRemaining > 3) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            aria-live="polite"
            className="fixed top-0 left-0 right-0 z-50 bg-warning text-warning-foreground py-2 px-4"
        >
            <div className="container mx-auto flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Clock size={18} aria-hidden="true" />
                    <span className="text-sm font-medium">
                        {subscription.daysRemaining === 0
                            ? "Seu trial expira hoje!"
                            : `Restam ${subscription.daysRemaining} dia${subscription.daysRemaining > 1 ? 's' : ''} de teste`
                        }
                    </span>
                </div>
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate('/checkout')}
                >
                    <Sparkles size={14} className="mr-1" aria-hidden="true" />
                    Assinar agora
                </Button>
            </div>
        </motion.div>
    );
};
