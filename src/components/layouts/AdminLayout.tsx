import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Logo } from "@/components/icons/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePWA } from "@/hooks/usePWA";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { NotificationBell } from "@/components/admin/NotificationCenter";
import { ThemeSelector } from "@/components/admin/ThemeSelector";
import { FloatingActionButton } from "@/components/mobile/FloatingActionButton";
import { SubscriptionWarningBanner } from "@/components/subscription/SubscriptionWarningBanner";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  DollarSign,
  Gift,
  Settings,
  Bell,
  ChevronDown,
  Menu,
  X,
  LogOut,
  UserCog,
  ClipboardList,
  BarChart3,
  Package,
  ShoppingBag,
  Star,
  Building2,
  Image,
  Home,
  WifiOff,
  Trophy,
  Clock,
  Share2,
  Brain,
  Crown,
  Megaphone,
  Bot,
  CalendarDays,
  Smartphone,
  Send,
  Upload
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GraduationCap } from "lucide-react";
import { HelpButton } from "@/features/training/HelpButton";
import { LAYOUT_IDS, sidebarId } from "@/features/training/tourIds";

interface AdminLayoutProps {
  children: React.ReactNode;
}

// Mesmos 23 destinos de antes, agrupados. Paths e data-tour (sidebarId) inalterados.
const menuGroups = [
  {
    title: "Operação",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/admin", shortLabel: "Início" },
      { icon: Calendar, label: "Agendamentos", path: "/admin/appointments", shortLabel: "Agenda" },
      { icon: Users, label: "Clientes", path: "/admin/clients", shortLabel: "Clientes" },
      { icon: UserCog, label: "Profissionais", path: "/admin/professionals", shortLabel: "Equipe" },
      { icon: ClipboardList, label: "Serviços", path: "/admin/services", shortLabel: "Serviços" },
    ],
  },
  {
    title: "Gestão",
    items: [
      { icon: DollarSign, label: "Financeiro", path: "/admin/financial", shortLabel: "Financeiro" },
      { icon: BarChart3, label: "Analytics", path: "/admin/analytics", shortLabel: "Analytics" },
      { icon: Package, label: "Pacotes", path: "/admin/packages", shortLabel: "Pacotes" },
      { icon: Gift, label: "Cupons", path: "/admin/coupons", shortLabel: "Cupons" },
      { icon: ShoppingBag, label: "Produtos", path: "/admin/products", shortLabel: "Produtos" },
      { icon: Building2, label: "Multi-Unidades", path: "/admin/multi-units", shortLabel: "Unidades" },
      { icon: Brain, label: "Recursos Avançados", path: "/admin/advanced", shortLabel: "Avançado" },
    ],
  },
  {
    title: "Relacionamento",
    items: [
      { icon: Smartphone, label: "WhatsApp", path: "/admin/whatsapp", shortLabel: "WhatsApp", isNew: true },
      { icon: Bot, label: "Chatbot IA", path: "/admin/chatbot", shortLabel: "Chatbot", isNew: true },
      { icon: Send, label: "Disparador", path: "/admin/broadcast", shortLabel: "Disparo", isNew: true },
      { icon: CalendarDays, label: "Agendador Status", path: "/admin/status-scheduler", shortLabel: "Status", isNew: true },
      { icon: Megaphone, label: "Marketing", path: "/admin/marketing", shortLabel: "Marketing" },
      { icon: Star, label: "Avaliações", path: "/admin/reviews", shortLabel: "Avaliações" },
      { icon: Image, label: "Galeria", path: "/admin/gallery", shortLabel: "Galeria" },
      { icon: Upload, label: "Importar Contatos", path: "/admin/import-contacts", shortLabel: "Importar", isNew: true },
    ],
  },
  {
    title: "Configurações e ajuda",
    items: [
      { icon: Settings, label: "Configurações", path: "/admin/settings", shortLabel: "Config" },
      { icon: Crown, label: "Minha Assinatura", path: "/admin/subscription", shortLabel: "Assinatura" },
      { icon: GraduationCap, label: "Central de Treinamento", path: "/admin/training", shortLabel: "Ajuda" },
    ],
  },
];
const menuItems = menuGroups.flatMap(g => g.items);

// Título do cabeçalho também para sub-rotas sem item próprio.
const EXTRA_TITLES: Record<string, string> = { "/admin/export-contacts": "Exportar Contatos" };
const pageTitle = (pathname: string) =>
  menuItems.find(i => i.path === pathname)?.label
  ?? EXTRA_TITLES[pathname]
  ?? (pathname.startsWith("/admin/training/") ? "Central de Treinamento" : "Dashboard");

// Bottom navigation items (mobile only) - most used features
const bottomNavItems = [
  { icon: Home, label: "Início", path: "/admin" },
  { icon: Calendar, label: "Agenda", path: "/admin/appointments" },
  { icon: Users, label: "Clientes", path: "/admin/clients" },
  { icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
  { icon: Menu, label: "Menu", path: "menu" },
];

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [salonName, setSalonName] = useState<string>("");
  const [salonId, setSalonId] = useState<string | null>(null);
  const { user, profile, signOut, isAdmin } = useAuth();
  const { isOnline } = usePWA();
  const navigate = useNavigate();
  const location = useLocation();

  // Notificações em tempo real
  const { notifications, unreadCount, isConnected } = useRealtimeNotifications(salonId || undefined);

  useEffect(() => {
    fetchSalonData();
  }, [user]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Drawer mobile: Esc fecha, foco entra no drawer e volta ao botão que abriu.
  const sidebarRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!sidebarOpen) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    sidebarRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
      if (e.key !== "Tab" || !sidebarRef.current) return;
      const f = sidebarRef.current.querySelectorAll<HTMLElement>("button, a[href]");
      if (!f.length) return;
      const [first, last] = [f[0], f[f.length - 1]];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      openerRef.current?.focus?.();
    };
  }, [sidebarOpen]);

  const fetchSalonData = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('salons')
      .select('id, name')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (data) {
      setSalonName(data.name);
      setSalonId(data.id);
      console.log('🔔 Salon ID carregado para notificações:', data.id);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleBottomNavClick = (path: string) => {
    if (path === "menu") {
      setSidebarOpen(true);
    } else {
      navigate(path);
    }
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuário';

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-brand-navy/50 backdrop-blur-[2px] z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar navy (logo branco integral) */}
      <aside
        ref={sidebarRef}
        id="admin-sidebar"
        aria-label="Menu principal"
        className={cn(
          "fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-50",
          "w-[280px] lg:w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
          "transform transition-transform duration-300 ease-in-out",
          "safe-top safe-bottom",
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between gap-2 px-4 h-16 border-b border-sidebar-border">
            <Logo size="sm" variant="white" className="max-w-[184px]" />
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent touch-target"
              aria-label="Fechar menu"
            >
              <X size={22} aria-hidden />
            </button>
          </div>

          {/* Estabelecimento */}
          <div className="p-3">
            <button
              onClick={() => navigate('/admin/settings')}
              data-tour={LAYOUT_IDS.salonSelector}
              className="w-full flex items-center justify-between gap-2 p-3 rounded-xl bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors touch-target focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0" aria-hidden>
                  {salonName ? salonName.charAt(0).toUpperCase() : displayName.charAt(0).toUpperCase()}
                </div>
                <div className="text-left min-w-0">
                  <p className="font-semibold text-sidebar-foreground text-sm truncate">
                    {salonName || "Configurar estabelecimento"}
                  </p>
                  <p className="text-xs text-sidebar-muted">Administrador</p>
                </div>
              </div>
              <Settings size={16} className="text-sidebar-muted flex-shrink-0" aria-hidden />
            </button>
          </div>

          {!isOnline && (
            <div role="status" className="mx-3 mb-2 px-3 py-2 rounded-lg bg-white/10 border border-white/15 flex items-center gap-2 text-sidebar-foreground text-sm">
              <WifiOff size={16} aria-hidden />
              <span>Modo offline</span>
            </div>
          )}

          {/* Navegação agrupada */}
          <nav className="flex-1 px-3 pb-3 overflow-y-auto momentum-scroll" data-tour={LAYOUT_IDS.sidebar}>
            {menuGroups.map((group) => (
              <div key={group.title} className="mt-3 first:mt-0">
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">{group.title}</p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.path || (item.path === "/admin/training" && location.pathname.startsWith("/admin/training/"));
                    return (
                      <li key={item.path}>
                        <button
                          data-tour={sidebarId(item.path)}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => {
                            navigate(item.path);
                            setSidebarOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 min-h-[44px] rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                            isActive
                              ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold'
                              : 'text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-white'
                          )}
                        >
                          <item.icon size={18} className="flex-shrink-0" aria-hidden />
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="p-3 border-t border-sidebar-border safe-bottom">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 min-h-[44px] rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <LogOut size={18} aria-hidden />
              <span className="font-medium">Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Top Header */}
        <header className="sticky-header">
          <div className="flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-8 h-14 lg:h-16">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg text-foreground hover:bg-secondary touch-target -ml-2"
                aria-label="Abrir menu"
                aria-expanded={sidebarOpen}
                aria-controls="admin-sidebar"
                data-tour={LAYOUT_IDS.menuButton}
              >
                <Menu size={24} aria-hidden />
              </button>
              <Logo size="sm" showText={false} className="hidden sm:inline-flex lg:hidden" />
              <div className="min-w-0">
                <p className="hidden sm:block text-xs text-muted-foreground truncate">{salonName || "Painel"}</p>
                <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">
                  {pageTitle(location.pathname)}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <HelpButton />
              <ThemeSelector />

              {isConnected && (
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20" role="status">
                  <span className="w-2 h-2 rounded-full bg-success" aria-hidden />
                  <span className="text-xs text-success font-medium">Tempo real</span>
                </div>
              )}

              <div data-tour={LAYOUT_IDS.notifications}>
                <NotificationBell />
              </div>
              <div className="hidden sm:flex w-9 h-9 rounded-full bg-primary items-center justify-center text-primary-foreground text-sm font-semibold" title={displayName} aria-hidden>
                {displayName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Subscription Warning Banner */}
        <SubscriptionWarningBanner />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="bottom-nav lg:hidden" data-tour={LAYOUT_IDS.bottomNav}>
        <div className="flex items-center justify-around h-16">
          {bottomNavItems.map((item) => {
            const isActive = item.path !== "menu" && location.pathname === item.path;
            const isMenu = item.path === "menu";

            return (
              <button
                key={item.label}
                data-tour={isMenu ? LAYOUT_IDS.bottomMenu : `bottom-${sidebarId(item.path)}`}
                onClick={() => handleBottomNavClick(item.path)}
                aria-current={isActive ? "page" : undefined}
                aria-expanded={isMenu ? sidebarOpen : undefined}
                aria-controls={isMenu ? "admin-sidebar" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[60px] touch-target rounded-lg",
                  isActive ? "text-primary font-semibold" : "text-muted-foreground",
                  isMenu && sidebarOpen && "text-primary"
                )}
              >
                <item.icon size={22} aria-hidden />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Action Button - Mobile Only */}
      <FloatingActionButton />
    </div>
  );
};
