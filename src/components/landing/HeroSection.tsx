import { Button } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import { CalendarCheck, ChevronRight, Link2, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { DEMO_SALON_SLUG, IS_DEMO } from "@/config/demo";

const benefits = [
  { icon: Link2, title: "Link de agendamento", text: "Seus clientes escolhem serviço, profissional e horário sem precisar ligar." },
  { icon: MessageSquare, title: "Lembretes por WhatsApp", text: "Confirmações e lembretes automáticos para quem agendou." },
  { icon: CalendarCheck, title: "Agenda organizada", text: "Equipe, clientes e financeiro do negócio no mesmo painel." },
];

export const HeroSection = () => {
  return (
    <section className="bg-background pt-28 pb-16 md:pt-36 md:pb-24">
      <div className="container px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-6 inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground">
            {BRAND.description}
          </p>

          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Agendamento online e um negócio{" "}
            <span className="text-primary">organizado de verdade</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            O {BRAND.name} reúne agenda, clientes, equipe e financeiro para cabeleireiros, barbearias, estética e
            outros prestadores de serviço que trabalham com horário marcado.
          </p>

          {IS_DEMO ? (
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
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
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {/* /register cria o trial de 21 dias (useSubscription.startTrial). */}
            <Button asChild variant="brand" size="xl" className="group">
              <Link to="/register">
                Criar conta e testar 21 dias
                <ChevronRight className="transition-transform group-hover:translate-x-1" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl">
              <a href="#pricing">Ver planos</a>
            </Button>
          </div>
          )}
        </div>

        <ul className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
          {benefits.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
