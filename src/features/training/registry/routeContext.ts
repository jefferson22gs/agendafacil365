/**
 * Ajuda contextual determinística: rota → tour da tela e categoria prioritária.
 * Quando uma tela tiver vários subtours, o primeiro da lista é o "Tour desta tela".
 */
export interface RouteContext {
  tours: string[];
  category: string;
}

const MAP: Record<string, RouteContext> = {
  "/admin": { tours: ["dashboard", "overview"], category: "start" },
  "/admin/appointments": { tours: ["appointments", "appointments-new"], category: "agenda" },
  "/admin/clients": { tours: ["clients"], category: "clients" },
  "/admin/import-contacts": { tours: ["import-contacts"], category: "clients" },
  "/admin/export-contacts": { tours: ["export-contacts"], category: "clients" },
  "/admin/professionals": { tours: ["professionals"], category: "team" },
  "/admin/services": { tours: ["services"], category: "start" },
  "/admin/coupons": { tours: ["coupons"], category: "sales" },
  "/admin/packages": { tours: ["packages"], category: "sales" },
  "/admin/financial": { tours: ["financial"], category: "finance" },
  "/admin/analytics": { tours: ["analytics"], category: "finance" },
  "/admin/whatsapp": { tours: ["whatsapp-connect", "whatsapp-status"], category: "whatsapp" },
  "/admin/chatbot": { tours: ["chatbot-setup", "chatbot-knowledge", "chatbot-test", "chatbot-history"], category: "ai" },
  "/admin/status-scheduler": { tours: ["status-scheduler"], category: "whatsapp" },
  "/admin/broadcast": { tours: ["broadcast"], category: "marketing" },
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

export function contextForRoute(pathname: string, search = ""): RouteContext | undefined {
  void search; // abas de /admin/whatsapp: mapeadas pela central de WhatsApp (outra branch).
  const clean = pathname.replace(/\/+$/, "") || "/admin";
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
