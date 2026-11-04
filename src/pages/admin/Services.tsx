import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { TrainingEmptyActions } from "@/features/training/TrainingEmptyActions";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, ClipboardList, Clock, DollarSign, Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/page-header";
import { Tables } from "@/integrations/supabase/types";

type Service = Tables<"services">;

const Services = () => {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    duration_minutes: 30,
    icon: "✂️",
  });

  const icons = ["✂️", "🧔", "💈", "💆", "👦", "📐", "🪒", "💇"];

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      const { data: salon } = await supabase
        .from('salons')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!salon) {
        setLoading(false);
        return;
      }

      setSalonId(salon.id);

      const { data: servicesData, error } = await supabase
        .from('services')
        .select('*')
        .eq('salon_id', salon.id)
        .order('name');

      if (error) throw error;
      setServices(servicesData || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast.error("Erro ao carregar serviços");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!salonId) {
      toast.error("Configure seu estabelecimento primeiro");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (formData.price <= 0) {
      toast.error("Preço deve ser maior que zero");
      return;
    }

    try {
      const serviceData = {
        name: formData.name,
        description: formData.description || null,
        price: formData.price,
        duration_minutes: formData.duration_minutes,
        icon: formData.icon,
        salon_id: salonId,
      };

      if (editingService) {
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingService.id);

        if (error) throw error;
        toast.success("Serviço atualizado!");
      } else {
        const { error } = await supabase
          .from('services')
          .insert(serviceData);

        if (error) throw error;
        toast.success("Serviço adicionado!");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving service:", error);
      toast.error(error.message || "Erro ao salvar serviço");
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      price: service.price,
      duration_minutes: service.duration_minutes,
      icon: service.icon || "✂️",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Serviço excluído!");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting service:", error);
      toast.error(error.message || "Erro ao excluir serviço");
    }
  };

  const resetForm = () => {
    setEditingService(null);
    setFormData({
      name: "",
      description: "",
      price: 0,
      duration_minutes: 30,
      icon: "✂️",
    });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3" role="status">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" aria-hidden></div>
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      </AdminLayout>
    );
  }

  if (!salonId) {
    return (
      <AdminLayout>
        <EmptyState
          icon={Building2}
          title="Configure seu estabelecimento primeiro"
          description="Cadastre o estabelecimento para gerenciar serviços."
          action={
            <Button variant="brand" onClick={() => window.location.href = '/admin/settings'}>
              Configurar estabelecimento
            </Button>
          }
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" data-tour="services-header">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Serviços</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">Defina preço e duração de cada serviço oferecido.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="brand" data-tour="services-new-button">
                <Plus size={18} className="mr-2" />
                Novo Serviço
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" data-tour="services-dialog">
              <DialogHeader>
                <DialogTitle>
                  {editingService ? "Editar Serviço" : "Novo Serviço"}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados do serviço
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2" data-tour="services-icon">
                  <Label>Ícone</Label>
                  <div className="flex flex-wrap gap-2">
                    {icons.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon })}
                        className={`
                          w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all
                          ${formData.icon === icon
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary hover:bg-secondary/80'
                          }
                        `}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2" data-tour="services-name">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Corte Masculino"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva o serviço..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4" data-tour="services-price-duration">
                  <div className="space-y-2">
                    <Label htmlFor="price">Preço (R$) *</Label>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duração (min) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="5"
                      step="5"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="brand" onClick={handleSubmit} data-tour="services-save">
                  {editingService ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {services.length === 0 ? (
          <div data-tour="services-empty">
            <EmptyState
              icon={ClipboardList}
              title="Nenhum serviço cadastrado ainda"
              description="Cadastre os serviços que seus clientes poderão agendar, com preço e duração."
              action={<TrainingEmptyActions tourId="services" />}
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-tour="services-list">
            {services.map((service) => (
              <Card key={service.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-3xl">
                      {service.icon || "✂️"}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(service)}
                        aria-label="Editar serviço"
                        data-tour="services-edit"
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(service.id)}
                        aria-label="Excluir serviço"
                        data-tour="services-delete"
                      >
                        <Trash2 size={16} className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {service.name}
                  </h3>
                  {service.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {service.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Clock size={14} />
                      {service.duration_minutes} min
                    </div>
                    <div className="flex items-center gap-1 text-lg font-bold text-foreground">
                      <DollarSign size={16} className="text-primary" />
                      R$ {service.price.toFixed(2)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default Services;
