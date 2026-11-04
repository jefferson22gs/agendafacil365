import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
    Crown,
    CreditCard,
    Calendar,
    Clock,
    AlertTriangle,
    Check,
    X,
    RefreshCw,
    ExternalLink,
    Gift,
    Shield,
    FileText,
    Percent
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { useSubscription, SubscriptionStatus } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import { BRAND, displayPlanName } from "@/config/brand";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const statusConfig: Record<SubscriptionStatus, { label: string; color: string; icon: any }> = {
    trial: { label: 'Período de Teste', color: 'bg-warning text-warning-foreground', icon: Gift },
    active: { label: 'Ativa', color: 'bg-success text-success-foreground', icon: Check },
    pending: { label: 'Pagamento Pendente', color: 'bg-warning text-warning-foreground', icon: Clock },
    cancelled: { label: 'Cancelada', color: 'bg-muted text-foreground', icon: X },
    expired: { label: 'Expirada', color: 'bg-destructive text-destructive-foreground', icon: AlertTriangle },
    blocked: { label: 'Bloqueada', color: 'bg-destructive text-destructive-foreground', icon: AlertTriangle },
    none: { label: 'Sem Assinatura', color: 'bg-muted text-foreground', icon: X },
};

const PLANS = {
    monthly: {
        id: "3bc80db99eec4746a3fa82309737b066",
        price: 39.90,
        period: "mês",
        label: "Mensal",
    },
    annual: {
        id: "3d181e15ab654a5fae79f7f76e7261d3",
        price: 400.00,
        period: "ano",
        label: "Anual",
        discount: 15,
        savings: 78.80,
    }
};

type PlanType = 'monthly' | 'annual';

const SubscriptionManagement = () => {
    const navigate = useNavigate();
    const { subscription, isLoading, checkSubscription } = useSubscription();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly');

    const currentPlan = PLANS[selectedPlan];

    // Gera URL de checkout com external_reference para rastreabilidade
    const getCheckoutUrl = (planType: PlanType = selectedPlan) => {
        const planId = PLANS[planType].id;
        const baseUrl = `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=${planId}`;
        if (subscription?.salonId) {
            return `${baseUrl}&external_reference=${subscription.salonId}`;
        }
        return baseUrl;
    };

    const handleSubscribe = async () => {
        // Salvar external_reference no banco antes de redirecionar
        if (subscription?.id && subscription?.salonId) {
            const { supabase } = await import('@/integrations/supabase/client');
            await supabase
                .from('subscriptions')
                .update({ mp_external_reference: subscription.salonId })
                .eq('id', subscription.id);
        }

        // Abrir checkout do Mercado Pago
        window.open(getCheckoutUrl(), '_blank');
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await checkSubscription();
        setIsRefreshing(false);
    };

    const handleCancelSubscription = async () => {
        // In production, this would call Mercado Pago API to cancel
        alert('Funcionalidade de cancelamento será implementada com a integração completa do Mercado Pago.');
    };

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <div role="status" aria-label="Carregando assinatura" className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin motion-reduce:animate-none" />
                </div>
            </AdminLayout>
        );
    }

    const status = subscription?.status || 'none';
    const config = statusConfig[status];
    const StatusIcon = config.icon;

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div data-tour="subscription-header">
                        <h1 className="font-display text-3xl font-bold text-foreground">
                            Minha Assinatura
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Gerencie sua assinatura do {displayPlanName(null)}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        data-tour="subscription-refresh"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        <RefreshCw size={16} aria-hidden="true" className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Atualizar status
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Subscription Card */}
                    <div className="lg:col-span-2">
                        <Card className="glass-card overflow-hidden">
                            <div className="bg-gradient-to-r from-primary to-brand-hover p-6 text-primary-foreground">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Crown size={32} className="flex-shrink-0" aria-hidden="true" />
                                        <div>
                                            <h2 className="text-xl font-bold">{displayPlanName(subscription?.planName)}</h2>
                                            <p className="text-white/80 text-sm">Plano Único - Tudo Incluso</p>
                                        </div>
                                    </div>
                                    <Badge className={`${config.color} border-0`} data-tour="subscription-status">
                                        <StatusIcon size={14} className="mr-1" aria-hidden="true" />
                                        {config.label}
                                    </Badge>
                                </div>
                            </div>

                            <CardContent className="p-6 space-y-6">
                                {/* Trial info */}
                                {subscription?.isTrial && subscription?.isActive && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        data-tour="subscription-trial"
                                        className="p-4 rounded-xl bg-warning/10 border border-warning/30"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Gift className="w-8 h-8 text-warning flex-shrink-0" aria-hidden="true" />
                                            <div className="flex-1">
                                                <p className="font-semibold text-foreground">Período de Teste Gratuito</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {subscription.daysRemaining > 0
                                                        ? `Restam ${subscription.daysRemaining} dia${subscription.daysRemaining > 1 ? 's' : ''} de teste`
                                                        : 'Seu período de teste expira hoje!'
                                                    }
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-bold text-warning">{subscription.daysRemaining}</p>
                                                <p className="text-xs text-muted-foreground">dias restantes</p>
                                            </div>
                                        </div>

                                        {subscription.daysRemaining <= 3 && (
                                            <Button
                                                variant="brand"
                                                size="sm"
                                                className="w-full mt-4"
                                                onClick={handleSubscribe}
                                            >
                                                <CreditCard size={16} className="mr-2" />
                                                Assinar agora para não perder acesso
                                            </Button>
                                        )}
                                    </motion.div>
                                )}

                                {/* Expired/Blocked warning */}
                                {!subscription?.isActive && subscription?.status !== 'none' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        role="alert"
                                        className="p-4 rounded-xl bg-destructive/10 border border-destructive/30"
                                    >
                                        <div className="flex items-center gap-3">
                                            <AlertTriangle className="w-8 h-8 text-destructive flex-shrink-0" aria-hidden="true" />
                                            <div>
                                                <p className="font-semibold text-destructive">Assinatura Inativa</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Seu acesso está limitado. Renove para continuar usando todas as funcionalidades.
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="brand"
                                            size="sm"
                                            className="w-full mt-4"
                                            data-tour="subscription-renew"
                                            onClick={handleSubscribe}
                                        >
                                            <CreditCard size={16} className="mr-2" />
                                            Renovar assinatura
                                        </Button>
                                    </motion.div>
                                )}

                                {/* Subscription details */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-tour="subscription-details">
                                    <div className="p-4 rounded-xl bg-secondary/30">
                                        <p className="text-sm text-muted-foreground mb-1">Tipo de Plano</p>
                                        <p className="text-lg font-semibold text-foreground flex items-center gap-2">
                                            {subscription?.planType === 'annual' ? (
                                                <>
                                                    <Crown size={18} className="text-primary" />
                                                    Anual
                                                    <Badge className="bg-success text-success-foreground border-0 text-xs">-15%</Badge>
                                                </>
                                            ) : (
                                                <>
                                                    <Calendar size={18} className="text-primary" />
                                                    Mensal
                                                </>
                                            )}
                                        </p>
                                    </div>

                                    <div className="p-4 rounded-xl bg-secondary/30">
                                        <p className="text-sm text-muted-foreground mb-1">
                                            {subscription?.planType === 'annual' ? 'Valor anual' : 'Valor mensal'}
                                        </p>
                                        <p className="text-2xl font-bold text-foreground">
                                            R$ {subscription?.amount?.toFixed(2).replace('.', ',') || (subscription?.planType === 'annual' ? '400,00' : '39,90')}
                                        </p>
                                        {subscription?.planType === 'annual' && (
                                            <p className="text-xs text-success mt-1">
                                                Equivale a R$ 33,33/mês
                                            </p>
                                        )}
                                    </div>

                                    {subscription?.trialEndDate && subscription?.isTrial && (
                                        <div className="p-4 rounded-xl bg-secondary/30" data-tour="subscription-trial-end">
                                            <p className="text-sm text-muted-foreground mb-1">Fim do período de teste</p>
                                            <p className="text-lg font-semibold text-foreground">
                                                {subscription.trialEndDate.toLocaleDateString('pt-BR', {
                                                    day: '2-digit',
                                                    month: 'long',
                                                    year: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                    )}

                                    {subscription?.currentPeriodEnd && !subscription?.isTrial && (
                                        <div className="p-4 rounded-xl bg-secondary/30" data-tour="subscription-period-end">
                                            <p className="text-sm text-muted-foreground mb-1">
                                                {subscription?.planType === 'annual' ? 'Vencimento da assinatura' : 'Próxima cobrança'}
                                            </p>
                                            <p className="text-lg font-semibold text-foreground">
                                                {subscription.currentPeriodEnd.toLocaleDateString('pt-BR', {
                                                    day: '2-digit',
                                                    month: 'long',
                                                    year: 'numeric'
                                                })}
                                            </p>
                                            {subscription?.daysRemaining && subscription.daysRemaining <= 30 && (
                                                <p className="text-xs text-warning mt-1">
                                                    {subscription.daysRemaining} dias restantes
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Plan Selection - Show when trial or not active */}
                                {(subscription?.isTrial || !subscription?.isActive) && (
                                    <div className="pt-4 border-t border-border/50">
                                        <p className="text-sm font-medium text-foreground mb-3">Escolha seu plano:</p>
                                        <div className="grid grid-cols-2 gap-3 mb-4" data-tour="subscription-plans">
                                            <button
                                                type="button"
                                                aria-pressed={selectedPlan === 'monthly'}
                                                onClick={() => setSelectedPlan('monthly')}
                                                className={cn(
                                                    "p-4 rounded-xl border-2 transition-all text-left",
                                                    selectedPlan === 'monthly'
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border hover:border-primary/50"
                                                )}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Calendar size={16} className="text-primary" />
                                                    <span className="font-semibold">Mensal</span>
                                                </div>
                                                <p className="text-xl font-bold text-primary">R$ 39,90</p>
                                                <p className="text-xs text-muted-foreground">/mês</p>
                                            </button>
                                            <button
                                                type="button"
                                                aria-pressed={selectedPlan === 'annual'}
                                                onClick={() => setSelectedPlan('annual')}
                                                className={cn(
                                                    "p-4 rounded-xl border-2 transition-all text-left relative",
                                                    selectedPlan === 'annual'
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border hover:border-primary/50"
                                                )}
                                            >
                                                <Badge className="absolute -top-2 -right-2 bg-success text-success-foreground text-[10px] border-0">
                                                    -15%
                                                </Badge>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Crown size={16} className="text-primary" />
                                                    <span className="font-semibold">Anual</span>
                                                </div>
                                                <p className="text-xl font-bold text-primary">R$ 400,00</p>
                                                <p className="text-xs text-success">Economize R$ 78,80</p>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/50">
                                    {subscription?.isTrial || !subscription?.isActive ? (
                                        <Button
                                            variant="brand"
                                            className="flex-1"
                                            data-tour="subscription-subscribe"
                                            onClick={handleSubscribe}
                                        >
                                            <CreditCard size={18} className="mr-2" />
                                            Assinar {selectedPlan === 'annual' ? 'Anual' : 'Mensal'}
                                            <ExternalLink size={14} className="ml-2" />
                                        </Button>
                                    ) : (
                                        <a
                                            data-tour="subscription-manage"
                                            href="https://www.mercadopago.com.br/subscriptions"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1"
                                        >
                                            <Button variant="outline" className="w-full">
                                                <FileText size={18} className="mr-2" />
                                                Gerenciar no Mercado Pago
                                                <ExternalLink size={14} className="ml-2" />
                                            </Button>
                                        </a>
                                    )}

                                    {subscription?.isActive && !subscription?.isTrial && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" data-tour="subscription-cancel">
                                                    Cancelar assinatura
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent data-tour="subscription-cancel-dialog">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Tem certeza que deseja cancelar?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Ao cancelar sua assinatura, você perderá acesso a todas as funcionalidades
                                                        do {displayPlanName(subscription?.planName)} no final do período atual. Esta ação não pode ser desfeita.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Manter assinatura</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        data-tour="subscription-cancel-confirm"
                                                        onClick={handleCancelSubscription}
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    >
                                                        Sim, cancelar
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Features included */}
                        <Card className="glass-card">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-primary" />
                                    O que está incluso
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {[
                                    'Agendamento ilimitado',
                                    'Gestão de clientes',
                                    'Dashboard financeiro',
                                    'Integração WhatsApp',
                                    'Profissionais ilimitados',
                                    'Relatórios e Analytics',
                                    'App PWA personalizado',
                                    'Suporte prioritário',
                                ].map((feature, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <Check size={16} className="text-success flex-shrink-0" aria-hidden="true" />
                                        <span className="text-sm text-foreground">{feature}</span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        {/* Help */}
                        <Card className="glass-card">
                            <CardContent className="p-6 text-center">
                                <p className="text-sm text-muted-foreground mb-4">
                                    Dúvidas sobre sua assinatura?
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    data-tour="subscription-support"
                                    onClick={() => window.open(`https://wa.me/5511986262240?text=${encodeURIComponent(`Olá! Tenho uma dúvida sobre minha assinatura do ${BRAND.name}.`)}`, '_blank')}
                                >
                                    Falar com Código Base
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default SubscriptionManagement;
