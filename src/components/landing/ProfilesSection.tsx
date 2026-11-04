import { Briefcase, Check, User, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";

const profiles = [
  {
    icon: Briefcase,
    title: "Para donos de negócio",
    role: "Administrador",
    description: "Controle total do seu negócio: painel completo, gestão financeira, equipe e muito mais.",
    features: [
      "Painel com métricas em tempo real",
      "Gestão de profissionais e comissões",
      "Controle financeiro completo",
      "Cupons e promoções",
      "Relatórios detalhados",
    ],
  },
  {
    icon: UserCog,
    title: "Para profissionais",
    role: "Cabeleireiro, barbeiro, esteticista e outros",
    description: "Visualize sua agenda, histórico de clientes e acompanhe suas comissões de forma simples.",
    features: [
      "Agenda pessoal organizada",
      "Histórico completo do cliente",
      "Visualização de comissões",
      "Atendimento rápido",
      "Notificações em tempo real",
    ],
  },
  {
    icon: User,
    title: "Para clientes",
    role: "Agendamento online",
    description: "Agende sem precisar ligar, receba lembretes e acompanhe seu histórico de atendimentos.",
    features: [
      "Agendamento online rápido",
      "Escolha de profissional",
      "Cupons de desconto",
      "Lembretes automáticos",
      "Histórico de atendimentos",
    ],
  },
];

export const ProfilesSection = () => {
  return (
    <section id="about" className="scroll-mt-20 bg-background py-16 md:py-24">
      <div className="container px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Uma experiência para cada perfil
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">Telas pensadas para cada tipo de usuário.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          {profiles.map(({ icon: Icon, title, role, description, features }) => (
            <article key={title} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-6 w-6 text-primary" aria-hidden />
              </div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{role}</p>
              <h3 className="text-xl font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-muted-foreground">{description}</p>

              <ul className="mb-8 mt-6 space-y-3">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button asChild variant="brand-outline" className="mt-auto h-11 w-full">
                <a href="#pricing">Ver planos</a>
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
