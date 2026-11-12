import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Package, Edit2, Trash2, Percent, X } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { PackageOrdersCard } from "@/components/packages/PackageOrdersCard";

interface PackageItem {
  service_id: string;
  quantity: number;
  service_name?: string;
  service_price?: number;
}

interface ServicePackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discount_percent: number;
  validity_days: number;
  is_active: boolean;
  salon_id: string;
  created_at: string;
  items?: PackageItem[];
  total_services?: number;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

const PackagesPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<ServicePackage | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    items: [] as PackageItem[],
    discount_percent: 10,
    validity_days: 365
  });

  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);

  useEffect(() => {
    fetchSalonId();
  }, [user]);

  useEffect(() => {
    if (salonId) {
      fetchPackages();
      fetchServices();
    }
  }, [salonId]);

  const fetchSalonId = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('salons')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();
    
    if (data) setSalonId(data.id);
    setLoading(false);
  };

  const fetchPackages = async () => {
    if (!salonId) return;
    
    const { data, error } = await supabase
      .from('service_packages_with_items')
      .select('*')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching packages:", error);
      return;
    }
    setPackages((data || []) as unknown as ServicePackage[]);
  };

  const fetchServices = async () => {
    if (!salonId) return;
    
    const { data } = await supabase
      .from('services')
      .select('id, name, price')
      .eq('salon_id', salonId)
      .eq('is_active', true);

    setServices(data || []);
  };

  const addItemToPackage = () => {
    if (!selectedService) return;
    
    const service = services.find(s => s.id === selectedService);
    if (!service) return;

    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          service_id: selectedService,
          quantity: selectedQuantity,
          service_name: service.name,
          service_price: service.price
        }
      ]
    });

    setSelectedService('');
    setSelectedQuantity(1);
  };

  const removeItemFromPackage = (service_id: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter(item => item.service_id !== service_id)
    });
  };

  const calculateOriginalPrice = () => {
    return formData.items.reduce((total, item) => {
      return total + ((item.service_price || 0) * item.quantity);
    }, 0);
  };

  const calculateFinalPrice = () => {
    const originalPrice = calculateOriginalPrice();
    const discount = originalPrice * (formData.discount_percent / 100);
    return originalPrice - discount;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonId || formData.items.length === 0) {
      toast.error("Adicione pelo menos um serviço ao pacote");
      return;
    }

    const finalPrice = calculateFinalPrice();

    try {
      if (editingPackage) {
        // Atualizar pacote
        console.log("Updating package:", editingPackage.id);
        const { data: pkgData, error: pkgError } = await supabase
          .from('service_packages')
          .update({
            name: formData.name,
            description: formData.description || null,
            price: finalPrice,
            discount_percent: formData.discount_percent,
            validity_days: formData.validity_days
          })
          .eq('id', editingPackage.id)
          .select()
          .single();

        if (pkgError) {
          console.error("Package update error:", pkgError);
          throw pkgError;
        }

        // Remover itens antigos
        console.log("Deleting old items for package:", editingPackage.id);
        const { error: deleteError } = await supabase
          .from('service_package_items')
          .delete()
          .eq('package_id', editingPackage.id);

        if (deleteError) {
          console.error("Delete items error:", deleteError);
          throw deleteError;
        }

        // Adicionar novos itens
        const itemsToAdd = formData.items.map(item => ({
          package_id: pkgData.id,
          service_id: item.service_id,
          quantity: item.quantity
        }));

        console.log("Inserting items:", itemsToAdd);
        const { error: itemsError } = await supabase
          .from('service_package_items')
          .insert(itemsToAdd);

        if (itemsError) {
          console.error("Insert items error:", itemsError);
          throw itemsError;
        }

        toast.success("Pacote atualizado!");
      } else {
        // Criar novo pacote
        console.log("Creating new package with data:", {
          salon_id: salonId,
          name: formData.name,
          price: finalPrice
        });

        const { data: pkgData, error: pkgError } = await supabase
          .from('service_packages')
          .insert({
            salon_id: salonId,
            name: formData.name,
            description: formData.description || null,
            price: finalPrice,
            discount_percent: formData.discount_percent,
            validity_days: formData.validity_days
          })
          .select()
          .single();

        if (pkgError) {
          console.error("Package creation error:", pkgError);
          throw pkgError;
        }

        // Adicionar itens
        const itemsToAdd = formData.items.map(item => ({
          package_id: pkgData.id,
          service_id: item.service_id,
          quantity: item.quantity
        }));

        console.log("Inserting items for new package:", itemsToAdd);
        const { error: itemsError } = await supabase
          .from('service_package_items')
          .insert(itemsToAdd);

        if (itemsError) {
          console.error("Insert items error:", itemsError);
          throw itemsError;
        }

        toast.success("Pacote criado!");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPackages();
    } catch (error: any) {
      console.error("Error saving package:", error);
      toast.error(`Erro ao salvar pacote: ${error.message || error.hint || 'Erro desconhecido'}`);
    }
  };

  const handleEdit = async (pkg: ServicePackage) => {
    // Buscar itens do pacote
    const { data: items, error } = await supabase
      .from('service_package_items')
      .select('service_id, quantity, services(name, price)')
      .eq('package_id', pkg.id);

    if (error) {
      console.error("Error fetching package items:", error);
      toast.error("Erro ao carregar pacote");
      return;
    }

    const packageItems: PackageItem[] = items.map(item => ({
      service_id: item.service_id,
      quantity: item.quantity,
      service_name: (item.services as any)?.name,
      service_price: (item.services as any)?.price
    }));

    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || '',
      items: packageItems,
      discount_percent: pkg.discount_percent,
      validity_days: pkg.validity_days
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este pacote?")) return;

    try {
      const { error } = await supabase
        .from('service_packages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Pacote excluído!");
      fetchPackages();
    } catch (error) {
      console.error("Error deleting package:", error);
      toast.error("Erro ao excluir pacote");
    }
  };

  const resetForm = () => {
    setEditingPackage(null);
    setFormData({
      name: '',
      description: '',
      items: [],
      discount_percent: 10,
      validity_days: 365
    });
    setSelectedService('');
    setSelectedQuantity(1);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3" role="status">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" aria-hidden></div>
          <p className="text-sm text-muted-foreground">Carregando pacotes…</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div data-tour="packages-header">
          <PageHeader
            className="mb-0"
            title="Pacotes de Serviços"
            description="Crie pacotes promocionais com múltiplos serviços (combos)."
            actions={
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="brand" data-tour="packages-new-button">
                <Plus size={18} className="mr-2" />
                Novo Pacote
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-tour="packages-dialog">
              <DialogHeader>
                <DialogTitle>
                  {editingPackage ? 'Editar Pacote' : 'Novo Pacote'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do Pacote</Label>
                  <Input
                    data-tour="packages-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex:Combo: 5 Cortes + 5 Barbas"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    data-tour="packages-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição opcional"
                  />
                </div>

                {/* Adicionar Serviços */}
                <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
                  <Label className="text-base font-semibold">Adicionar Serviços</Label>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Serviço</Label>
                      <Select
                        value={selectedService}
                        onValueChange={setSelectedService}
                      >
                        <SelectTrigger data-tour="packages-service">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        min={1}
                        data-tour="packages-quantity"
                        value={selectedQuantity}
                        onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>&nbsp;</Label>
                      <Button
                        type="button"
                        variant="outline"
                        data-tour="packages-add-item"
                        aria-label="Adicionar serviço ao pacote"
                        onClick={addItemToPackage}
                        disabled={!selectedService}
                        className="w-full"
                      >
                        <Plus size={16} />
                      </Button>
                    </div>
                  </div>

                  {/* Lista de Serviços do Pacote */}
                  {formData.items.length > 0 && (
                    <div className="space-y-2 mt-4" data-tour="packages-items">
                      <Label>Serviços no Pacote</Label>
                      <div className="space-y-2">
                        {formData.items.map((item) => (
                          <div key={item.service_id} className="flex items-center justify-between p-3 rounded-lg bg-background border">
                            <div className="flex-1">
                              <p className="font-medium">{item.service_name}</p>
                              <p className="text-sm text-muted-foreground">
                                R$ {(item.service_price || 0).toFixed(2)} x {item.quantity}
                              </p>
                            </div>
                            <p className="font-bold text-primary mr-4">
                              R$ {((item.service_price || 0) * item.quantity).toFixed(2)}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              data-tour="packages-remove-item"
                              aria-label="Remover serviço do pacote"
                              onClick={() => removeItemFromPackage(item.service_id)}
                            >
                              <X size={16} className="text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Desconto (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      data-tour="packages-discount"
                      value={formData.discount_percent}
                      onChange={(e) => setFormData({ ...formData, discount_percent: parseInt(e.target.value) })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Validade (dias)</Label>
                    <Input
                      type="number"
                      min={30}
                      data-tour="packages-validity"
                      value={formData.validity_days}
                      onChange={(e) => setFormData({ ...formData, validity_days: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                {/* Resumo do Preço */}
                {formData.items.length > 0 && (
                  <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-2" data-tour="packages-price-summary">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Preço original:</span>
                      <span className="line-through">R$ {calculateOriginalPrice().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Desconto ({formData.discount_percent}%):</span>
                      <span className="text-destructive">-R$ {(calculateOriginalPrice() * formData.discount_percent / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total de serviços:</span>
                      <span>{formData.items.reduce((sum, item) => sum + item.quantity, 0)} sessões</span>
                    </div>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Preço final:</span>
                        <span className="text-2xl font-bold text-primary">
                          R$ {calculateFinalPrice().toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    variant="brand" 
                    className="flex-1"
                    data-tour="packages-save"
                    disabled={formData.items.length === 0}
                  >
                    {editingPackage ? 'Salvar' : 'Criar Pacote'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
            }
          />
        </div>

        {/* Packages Grid */}
        {packages.length === 0 ? (
          <div data-tour="packages-empty">
            <EmptyState icon={Package} title="Nenhum pacote criado" description="Crie combos com múltiplos serviços para oferecer descontos." />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="packages-list">
            {packages.map((pkg: any) => (
              <Card key={pkg.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center" aria-hidden>
                      <Package size={24} />
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(pkg)} data-tour="packages-edit" aria-label="Editar pacote">
                        <Edit2 size={16} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(pkg.id)} data-tour="packages-delete" aria-label="Excluir pacote">
                        <Trash2 size={16} className="text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {pkg.name}
                  </h3>

                  {/* Lista de Serviços */}
                  {Array.isArray(pkg.items) && pkg.items.length > 0 && (
                    <div className="space-y-1 mb-4">
                      {pkg.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {item.service_name}
                          </span>
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded tabular-nums">
                            {item.quantity}x
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <p className="text-2xl font-bold text-primary">
                        R$ {pkg.price.toFixed(2)}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-success">
                        <Percent size={12} aria-hidden />
                        <span>{pkg.discount_percent}% de desconto</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Validade</p>
                      <p className="text-sm font-medium">{pkg.validity_days} dias</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {salonId && <PackageOrdersCard salonId={salonId} />}
      </div>
    </AdminLayout>
  );
};

export default PackagesPage;
