import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  Clock,
  Star,
  AlertTriangle,
  Target,
  Lightbulb,
  BarChart3
} from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";

interface Analytics {
  period: string;
  start_date: string;
  total_revenue: number;
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  cancellation_rate: number;
  new_clients: number;
  avg_ticket: number;
  top_services: Array<{ name: string; count: number; revenue: number }>;
  top_professionals: Array<{ name: string; appointments: number; revenue: number; avg_rating: number | null }>;
  revenue_by_day: Array<{ day_of_week: number; revenue: number; appointments: number }>;
  hourly_distribution: Array<{ hour: number; count: number }>;
}

const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
// Paleta de gráficos da marca (tokens --chart-N adaptam claro/escuro).
const COLORS = [1, 2, 3, 4, 5].map((n) => `hsl(var(--chart-${n}))`);
const AXIS = 'hsl(var(--muted-foreground))';
const GRID = 'hsl(var(--border))';
const TOOLTIP_STYLE = { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' };

const AnalyticsDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    fetchSalonId();
  }, [user]);

  useEffect(() => {
    if (salonId) {
      fetchAnalytics();
    }
  }, [salonId, period]);

  const fetchSalonId = async () => {
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

  const fetchAnalytics = async () => {
    if (!salonId) return;
    setLoading(true);
    
    try {
      const { data, error } = await supabase.rpc('get_salon_analytics', {
        p_salon_id: salonId,
        p_period: period
      });

      if (error) throw error;
      setAnalytics(data as unknown as Analytics);
      generateSuggestions(data as unknown as Analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = (data: Analytics) => {
    const suggs: string[] = [];
    
    if (data.cancellation_rate > 10) {
      suggs.push("📉 Taxa de cancelamento alta! Considere implementar pagamento antecipado ou lembretes.");
    }
    
    if (data.revenue_by_day && data.revenue_by_day.length > 0) {
      const lowestDay = data.revenue_by_day.reduce((min, d) => 
        d.revenue < min.revenue ? d : min
      );
      suggs.push(`💡 ${dayLabels[lowestDay.day_of_week]} é seu dia com menor faturamento. Crie uma promoção especial!`);
    }
    
    if (data.avg_ticket < 50) {
      suggs.push("💰 Ticket médio baixo. Ofereça combos ou serviços complementares.");
    }
    
    if (data.top_professionals && data.top_professionals.length > 0) {
      const topPro = data.top_professionals[0];
      if (topPro.avg_rating && topPro.avg_rating >= 4.5) {
        suggs.push(`⭐ ${topPro.name} tem excelente avaliação! Destaque na página pública.`);
      }
    }
    
    setSuggestions(suggs);
  };

  const formatRevenueByDay = () => {
    if (!analytics?.revenue_by_day) return [];
    return analytics.revenue_by_day.map(d => ({
      ...d,
      day: dayLabels[d.day_of_week]
    }));
  };

  const formatHourlyData = () => {
    if (!analytics?.hourly_distribution) return [];
    return analytics.hourly_distribution.map(h => ({
      ...h,
      label: `${h.hour}:00`
    }));
  };

  if (loading && !analytics) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3" role="status">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" aria-hidden></div>
          <p className="text-sm text-muted-foreground">Carregando relatórios…</p>
        </div>
      </AdminLayout>
    );
  }

  if (!salonId) {
    return (
      <AdminLayout>
        <div data-tour="analytics-no-salon">
          <EmptyState icon={BarChart3} title="Relatórios indisponíveis" description="Configure seu estabelecimento em Configurações para ver os relatórios." />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div data-tour="analytics-header">
            <PageHeader className="mb-0" title="Dashboard Analítico" description="Análise do desempenho do seu estabelecimento no período escolhido." />
          </div>
          
          <div className="flex flex-wrap gap-2" data-tour="analytics-period" role="group" aria-label="Período do relatório">
            {(['week', 'month', 'quarter', 'year'] as const).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'brand' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p)}
              >
                {p === 'week' && '7 dias'}
                {p === 'month' && '30 dias'}
                {p === 'quarter' && '90 dias'}
                {p === 'year' && '1 ano'}
              </Button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-tour="analytics-kpis">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 text-success flex items-center justify-center">
                  <DollarSign size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    R$ {(analytics?.total_revenue || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Faturamento</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Calendar size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {analytics?.total_appointments || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Agendamentos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Target size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    R$ {(analytics?.avg_ticket || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Ticket Médio</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {analytics?.new_clients || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Novos Clientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <Card className="border-primary/30" data-tour="analytics-suggestions">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb size={20} className="text-primary" />
                Sugestões Inteligentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <p key={i} className="text-sm text-muted-foreground">{s}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Day */}
          <Card data-tour="analytics-by-day">
            <CardHeader>
              <CardTitle className="text-lg">Faturamento por Dia da Semana</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={formatRevenueByDay()}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis dataKey="day" stroke={AXIS} fontSize={12} />
                  <YAxis stroke={AXIS} fontSize={12} />
                  <Tooltip 
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Faturamento']}
                  />
                  <Bar dataKey="revenue" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Hourly Distribution */}
          <Card data-tour="analytics-by-hour">
            <CardHeader>
              <CardTitle className="text-lg">Distribuição por Horário</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={formatHourlyData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis dataKey="label" stroke={AXIS} fontSize={12} />
                  <YAxis stroke={AXIS} fontSize={12} />
                  <Tooltip 
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number) => [value, 'Agendamentos']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke={COLORS[0]} 
                    fill={COLORS[0]}
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Services */}
          <Card data-tour="analytics-top-services">
            <CardHeader>
              <CardTitle className="text-lg">Top Serviços</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.top_services && analytics.top_services.length > 0 ? (
                <div className="space-y-3">
                  {analytics.top_services.map((service, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg surface-2">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-foreground border-2"
                          style={{ borderColor: COLORS[i % COLORS.length] }}
                        >
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{service.name}</p>
                          <p className="text-xs text-muted-foreground">{service.count} atendimentos</p>
                        </div>
                      </div>
                      <p className="font-bold text-primary">R$ {service.revenue.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Nenhum dado no período selecionado</p>
              )}
            </CardContent>
          </Card>

          {/* Top Professionals */}
          <Card data-tour="analytics-top-professionals">
            <CardHeader>
              <CardTitle className="text-lg">Top Profissionais</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.top_professionals && analytics.top_professionals.length > 0 ? (
                <div className="space-y-3">
                  {analytics.top_professionals.map((pro, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg surface-2">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-primary text-primary-foreground"
                        >
                          {pro.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{pro.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{pro.appointments} atendimentos</span>
                            {pro.avg_rating && (
                              <span className="flex items-center gap-1">
                                <Star size={10} className="text-amber-500 fill-amber-500" aria-hidden />
                                {pro.avg_rating.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="font-bold text-primary">R$ {pro.revenue.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">Nenhum dado no período selecionado</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cancellation Rate */}
        <Card data-tour="analytics-cancellations">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {(analytics?.cancellation_rate || 0) > 10 ? (
                  <AlertTriangle size={32} className="text-warning" />
                ) : (
                  <TrendingDown size={32} className="text-success" />
                )}
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    {(analytics?.cancellation_rate || 0).toFixed(1)}%
                  </p>
                  <p className="text-muted-foreground">Taxa de Cancelamento</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-medium text-foreground">
                  {analytics?.cancelled_appointments || 0} cancelados
                </p>
                <p className="text-sm text-muted-foreground">
                  de {analytics?.total_appointments || 0} agendamentos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AnalyticsDashboard;
