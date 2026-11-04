import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page-header";
import { 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Clock,
  User,
  AlertCircle,
  CheckCircle
} from "lucide-react";

interface ClientMetrics {
  id: string;
  client_id: string;
  total_appointments: number;
  total_spent: number;
  avg_days_between_visits: number | null;
  last_visit_date: string | null;
  predicted_next_visit: string | null;
  ltv: number;
  churn_risk: string;
  preferred_day_of_week: number | null;
  preferred_time: string | null;
}

interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface ClientMetricsCardProps {
  salonId: string;
}

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const timeLabels: Record<string, string> = {
  morning: 'Manhã',
  afternoon: 'Tarde',
  evening: 'Noite'
};

// Variante semântica do Badge por risco de abandono (texto sempre acompanha a cor).
const churnVariant: Record<string, "success" | "warning" | "danger"> = {
  low: 'success',
  medium: 'warning',
  high: 'danger'
};

export const ClientMetricsCard = ({ salonId }: ClientMetricsCardProps) => {
  const [metrics, setMetrics] = useState<(ClientMetrics & { client: Client })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, [salonId]);

  const fetchMetrics = async () => {
    try {
      // First calculate metrics for all clients
      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .eq('salon_id', salonId);

      if (clients) {
        for (const client of clients) {
          await supabase.rpc('calculate_client_metrics', { p_client_id: client.id });
        }
      }

      // Then fetch the metrics with client info
      const { data, error } = await supabase
        .from('client_metrics')
        .select(`
          *,
          client:clients(id, name, phone, email)
        `)
        .eq('salon_id', salonId)
        .order('churn_risk', { ascending: false })
        .limit(10);

      if (error) throw error;
      setMetrics(data || []);
    } catch (error) {
      console.error("Error fetching client metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card data-tour="dashboard-client-metrics">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={20} className="text-primary" />
            Previsão de Retorno
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-secondary/50 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (metrics.length === 0) {
    return (
      <Card data-tour="dashboard-client-metrics">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={20} className="text-primary" />
            Previsão de Retorno
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={User}
            title="Nenhuma métrica de cliente ainda"
            description="As previsões aparecem depois que houver histórico de atendimentos."
            className="border-0 bg-transparent py-8"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-tour="dashboard-client-metrics">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp size={20} className="text-primary" />
          Previsão de Retorno
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.map((metric) => (
          <div 
            key={metric.id}
            className="p-4 rounded-xl bg-secondary/50 border border-border/50"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-foreground">{metric.client?.name || 'Cliente'}</p>
                <p className="text-xs text-muted-foreground">{metric.client?.phone}</p>
              </div>
              <Badge variant={churnVariant[metric.churn_risk] || churnVariant.low}>
                {metric.churn_risk === 'high' && <AlertCircle size={12} className="mr-1" />}
                {metric.churn_risk === 'low' && <CheckCircle size={12} className="mr-1" />}
                Risco {metric.churn_risk === 'low' ? 'baixo' : metric.churn_risk === 'medium' ? 'médio' : 'alto'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar size={12} />
                <span>
                  {metric.avg_days_between_visits 
                    ? `Retorna a cada ${Math.round(metric.avg_days_between_visits)} dias`
                    : 'Sem histórico'
                  }
                </span>
              </div>
              
              {metric.predicted_next_visit && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock size={12} />
                  <span>
                    Próxima: {new Date(metric.predicted_next_visit).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              )}
              
              <div className="flex items-center gap-1 text-muted-foreground">
                <TrendingUp size={12} />
                <span>LTV: R$ {metric.ltv.toFixed(2)}</span>
              </div>
              
              {metric.preferred_day_of_week !== null && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <User size={12} />
                  <span>
                    Prefere: {dayNames[metric.preferred_day_of_week]} {metric.preferred_time && `(${timeLabels[metric.preferred_time]})`}
                  </span>
                </div>
              )}
            </div>

            {metric.churn_risk !== 'low' && metric.last_visit_date && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <p className="text-xs text-warning">
                  💡 Sugestão: Envie um cupom ou lembrete para este cliente
                </p>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
