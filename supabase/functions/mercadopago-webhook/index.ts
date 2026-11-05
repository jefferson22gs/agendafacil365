// Mercado Pago Webhook Handler - Supabase Edge Function
// This function receives webhooks from Mercado Pago and updates subscription status automatically

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MPWebhookPayload {
    action: string;
    api_version: string;
    data: {
        id: string;
    };
    date_created: string;
    id: number;
    live_mode: boolean;
    type: 'subscription_preapproval' | 'payment' | 'subscription_authorized_payment';
    user_id: string;
}

interface MPPreapproval {
    id: string;
    payer_id: number;
    payer_email: string;
    status: 'pending' | 'authorized' | 'paused' | 'cancelled';
    external_reference: string;
    next_payment_date: string;
    auto_recurring: {
        transaction_amount: number;
        currency_id: string;
    };
}

interface MPPayment {
    id: number;
    status: 'approved' | 'pending' | 'rejected' | 'refunded' | 'cancelled';
    status_detail: string;
    transaction_amount: number;
    currency_id: string;
    date_approved: string;
    external_reference: string;
    payment_method_id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SubRow = { id: string; salon_id: string; [k: string]: unknown };
type SubQuery = {
    select(c: string): SubQuery; eq(c: string, v: string): SubQuery; order(c: string, o: { ascending: boolean }): SubQuery;
    limit(n: number): SubQuery; maybeSingle(): PromiseLike<{ data: SubRow | null }>;
};
type SubDb = { from(table: 'subscriptions'): SubQuery };

/** Assinatura mais recente do estabelecimento; consultas só com .eq() (sem montar filtro com texto externo). */
export async function findSubscription(db: SubDb, preapprovalId: string | null, externalReference: string | null | undefined) {
    if (preapprovalId) {
        const { data } = await db.from('subscriptions').select('*').eq('mp_preapproval_id', preapprovalId)
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (data) return data;
    }
    const ref = (externalReference ?? '').trim();
    if (!UUID.test(ref)) return null;
    const { data } = await db.from('subscriptions').select('*').eq('salon_id', ref)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
    return data ?? null;
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Get environment variables
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const mpAccessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')!;

        // Initialize Supabase client with service role
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Parse webhook payload
        const payload: MPWebhookPayload = await req.json();
        console.log('Webhook received:', payload.type, payload.data.id);

        // Handle different webhook types
        switch (payload.type) {
            case 'subscription_preapproval': {
                // Fetch preapproval from Mercado Pago
                const preapprovalResponse = await fetch(
                    `https://api.mercadopago.com/preapproval/${payload.data.id}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${mpAccessToken}`,
                        },
                    }
                );

                if (!preapprovalResponse.ok) {
                    console.error('Failed to fetch preapproval:', preapprovalResponse.status);
                    break;
                }

                const preapproval: MPPreapproval = await preapprovalResponse.json();
                console.log('Preapproval status:', preapproval.status);

                // Map MP status to our status
                const statusMap: Record<string, string> = {
                    'authorized': 'active',
                    'pending': 'pending',
                    'paused': 'pending',
                    'cancelled': 'cancelled',
                };

                const status = statusMap[preapproval.status] || 'pending';

                // Localiza a assinatura sem interpolar texto externo em filtro PostgREST:
                // 1) id do preapproval já vinculado; 2) external_reference = salon_id (UUID validado).
                // Não usa mp_external_reference (coluna gravável pelo cliente antes do endurecimento de RLS).
                const subscription = await findSubscription(supabase as unknown as SubDb, preapproval.id, preapproval.external_reference);

                if (!subscription) {
                    console.log('No subscription found for preapproval:', preapproval.id);
                    break;
                }

                // Calculate period dates
                const now = new Date();
                const periodEnd = new Date(preapproval.next_payment_date || now);
                if (!preapproval.next_payment_date) {
                    periodEnd.setMonth(periodEnd.getMonth() + 1);
                }

                // Update subscription - LIBERA O SISTEMA!
                const { error: updateError } = await supabase
                    .from('subscriptions')
                    .update({
                        status,
                        is_trial: false,
                        mp_preapproval_id: preapproval.id,
                        mp_payer_id: preapproval.payer_id.toString(),
                        current_period_start: now.toISOString(),
                        current_period_end: periodEnd.toISOString(),
                        next_payment_date: periodEnd.toISOString(),
                        amount: preapproval.auto_recurring?.transaction_amount || 39.90,
                        updated_at: now.toISOString(),
                    })
                    .eq('id', subscription.id);

                if (updateError) {
                    console.error('Error updating subscription:', updateError);
                } else {
                    console.log('✅ Subscription ACTIVATED:', subscription.id, '- Status:', status);
                }
                break;
            }

            case 'payment':
            case 'subscription_authorized_payment': {
                // Fetch payment from Mercado Pago
                const paymentResponse = await fetch(
                    `https://api.mercadopago.com/v1/payments/${payload.data.id}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${mpAccessToken}`,
                        },
                    }
                );

                if (!paymentResponse.ok) {
                    console.error('Failed to fetch payment:', paymentResponse.status);
                    break;
                }

                const payment: MPPayment = await paymentResponse.json();
                console.log('Payment status:', payment.status, '- Amount:', payment.transaction_amount);

                // Find subscription by external reference
                if (!payment.external_reference) {
                    console.log('No external reference in payment');
                    break;
                }

                const subscription = await findSubscription(supabase as unknown as SubDb, null, payment.external_reference);

                if (!subscription) {
                    console.log('No subscription found for payment:', payment.external_reference);
                    break;
                }

                // Record payment
                const { data: paymentRecord, error: paymentError } = await supabase
                    .from('subscription_payments')
                    .insert({
                        subscription_id: subscription.id,
                        salon_id: subscription.salon_id,
                        mp_payment_id: payment.id.toString(),
                        mp_status: payment.status,
                        mp_status_detail: payment.status_detail,
                        amount: payment.transaction_amount,
                        currency: payment.currency_id,
                        payment_method: payment.payment_method_id,
                        paid_at: payment.date_approved,
                    })
                    .select()
                    .single();

                // Update subscription based on payment status
                if (payment.status === 'approved') {
                    const periodEnd = new Date();
                    periodEnd.setMonth(periodEnd.getMonth() + 1);

                    await supabase
                        .from('subscriptions')
                        .update({
                            status: 'active',
                            is_trial: false,
                            last_payment_date: payment.date_approved,
                            current_period_end: periodEnd.toISOString(),
                            next_payment_date: periodEnd.toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', subscription.id);

                    console.log('✅ Payment APPROVED - Subscription activated:', subscription.id);

                    // ===== CALCULAR COMISSÃO PARA O VENDEDOR =====
                    try {
                        // Buscar informações do salão para saber quem é o vendedor
                        const { data: salon } = await supabase
                            .from('salons')
                            .select('seller_id')
                            .eq('id', subscription.salon_id)
                            .single();

                        // Se houver vendedor associado, calcular comissão
                        if (salon?.seller_id) {
                            // Buscar informações da assinatura para determinar tipo (mensal/anual)
                            const { data: subscriptionData } = await supabase
                                .from('subscriptions')
                                .select('plan_id, billing_cycle')
                                .eq('id', subscription.id)
                                .single();

                            // Determinar tipo de pagamento baseado no plano
                            const isAnnualPlan = subscriptionData?.plan_id?.includes('annual') || 
                                              subscriptionData?.billing_cycle === 'annual' ||
                                              payment.transaction_amount >= 400; // Plano anual geralmente é maior
                            
                            const paymentType = isAnnualPlan ? 'annual' : 'monthly';

                            console.log(`🔍 Calculating commission for seller ${salon.seller_id}, payment type: ${paymentType}, amount: ${payment.transaction_amount}`);

                            // Calcular comissão usando a função SQL
                            const { data: commissionResult, error: commissionError } = await supabase
                                .rpc('calculate_commission', {
                                    p_amount: payment.transaction_amount,
                                    p_payment_type: paymentType,
                                    p_seller_id: salon.seller_id
                                });

                            if (commissionError) {
                                console.error('❌ Error calculating commission:', commissionError);
                            } else if (commissionResult) {
                                // Buscar dados do vendedor para obter o percentual usado
                                const { data: seller } = await supabase
                                    .from('sellers')
                                    .select('commission_monthly_percent, commission_annual_percent')
                                    .eq('id', salon.seller_id)
                                    .single();

                                const commissionPercent = isAnnualPlan 
                                    ? (seller?.commission_annual_percent || 10) 
                                    : (seller?.commission_monthly_percent || 20);

                                // Criar registro de comissão
                                await supabase
                                    .from('seller_commissions')
                                    .insert({
                                        seller_id: salon.seller_id,
                                        salon_id: subscription.salon_id,
                                        subscription_id: subscription.id,
                                        payment_id: paymentRecord?.id,
                                        amount: payment.transaction_amount,
                                        commission_percent: commissionPercent,
                                        commission_amount: commissionResult,
                                        payment_type: paymentType,
                                        status: 'pending',
                                        mp_payment_id: payment.id.toString(),
                                        subscription_plan: subscriptionData?.plan_id || 'unknown',
                                    });

                                console.log(`✅ Commission calculated: R$ ${commissionResult} (${commissionPercent}%) for seller ${salon.seller_id}`);
                            }
                        } else {
                            console.log('ℹ️ No seller associated with this salon, skipping commission calculation');
                        }
                    } catch (commissionError) {
                        console.error('⚠️ Error in commission calculation process:', commissionError);
                        // Não falhar o fluxo principal se houver erro na comissão
                    }

                } else if (payment.status === 'rejected') {
                    await supabase
                        .from('subscriptions')
                        .update({
                            status: 'pending',
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', subscription.id);

                    console.log('❌ Payment REJECTED - Subscription pending:', subscription.id);
                }
                break;
            }

            default:
                console.log('Unhandled webhook type:', payload.type);
        }

        return new Response(
            JSON.stringify({ success: true }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        );
    } catch (error) {
        console.error('Webhook error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        );
    }
});
