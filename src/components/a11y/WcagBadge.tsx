import { Accessibility } from "lucide-react";

/** Selo discreto de acessibilidade (rodapé). */
export function WcagBadge({ className = "" }: { className?: string }) {
  return (
    <p className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
      <Accessibility size={14} aria-hidden />
      <span>Desenvolvido conforme as diretrizes de acessibilidade <abbr title="Web Content Accessibility Guidelines">WCAG</abbr> 2.2 nível AA</span>
    </p>
  );
}
