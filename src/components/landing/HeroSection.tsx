import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import { Accessibility, ChevronRight, FileSignature, PlayCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { DEMO_SALON_SLUG, DEMO_URL, IS_DEMO } from "@/config/demo";
import { ProductShowcase } from "./ProductShowcase";

const trust = [
  { icon: ShieldCheck, text: "Dados isolados por negócio · LGPD" },
  { icon: FileSignature, text: "Contrato com assinatura eletrônica" },
  { icon: Accessibility, text: "Acessível · WCAG 2.2 AA" },
];

export const HeroSection = () => {
  return (
    <section className="relative isolate overflow-hidden bg-background pb-16 pt-28 md:pb-24 md:pt-36">
      {/* Fundo: grade suave + brilhos da marca */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,hsl(var(--border)/0.6)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.6)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div aria-hidden="true" className="absolute -top-40 left-1/2 -z-10 h-[32rem] w-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.18),transparent)]" />

      <div className="container px-4">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
          <div className="text-center lg:text-left">
            <a
              href="#novidades"
              className="group mb-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/25 bg-primary/5 py-1.5 pl-1.5 pr-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Novo
              </span>
              Retornos automáticos e app com a sua marca
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </a>

            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Sua agenda cheia.{" "}
              <span className="bg-gradient-to-r from-primary to-brand-sky bg-clip-text text-transparent">
                Seus clientes voltando sozinhos.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground md:text-xl lg:mx-0">
              Agendamento online, lembretes por WhatsApp e e-mail, retorno automático de procedimentos e um app próprio com
              a logo do seu negócio. Tudo no {BRAND.name}.
            </p>

            {IS_DEMO ? (
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
                <Button asChild variant="brand" size="xl" className="group">
                  <Link to="/admin">
                    Entrar na demonstração
                    <ChevronRight className="transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="xl">
                  <Link to={`/s/${DEMO_SALON_SLUG}`}>Ver página de agendamento</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
                {/* /register cria o trial de 30 dias (useSubscription.startTrial). */}
                <Button asChild variant="brand" size="xl" className="group">
                  <Link to="/register">
                    Testar grátis por 30 dias
                    <ChevronRight className="transition-transform group-hover:translate-x-1" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="xl">
                  <a href={DEMO_URL}>
                    <PlayCircle aria-hidden />
                    Ver demonstração
                  </a>
                </Button>
              </div>
            )}
            <p className="mt-4 text-sm text-muted-foreground">Sem cartão de crédito · Cancele quando quiser</p>

            <ul className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-3 lg:justify-start">
              {trust.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Icon className="h-4 w-4 text-primary" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <ProductShowcase />
        </div>
      </div>
    </section>
  );
};
