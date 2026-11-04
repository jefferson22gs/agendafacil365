import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { getSupportWhatsAppLink } from "@/config/contact";

const trust = ["Sem taxa de adesão", "Suporte incluído", "Cancele quando quiser"];

export const CTASection = () => {
  return (
    <section id="contact" aria-labelledby="cta-title" className="scroll-mt-20 bg-background py-16 md:py-24">
      <div className="container px-4">
        <div className="mx-auto max-w-4xl rounded-2xl bg-brand-navy p-8 text-center text-white shadow-lg sm:p-12 md:p-16">
          <h2 id="cta-title" className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Pronto para organizar a agenda do seu negócio?
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
            Teste grátis por 21 dias, sem cartão de crédito.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild variant="brand" size="xl" className="group">
              <Link to="/register">
                Criar conta e testar 21 dias
                <ArrowRight className="transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              size="xl"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white focus-visible:ring-white focus-visible:ring-offset-brand-navy"
            >
              <a href={getSupportWhatsAppLink('demo')} target="_blank" rel="noopener noreferrer">
                <Calendar aria-hidden />
                Agendar demonstração
              </a>
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-white/80">
            {trust.map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-brand-sky" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
