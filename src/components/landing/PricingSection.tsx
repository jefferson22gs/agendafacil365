import { useState } from "react";
import { Check, Calendar, CalendarRange, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// Valores e desconto idênticos ao Checkout (R$ 39,90/mês, R$ 400,00/ano). Não alterar sem validação comercial.
const features = [
  "Profissionais ilimitados",
  "Agendamentos ilimitados",
  "Dashboard completo",
  "Lembretes por WhatsApp",
  "Cupons de desconto",
  "Gestão de clientes",
  "Relatórios financeiros",
  "Suporte prioritário",
];

type PlanType = 'monthly' | 'annual';

const plans = {
  monthly: {
    price: "39",
    cents: "90",
    period: "mês",
    total: null,
  },
  annual: {
    price: "400",
    cents: "00",
    period: "ano",
    total: "R$ 33,33/mês",
    savings: "78,80",
  },
};

const toggleClass = (active: boolean) =>
  cn(
    "relative inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
  );

export const PricingSection = () => {
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly');
  const currentPlan = plans[selectedPlan];

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 bg-background py-16 md:py-24">
      <div className="container px-4">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 id="pricing-title" className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Um preço, tudo incluso
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Sem surpresas, sem taxas extras. Tudo que você precisa por um preço único.
          </p>
        </div>

        <div className="mb-8 flex justify-center">
          <div role="group" aria-label="Período do plano" className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1">
            <button type="button" aria-pressed={selectedPlan === 'monthly'} onClick={() => setSelectedPlan('monthly')} className={toggleClass(selectedPlan === 'monthly')}>
              <Calendar className="h-4 w-4" aria-hidden />
              Mensal
            </button>
            <button type="button" aria-pressed={selectedPlan === 'annual'} onClick={() => setSelectedPlan('annual')} className={toggleClass(selectedPlan === 'annual')}>
              <CalendarRange className="h-4 w-4" aria-hidden />
              Anual
              <span className="rounded-full bg-success px-1.5 py-0.5 text-[11px] font-semibold text-success-foreground">-15%</span>
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-lg">
          <div className="rounded-2xl border-2 border-primary bg-card p-6 shadow-lg sm:p-10">
            <div className="mb-6 text-center">
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {selectedPlan === 'annual' ? 'Melhor custo-benefício' : 'Acesso completo'}
              </span>
              <h3 className="mt-4 text-2xl font-bold text-foreground">
                {selectedPlan === 'annual' ? 'Plano Anual' : 'Plano Mensal'}
              </h3>
              <p className="mt-1 text-muted-foreground">Todas as funcionalidades liberadas</p>
            </div>

            <div className="mb-8 text-center" aria-live="polite">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-xl text-muted-foreground">R$</span>
                <span className="text-6xl font-bold tracking-tight text-foreground">{currentPlan.price}</span>
                <span className="text-2xl font-bold text-foreground">,{currentPlan.cents}</span>
              </div>
              <span className="text-muted-foreground">/{currentPlan.period}</span>

              {selectedPlan === 'annual' && (
                <div className="mt-3 flex flex-col items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
                    <Percent size={12} aria-hidden />
                    Economia de R$ {plans.annual.savings}/ano
                  </span>
                  <p className="text-sm text-muted-foreground">Equivale a {plans.annual.total}</p>
                </div>
              )}
            </div>

            <ul className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                  <span className="text-sm text-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            <Button asChild variant="brand" size="lg" className="w-full whitespace-normal text-center">
              <Link to={`/checkout?plano=${selectedPlan === 'annual' ? 'anual' : 'mensal'}`}>
                {selectedPlan === 'annual' ? 'Assinar plano anual' : 'Assinar plano mensal'}
              </Link>
            </Button>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              Prefere testar antes?{" "}
              <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
                Crie sua conta e use 30 dias grátis
              </Link>
            </p>
            <p className="mt-2 text-center text-sm text-muted-foreground">Cancele quando quiser • Sem fidelidade</p>
          </div>
        </div>

        <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-border bg-card p-4">
          <h3 className="mb-4 text-center font-semibold text-foreground">Comparativo</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <button
              type="button"
              aria-pressed={selectedPlan === 'monthly'}
              onClick={() => setSelectedPlan('monthly')}
              className={cn(
                "rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selectedPlan === 'monthly' ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <p className="font-semibold text-foreground">Mensal</p>
              <p className="text-xl font-bold text-primary sm:text-2xl">R$ 39,90</p>
              <p className="text-xs text-muted-foreground">por mês</p>
            </button>
            <button
              type="button"
              aria-pressed={selectedPlan === 'annual'}
              onClick={() => setSelectedPlan('annual')}
              className={cn(
                "rounded-xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selectedPlan === 'annual' ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <p className="font-semibold text-foreground">Anual</p>
              <p className="text-xl font-bold text-primary sm:text-2xl">R$ 400,00</p>
              <p className="text-xs font-medium text-success">Economize R$ 78,80</p>
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};
