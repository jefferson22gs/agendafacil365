import { lazy, Suspense, type ComponentType } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { EmbeddedContext } from "./Shell";

const Connection = lazy(() => import("../WhatsAppConnection"));
const Inbox = lazy(() => import("./Inbox"));
const Broadcast = lazy(() => import("./Broadcast"));
const Status = lazy(() => import("../StatusScheduler"));
const Chatbot = lazy(() => import("../ChatbotIA").then(m => ({ default: m.ChatbotContent })));
const Import = lazy(() => import("../ImportContacts"));
const Export = lazy(() => import("../ExportContacts"));
// Espaço reservado na aba Chatbot para o card de automações do atendente IA (feat/atendente).
// Glob: enquanto o arquivo não existir, nada é renderizado e o build não quebra.
const automationCard = Object.values(import.meta.glob<{ default?: ComponentType; AutomationSettingsCard?: ComponentType }>("../../../components/whatsapp/AutomationSettingsCard.tsx"))[0];
const AutomationCard = automationCard ? lazy(() => automationCard().then(m => ({ default: (m.AutomationSettingsCard ?? m.default)! }))) : null;

export const TABS = [
  ["conversas", "Conversas"], ["disparador", "Disparador"], ["status", "Status"], ["chatbot", "Chatbot"], ["contatos", "Contatos"], ["conexao", "Conexão"],
] as const;
export type CentralTab = typeof TABS[number][0];
/** Rotas antigas abrem a aba correspondente. */
export const LEGACY_TAB: Record<string, string> = {
  "/admin/broadcast": "aba=disparador", "/admin/status-scheduler": "aba=status", "/admin/chatbot": "aba=chatbot",
  "/admin/import-contacts": "aba=contatos&contatos=importar", "/admin/export-contacts": "aba=contatos&contatos=exportar",
};
export const tabFrom = (value: string | null): CentralTab => (TABS.some(([id]) => id === value) ? value as CentralTab : "conversas");

export default function WhatsAppCentral() {
  const [params, setParams] = useSearchParams();
  const tab = tabFrom(params.get("aba"));
  const contacts = params.get("contatos") === "exportar" ? "exportar" : "importar";
  const go = (aba: string, extra: Record<string, string> = {}) => setParams({ aba, ...extra });
  const panel = { conexao: <Connection />, conversas: <Inbox />, disparador: <Broadcast />, status: <Status />, chatbot: <div className="space-y-6"><Chatbot />{AutomationCard && <AutomationCard />}</div>, contatos: contacts === "exportar" ? <Export /> : <Import /> }[tab];
  return <AdminLayout><div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
    <h1 className="text-2xl font-semibold">WhatsApp</h1>
    <nav data-tour="whatsapp-central-tabs" aria-label="Seções do WhatsApp" className="-mx-1 overflow-x-auto pb-1"><div role="tablist" className="flex w-max gap-1 px-1">
      {TABS.map(([id, label]) => <button key={id} type="button" role="tab" id={`wa-tab-${id}`} aria-selected={tab === id} aria-controls="wa-panel" data-tour={`whatsapp-tab-${id}`} onClick={() => go(id)} className={`min-h-11 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}>{label}</button>)}
    </div></nav>
    {tab === "contatos" && <div className="flex flex-wrap gap-2" role="group" aria-label="Contatos">
      {[["importar", "Importar"], ["exportar", "Exportar"]].map(([id, label]) => <button key={id} type="button" aria-pressed={contacts === id} data-tour={`whatsapp-contacts-${id}`} onClick={() => go("contatos", { contatos: id })} className={`min-h-11 rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:ring-primary ${contacts === id ? "border-primary bg-primary/10" : ""}`}>{label}</button>)}
    </div>}
    <div id="wa-panel" role="tabpanel" aria-labelledby={`wa-tab-${tab}`} className="min-w-0">
      <EmbeddedContext.Provider value={true}><Suspense fallback={<p role="status">Carregando…</p>}>{panel}</Suspense></EmbeddedContext.Provider>
    </div>
  </div></AdminLayout>;
}

/** /admin/broadcast etc. → /admin/whatsapp?aba=… preservando a query extra. */
export function LegacyWhatsAppRedirect() {
  const location = useLocation();
  const target = LEGACY_TAB[location.pathname.replace(/\/+$/, "")] ?? "aba=conversas";
  return <Navigate to={`/admin/whatsapp?${target}`} replace />;
}
