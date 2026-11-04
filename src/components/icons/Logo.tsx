import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** false = apenas o símbolo (compacto). Mantido por compatibilidade. */
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  /** "default" para fundos claros; "white" para navy/escuro; "auto" segue o modo de cor. */
  variant?: "default" | "white" | "auto";
  /** true quando o nome da marca já está escrito ao lado (logo vira decorativo). */
  decorative?: boolean;
}

// Alturas em px; o SVG preserva a proporção (horizontal 1502×316, símbolo 300×316).
const HEIGHTS = { sm: 32, md: 40, lg: 52 } as const;

export const Logo = ({ className = "", showText = true, size = "md", variant = "auto", decorative = false }: LogoProps) => {
  const h = HEIGHTS[size];
  const alt = decorative ? "" : BRAND.name;
  const [light, dark] = showText
    ? [BRAND.assets.logo, BRAND.assets.logoWhite]
    : [BRAND.assets.symbol, BRAND.assets.symbolWhite];
  const img = (src: string, extra = "") => (
    <img src={src} alt={alt} height={h} style={{ height: h }} className={cn("w-auto max-w-full select-none", extra)} draggable={false} />
  );

  return (
    <span className={cn("inline-flex items-center shrink-0", className)}>
      {variant === "default" && img(light)}
      {variant === "white" && img(dark)}
      {variant === "auto" && (
        <>
          {img(light, "dark:hidden")}
          {img(dark, "hidden dark:block")}
        </>
      )}
    </span>
  );
};
