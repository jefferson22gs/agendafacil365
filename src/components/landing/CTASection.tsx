import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { getSupportWhatsAppLink } from "@/config/contact";

const trust = ["30 dias grátis", "Sem cartão de crédito", "Sem taxa de adesão", "Contrato digital", "Cancele quando quiser"];

export const CTASection = () => {
  return (
    <section id="contact" aria-labelledby="cta-title" className="scroll-mt-20 bg-background py-16 md:py-24">
      <div className="container px-4">
        <div className="relative isolate mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-brand-navy p-8 text-center text-white shadow-2xl sm:p-12 md:p-16">
          <div aria-hidden="true" className="absolute -right-24 -top-24 -z-10 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,hsl(var(--brand-sky)/0.35),transparent)]" />
          <div aria-hidden="true" className="absolute -bottom-32 -left-24 -z-10 h-96 w-96 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.45),transparent)]" />
          <h2 id="cta-title" className="font-display text-3xl font-bold tracking-tight md:text-5xl">
            Seus clientes voltando sozinhos, a partir de hoje.
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">
            Configure em minutos, compartilhe seu link e deixe os lembretes e retornos trabalharem por você.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Button asChild variant="brand" size="xl" className="group">
              <Link to="/register">
                Começar grátis agora
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
