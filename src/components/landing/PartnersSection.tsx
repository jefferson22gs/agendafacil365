import { Scissors, Sparkles, Store, Clock } from "lucide-react";

// Mostra apenas o público-alvo (segmentos). Nomes de clientes/parceiros só com confirmação comercial.
const segments = [
  { icon: Scissors, label: "Salões e cabeleireiros" },
  { icon: Store, label: "Barbearias" },
  { icon: Sparkles, label: "Estética" },
  { icon: Clock, label: "Outros serviços com hora marcada" },
];

export const PartnersSection = () => {
  return (
    <section aria-labelledby="segments-title" className="border-y border-border bg-card py-10">
      <div className="container px-4">
        <h2 id="segments-title" className="mb-6 text-center text-sm font-medium text-muted-foreground">
          Feito para negócios de serviços que trabalham com agenda
        </h2>
        <ul className="grid grid-cols-1 gap-3 xs:grid-cols-2 md:grid-cols-4">
          {segments.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3">
              <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span className="text-sm font-medium text-foreground">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
