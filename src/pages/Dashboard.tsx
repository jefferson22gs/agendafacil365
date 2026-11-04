import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/icons/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page-header";
import { StatCard, type StatTone } from "@/components/admin/StatCard";
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCog,
  ClipboardList,
  DollarSign,
  Gift, 
  Settings, 
  Bell,
  ChevronDown,
  Clock,
  UserCheck,
  AlertCircle,
  Menu,
  X,
  LogOut,
  Plus
} from "lucide-react";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Calendar, label: "Agendamentos", badge: 12 },
  { icon: Users, label: "Clientes" },
  { icon: UserCog, label: "Profissionais" },
  { icon: DollarSign, label: "Financeiro" },
  { icon: Gift, label: "Cupons" },
  { icon: Settings, label: "Configurações" },
];

const stats = [
  { 
    icon: Calendar, 
    label: "Agendamentos hoje", 
    value: "0", 
    change: "Novo",
    tone: "primary" as StatTone,
  },
  { 
    icon: DollarSign, 
    label: "Faturamento do mês", 
    value: "R$ 0", 
    change: "Início",
    tone: "success" as StatTone,
  },
  { 
    icon: UserCheck, 
    label: "Clientes ativos", 
    value: "0", 
    change: "Novo",
    tone: "primary" as StatTone,
  },
  { 
    icon: Clock, 
    label: "Horários ociosos", 
    value: "-", 
    change: "Configure",
    tone: "neutral" as StatTone,
  },
];

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasSalon, setHasSalon] = useState<boolean | null>(null);
  const { user, profile, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkSalon = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('salons')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();
      
      setHasSalon(!!data);
    };

    checkSalon();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuário';

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-sidebar border-r border-sidebar-border
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            <Logo size="sm" />
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 touch-target rounded-lg text-sidebar-foreground hover:text-sidebar-primary"
              aria-label="Fechar menu"
            >
              <X size={20} aria-hidden />
            </button>
          </div>

          {/* Salon Selector */}
          <div className="p-4">
            <button className="w-full flex items-center justify-between p-3 rounded-xl bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm" aria-hidden>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="font-medium text-sidebar-foreground text-sm truncate max-w-[120px]">
                    {hasSalon === false ? 'Criar estabelecimento' : displayName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isAdmin ? 'Administrador' : 'Cliente'}
                  </p>
                </div>
              </div>
              <ChevronDown size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-2">
            <ul className="space-y-1">
              {menuItems.map((item) => (
                <li key={item.label}>
                  <button className={`
                    w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors
                    ${item.active 
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent'
                    }
                  `}>
                    <div className="flex items-center gap-3">
                      <item.icon size={20} aria-hidden />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`
                        text-xs font-medium px-2 py-0.5 rounded-full
                        ${item.active ? 'bg-sidebar-primary-foreground/20' : 'bg-primary text-primary-foreground'}
                      `}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-sidebar-border">
            <button 
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <LogOut size={20} aria-hidden />
              <span className="font-medium">Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-4 lg:px-8 h-16">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 touch-target rounded-lg text-foreground"
                aria-label="Abrir menu"
                aria-expanded={sidebarOpen}
              >
                <Menu size={24} aria-hidden />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
                <p className="text-sm text-muted-foreground">Bem-vindo de volta, {displayName}!</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="relative p-2 touch-target rounded-lg hover:bg-secondary transition-colors" aria-label="Notificações">
                <Bell size={20} className="text-muted-foreground" aria-hidden />
                <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" aria-hidden />
              </button>
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold" title={displayName} aria-hidden>
                {displayName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {/* Welcome Card for New Users */}
          {hasSalon === false && (
            <Card className="mb-8 border-primary/30">
              <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-foreground mb-2">
                    Bem-vindo ao Agenda Fácil 365!
                  </h2>
                  <p className="text-muted-foreground">
                    Configure seu estabelecimento para começar a usar todas as funcionalidades do sistema.
                  </p>
                </div>
                <Button variant="brand" size="lg">
                  <Plus size={18} className="mr-2" aria-hidden />
                  Configurar meu estabelecimento
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Alerts */}
          {hasSalon === false && (
            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 p-4 rounded-xl border bg-primary/10 border-primary/20">
                <AlertCircle size={20} className="text-primary shrink-0" aria-hidden />
                <p className="text-sm text-foreground">
                  Complete a configuração do seu estabelecimento para liberar todas as funcionalidades
                </p>
                <Button variant="ghost" size="sm" className="ml-auto">
                  Configurar
                </Button>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => (
              <StatCard key={stat.label} icon={stat.icon} label={stat.label} value={stat.value} hint={stat.change} tone={stat.tone} />
            ))}
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upcoming Appointments */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between space-y-0 gap-3">
                <CardTitle className="text-xl">Agendamentos de hoje</CardTitle>
                <Button variant="brand-outline" size="sm">Ver todos</Button>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon={Calendar}
                  title="Nenhum agendamento para hoje"
                  description={hasSalon === false ? "Configure seu estabelecimento para começar a receber agendamentos." : undefined}
                  className="border-0 bg-transparent py-8"
                />
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Ações rápidas</CardTitle>
              </CardHeader>
              <CardContent>
              <div className="space-y-3">
                <Button variant="brand" className="w-full justify-start gap-3">
                  <Calendar size={18} aria-hidden />
                  Novo agendamento
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Users size={18} aria-hidden />
                  Cadastrar cliente
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <Gift size={18} aria-hidden />
                  Criar cupom
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3">
                  <ClipboardList size={18} aria-hidden />
                  Adicionar serviço
                </Button>
              </div>

              {/* Suggestion Card */}
              <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-sm font-medium text-foreground mb-2">Dica</p>
                <p className="text-sm text-muted-foreground mb-3">
                  {hasSalon === false
                    ? 'Configure seu estabelecimento para começar a usar o sistema completo'
                    : 'Adicione seus serviços e profissionais para começar a receber agendamentos'
                  }
                </p>
                <Button variant="brand" size="sm" className="w-full">
                  {hasSalon === false ? 'Configurar estabelecimento' : 'Adicionar serviço'}
                </Button>
              </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
