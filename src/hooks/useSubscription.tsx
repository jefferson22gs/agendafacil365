import { displayPlanName, LEGACY_PLAN_NAME } from '@/config/brand';
import { callRpc, isMissingRpc } from '@/lib/rpcFallback';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export type SubscriptionStatus = 'trial' | 'active' | 'pending' | 'cancelled' | 'expired' | 'blocked' | 'none';
export type PlanType = 'monthly' | 'annual';

export interface SubscriptionData {
    id: string;
    salonId: string;
    status: SubscriptionStatus;
    isActive: boolean;
    isTrial: boolean;
    daysRemaining: number;
    trialEndDate: Date | null;
    currentPeriodEnd: Date | null;
    nextPaymentDate: Date | null;
    amount: number;
    planName: string;
    planType: PlanType;
    createdAt: Date;
    aiApiKey?: string;
    aiProvider?: string;
}

interface SubscriptionContextType {
    subscription: SubscriptionData | null;
    isLoading: boolean;
    isBlocked: boolean;
    showPaymentWarning: boolean;
    warningMessage: string;
    error: Error | null;
    checkSubscription: () => Promise<void>;
    startTrial: (salonId: string) => Promise<boolean>;
    activateSubscription: (mpPreapprovalId: string) => Promise<boolean>;
    blockSubscription: () => Promise<boolean>;
    unblockSubscription: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const checkSubscription = useCallback(async () => {
        if (!user) {
            setSubscription(null);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Get salon for this user
            const { data: salon, error: salonError } = await supabase
                .from('salons')
                .select('id')
                .eq('owner_id', user.id)
                .maybeSingle();

            if (salonError) {
                console.error('Error fetching salon:', salonError);
                throw salonError;
            }

            if (!salon) {
                // User has no salon yet - no subscription needed
                setSubscription(null);
                setIsLoading(false);
                return;
            }

            // Get subscription for this salon
            const { data: sub, error: subError } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('salon_id', salon.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (subError) {
                console.error('Error fetching subscription:', subError);
                throw subError;
            }

            const now = new Date();

            if (!sub) {
                // No subscription found - start trial automatically
                await startTrial(salon.id);
                return;
            }

            // Parse subscription data
            const isTrial = sub.is_trial || false;
            const trialEndDate = sub.trial_end_date ? new Date(sub.trial_end_date) : null;
            const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
            const status = sub.status as SubscriptionStatus;
            const planType = ((sub as any).plan_type as PlanType) || 'monthly';

            // Calculate if active
            let isActive = false;
            let daysRemaining = 0;

            if (isTrial && trialEndDate) {
                isActive = trialEndDate > now && status === 'trial';
                daysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
            } else if (status === 'active') {
                // For annual plans, check expiration date
                if (planType === 'annual' && currentPeriodEnd) {
                    isActive = currentPeriodEnd > now;
                    daysRemaining = Math.max(0, Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                } else if (currentPeriodEnd) {
                    // Monthly plan - check period end
                    isActive = currentPeriodEnd > now;
                    daysRemaining = Math.max(0, Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                } else {
                    // Active without period end (should not happen, but fallback to active)
                    isActive = true;
                }
            }

            // Only update status if the database record is different from the actual state
            let finalStatus = status;
            if (!isActive && (status === 'trial' || status === 'active')) {
                finalStatus = 'expired';

                // status é trial/active aqui: o banco ainda não está como expired.

                {
                    // Check the current database status again to avoid race conditions
                    const { data: currentSub, error } = await supabase
                        .from('subscriptions')
                        .select('status, trial_end_date, current_period_end')
                        .eq('id', sub.id)
                        .single();

                    if (!error && currentSub) {
                        const now = new Date();
                        let currentSubIsActive = false;

                        if (currentSub.status === 'trial' && currentSub.trial_end_date) {
                            currentSubIsActive = new Date(currentSub.trial_end_date) > now;
                        } else if (currentSub.status === 'active' && currentSub.current_period_end) {
                            currentSubIsActive = new Date(currentSub.current_period_end) > now;
                        }

                        // Only update if the database still shows the sub is active when it shouldn't be
                        if (!currentSubIsActive && currentSub.status !== 'expired') {
                            // RPC restrita (supabase/pending/…_rls.sql); fallback para antes de a migração ser aplicada.
                            const rpc = await callRpc<boolean>(supabase, 'expire_own_subscription', { p_subscription_id: sub.id });
                            if (isMissingRpc(rpc.error)) {
                                await supabase
                                    .from('subscriptions')
                                    .update({ status: 'expired' })
                                    .eq('id', sub.id);
                            }

                            // Update our local status to match the DB change
                            finalStatus = 'expired';
                        } else {
                            // The database is already correct, use the current status
                            finalStatus = currentSub.status as SubscriptionStatus;
                        }
                    }
                }
            }

            // Get amount based on plan type
            const amount = planType === 'annual'
                ? ((sub as any).annual_amount || 400.00)
                : (sub.amount || 39.90);

            const subscriptionData: SubscriptionData = {
                id: sub.id,
                salonId: salon.id,
                status: finalStatus,
                isActive,
                isTrial,
                daysRemaining,
                trialEndDate,
                currentPeriodEnd,
                nextPaymentDate: currentPeriodEnd,
                amount,
                planName: displayPlanName(sub.plan_name),
                planType,
                createdAt: new Date(sub.created_at),
            };

            setSubscription(subscriptionData);

        } catch (err) {
            console.error('Error checking subscription:', err);
            setError(err as Error);
            // On error, block access (safe mode)
            setSubscription(null);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const startTrial = async (salonId: string): Promise<boolean> => {
        if (!user) return false;

        try {
            const now = new Date();
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 30);

            // RPC restrita (supabase/pending/…_rls.sql) cria o trial no servidor; se ainda não existir
            // (função ausente = PGRST202), usa o insert direto de antes. Erro de regra da RPC NÃO cai no fallback.
            const rpc = await callRpc<{ id: string }>(supabase, 'start_salon_trial', { p_salon_id: salonId });
            const { data, error } = !isMissingRpc(rpc.error) ? rpc : await supabase
                .from('subscriptions')
                .insert({
                    salon_id: salonId,
                    user_id: user.id,
                    status: 'trial',
                    is_trial: true,
                    trial_start_date: now.toISOString(),
                    trial_end_date: trialEndDate.toISOString(),
                    plan_name: LEGACY_PLAN_NAME, // valor persistido legado (ver docs/LEGACY_IDENTIFIERS.md)
                    amount: 39.90,
                })
                .select()
                .single();

            if (error) {
                console.error('Error starting trial:', error);
                throw error;
            }

            const newSubscription: SubscriptionData = {
                id: data.id,
                salonId,
                status: 'trial',
                isActive: true,
                isTrial: true,
                daysRemaining: 30,
                trialEndDate,
                currentPeriodEnd: null,
                nextPaymentDate: null,
                amount: 39.90,
                planName: displayPlanName(LEGACY_PLAN_NAME),
                planType: 'monthly',
                createdAt: now,
            };

            setSubscription(newSubscription);
            return true;
        } catch (err) {
            console.error('Error starting trial:', err);
            setError(err as Error);
            return false;
        }
    };

    const activateSubscription = async (mpPreapprovalId: string): Promise<boolean> => {
        if (!subscription) return false;

        try {
            const now = new Date();
            const periodEnd = new Date();
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const { error } = await supabase
                .from('subscriptions')
                .update({
                    status: 'active',
                    is_trial: false,
                    mp_preapproval_id: mpPreapprovalId,
                    current_period_start: now.toISOString(),
                    current_period_end: periodEnd.toISOString(),
                })
                .eq('id', subscription.id);

            if (error) {
                console.error('Error activating subscription:', error);
                throw error;
            }

            setSubscription({
                ...subscription,
                status: 'active',
                isActive: true,
                isTrial: false,
                daysRemaining: 30,
                currentPeriodEnd: periodEnd,
                nextPaymentDate: periodEnd,
            });

            return true;
        } catch (err) {
            console.error('Error activating subscription:', err);
            setError(err as Error);
            return false;
        }
    };

    const blockSubscription = async (): Promise<boolean> => {
        if (!subscription) return false;

        try {
            const { error } = await supabase
                .from('subscriptions')
                .update({ status: 'blocked' })
                .eq('id', subscription.id);

            if (error) throw error;

            setSubscription({
                ...subscription,
                status: 'blocked',
                isActive: false,
            });

            return true;
        } catch (err) {
            console.error('Error blocking subscription:', err);
            return false;
        }
    };

    const unblockSubscription = async (): Promise<boolean> => {
        if (!subscription) return false;

        try {
            const now = new Date();
            const periodEnd = new Date();
            periodEnd.setMonth(periodEnd.getMonth() + 1);

            const { error } = await supabase
                .from('subscriptions')
                .update({
                    status: 'active',
                    current_period_start: now.toISOString(),
                    current_period_end: periodEnd.toISOString(),
                })
                .eq('id', subscription.id);

            if (error) throw error;

            setSubscription({
                ...subscription,
                status: 'active',
                isActive: true,
                daysRemaining: 30,
                currentPeriodEnd: periodEnd,
            });

            return true;
        } catch (err) {
            console.error('Error unblocking subscription:', err);
            return false;
        }
    };

    useEffect(() => {
        checkSubscription();
    }, [checkSubscription]);

    // Check subscription status periodically (every 5 minutes)
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(checkSubscription, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user, checkSubscription]);

    // Calculate blocking and warning states
    const isBlocked = subscription ? !subscription.isActive && subscription.status !== 'none' : false;

    const showPaymentWarning = subscription ? (
        (subscription.isTrial && subscription.daysRemaining <= 3) ||
        (subscription.status === 'pending') ||
        (subscription.status === 'expired') ||
        (subscription.status === 'cancelled') ||
        (!subscription.isTrial && subscription.daysRemaining <= 5)
    ) : false;

    let warningMessage = '';
    if (subscription) {
        if (subscription.status === 'expired') {
            warningMessage = 'Sua assinatura expirou. Renove para continuar usando o sistema.';
        } else if (subscription.status === 'pending') {
            warningMessage = 'Pagamento pendente. Regularize para evitar bloqueio.';
        } else if (subscription.status === 'cancelled') {
            warningMessage = 'Sua assinatura foi cancelada. Reative para continuar.';
        } else if (subscription.isTrial && subscription.daysRemaining <= 3) {
            warningMessage = `Seu período de teste termina em ${subscription.daysRemaining} dia(s). Assine agora!`;
        } else if (!subscription.isTrial && subscription.daysRemaining <= 5) {
            warningMessage = `Sua assinatura vence em ${subscription.daysRemaining} dia(s).`;
        }
    }

    return (
        <SubscriptionContext.Provider
            value={{
                subscription,
                isLoading,
                isBlocked,
                showPaymentWarning,
                warningMessage,
                error,
                checkSubscription,
                startTrial,
                activateSubscription,
                blockSubscription,
                unblockSubscription,
            }}
        >
            {children}
        </SubscriptionContext.Provider>
    );
};

export const useSubscription = () => {
    const context = useContext(SubscriptionContext);
    if (context === undefined) {
        throw new Error('useSubscription must be used within a SubscriptionProvider');
    }
    return context;
};
