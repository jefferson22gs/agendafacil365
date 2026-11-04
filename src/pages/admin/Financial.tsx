import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Users,
  Calendar,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BarChart3
} from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { StatCard } from "@/components/admin/StatCard";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FinancialData {
  totalRevenue: number;
  totalAppointments: number;
  averageTicket: number;
  completedAppointments: number;
  cancelledAppointments: number;
  pendingRevenue: number;
}

interface ProfessionalCommission {
  id: string;
  name: string;
  totalRevenue: number;
  commission: number;
  appointmentsCount: number;
  commissionRate: number;
}

const Financial = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [financialData, setFinancialData] = useState<FinancialData>({
    totalRevenue: 0,
    totalAppointments: 0,
    averageTicket: 0,
    completedAppointments: 0,
    cancelledAppointments: 0,
    pendingRevenue: 0,
  });
  const [professionalCommissions, setProfessionalCommissions] = useState<ProfessionalCommission[]>([]);

  useEffect(() => {
    fetchSalon();
  }, [user]);

  useEffect(() => {
    if (salonId) {
      fetchFinancialData();
    }
  }, [salonId, selectedMonth]);

  const fetchSalon = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('salons')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (data) {
      setSalonId(data.id);
    } else {
      setLoading(false);
    }
  };

  const fetchFinancialData = async () => {
    if (!salonId) return;

    setLoading(true);
    const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

    try {
      // Fetch all appointments for the month
      const { data: appointments } = await supabase
        .from('appointments')
        .select(`
          id,
          status,
          price,
          final_price,
          professional_id,
          professionals:professional_id (
            id,
            name,
            commission_rate
          )
        `)
        .eq('salon_id', salonId)
        .gte('date', monthStart)
        .lte('date', monthEnd);

      if (appointments) {
        // Calculate overall stats
        const completed = appointments.filter(a => a.status === 'completed');
        const cancelled = appointments.filter(a => a.status === 'cancelled');
        const pending = appointments.filter(a => a.status === 'pending' || a.status === 'confirmed');

        const totalRevenue = completed.reduce((sum, apt) => sum + (apt.final_price || 0), 0);
        const pendingRevenue = pending.reduce((sum, apt) => sum + (apt.final_price || 0), 0);
        const averageTicket = completed.length > 0 ? totalRevenue / completed.length : 0;

        setFinancialData({
          totalRevenue,
          totalAppointments: appointments.length,
          averageTicket,
          completedAppointments: completed.length,
          cancelledAppointments: cancelled.length,
          pendingRevenue,
        });

        // Calculate professional commissions
        const professionalMap = new Map<string, ProfessionalCommission>();

        completed.forEach(apt => {
          if (apt.professionals) {
            const prof = apt.professionals as any;
            const existing = professionalMap.get(prof.id);
            const revenue = apt.final_price || 0;
            const commissionRate = prof.commission_rate || 0;

            if (existing) {
              existing.totalRevenue += revenue;
              existing.commission += revenue * (commissionRate / 100);
              existing.appointmentsCount += 1;
            } else {
              professionalMap.set(prof.id, {
                id: prof.id,
                name: prof.name,
                totalRevenue: revenue,
                commission: revenue * (commissionRate / 100),
                appointmentsCount: 1,
                commissionRate,
              });
            }
          }
        });

        setProfessionalCommissions(Array.from(professionalMap.values()));
      }
    } catch (error) {
      console.error("Error fetching financial data:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalCommissions = professionalCommissions.reduce((sum, p) => sum + p.commission, 0);
  const netRevenue = financialData.totalRevenue - totalCommissions;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3" role="status">
          <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Carregando financeiro…</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div data-tour="financial-header">
            <PageHeader className="mb-0" title="Financeiro" description="Faturamento e comissões calculados a partir dos atendimentos concluídos." />
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-2 self-start md:self-auto" data-tour="financial-month" role="group" aria-label="Mês de referência">
            <Button
              variant="outline"
              size="icon"
              aria-label="Mês anterior"
              onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
            >
              <ChevronLeft size={18} />
            </Button>
            <div className="px-4 py-2 surface-2 border border-border rounded-lg min-w-[160px] text-center capitalize" aria-live="polite">
              <span className="font-medium text-foreground">
                {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
              </span>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próximo mês"
              onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
            >
              <ChevronRight size={18} />
            </Button>
          </div>
        </div>

        {/* Indicadores do mês */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard data-tour="financial-revenue" icon={DollarSign} tone="success" label="Faturamento Total" value={`R$ ${financialData.totalRevenue.toFixed(2)}`} hint="Receita" />
          <StatCard data-tour="financial-appointments" icon={Calendar} label="Total de Agendamentos" value={financialData.totalAppointments} hint={`${financialData.completedAppointments} concluídos`} />
          <StatCard data-tour="financial-ticket" icon={BarChart3} label="Ticket Médio" value={`R$ ${financialData.averageTicket.toFixed(2)}`} />
          <StatCard data-tour="financial-net" icon={TrendingUp} label="Lucro Líquido" value={`R$ ${netRevenue.toFixed(2)}`} hint="Após comissões" />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-tour="financial-summary">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendente</p>
                  <p className="text-xl font-bold text-foreground">
                    R$ {financialData.pendingRevenue.toFixed(2)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center" aria-hidden>
                  <DollarSign size={20} className="text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Comissões</p>
                  <p className="text-xl font-bold text-foreground">
                    R$ {totalCommissions.toFixed(2)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center" aria-hidden>
                  <TrendingDown size={20} className="text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cancelamentos</p>
                  <p className="text-xl font-bold text-foreground">
                    {financialData.cancelledAppointments}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center" aria-hidden>
                  <Calendar size={20} className="text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Professional Commissions */}
        <Card data-tour="financial-commissions">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users size={20} className="text-primary" />
                Comissões por Profissional
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {professionalCommissions.length === 0 ? (
              <div data-tour="financial-empty">
                <EmptyState icon={Users} title="Nenhum atendimento concluído neste período" description="As comissões aparecem quando houver atendimentos marcados como concluídos no mês." className="border-0 bg-transparent py-8" />
              </div>
            ) : (
              <div className="space-y-3">
                {professionalCommissions.map((prof) => (
                  <div
                    key={prof.id}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl surface-2 border border-border/60"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                        {prof.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{prof.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {prof.appointmentsCount} atendimentos • {prof.commissionRate}% comissão
                        </p>
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-sm text-muted-foreground">
                        Faturou R$ {prof.totalRevenue.toFixed(2)}
                      </p>
                      <p className="text-lg font-bold text-primary">
                        R$ {prof.commission.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-primary/10 border border-primary/20 mt-4">
                  <p className="font-medium text-foreground">Total de Comissões</p>
                  <p className="text-xl font-bold text-primary">
                    R$ {totalCommissions.toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Financial;
