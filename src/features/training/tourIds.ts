/**
 * Alvos de tour = valores do atributo `data-tour` no JSX.
 * Padrão: `<modulo>-<elemento>` em kebab-case (ex.: `services-new-button`).
 * Nunca use classes CSS, posição no DOM ou texto como alvo.
 * `npm run training:check` confere se todo alvo usado nos tours existe em algum `data-tour` do código.
 */
export type TourId = string;

/** Alvos do layout administrativo (menu lateral, barra inferior, cabeçalho). */
export const LAYOUT_IDS = {
  sidebar: "layout-sidebar",
  menuButton: "layout-menu-button",
  helpButton: "layout-help-button",
  notifications: "layout-notifications",
  bottomNav: "layout-bottom-nav",
  bottomMenu: "layout-bottom-menu",
  salonSelector: "layout-salon-selector",
  menuSearch: "layout-menu-search",
  sidebarCollapse: "layout-sidebar-collapse",
} as const;

/** Alvos que ficam dentro do menu lateral: no celular/tablet o layout abre o menu enquanto o passo está ativo. */
export const isMenuTarget = (id?: TourId) =>
  !!id && (id.startsWith("sidebar-") || id === LAYOUT_IDS.sidebar || id === LAYOUT_IDS.salonSelector || id === LAYOUT_IDS.menuSearch || id === LAYOUT_IDS.sidebarCollapse);

/** `data-tour` de cada item do menu lateral, derivado da rota: /admin/services → sidebar-services. */
export const sidebarId = (path: string): TourId =>
  path === "/admin" ? "sidebar-dashboard" : `sidebar-${path.replace("/admin/", "")}`;

/** Selector CSS para um alvo. */
export const tourSelector = (id: TourId) => `[data-tour="${CSS.escape(id)}"]`;
