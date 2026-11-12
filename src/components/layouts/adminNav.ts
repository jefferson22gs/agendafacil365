import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCog,
  ClipboardList,
  DollarSign,
  BarChart3,
  FileSignature,
  CalendarClock,
  Package,
  Gift,
  ShoppingBag,
  Building2,
  Brain,
  Smartphone,
  Megaphone,
  Star,
  Image,
  Settings,
  Crown,
  GraduationCap,
  Home,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Navegação do painel do dono: dados e regras puras (testadas em tests/rebrand/layout.test.cjs). */
export interface NavSub { label: string; aba: string; keywords?: string }
export interface NavItem { label: string; path: string; icon: LucideIcon; keywords?: string; children?: NavSub[] }
export interface NavGroup { title: string; items: NavItem[] }

export const WHATSAPP_PATH = "/admin/whatsapp";

/** Abas da central de WhatsApp (`/admin/whatsapp?aba=...`), na ordem do menu. */
export const WHATSAPP_TABS: NavSub[] = [
  { label: "Conversas", aba: "conversas", keywords: "mensagens atendimento" },
  { label: "Disparador", aba: "disparador", keywords: "disparo envio em massa broadcast campanha" },
  { label: "Agendador de status", aba: "status", keywords: "stories postagem" },
  { label: "Chatbot IA", aba: "chatbot", keywords: "robo assistente inteligencia artificial" },
  { label: "Fluxo de agendamento", aba: "fluxo", keywords: "typebot botoes lista menu numerado simulador evolution" },
  { label: "Contatos", aba: "contatos", keywords: "importar exportar vcf csv" },
  { label: "Conexão", aba: "conexao", keywords: "qr code numero conectar" },
];

/** Rotas antigas que viraram abas da central: continuam destacando o item WhatsApp. */
const LEGACY_WHATSAPP: Record<string, string> = {
  "/admin/broadcast": "disparador",
  "/admin/status-scheduler": "status",
  "/admin/chatbot": "chatbot",
  "/admin/import-contacts": "contatos",
  "/admin/export-contacts": "contatos",
};

export const whatsappTabHref = (aba: string) => `${WHATSAPP_PATH}?aba=${aba}`;

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Operação",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/admin", keywords: "inicio painel resumo" },
      { icon: Calendar, label: "Agendamentos", path: "/admin/appointments", keywords: "agenda horarios" },
      { icon: Users, label: "Clientes", path: "/admin/clients" },
      { icon: UserCog, label: "Profissionais", path: "/admin/professionals", keywords: "equipe funcionarios" },
      { icon: ClipboardList, label: "Serviços", path: "/admin/services", keywords: "precos" },
      { icon: CalendarClock, label: "Retornos & Lembretes", path: "/admin/returns", keywords: "retorno retoque manutencao recorrencia lembrete botox" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { icon: DollarSign, label: "Financeiro", path: "/admin/financial", keywords: "faturamento comissao" },
      { icon: BarChart3, label: "Analytics", path: "/admin/analytics", keywords: "relatorios graficos" },
      { icon: Package, label: "Pacotes", path: "/admin/packages", keywords: "combo" },
      { icon: Gift, label: "Cupons", path: "/admin/coupons", keywords: "desconto promocao" },
      { icon: ShoppingBag, label: "Produtos", path: "/admin/products", keywords: "loja estoque" },
      { icon: Building2, label: "Multi-Unidades", path: "/admin/multi-units", keywords: "franquia filial" },
      { icon: Brain, label: "Recursos Avançados", path: "/admin/advanced", keywords: "fidelidade metas indicacoes fila" },
    ],
  },
  {
    title: "Relacionamento",
    items: [
      { icon: Smartphone, label: "WhatsApp", path: WHATSAPP_PATH, keywords: "zap", children: WHATSAPP_TABS },
      { icon: Megaphone, label: "Marketing", path: "/admin/marketing", keywords: "campanha notificacoes" },
      { icon: Star, label: "Avaliações", path: "/admin/reviews", keywords: "notas comentarios" },
      { icon: Image, label: "Galeria", path: "/admin/gallery", keywords: "fotos antes depois" },
    ],
  },
  {
    title: "Configurações e ajuda",
    items: [
      { icon: Settings, label: "Configurações", path: "/admin/settings", keywords: "horarios link pix dados cobranca pagamento cartao mercado pago asaas pagbank infinitepay aplicativo notificacoes" },
      { icon: Crown, label: "Minha Assinatura", path: "/admin/subscription", keywords: "plano pagamento" },
      { icon: FileSignature, label: "Contrato", path: "/admin/contract", keywords: "contrato assinatura eletronica autentique" },
      { icon: GraduationCap, label: "Central de Treinamento", path: "/admin/training", keywords: "ajuda tutorial tour" },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** Barra inferior do celular: no máximo 4 destinos + "Menu". */
export const BOTTOM_NAV: Pick<NavItem, "label" | "path" | "icon">[] = [
  { icon: Home, label: "Início", path: "/admin" },
  { icon: Calendar, label: "Agenda", path: "/admin/appointments" },
  { icon: Users, label: "Clientes", path: "/admin/clients" },
  { icon: Smartphone, label: "WhatsApp", path: WHATSAPP_PATH },
];

const cleanPath = (pathname: string) => pathname.replace(/\/+$/, "") || "/admin";

/** Item do menu correspondente à URL atual (`aba` só para a central de WhatsApp). */
export function activeNav(pathname: string, search = ""): { path: string; aba?: string } {
  const clean = cleanPath(pathname);
  if (clean === WHATSAPP_PATH) {
    const aba = new URLSearchParams(search).get("aba") ?? "";
    return WHATSAPP_TABS.some((t) => t.aba === aba) ? { path: WHATSAPP_PATH, aba } : { path: WHATSAPP_PATH };
  }
  if (LEGACY_WHATSAPP[clean]) return { path: WHATSAPP_PATH, aba: LEGACY_WHATSAPP[clean] };
  if (clean.startsWith("/admin/training/")) return { path: "/admin/training" };
  return { path: clean };
}

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Busca rápida do menu: nome ou palavra-chave, sem acento. Pai que casa mostra todas as abas; senão só as abas que casam. */
export function filterNav(groups: NavGroup[], query: string): NavGroup[] {
  const q = normalize(query);
  if (!q) return groups;
  const hit = (label: string, keywords = "") => normalize(`${label} ${keywords}`).includes(q);
  return groups
    .map((g) => ({
      ...g,
      items: g.items.flatMap((item) => {
        if (hit(item.label, item.keywords)) return [item];
        const kids = item.children?.filter((c) => hit(c.label, c.keywords));
        return kids?.length ? [{ ...item, children: kids }] : [];
      }),
    }))
    .filter((g) => g.items.length > 0);
}

// Telas sem item próprio no menu (rotas antigas e sub-rotas).
const EXTRA_TITLES: Record<string, string> = {
  "/admin/broadcast": "Disparador",
  "/admin/status-scheduler": "Agendador de status",
  "/admin/chatbot": "Chatbot IA",
  "/admin/import-contacts": "Importar Contatos",
  "/admin/export-contacts": "Exportar Contatos",
};

/** Título do cabeçalho. */
export function pageTitle(pathname: string, search = ""): string {
  const clean = cleanPath(pathname);
  if (EXTRA_TITLES[clean]) return EXTRA_TITLES[clean];
  const { path, aba } = activeNav(clean, search);
  const item = NAV_ITEMS.find((i) => i.path === path);
  if (!item) return "Painel";
  const sub = aba ? item.children?.find((c) => c.aba === aba) : undefined;
  return sub ? `${item.label} · ${sub.label}` : item.label;
}
