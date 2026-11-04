import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Tons semânticos do ícone. `success/warning/danger` só para indicadores que de fato expressam estado. */
const TONES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
} as const;

export type StatTone = keyof typeof TONES;

type StatCardProps = HTMLAttributes<HTMLDivElement> & {
  icon: LucideIcon;
  label: ReactNode;
  value: ReactNode;
  /** Texto curto auxiliar (ex.: "3 confirmados"). */
  hint?: ReactNode;
  tone?: StatTone;
};

/** Cartão de indicador padrão do painel: ícone com fundo suave, valor em destaque e rótulo. */
export const StatCard = ({ icon: Icon, label, value, hint, tone = "primary", className, ...props }: StatCardProps) => (
  <Card className={className} {...props}>
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", TONES[tone])} aria-hidden>
          <Icon size={22} />
        </div>
        {hint && <span className="text-right text-xs font-medium text-muted-foreground">{hint}</span>}
      </div>
      <p className="mt-4 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </CardContent>
  </Card>
);
