import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cabeçalho padrão das telas administrativas: título, descrição e UMA ação principal à direita. */
export const PageHeader = ({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) => (
  <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6", className)}>
    <div className="min-w-0">
      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

/** Estado vazio com ícone, explicação e ação opcional. */
export const EmptyState = ({ icon: Icon, title, description, action, className }: { icon?: LucideIcon; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) => (
  <div className={cn("flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-border bg-card px-6 py-12", className)}>
    {Icon && (
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
        <Icon size={24} />
      </div>
    )}
    <p className="font-semibold text-foreground">{title}</p>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
