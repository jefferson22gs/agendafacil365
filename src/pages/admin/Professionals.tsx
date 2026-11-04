import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { TrainingEmptyActions } from "@/features/training/TrainingEmptyActions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, User, Mail, Phone, Percent, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page-header";
import { Tables } from "@/integrations/supabase/types";

type Professional = Tables<"professionals">;

const Professionals = () => {
  const { user } = useAuth();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    specialty: "",
    commission_rate: 0,
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Get salon ID
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

      // Fetch professionals
      const { data: profs, error } = await supabase
        .from('professionals')
        .select('*')
        .eq('salon_id', salon.id)
        .order('name');

      if (error) throw error;
      setProfessionals(profs || []);
    } catch (error) {
      console.error("Error fetching professionals:", error);
      toast.error("Erro ao carregar profissionais");
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

    try {
      const professionalData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        specialty: formData.specialty || null,
        commission_rate: formData.commission_rate,
        salon_id: salonId,
      };

      if (editingProfessional) {
        const { error } = await supabase
          .from('professionals')
          .update(professionalData)
          .eq('id', editingProfessional.id);

        if (error) throw error;
        toast.success("Profissional atualizado!");
      } else {
        const { error } = await supabase
          .from('professionals')
          .insert(professionalData);

        if (error) throw error;
        toast.success("Profissional adicionado!");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving professional:", error);
      toast.error(error.message || "Erro ao salvar profissional");
    }
  };

  const handleEdit = (professional: Professional) => {
    setEditingProfessional(professional);
    setFormData({
      name: professional.name,
      email: professional.email || "",
      phone: professional.phone || "",
      specialty: professional.specialty || "",
      commission_rate: professional.commission_rate || 0,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este profissional?")) return;

    try {
      const { error } = await supabase
        .from('professionals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Profissional excluído!");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting professional:", error);
      toast.error(error.message || "Erro ao excluir profissional");
    }
  };

  const resetForm = () => {
    setEditingProfessional(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      specialty: "",
      commission_rate: 0,
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
          description="Cadastre o estabelecimento para gerenciar profissionais."
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" data-tour="professionals-header">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Profissionais</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">Cadastre quem atende, contatos e comissões.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="brand" data-tour="professionals-new-button">
                <Plus size={18} className="mr-2" />
                Novo Profissional
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" data-tour="professionals-dialog">
              <DialogHeader>
                <DialogTitle>
                  {editingProfessional ? "Editar Profissional" : "Novo Profissional"}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados do profissional
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2" data-tour="professionals-name">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome do profissional"
                  />
                </div>
                <div className="space-y-2" data-tour="professionals-email">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2" data-tour="professionals-phone">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-2" data-tour="professionals-specialty">
                  <Label htmlFor="specialty">Especialidade</Label>
                  <Input
                    id="specialty"
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    placeholder="Ex: Cortes modernos, barba"
                  />
                </div>
                <div className="space-y-2" data-tour="professionals-commission">
                  <Label htmlFor="commission">Comissão (%)</Label>
                  <Input
                    id="commission"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.commission_rate}
                    onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="brand" onClick={handleSubmit} data-tour="professionals-save">
                  {editingProfessional ? "Salvar" : "Adicionar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {professionals.length === 0 ? (
          <div data-tour="professionals-empty">
            <EmptyState
              icon={User}
              title="Nenhum profissional cadastrado ainda"
              description="Cadastre quem atende no estabelecimento, com nome, contato e comissão. Depois, os profissionais aparecerão aqui para você consultar e editar."
              action={<TrainingEmptyActions tourId="professionals" />}
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-tour="professionals-list">
            {professionals.map((professional) => (
              <Card key={professional.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                      {professional.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(professional)}
                        data-tour="professionals-edit"
                        aria-label="Editar profissional"
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(professional.id)}
                        data-tour="professionals-delete"
                        aria-label="Excluir profissional"
                      >
                        <Trash2 size={16} className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {professional.name}
                  </h3>
                  {professional.specialty && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {professional.specialty}
                    </p>
                  )}
                  <div className="space-y-2 text-sm">
                    {professional.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail size={14} />
                        {professional.email}
                      </div>
                    )}
                    {professional.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone size={14} />
                        {professional.phone}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Percent size={14} />
                      Comissão: {professional.commission_rate}%
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border" data-tour="professionals-status">
                    {/* Inativo não é erro: tom neutro, texto explícito */}
                    <Badge variant={professional.is_active ? 'success' : 'secondary'}>
                      {professional.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
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

export default Professionals;
