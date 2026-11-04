import {
  Calendar,
  Users,
  UserCog,
  BarChart3,
  Bell,
  Gift,
  Smartphone,
  Shield,
  Sparkles,
  Share2,
  Bot,
  ImagePlus,
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Agendamento online",
    description: "Seus clientes agendam pelo link do negócio, com confirmação automática via WhatsApp.",
  },
  {
    icon: Bot,
    title: "Chatbot IA no WhatsApp",
    description: "Atendimento automático 24/7 que responde dúvidas e agenda clientes sozinho.",
    isNew: true,
  },
  {
    icon: ImagePlus,
    title: "Status com IA",
    description: "Agende posts para o Status do WhatsApp com legendas geradas por Inteligência Artificial.",
    isNew: true,
  },
  {
    icon: Share2,
    title: "Página pública",
    description: "Cada profissional tem sua página exclusiva para compartilhar com clientes.",
    isNew: true,
  },
  {
    icon: Users,
    title: "Gestão de clientes",
    description: "Histórico completo, preferências e perfil de cada cliente.",
  },
  {
    icon: UserCog,
    title: "Controle de profissionais",
    description: "Agenda individual, comissões automáticas e desempenho em tempo real.",
  },
  {
    icon: BarChart3,
    title: "Painel financeiro",
    description: "Faturamento, ticket médio e serviços mais vendidos em um só lugar.",
  },
  {
    icon: Bell,
    title: "Automações",
    description: "Lembretes automáticos e sugestões de retorno para fidelizar clientes.",
  },
  {
    icon: Gift,
    title: "Cupons e promoções",
    description: "Crie cupons personalizados para horários ociosos e novos clientes.",
  },
];

const highlights = [
  { icon: Smartphone, text: "Funciona no celular" },
  { icon: Shield, text: "Dados seguros" },
  { icon: Sparkles, text: "IA integrada" },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="scroll-mt-20 bg-surface-1 py-16 md:py-24">
      <div className="container px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Tudo que o seu negócio precisa em um só lugar
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Recursos pensados para quem trabalha com horário marcado.
          </p>
        </div>

        <ul className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {features.map(({ icon: Icon, title, description, isNew }) => (
            <li
              key={title}
              className="relative rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              {isNew && (
                <span className="absolute right-4 top-4 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  Novo
                </span>
              )}
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </li>
          ))}
        </ul>

        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {highlights.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              <span className="font-medium text-foreground">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
