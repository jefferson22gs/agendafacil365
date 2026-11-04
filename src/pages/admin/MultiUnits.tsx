import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { StatCard } from "@/components/admin/StatCard";
import { 
  Building2, 
  Plus, 
  DollarSign, 
  Calendar, 
  Users,
  TrendingUp,
  BarChart3
} from "lucide-react";

interface SalonUnit {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_active: boolean;
  stats?: {
    revenue: number;
    appointments: number;
    clients: number;
  };
}

interface SalonGroup {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
}

const MultiUnitsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<SalonGroup | null>(null);
  const [units, setUnits] = useState<SalonUnit[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [totalStats, setTotalStats] = useState({ revenue: 0, appointments: 0, clients: 0 });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    try {
      // Check if user has a group
      const { data: existingGroup } = await supabase
        .from('salon_groups')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (existingGroup) {
        setGroup(existingGroup);
        
        // Fetch all salons in the group
        const { data: salons } = await supabase
          .from('salons')
          .select('id, name, city, state, is_active')
          .eq('group_id', existingGroup.id);

        if (salons) {
          // Fetch stats for each salon
          const unitsWithStats = await Promise.all(salons.map(async (salon) => {
            const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
            
            const { data: appointments } = await supabase
              .from('appointments')
              .select('final_price')
              .eq('salon_id', salon.id)
              .eq('status', 'completed')
              .gte('created_at', startOfMonth);

            const revenue = appointments?.reduce((sum, a) => sum + (a.final_price || 0), 0) || 0;
            
            const { count: clientsCount } = await supabase
              .from('clients')
              .select('*', { count: 'exact', head: true })
              .eq('salon_id', salon.id);

            return {
              ...salon,
              stats: {
                revenue,
                appointments: appointments?.length || 0,
                clients: clientsCount || 0
              }
            };
          }));

          setUnits(unitsWithStats);
          
          // Calculate totals
          const totals = unitsWithStats.reduce((acc, unit) => ({
            revenue: acc.revenue + (unit.stats?.revenue || 0),
            appointments: acc.appointments + (unit.stats?.appointments || 0),
            clients: acc.clients + (unit.stats?.clients || 0)
          }), { revenue: 0, appointments: 0, clients: 0 });
          
          setTotalStats(totals);
        }
      } else {
        // Fetch user's single salon
        const { data: salon } = await supabase
          .from('salons')
          .select('id, name, city, state, is_active')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (salon) {
          setUnits([{ ...salon, stats: { revenue: 0, appointments: 0, clients: 0 } }]);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async () => {
    if (!user || !groupName.trim()) return;

    try {
      const { data: newGroup, error } = await supabase
        .from('salon_groups')
        .insert({
          name: groupName,
          owner_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Update existing salon to belong to this group
      if (units.length > 0) {
        await supabase
          .from('salons')
          .update({ group_id: newGroup.id, is_franchise: true })
          .eq('id', units[0].id);
      }

      setGroup(newGroup);
      setIsDialogOpen(false);
      toast.success("Grupo criado com sucesso!");
      fetchData();
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Erro ao criar grupo");
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3" role="status">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" aria-hidden></div>
          <p className="text-sm text-muted-foreground">Carregando unidades…</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div data-tour="multi-units-header">
          <PageHeader
            className="mb-0"
            title="Multi-Unidades"
            description={group ? `Grupo: ${group.name}` : 'Gerencie múltiplas unidades do seu negócio.'}
            actions={!group && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="brand" data-tour="multi-units-create-button">
                  <Plus size={18} className="mr-2" />
                  Criar Grupo
                </Button>
              </DialogTrigger>
              <DialogContent data-tour="multi-units-dialog">
                <DialogHeader>
                  <DialogTitle>Criar grupo de unidades</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="multi-units-group-name">Nome do Grupo</Label>
                    <Input
                      id="multi-units-group-name"
                      data-tour="multi-units-group-name"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Ex: Rede Beauty Hair"
                    />
                  </div>
                  <Button variant="brand" className="w-full" onClick={createGroup} data-tour="multi-units-save">
                    Criar Grupo
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          />
        </div>

        {/* Consolidated Stats */}
        {group && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="multi-units-totals">
            <StatCard icon={DollarSign} tone="success" label="Faturamento Total" value={`R$ ${totalStats.revenue.toFixed(2)}`} />
            <StatCard icon={Calendar} label="Agendamentos" value={totalStats.appointments} />
            <StatCard icon={Users} label="Clientes Total" value={totalStats.clients} />
            <StatCard icon={Building2} tone="neutral" label="Unidades" value={units.length} />
          </div>
        )}

        {/* Units Grid */}
        {units.length === 0 ? (
          <div data-tour="multi-units-empty">
            <EmptyState icon={Building2} title="Nenhuma unidade encontrada" description="Configure seu primeiro estabelecimento para começar." />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="multi-units-list">
            {units.map((unit) => (
              <Card key={unit.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center" aria-hidden>
                        <Building2 size={24} />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">{unit.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {unit.city && unit.state ? `${unit.city}, ${unit.state}` : 'Sem localização'}
                        </p>
                      </div>
                    </div>
                    <Badge variant={unit.is_active ? 'success' : 'secondary'}>
                      {unit.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border/50">
                    <div className="text-center">
                      <p className="text-lg font-bold text-primary tabular-nums">
                        R$ {(unit.stats?.revenue || 0).toFixed(0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Faturamento</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">
                        {unit.stats?.appointments || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Agendamentos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">
                        {unit.stats?.clients || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Clientes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Card */}
        {!group && units.length > 0 && (
          <Card className="border-primary/30">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center" aria-hidden>
                  <BarChart3 size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    Expanda seu negócio
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Crie um grupo para gerenciar múltiplas unidades, ver relatórios consolidados 
                    e comparar o desempenho entre suas unidades.
                  </p>
                  <Button variant="brand" size="sm" onClick={() => setIsDialogOpen(true)}>
                    <Plus size={16} className="mr-2" />
                    Criar Grupo de Franquias
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default MultiUnitsPage;
