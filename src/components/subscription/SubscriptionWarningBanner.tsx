import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X, CreditCard, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useState } from "react";

export const SubscriptionWarningBanner = () => {
    const { subscription, showPaymentWarning, warningMessage } = useSubscription();
    const navigate = useNavigate();
    const [dismissed, setDismissed] = useState(false);

    if (!showPaymentWarning || dismissed || !subscription) {
        return null;
    }

    const isUrgent = subscription.status === 'expired' ||
        subscription.status === 'pending' ||
        subscription.daysRemaining <= 1;

    // Urgente = erro (destructive); aviso = atenção (warning). Ícone + texto, não só cor.
    const bgColor = isUrgent
        ? "bg-destructive/10 border-destructive/30"
        : "bg-warning/10 border-warning/30";

    const iconColor = isUrgent ? "text-destructive" : "text-warning";

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                role={isUrgent ? "alert" : "status"}
                className={`${bgColor} border-b px-4 py-3`}
            >
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-full flex-shrink-0 ${isUrgent ? 'bg-destructive/15' : 'bg-warning/15'}`}>
                            {isUrgent ? (
                                <AlertTriangle className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
                            ) : (
                                <Clock className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
                            )}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-foreground">
                                {warningMessage}
                            </p>
                            {subscription.isTrial && (
                                <p className="text-xs text-muted-foreground">
                                    Teste gratuito: {subscription.daysRemaining} dia(s) restante(s)
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="brand"
                            onClick={() => navigate('/admin/subscription')}
                            className="gap-2 h-11"
                        >
                            <CreditCard className="w-4 h-4" aria-hidden="true" />
                            {subscription.isTrial ? 'Assinar Agora' : 'Renovar'}
                        </Button>

                        {!isUrgent && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-11 w-11"
                                aria-label="Dispensar aviso de assinatura"
                                onClick={() => setDismissed(true)}
                            >
                                <X className="w-4 h-4" aria-hidden="true" />
                            </Button>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};
