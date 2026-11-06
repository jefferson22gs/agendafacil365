import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Logo } from "@/components/icons/Logo";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePWA } from "@/hooks/usePWA";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { NotificationBell } from "@/components/admin/NotificationCenter";
import { ThemeSelector } from "@/components/admin/ThemeSelector";
import { FloatingActionButton } from "@/components/mobile/FloatingActionButton";
import { SubscriptionWarningBanner } from "@/components/subscription/SubscriptionWarningBanner";
import { ChevronDown, Menu, LogOut, WifiOff, Settings, Search, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpButton } from "@/features/training/HelpButton";
import { useOptionalTraining } from "@/features/training/TrainingProvider";
import { LAYOUT_IDS, isMenuTarget, sidebarId } from "@/features/training/tourIds";
import { NAV_GROUPS, BOTTOM_NAV, WHATSAPP_PATH, activeNav, filterNav, pageTitle, whatsappTabHref } from "./adminNav";

const COLLAPSED_KEY = "agendafacil365.sidebar.collapsed";
const navClass = "flex min-h-[44px] min-w-[44px] items-center gap-3 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring hover:bg-sidebar-accent";
// Ativo: fundo + barra lateral (não depende só de cor; branco sobre navy passa AA em qualquer paleta).
const selectedClass = "bg-sidebar-accent text-white font-semibold shadow-[inset_4px_0_0_hsl(var(--sidebar-ring))]";

export const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === "true"; } catch { return false; }
  });
  const [query, setQuery] = useState("");
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [salonName, setSalonName] = useState("");
  const [salonId, setSalonId] = useState<string | null>(null);
  const { user, profile, signOut } = useAuth();
  const { isOnline } = usePWA();
  const { isConnected } = useRealtimeNotifications(salonId || undefined);
  const navigate = useNavigate();
  const location = useLocation();
  const training = useOptionalTraining();
  const openerRef = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const current = activeNav(location.pathname, location.search);
  const tourTarget = training?.active?.tour.steps[training.active.step]?.target;
  const tourNeedsMenu = isMenuTarget(tourTarget);
  const mini = desktop && collapsed && !tourNeedsMenu;
  const groups = filterNav(NAV_GROUPS, tourNeedsMenu ? "" : query);
  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Usuário";

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => { setDesktop(media.matches); setSidebarOpen(false); };
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let alive = true;
    if (user) void supabase.from("salons").select("id, name").eq("owner_id", user.id).maybeSingle().then(({ data }) => {
      if (alive && data) { setSalonName(data.name); setSalonId(data.id); }
    });
    return () => { alive = false; };
  }, [user]);

  useEffect(() => { setSidebarOpen(false); setQuery(""); }, [location.pathname, location.search]);
  useEffect(() => { setWhatsappOpen(current.path === WHATSAPP_PATH); }, [current.path]);

  // O tour pode revelar navegação, nunca clicar em ações da página. Sheet mantém o foco e trava o fundo.
  useEffect(() => {
    if (tourNeedsMenu && !desktop) {
      openerRef.current = menuButtonRef.current;
      setSidebarOpen(true);
    } else setSidebarOpen(false);
  }, [tourNeedsMenu, desktop]);

  // A reserva acompanha a altura REAL da barra (fonte ampliada, safe-area e rotação incluídas).
  useEffect(() => {
    const bar = bottomRef.current;
    if (!bar) return;
    const observer = new ResizeObserver(() => rootRef.current?.style.setProperty("--admin-bottom-h", `${bar.getBoundingClientRect().height}px`));
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  const openMenu = (button: HTMLElement) => { openerRef.current = button; setSidebarOpen(true); };
  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try { localStorage.setItem(COLLAPSED_KEY, String(!value)); } catch { /* Preferência opcional. */ }
      return !value;
    });
  };
  const closeMenu = () => { setSidebarOpen(false); setQuery(""); };
  const handleSignOut = async () => { await signOut(); navigate("/"); };
  const labelled = (label: string, element: React.ReactElement) => mini ? (
    <Tooltip><TooltipTrigger asChild>{element}</TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip>
  ) : element;

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex shrink-0 items-center gap-2 border-b border-sidebar-border p-2">
        {!mini && <Logo size="sm" variant="white" className="min-w-0 flex-1 !shrink max-w-[184px]" />}
        {!desktop && <SheetClose className={cn(navClass, "ml-auto shrink-0")} aria-label="Fechar menu"><X size={22} aria-hidden /></SheetClose>}
        {desktop && labelled(mini ? "Expandir menu" : "Recolher menu", <button type="button" onClick={toggleCollapsed} data-tour={LAYOUT_IDS.sidebarCollapse} aria-label={mini ? "Expandir menu" : "Recolher menu"} aria-expanded={!mini} className={cn(navClass, "shrink-0")}>{mini ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}</button>)}
      </div>
      {!mini && <div className="relative shrink-0 px-3 py-2">
        <Search size={18} aria-hidden className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-sidebar-muted" />
        <input type="search" aria-label="Buscar no menu" placeholder="Buscar no menu" value={tourNeedsMenu ? "" : query} onChange={(e) => setQuery(e.target.value)} data-tour={LAYOUT_IDS.menuSearch} className="min-h-[44px] w-full rounded-lg border border-sidebar-border bg-sidebar-accent py-2 pl-9 pr-2 text-sm text-white placeholder:text-sidebar-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" />
      </div>}
      <nav aria-label="Menu principal" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 momentum-scroll" data-tour={LAYOUT_IDS.sidebar}>
        {labelled(salonName || "Configurar estabelecimento", <Link to="/admin/settings" onClick={closeMenu} data-tour={LAYOUT_IDS.salonSelector} aria-label={salonName ? `Configurações de ${salonName}` : "Configurar estabelecimento"} className={cn(navClass, "mb-2 bg-sidebar-accent")}>
          <Settings size={20} className="shrink-0" aria-hidden />
          {!mini && <span className="min-w-0 break-words"><span className="block font-semibold">{salonName || "Configurar estabelecimento"}</span><span className="block text-xs text-sidebar-muted">Administrador · {displayName}</span></span>}
        </Link>)}
        {!isOnline && <p role="status" className="my-2 flex items-center gap-2 px-3 py-2 text-sm"><WifiOff size={18} className="shrink-0" aria-hidden /><span className={mini ? "sr-only" : ""}>Modo offline</span></p>}
        {!groups.length && <p role="status" className="px-3 py-4 text-sm text-sidebar-muted">Nenhum item encontrado. Tente outro nome.</p>}
        {groups.map((group) => <section key={group.title} aria-label={group.title} className="mt-3">
          <h2 className={mini ? "sr-only" : "px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-sidebar-muted"}>{group.title}</h2>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = current.path === item.path;
              const expanded = !mini && (whatsappOpen || !!query.trim());
              return <li key={item.path}>
                <div className="flex items-center gap-1">
                  {labelled(item.label, <Link to={item.path} onClick={closeMenu} data-tour={sidebarId(item.path)} aria-label={mini ? item.label : undefined} aria-current={active ? "page" : undefined} className={cn(navClass, "min-w-0 flex-1", active && selectedClass)}>
                    <item.icon size={20} className="shrink-0" aria-hidden />
                    {!mini && <span className="break-words">{item.label}</span>}
                  </Link>)}
                  {item.children && !mini && <button type="button" className={cn(navClass, "shrink-0 px-2")} aria-label={expanded ? "Recolher abas do WhatsApp" : "Expandir abas do WhatsApp"} aria-expanded={expanded} aria-controls="whatsapp-submenu" onClick={() => setWhatsappOpen((value) => !value)}><ChevronDown size={18} aria-hidden className={expanded ? "rotate-180" : ""} /></button>}
                </div>
                {item.children && expanded && <ul id="whatsapp-submenu" className="ml-5 mt-1 space-y-1 border-l border-sidebar-border pl-2">
                  {item.children.map((sub) => <li key={sub.aba}><Link to={whatsappTabHref(sub.aba)} onClick={closeMenu} aria-current={active && current.aba === sub.aba ? "page" : undefined} className={cn(navClass, active && current.aba === sub.aba && selectedClass)}>{sub.label}</Link></li>)}
                </ul>}
              </li>;
            })}
          </ul>
        </section>)}
      </nav>
      <div className="shrink-0 border-t border-sidebar-border p-2">
        {labelled("Sair", <button type="button" onClick={() => void handleSignOut()} aria-label="Sair" className={cn(navClass, "w-full")}><LogOut size={20} className="shrink-0" aria-hidden />{!mini && <span>Sair</span>}</button>)}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="flex min-h-[100dvh] bg-background [--admin-bottom-h:5rem]">
      {desktop ? <aside aria-label="Navegação do painel" className={cn("sticky top-0 shrink-0 self-start border-r border-sidebar-border bg-sidebar safe-top safe-bottom", mini ? "w-[4.5rem]" : "w-64")} style={{ height: "calc(100dvh - var(--demo-bar-h, 0px))" }}>{sidebar}</aside> : (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent id="admin-sidebar" side="left" className="w-[min(22rem,calc(100vw-24px))] max-w-none border-sidebar-border bg-sidebar p-0 text-sidebar-foreground safe-top safe-bottom safe-left [&>button:last-child]:hidden" style={{ height: "calc(100dvh - var(--demo-bar-h, 0px))" }} onCloseAutoFocus={(e) => { e.preventDefault(); openerRef.current?.focus(); }}>
            <SheetTitle className="sr-only">Menu principal</SheetTitle>
            <SheetDescription className="sr-only">Navegue pelas áreas do painel. Busque um item ou role a lista. Escape fecha o menu.</SheetDescription>
            {sidebar}
          </SheetContent>
        </Sheet>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky-header">
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2 py-1 sm:px-4 lg:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {!desktop && <button ref={menuButtonRef} type="button" onClick={(e) => openMenu(e.currentTarget)} className="touch-target shrink-0 rounded-lg text-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring" aria-label="Abrir menu" aria-expanded={sidebarOpen} aria-controls="admin-sidebar" data-tour={LAYOUT_IDS.menuButton}><Menu size={24} aria-hidden /></button>}
              <div className="min-w-0">
                <p className="hidden truncate text-xs text-muted-foreground sm:block">{salonName || "Painel"}</p>
                <h1 className="truncate text-base font-semibold sm:text-lg" title={pageTitle(location.pathname, location.search)}>{pageTitle(location.pathname, location.search)}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 [&_button]:min-h-[44px] [&_button]:min-w-[44px]">
              <HelpButton />
              <ThemeSelector />
              {isConnected && <div className="hidden items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2 py-1 xl:flex" role="status"><span className="h-2 w-2 rounded-full bg-success" aria-hidden /><span className="text-xs font-medium text-success">Tempo real</span></div>}
              <div data-tour={LAYOUT_IDS.notifications}><NotificationBell /></div>
              <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground sm:flex" title={displayName} aria-hidden>{displayName.charAt(0).toUpperCase()}</div>
            </div>
          </div>
        </header>
        <SubscriptionWarningBanner />
        <main className="min-w-0 flex-1 overflow-x-auto p-4 sm:p-6 lg:p-8" style={!desktop ? { paddingBottom: "calc(var(--admin-bottom-h) + 5rem)" } : undefined}>{children}</main>
      </div>
      <nav ref={bottomRef} aria-label="Atalhos do painel" className="bottom-nav safe-left safe-right z-40 lg:hidden" data-tour={LAYOUT_IDS.bottomNav}>
        <div className="grid grid-cols-5 items-stretch gap-0.5 px-1 py-1">
          {BOTTOM_NAV.map((item) => <Link key={item.path} to={item.path} data-tour={`bottom-${sidebarId(item.path)}`} aria-current={current.path === item.path ? "page" : undefined} className={cn("flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 text-center text-xs focus-visible:ring-2 focus-visible:ring-ring", current.path === item.path ? "bg-secondary font-semibold text-foreground" : "text-muted-foreground")}><item.icon size={22} className="shrink-0" aria-hidden /><span className="max-w-full break-words">{item.label}</span></Link>)}
          <button type="button" data-tour={LAYOUT_IDS.bottomMenu} onClick={(e) => openMenu(e.currentTarget)} aria-label="Abrir menu completo" aria-expanded={sidebarOpen} aria-controls="admin-sidebar" className="flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg py-1 text-xs text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"><Menu size={22} aria-hidden /><span>Menu</span></button>
        </div>
      </nav>
      {!sidebarOpen && <FloatingActionButton className="bottom-[calc(var(--admin-bottom-h)+1rem)]" />}
    </div>
  );
};
