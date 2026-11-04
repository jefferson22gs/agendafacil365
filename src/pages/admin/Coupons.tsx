import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, Gift, Percent, DollarSign, Calendar, Users } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/ui/page-header";

type Coupon = Tables<"coupons">;

const Coupons = () => {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    type: "percentage" as "percentage" | "fixed",
    value: 0,
    min_purchase: 0,
    max_uses: null as number | null,
    valid_until: "",
    is_new_clients_only: false,
  });

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

      const { data: couponsData, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('salon_id', salon.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons(couponsData || []);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      toast.error("Erro ao carregar cupons");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!salonId) {
      toast.error("Configure seu salão primeiro");
      return;
    }

    if (!formData.code.trim()) {
      toast.error("Código é obrigatório");
      return;
    }

    if (formData.value <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }

    try {
      const couponData = {
        code: formData.code.toUpperCase(),
        type: formData.type,
        value: formData.value,
        min_purchase: formData.min_purchase || null,
        max_uses: formData.max_uses || null,
        valid_until: formData.valid_until || null,
        is_new_clients_only: formData.is_new_clients_only,
        salon_id: salonId,
      };

      if (editingCoupon) {
        const { error } = await supabase
          .from('coupons')
          .update(couponData)
          .eq('id', editingCoupon.id);

        if (error) throw error;
        toast.success("Cupom atualizado!");
      } else {
        const { error } = await supabase
          .from('coupons')
          .insert(couponData);

        if (error) throw error;
        toast.success("Cupom criado!");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving coupon:", error);
      toast.error(error.message || "Erro ao salvar cupom");
    }
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      min_purchase: coupon.min_purchase || 0,
      max_uses: coupon.max_uses,
      valid_until: coupon.valid_until ? coupon.valid_until.split('T')[0] : "",
      is_new_clients_only: coupon.is_new_clients_only || false,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cupom?")) return;

    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Cupom excluído!");
      fetchData();
    } catch (error: any) {
      console.error("Error deleting coupon:", error);
      toast.error(error.message || "Erro ao excluir cupom");
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active: !coupon.is_active })
        .eq('id', coupon.id);

      if (error) throw error;
      fetchData();
    } catch (error: any) {
      console.error("Error toggling coupon:", error);
      toast.error(error.message || "Erro ao alterar status");
    }
  };

  const resetForm = () => {
    setEditingCoupon(null);
    setFormData({
      code: "",
      type: "percentage",
      value: 0,
      min_purchase: 0,
      max_uses: null,
      valid_until: "",
      is_new_clients_only: false,
    });
  };

  const isExpired = (validUntil: string | null) => {
    if (!validUntil) return false;
    return new Date(validUntil) < new Date();
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3" role="status">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" aria-hidden></div>
          <p className="text-sm text-muted-foreground">Carregando cupons…</p>
        </div>
      </AdminLayout>
    );
  }

  if (!salonId) {
    return (
      <AdminLayout>
        <EmptyState
          icon={Gift}
          title="Configure seu estabelecimento primeiro"
          description="Depois de cadastrar o estabelecimento você poderá criar cupons de desconto."
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
        <div data-tour="coupons-header">
          <PageHeader
            className="mb-0"
            title="Cupons"
            description="Crie códigos de desconto com regras de valor, validade e limite de uso."
            actions={
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="brand" data-tour="coupons-new-button">
                <Plus size={18} className="mr-2" />
                Novo Cupom
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" data-tour="coupons-dialog">
              <DialogHeader>
                <DialogTitle>
                  {editingCoupon ? "Editar Cupom" : "Novo Cupom"}
                </DialogTitle>
                <DialogDescription>
                  Configure as regras do cupom
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Código *</Label>
                  <Input
                    id="code"
                    data-tour="coupons-code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="Ex: DESCONTO10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4" data-tour="coupons-discount">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: "percentage" | "fixed") => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentagem</SelectItem>
                        <SelectItem value="fixed">Valor fixo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="value">Valor *</Label>
                    <Input
                      id="value"
                      type="number"
                      min="0"
                      step={formData.type === "percentage" ? "1" : "0.01"}
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4" data-tour="coupons-limits">
                  <div className="space-y-2">
                    <Label htmlFor="min_purchase">Compra mínima (R$)</Label>
                    <Input
                      id="min_purchase"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.min_purchase}
                      onChange={(e) => setFormData({ ...formData, min_purchase: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_uses">Limite de usos</Label>
                    <Input
                      id="max_uses"
                      type="number"
                      min="1"
                      value={formData.max_uses || ""}
                      onChange={(e) => setFormData({ ...formData, max_uses: e.target.value ? Number(e.target.value) : null })}
                      placeholder="Ilimitado"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valid_until">Válido até</Label>
                  <Input
                    id="valid_until"
                    data-tour="coupons-valid-until"
                    type="date"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Apenas novos clientes</Label>
                    <p className="text-sm text-muted-foreground">
                      Restringir para primeira compra
                    </p>
                  </div>
                  <Switch
                    data-tour="coupons-new-clients"
                    aria-label="Apenas novos clientes"
                    checked={formData.is_new_clients_only}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_new_clients_only: checked })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="brand" onClick={handleSubmit} data-tour="coupons-save">
                  {editingCoupon ? "Salvar" : "Criar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
            }
          />
        </div>

        {coupons.length === 0 ? (
          <div data-tour="coupons-empty">
            <EmptyState icon={Gift} title="Nenhum cupom cadastrado ainda" description="Use “Novo Cupom” para criar o primeiro código de desconto." />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-tour="coupons-list">
            {coupons.map((coupon) => (
              <Card key={coupon.id} className={isExpired(coupon.valid_until) ? 'opacity-75' : undefined}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        coupon.type === 'percentage' 
                          ? 'bg-primary/10 text-primary'
                          : 'bg-success/10 text-success'
                      }`} aria-hidden>
                        {coupon.type === 'percentage' ? <Percent size={24} /> : <DollarSign size={24} />}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        data-tour="coupons-edit"
                        aria-label="Editar cupom"
                        onClick={() => handleEdit(coupon)}
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        data-tour="coupons-delete"
                        aria-label="Excluir cupom"
                        onClick={() => handleDelete(coupon.id)}
                      >
                        <Trash2 size={16} className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="font-mono text-xl font-bold text-foreground tracking-wider">
                      {coupon.code}
                    </p>
                    <p className="text-2xl font-bold text-primary mt-1">
                      {coupon.type === 'percentage' 
                        ? `${coupon.value}% OFF`
                        : `R$ ${coupon.value.toFixed(2)} OFF`
                      }
                    </p>
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    {!!coupon.min_purchase && coupon.min_purchase > 0 && (
                      <div className="flex items-center gap-2">
                        <DollarSign size={14} />
                        Mínimo: R$ {coupon.min_purchase.toFixed(2)}
                      </div>
                    )}
                    {coupon.max_uses && (
                      <div className="flex items-center gap-2">
                        <Users size={14} />
                        {coupon.uses_count || 0}/{coupon.max_uses} usos
                      </div>
                    )}
                    {coupon.valid_until && (
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        Até: {new Date(coupon.valid_until).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                    {coupon.is_new_clients_only && (
                      <Badge variant="info">Apenas novos clientes</Badge>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                    {/* Status sempre com texto; expirado tem prioridade sobre ativo/inativo */}
                    <Badge variant={isExpired(coupon.valid_until) ? 'danger' : coupon.is_active ? 'success' : 'secondary'}>
                      {isExpired(coupon.valid_until) ? 'Expirado' : coupon.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <Switch
                      data-tour="coupons-active"
                      aria-label="Ativar ou desativar cupom"
                      checked={coupon.is_active || false}
                      onCheckedChange={() => toggleActive(coupon)}
                      disabled={isExpired(coupon.valid_until)}
                    />
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

export default Coupons;
