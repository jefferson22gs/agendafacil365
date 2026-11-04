import { CalendarCheck, Settings2, Share2 } from "lucide-react";

// Depoimentos antigos removidos (pendentes de confirmação comercial). Seção virou "Como funciona".
const steps = [
  {
    icon: Settings2,
    title: "Cadastre seu negócio",
    text: "Informe dados do estabelecimento, horários de funcionamento, serviços e profissionais.",
  },
  {
    icon: Share2,
    title: "Compartilhe seu link",
    text: "Ative seu link de agendamento e divulgue nas redes sociais e no WhatsApp.",
  },
  {
    icon: CalendarCheck,
    title: "Receba agendamentos",
    text: "Os clientes escolhem serviço, profissional e horário; você acompanha tudo pelo painel.",
  },
];

export const TestimonialsSection = () => {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 bg-surface-1 py-16 md:py-24">
      <div className="container px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 id="how-title" className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Como funciona
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">Comece a receber agendamentos online em três passos.</p>
        </div>

        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <Icon className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
