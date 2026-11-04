/**
 * Fonte única da marca da plataforma (Agenda Fácil 365).
 * Não confundir com a identidade de cada estabelecimento (salons.name/logo_url/primary_color),
 * que continua vindo do banco e nunca é substituída por estes valores.
 */
export const BRAND = {
  id: "agenda-facil-365",
  name: "Agenda Fácil 365",
  shortName: "Agenda Fácil",
  description: "Agendamento online e gestão para negócios de serviços.",
  poweredBy: "Tecnologia Agenda Fácil 365",
  assets: {
    logo: "/brand/logo-horizontal.svg",
    logoWhite: "/brand/logo-horizontal-branco.svg",
    logoMono: "/brand/logo-horizontal-monocromatico.svg",
    logoVertical: "/brand/logo-vertical.svg",
    symbol: "/brand/simbolo.svg",
    symbolWhite: "/brand/simbolo-branco.svg",
    appIcon: "/brand/icone-app.svg",
    icon192: "/pwa-192x192.png",
    icon512: "/pwa-512x512.png",
    maskable512: "/pwa-maskable-512x512.png",
    appleTouch: "/apple-touch-icon.png",
    ogImage: "/og-image.png",
  },
  colors: {
    primary: "#2563EB",
    primaryHover: "#1D4ED8",
    sky: "#38BDF8",
    navy: "#14213D",
    background: "#F4F8FF",
    darkBackground: "#0B1220",
  },
} as const;

/**
 * `subscriptions.plan_name` gravado continua com o valor legado (contrato de dados/relatórios).
 * Só a exibição é traduzida para a nova marca.
 */
const PLAN_DISPLAY: Record<string, string> = {
  "SysHair Premium": "Agenda Fácil 365 Premium",
  "SysHair Trial Extension": "Agenda Fácil 365 – extensão de teste",
};
export const LEGACY_PLAN_NAME = "SysHair Premium";
export const displayPlanName = (name: string | null | undefined): string =>
  (name && (PLAN_DISPLAY[name] ?? name)) || PLAN_DISPLAY[LEGACY_PLAN_NAME];

/** Cor padrão para tenant sem cor válida salva (não usada para sobrescrever cor existente). */
export const DEFAULT_TENANT_COLOR = BRAND.colors.primary;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Aceita apenas HEX (#rgb/#rrggbb). Qualquer outro valor vindo do banco cai no fallback. */
export const safeHexColor = (value: string | null | undefined, fallback: string = DEFAULT_TENANT_COLOR): string =>
  typeof value === "string" && HEX.test(value.trim()) ? value.trim() : fallback;

/**
 * Origem pública para links compartilháveis. No navegador usa a origem atual;
 * fora dele não há origem confiável e o chamador deve fornecer uma configurada no servidor.
 */
export const publicOrigin = (): string => (typeof window !== "undefined" ? window.location.origin : "");
