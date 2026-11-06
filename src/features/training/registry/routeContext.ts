/**
 * Ajuda contextual determinística: rota → tour da tela e categoria prioritária.
 * Quando uma tela tiver vários subtours, o primeiro da lista é o "Tour desta tela".
 * Rotas com query (abas da central /admin/whatsapp) usam a chave "caminho?aba=x".
 */
export interface RouteContext {
  tours: string[];
  category: string;
}

const WHATSAPP = "/admin/whatsapp";

const MAP: Record<string, RouteContext> = {
  "/admin": { tours: ["dashboard", "overview"], category: "start" },
  "/admin/appointments": { tours: ["appointments", "appointments-new"], category: "agenda" },
  "/admin/clients": { tours: ["clients"], category: "clients" },
  "/admin/professionals": { tours: ["professionals"], category: "team" },
  "/admin/services": { tours: ["services"], category: "start" },
  "/admin/coupons": { tours: ["coupons"], category: "sales" },
  "/admin/packages": { tours: ["packages"], category: "sales" },
  "/admin/financial": { tours: ["financial"], category: "finance" },
  "/admin/analytics": { tours: ["analytics"], category: "finance" },
  [`${WHATSAPP}?aba=conexao`]: { tours: ["whatsapp-connect", "whatsapp-status"], category: "whatsapp" },
  [`${WHATSAPP}?aba=conversas`]: { tours: ["whatsapp-inbox"], category: "whatsapp" },
  [`${WHATSAPP}?aba=disparador`]: { tours: ["broadcast"], category: "marketing" },
  [`${WHATSAPP}?aba=status`]: { tours: ["status-scheduler"], category: "whatsapp" },
  [`${WHATSAPP}?aba=chatbot`]: { tours: ["chatbot-setup", "chatbot-knowledge", "chatbot-test"], category: "ai" },
  [`${WHATSAPP}?aba=contatos`]: { tours: ["import-contacts", "export-contacts"], category: "clients" },
  [`${WHATSAPP}?aba=contatos&contatos=exportar`]: { tours: ["export-contacts", "import-contacts"], category: "clients" },
  "/admin/advanced": { tours: ["advanced"], category: "advanced" },
  "/admin/products": { tours: ["products"], category: "sales" },
  "/admin/reviews": { tours: ["reviews"], category: "marketing" },
  "/admin/gallery": { tours: ["gallery"], category: "marketing" },
  "/admin/multi-units": { tours: ["multi-units"], category: "advanced" },
  "/admin/subscription": { tours: ["subscription"], category: "settings" },
  "/admin/marketing": { tours: ["marketing"], category: "marketing" },
  "/admin/settings": { tours: ["settings-info", "settings-hours", "settings-public-link", "settings-branding", "settings-notifications", "settings-pix"], category: "settings" },
  "/admin/training": { tours: ["training-center", "overview"], category: "start" },
};

/** Rotas antigas, caso ainda abram fora da central. */
const LEGACY_TABS: Record<string, string> = {
  "/admin/chatbot": "aba=chatbot",
  "/admin/broadcast": "aba=disparador",
  "/admin/status-scheduler": "aba=status",
  "/admin/import-contacts": "aba=contatos",
  "/admin/export-contacts": "aba=contatos&contatos=exportar",
};

export function contextForRoute(pathname: string, search = ""): RouteContext | undefined {
  const clean = pathname.replace(/\/+$/, "") || "/admin";
  if (clean === WHATSAPP || LEGACY_TABS[clean]) {
    const params = new URLSearchParams(LEGACY_TABS[clean] ?? search);
    const tab = params.get("aba") || "conversas"; // mesma aba padrão de WhatsAppCentral.tabFrom
    const sub = tab === "contatos" && params.get("contatos") === "exportar" ? "&contatos=exportar" : "";
    return MAP[`${WHATSAPP}?aba=${tab}${sub}`] ?? MAP[`${WHATSAPP}?aba=conversas`];
  }
  if (MAP[clean]) return MAP[clean];
  if (clean.startsWith("/admin/training/")) return { tours: ["training-article"], category: "start" };
  return undefined;
}

/** A tela atual já é a rota do tour? Com query, exige o caminho e cada parâmetro da rota (outros parâmetros são ignorados). */
export function isAtRoute(route: string, pathname: string, search: string): boolean {
  const [path, query = ""] = route.split("?");
  if (pathname.replace(/\/+$/, "") !== path.replace(/\/+$/, "")) return false;
  const current = new URLSearchParams(search);
  return [...new URLSearchParams(query)].every(([key, value]) => current.get(key) === value);
}
