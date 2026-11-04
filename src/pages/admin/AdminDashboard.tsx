import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SalonInsights } from "@/components/admin/SalonInsights";
import { ClientMetricsCard } from "@/components/admin/ClientMetricsCard";
import { AdminNotificationCenter } from "@/components/admin/AdminNotificationCenter";
import { WelcomeCard } from "@/features/training/WelcomeCard";
import { FirstStepsChecklist } from "@/features/training/FirstStepsChecklist";
import { SkeletonDashboard } from "@/components/ui/skeleton-card";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { StatCard, type StatTone } from "@/components/admin/StatCard";
import { AppointmentStatusBadge } from "@/components/admin/AppointmentStatusBadge";
import {
  Calendar,
  DollarSign,
  UserCheck,
  Clock,
  TrendingUp,
  Plus,
  Users,
  ShoppingBag,
  Gift,
  AlertCircle
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Appointment = Tables<"appointments">;

const AdminDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [hasSalon, setHasSalon] = useState(false);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    monthRevenue: 0,
    activeClients: 0,
    idleHours: 0,
  });
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      // Check if user has a salon
      const { data: salon } = await supabase
        .from('salons')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!salon) {
        setHasSalon(false);
        setLoading(false);
        return;
      }

      setHasSalon(true);
      setSalonId(salon.id);

      // Use local date (not UTC) to avoid timezone offset issues (Brazil is UTC-3)
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Fetch ALL of today's appointments (not just future ones)
      const { data: appointments } = await supabase
        .from('appointments')
        .select(`
          *,
          services:service_id (name, duration_minutes),
          professionals:professional_id (name)
        `)
        .eq('salon_id', salon.id)
        .eq('date', today)
        .order('start_time');

      setTodayAppointments(appointments || []);

      // Count today's appointments (apenas futuros)
      const todayCount = appointments?.length || 0;

      // Calculate month revenue
      const { data: monthAppointments } = await supabase
        .from('appointments')
        .select('final_price')
        .eq('salon_id', salon.id)
        .eq('status', 'completed')
        .gte('created_at', startOfMonth);

      const monthRevenue = monthAppointments?.reduce((sum, apt) => sum + (apt.final_price || 0), 0) || 0;

      // Count active clients
      const { count: clientsCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('salon_id', salon.id);

      setStats({
        todayAppointments: todayCount,
        monthRevenue: monthRevenue,
        activeClients: clientsCount || 0,
        idleHours: 0, // TODO: Calculate based on working hours
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuário';

  const statsCards = [
    {
      icon: Calendar,
      label: "Agendamentos hoje",
      value: stats.todayAppointments.toString(),
      change: todayAppointments.length > 0 ? `${todayAppointments.filter(a => a.status === 'confirmed').length} confirmados` : "Nenhum",
      tone: "primary" as StatTone,
    },
    {
      icon: DollarSign,
      label: "Faturamento do mês",
      value: `R$ ${stats.monthRevenue.toFixed(2)}`,
      // Soma apenas agendamentos concluídos no mês (ver query acima).
      change: "Concluídos",
      tone: "success" as StatTone,
    },
    {
      icon: UserCheck,
      label: "Clientes cadastrados",
      value: stats.activeClients.toString(),
      change: "Total",
      tone: "primary" as StatTone,
    },
    {
      icon: Clock,
      label: "Próximo horário",
      value: todayAppointments.length > 0 ? todayAppointments[0]?.start_time?.slice(0, 5) : "-",
      change: todayAppointments.length > 0 ? todayAppointments[0]?.services?.name : "Sem agenda",
      tone: "neutral" as StatTone,
    },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <SkeletonDashboard />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div data-tour="dashboard-header">
          <PageHeader
            className="mb-0"
            title={`Olá, ${displayName}`}
            description={hasSalon ? "Acompanhe o dia e o desempenho do seu estabelecimento." : "Configure seu estabelecimento para começar."}
            actions={hasSalon ? (
              <Button variant="brand" onClick={() => navigate('/admin/appointments')}>
                <Plus size={18} className="mr-2" aria-hidden />
                Novo agendamento
              </Button>
            ) : undefined}
          />
        </div>

        {hasSalon && (
          <>
            <WelcomeCard />
            <FirstStepsChecklist />
          </>
        )}

        {/* Notificações */}
        {hasSalon && <AdminNotificationCenter />}

        {/* Primeiro acesso: estabelecimento ainda não configurado */}
        {!hasSalon && (
          <Card className="border-primary/30" data-tour="dashboard-no-salon">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0" aria-hidden>
                    <AlertCircle size={24} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      Bem-vindo ao Agenda Fácil 365!
                    </h2>
                    <p className="text-muted-foreground">
                      Configure seu estabelecimento para começar a usar todas as funcionalidades
                    </p>
                  </div>
                </div>
                <Button variant="brand" size="lg" onClick={() => navigate('/admin/settings')}>
                  <Plus size={18} className="mr-2" aria-hidden />
                  Configurar estabelecimento
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Indicadores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="dashboard-stats">
          {statsCards.map((stat) => (
            <StatCard key={stat.label} icon={stat.icon} label={stat.label} value={stat.value} hint={stat.change} tone={stat.tone} />
          ))}
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agendamentos de hoje */}
          <Card className="lg:col-span-2" data-tour="dashboard-today">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Agendamentos de hoje</CardTitle>
                <Button variant="brand-outline" size="sm" onClick={() => navigate('/admin/appointments')} data-tour="dashboard-today-all">
                  Ver todos
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!hasSalon ? (
                <EmptyState icon={Calendar} title="Agenda indisponível" description="Configure seu estabelecimento para ver agendamentos." className="border-0 bg-transparent py-8" />
              ) : todayAppointments.length === 0 ? (
                <EmptyState icon={Calendar} title="Nenhum agendamento para hoje" description="Os agendamentos aparecerão aqui quando forem criados." className="border-0 bg-transparent py-8" />
              ) : (
                <ul className="space-y-2">
                  {todayAppointments.slice(0, 5).map((appointment) => (
                    <li
                      key={appointment.id}
                      className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-xl surface-2 border border-border/60"
                    >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="w-14 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-semibold tabular-nums shrink-0">
                          {appointment.start_time?.slice(0, 5)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {appointment.client_name || 'Cliente'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {appointment.services?.name} • {appointment.professionals?.name}
                          </p>
                        </div>
                      </div>
                      <AppointmentStatusBadge status={appointment.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Insights */}
          {salonId && <SalonInsights salonId={salonId} />}
        </div>

        {/* Second Row - Client Metrics & Quick Actions */}
        {salonId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ClientMetricsCard salonId={salonId} />

            {/* Ações rápidas */}
            <Card data-tour="dashboard-quick-actions">
              <CardHeader>
                <CardTitle>Ações rápidas</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="brand"
                  className="w-full justify-start gap-3 sm:col-span-2"
                  onClick={() => navigate('/admin/appointments')}
                >
                  <Calendar size={18} aria-hidden />
                  Novo agendamento
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => navigate('/admin/clients')}
                >
                  <Users size={18} aria-hidden />
                  Ver clientes
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => navigate('/admin/analytics')}
                >
                  <TrendingUp size={18} aria-hidden />
                  Dashboard Analítico
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => navigate('/admin/packages')}
                >
                  <Gift size={18} aria-hidden />
                  Gerenciar pacotes
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                  onClick={() => navigate('/admin/products')}
                >
                  <ShoppingBag size={18} aria-hidden />
                  Produtos
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {!salonId && (
          <Card>
            <CardHeader>
              <CardTitle>Ações rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <p className="text-sm font-medium text-foreground mb-2">Dica</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Configure seu estabelecimento para liberar todas as funcionalidades
                </p>
                <Button
                  variant="brand"
                  size="sm"
                  className="w-full"
                  onClick={() => navigate('/admin/settings')}
                >
                  Configurar estabelecimento
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
