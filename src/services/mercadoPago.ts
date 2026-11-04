// Mercado Pago Integration Service
// Documentation: https://www.mercadopago.com.br/developers/pt/reference

export interface MercadoPagoConfig {
    publicKey: string;
    accessToken: string;
    sandbox: boolean;
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: 'month' | 'year';
    intervalCount: number;
    trialDays: number;
    features: string[];
}

export interface Customer {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    document?: {
        type: 'CPF' | 'CNPJ';
        number: string;
    };
}

export interface PaymentMethod {
    cardNumber: string;
    cardholderName: string;
    expirationMonth: string;
    expirationYear: string;
    securityCode: string;
    documentNumber: string;
    documentType: string;
}

export interface SubscriptionResponse {
    id: string;
    status: 'authorized' | 'pending' | 'cancelled' | 'paused';
    preapprovalId: string;
    customerId: string;
    trialEndDate: Date;
    nextPaymentDate: Date;
    lastPaymentDate?: Date;
    createdAt: Date;
}

// Plano padrão. `id` 'syshair-premium' é identificador técnico persistido/checkout: NÃO renomear.
export const DEFAULT_PLAN: SubscriptionPlan = {
    id: 'syshair-premium',
    name: 'Agenda Fácil 365 Premium',
    price: 39.90,
    currency: 'BRL',
    interval: 'month',
    intervalCount: 1,
    trialDays: 7,
    features: [
        'Agendamento online ilimitado',
        'Gestão de clientes (CRM)',
        'Controle financeiro completo',
        'Profissionais ilimitados',
        'Dashboard de analytics',
        'Integração WhatsApp',
        'App PWA personalizado',
        'Suporte prioritário',
        'Sem taxas adicionais',
        'Atualizações gratuitas',
    ],
};

class MercadoPagoService {
    private config: MercadoPagoConfig | null = null;

    /**
     * Initialize Mercado Pago SDK with credentials
     */
    init(config: MercadoPagoConfig): void {
        this.config = config;

        // Load Mercado Pago SDK script
        if (typeof window !== 'undefined' && !document.getElementById('mercadopago-sdk')) {
            const script = document.createElement('script');
            script.id = 'mercadopago-sdk';
            script.src = 'https://sdk.mercadopago.com/js/v2';
            script.async = true;
            document.body.appendChild(script);
        }
    }

    /**
     * Get the public key for frontend operations
     */
    getPublicKey(): string | null {
        return this.config?.publicKey || null;
    }

    /**
     * Create a new subscription for a customer
     */
    async createSubscription(
        customer: Customer,
        paymentMethod: PaymentMethod,
        plan: SubscriptionPlan = DEFAULT_PLAN
    ): Promise<SubscriptionResponse> {
        if (!this.config) {
            throw new Error('Mercado Pago not initialized. Call init() first.');
        }

        // In a real implementation, this would call the Mercado Pago API
        // For now, we simulate the response
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + plan.trialDays);

        const nextPaymentDate = new Date(trialEndDate);
        nextPaymentDate.setDate(nextPaymentDate.getDate() + 1);

        // Simulated response
        const response: SubscriptionResponse = {
            id: `sub_${Date.now()}`,
            status: 'authorized',
            preapprovalId: `preapproval_${Date.now()}`,
            customerId: `cust_${Date.now()}`,
            trialEndDate,
            nextPaymentDate,
            createdAt: new Date(),
        };

        return response;
    }

    /**
     * Cancel an existing subscription
     */
    async cancelSubscription(subscriptionId: string): Promise<boolean> {
        if (!this.config) {
            throw new Error('Mercado Pago not initialized. Call init() first.');
        }

        // In a real implementation, this would call the Mercado Pago API
        console.log(`Cancelling subscription: ${subscriptionId}`);
        return true;
    }

    /**
     * Pause an existing subscription
     */
    async pauseSubscription(subscriptionId: string): Promise<boolean> {
        if (!this.config) {
            throw new Error('Mercado Pago not initialized. Call init() first.');
        }

        console.log(`Pausing subscription: ${subscriptionId}`);
        return true;
    }

    /**
     * Resume a paused subscription
     */
    async resumeSubscription(subscriptionId: string): Promise<boolean> {
        if (!this.config) {
            throw new Error('Mercado Pago not initialized. Call init() first.');
        }

        console.log(`Resuming subscription: ${subscriptionId}`);
        return true;
    }

    /**
     * Get subscription status
     */
    async getSubscriptionStatus(subscriptionId: string): Promise<SubscriptionResponse | null> {
        if (!this.config) {
            throw new Error('Mercado Pago not initialized. Call init() first.');
        }

        // In a real implementation, this would fetch from Mercado Pago API
        return null;
    }

    /**
     * Process a webhook notification from Mercado Pago
     */
    async processWebhook(payload: any): Promise<{ action: string; data: any }> {
        const { type, data } = payload;

        switch (type) {
            case 'subscription_preapproval':
                return { action: 'subscription_updated', data };
            case 'payment':
                return { action: 'payment_received', data };
            default:
                return { action: 'unknown', data };
        }
    }

    /**
     * Generate a payment button/link
     */
    async createPaymentPreference(
        description: string,
        amount: number,
        externalReference: string
    ): Promise<string> {
        if (!this.config) {
            throw new Error('Mercado Pago not initialized. Call init() first.');
        }

        // In a real implementation, this would create a preference and return the init_point URL
        return `https://www.mercadopago.com.br/checkout/v1/redirect?preference-id=${externalReference}`;
    }
}

// Singleton instance
export const mercadoPago = new MercadoPagoService();

// Helper hooks for React components
export const useMercadoPago = () => {
    const initMercadoPago = (publicKey: string, accessToken: string, sandbox = true) => {
        mercadoPago.init({ publicKey, accessToken, sandbox });
    };

    return {
        initMercadoPago,
        createSubscription: mercadoPago.createSubscription.bind(mercadoPago),
        cancelSubscription: mercadoPago.cancelSubscription.bind(mercadoPago),
        pauseSubscription: mercadoPago.pauseSubscription.bind(mercadoPago),
        resumeSubscription: mercadoPago.resumeSubscription.bind(mercadoPago),
        getSubscriptionStatus: mercadoPago.getSubscriptionStatus.bind(mercadoPago),
        plan: DEFAULT_PLAN,
    };
};
