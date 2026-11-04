import { CheckCircle2, Clock, Ban, UserX, CircleCheckBig } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Variant = NonNullable<BadgeProps["variant"]>;

/** Rótulo, variante e ícone por status de agendamento (valores gravados em appointments.status). */
const APPOINTMENT_STATUS: Record<string, { label: string; variant: Variant; icon: LucideIcon }> = {
  pending: { label: "Pendente", variant: "warning", icon: Clock },
  confirmed: { label: "Confirmado", variant: "success", icon: CheckCircle2 },
  completed: { label: "Concluído", variant: "info", icon: CircleCheckBig },
  cancelled: { label: "Cancelado", variant: "danger", icon: Ban },
  no_show: { label: "Não compareceu", variant: "secondary", icon: UserX },
};

/** Status sempre com texto + ícone; a cor é reforço, não a única informação. */
export const AppointmentStatusBadge = ({ status, className, ...props }: { status: string | null | undefined } & Omit<BadgeProps, "variant">) => {
  const cfg = status ? APPOINTMENT_STATUS[status] : undefined;
  const Icon = cfg?.icon;
  return (
    <Badge variant={cfg?.variant ?? "outline"} className={cn("gap-1 whitespace-nowrap", className)} {...props}>
      {Icon && <Icon size={12} aria-hidden />}
      {cfg?.label ?? status}
    </Badge>
  );
};
