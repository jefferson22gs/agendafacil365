import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Users,
    Plus,
    Edit,
    Trash2,
    DollarSign,
    TrendingUp,
    Percent,
    Mail,
    Phone,
    MoreVertical,
    Loader2,
    Ban,
    CheckCircle,
    AlertTriangle,
    RefreshCw,
    Calendar,
    Building2,
    Clock
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Seller {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    whatsapp: string | null;
    commission_monthly_percent: number;
    commission_annual_percent: number;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

interface SellerStats {
    seller_id: string;
    seller_name: string;
    email: string;
    phone: string;
    is_active: boolean;
    total_salons: number;
    active_salons: number;
    new_salons_30d: number;
    total_paid: number;
    total_to_pay: number;
    total_pending: number;
    commission_monthly_percent: number;
    commission_annual_percent: number;
}

interface Commission {
    id: string;
    seller_id: string;
    salon_id: string;
    salon_name?: string;
    amount: number;
    commission_amount: number;
    commission_percent: number;
    payment_type: 'monthly' | 'annual';
    status: 'pending' | 'approved' | 'paid' | 'rejected';
    subscription_plan: string;
    created_at: string;
    paid_at: string | null;
}

export const SellersManagement = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [sellerStats, setSellerStats] = useState<SellerStats[]>([]);
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
    const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);

    // Dialog states
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showViewSalonsDialog, setShowViewSalonsDialog] = useState(false);
    const [showPayDialog, setShowPayDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Form states
    const [form, setForm] = useState({
        name: "",
        email: "",
        phone: "",
        whatsapp: "",
        commission_monthly_percent: 20,
        commission_annual_percent: 10,
        notes: ""
    });

    // Payment method
    const [paymentMethod, setPaymentMethod] = useState("pix");
    const [paymentNotes, setPaymentNotes] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setRefreshing(true);
        try {
            // Carregar vendedores
            const { data: sellersData, error: sellersError } = await supabase
                .from("sellers")
                .select("*")
                .order("name", { ascending: true });

            if (sellersError) {
                console.error("Error loading sellers:", sellersError);
                // Não exibir erro para não quebrar a UX se as tabelas não existirem ou não tiver permissão
            } else if (sellersData) {
                setSellers(sellersData);
            }

            // Carregar estatísticas
            const { data: statsData, error: statsError } = await supabase
                .from("seller_stats")
                .select("*")
                .order("seller_name", { ascending: true });

            if (statsError) {
                console.error("Error loading seller stats:", statsError);
            } else if (statsData) {
                setSellerStats(statsData);
            }

            // Carregar comissões pendentes
            const { data: commissionsData, error: commissionsError } = await supabase
                .from("seller_commissions")
                .select(`
                    *,
                    salons(name)
                `)
                .in("status", ["pending", "approved"])
                .order("created_at", { ascending: false })
                .limit(100);

            if (commissionsError) {
                console.error("Error loading commissions:", commissionsError);
            } else if (commissionsData) {
                const enrichedCommissions = commissionsData.map((c: any) => ({
                    ...c,
                    salon_name: c.salons?.name || "Estabelecimento não encontrado"
                }));
                setCommissions(enrichedCommissions);
            }

        } catch (error) {
            console.error("Error loading sellers data:", error);
            toast({
                title: "Erro ao carregar dados",
                description: "Não foi possível carregar os dados dos vendedores. Verifique as permissões.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleAddSeller = async () => {
        setActionLoading(true);
        try {
            const { error } = await supabase.from("sellers").insert([{
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                phone: form.phone.trim() || null,
                whatsapp: form.whatsapp.trim() || null,
                commission_monthly_percent: form.commission_monthly_percent,
                commission_annual_percent: form.commission_annual_percent,
                notes: form.notes.trim() || null,
            }]);

            if (error) throw error;

            toast({
                title: "✅ Vendedor adicionado",
                description: `${form.name} foi cadastrado com sucesso.`,
            });

            setShowAddDialog(false);
            resetForm();
            await loadData();
        } catch (error: any) {
            console.error("Error adding seller:", error);
            toast({
                title: "Erro ao adicionar vendedor",
                description: error.message || "Não foi possível cadastrar o vendedor.",
                variant: "destructive",
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleUpdateSeller = async () => {
        if (!selectedSeller) return;

        setActionLoading(true);
        try {
            const { error } = await supabase
                .from("sellers")
                .update({
                    name: form.name.trim(),
                    email: form.email.trim().toLowerCase(),
                    phone: form.phone.trim() || null,
                    whatsapp: form.whatsapp.trim() || null,
                    commission_monthly_percent: form.commission_monthly_percent,
                    commission_annual_percent: form.commission_annual_percent,
                    notes: form.notes.trim() || null,
                })
                .eq("id", selectedSeller.id);

            if (error) throw error;

            toast({
                title: "✅ Vendedor atualizado",
                description: `Dados de ${form.name} foram atualizados.`,
            });

            setShowEditDialog(false);
            resetForm();
            await loadData();
        } catch (error: any) {
            console.error("Error updating seller:", error);
            toast({
                title: "Erro ao atualizar vendedor",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleToggleActive = async (sellerId: string, isActive: boolean) => {
        setActionLoading(true);
        try {
            const newStatus = !isActive;
            const { error } = await supabase
                .from("sellers")
                .update({ is_active: newStatus })
                .eq("id", sellerId);

            if (error) throw error;

            toast({
                title: newStatus ? "Vendedor ativado" : "Vendedor desativado",
                description: "Alteração aplicada com sucesso.",
            });

            await loadData();
        } catch (error: any) {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteSeller = async () => {
        if (!selectedSeller) return;

        setActionLoading(true);
        try {
            const { error } = await supabase
                .from("sellers")
                .delete()
                .eq("id", selectedSeller.id);

            if (error) throw error;

            toast({
                title: "✅ Vendedor excluído",
                description: `${selectedSeller.name} foi removido do sistema.`,
            });

            setShowDeleteDialog(false);
            setSelectedSeller(null);
            await loadData();
        } catch (error: any) {
            console.error("Error deleting seller:", error);
            toast({
                title: "Erro ao excluir",
                description: error.message || "Não foi possível excluir o vendedor. Verifique se há associações ativas.",
                variant: "destructive",
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handlePayCommission = async () => {
        if (!selectedCommission) return;

        setActionLoading(true);
        try {
            const { error } = await supabase
                .from("seller_commissions")
                .update({
                    status: "paid",
                    paid_at: new Date().toISOString(),
                    payment_method: paymentMethod,
                    notes: paymentNotes.trim() || null,
                })
                .eq("id", selectedCommission.id);

            if (error) throw error;

            toast({
                title: "✅ Comissão paga",
                description: `R$ ${selectedCommission.commission_amount.toFixed(2)} marcado como pago.`,
            });

            setShowPayDialog(false);
            setPaymentMethod("pix");
            setPaymentNotes("");
            setSelectedCommission(null);
            await loadData();
        } catch (error: any) {
            console.error("Error paying commission:", error);
            toast({
                title: "Erro ao marcar como pago",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleApproveCommission = async (commissionId: string) => {
        try {
            const { error } = await supabase
                .from("seller_commissions")
                .update({
                    status: "approved",
                    approved_at: new Date().toISOString(),
                })
                .eq("id", commissionId);

            if (error) throw error;

            toast({
                title: "Comissão aprovada",
                description: "Mova para a aba de pagamento quando desejar quitar.",
            });

            await loadData();
        } catch (error: any) {
            toast({
                title: "Erro",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const openEditDialog = (seller: Seller) => {
        setSelectedSeller(seller);
        setForm({
            name: seller.name,
            email: seller.email,
            phone: seller.phone || "",
            whatsapp: seller.whatsapp || "",
            commission_monthly_percent: seller.commission_monthly_percent,
            commission_annual_percent: seller.commission_annual_percent,
            notes: seller.notes || ""
        });
        setShowEditDialog(true);
    };

    const resetForm = () => {
        setForm({
            name: "",
            email: "",
            phone: "",
            whatsapp: "",
            commission_monthly_percent: 20,
            commission_annual_percent: 10,
            notes: ""
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "paid":
                return <Badge variant="success">Paga</Badge>;
            case "approved":
                return <Badge variant="info">Aprovada</Badge>;
            case "rejected":
                return <Badge variant="danger">Rejeitada</Badge>;
            case "pending":
                return <Badge variant="warning">Pendente</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    const filteredSellers = sellerStats.filter(s =>
        s.seller_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredCommissions = commissions.filter(c =>
        c.salon_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Totais
    const totalSellers = sellers.length;
    const activeSellers = sellers.filter(s => s.is_active).length;
    const totalPending = commissions.filter(c => c.status === "pending").reduce((sum, c) => sum + c.commission_amount, 0);
    const totalToPay = commissions.filter(c => c.status === "approved").reduce((sum, c) => sum + c.commission_amount, 0);
    const totalPaidThisMonth = commissions
        .filter(c => c.status === "paid" && new Date(c.paid_at || c.created_at).getMonth() === new Date().getMonth())
        .reduce((sum, c) => sum + c.commission_amount, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/20">
                                <Users className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{totalSellers}</p>
                                <p className="text-xs text-muted-foreground">Vendedores</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-success/20">
                                <CheckCircle className="w-5 h-5 text-success" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{activeSellers}</p>
                                <p className="text-xs text-muted-foreground">Ativos</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-warning/20">
                                <Clock className="w-5 h-5 text-warning" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-warning">
                                    R$ {totalPending.toFixed(0)}
                                </p>
                                <p className="text-xs text-muted-foreground">Aprovar</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/20">
                                <DollarSign className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-primary">
                                    R$ {totalToPay.toFixed(0)}
                                </p>
                                <p className="text-xs text-muted-foreground">Pagar</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/20">
                                <TrendingUp className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-primary">
                                    R$ {totalPaidThisMonth.toFixed(0)}
                                </p>
                                <p className="text-xs text-muted-foreground">Pago este mês</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-success/20">
                                <Building2 className="w-5 h-5 text-success" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">
                                    {sellerStats.reduce((sum, s) => sum + s.total_salons, 0)}
                                </p>
                                <p className="text-xs text-muted-foreground">Salões vendidos</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="sellers" className="w-full">
                <div className="flex items-center justify-between mb-4">
                    <TabsList>
                        <TabsTrigger value="sellers" className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Vendedores
                        </TabsTrigger>
                        <TabsTrigger value="commissions" className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Comissões
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex gap-2">
                        <Input
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-64"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={loadData}
                            disabled={refreshing}
                            aria-label="Atualizar dados"
                        >
                            {refreshing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4" />
                            )}
                        </Button>
                        {sellers.length === 0 && (
                            <Button onClick={() => setShowAddDialog(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Adicionar Vendedor
                            </Button>
                        )}
                    </div>
                </div>

                {/* Sellers Tab */}
                <TabsContent value="sellers" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Users className="w-5 h-5" />
                                    Vendedores Cadastrados ({sellerStats.length})
                                </span>
                                <Button onClick={() => setShowAddDialog(true)} size="sm">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Novo Vendedor
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Vendedor</TableHead>
                                            <TableHead>Contato</TableHead>
                                            <TableHead>Comissão Mensal</TableHead>
                                            <TableHead>Comissão Anual</TableHead>
                                            <TableHead>Salões</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Total Pago</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredSellers.map((seller) => (
                                            <TableRow key={seller.seller_id}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{seller.seller_name}</p>
                                                        <p className="text-xs text-muted-foreground">{seller.email}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        {seller.phone && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 px-2"
                                                                onClick={() => window.open(`tel:${seller.phone}`)}
                                                            >
                                                                <Phone className="w-3 h-3" />
                                                            </Button>
                                                        )}
                                                        {sellers.find(x => x.id === seller.seller_id)?.whatsapp && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 px-2 text-success"
                                                                onClick={() => window.open(`https://wa.me/55${(sellers.find(x => x.id === seller.seller_id)?.whatsapp ?? '').replace(/\D/g, '')}`, "_blank")}
                                                            >
                                                                <Mail className="w-3 h-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Percent className="w-4 h-4 text-primary" />
                                                        <span className="font-medium">{seller.commission_monthly_percent}%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Percent className="w-4 h-4 text-primary" />
                                                        <span className="font-medium">{seller.commission_annual_percent}%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <Building2 className="w-3 h-3" />
                                                            <span>{seller.total_salons}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                            <CheckCircle className="w-3 h-3 text-success" />
                                                            <span>{seller.active_salons} ativos</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={seller.is_active ? "success" : "secondary"}>
                                                        {seller.is_active ? "Ativo" : "Inativo"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="font-medium text-success">
                                                        R$ {seller.total_paid.toFixed(2)}
                                                    </p>
                                                </TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm" aria-label={`Ações do vendedor ${seller.seller_name}`}>
                                                                <MoreVertical className="w-4 h-4" aria-hidden />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => {
                                                                const sellerData = sellers.find(s => s.id === seller.seller_id);
                                                                if (sellerData) openEditDialog(sellerData);
                                                            }}>
                                                                <Edit className="w-4 h-4 mr-2" />
                                                                Editar
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => {
                                                                const sellerData = sellers.find(s => s.id === seller.seller_id);
                                                                if (sellerData) handleToggleActive(sellerData.id, sellerData.is_active);
                                                            }} className={
                                                                seller.is_active ? "text-destructive" : "text-success"
                                                            }>
                                                                {seller.is_active ? (
                                                                    <><Ban className="w-4 h-4 mr-2" /> Desativar</>
                                                                ) : (
                                                                    <><CheckCircle className="w-4 h-4 mr-2" /> Ativar</>
                                                                )}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => {
                                                                const sellerData = sellers.find(s => s.id === seller.seller_id);
                                                                if (sellerData) {
                                                                    setSelectedSeller(sellerData);
                                                                    setShowDeleteDialog(true);
                                                                }
                                                            }} className="text-destructive">
                                                                <Trash2 className="w-4 h-4 mr-2" />
                                                                Excluir
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Commissions Tab */}
                <TabsContent value="commissions" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5" />
                                Comissões ({commissions.length})
                            </CardTitle>
                            <CardDescription>
                                Aprove as comissões pendentes e marque como pagas quando quitar o valor.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Vendedor</TableHead>
                                            <TableHead>Estabelecimento</TableHead>
                                            <TableHead>Plano</TableHead>
                                            <TableHead>Valor</TableHead>
                                            <TableHead>Comissão</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Data</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredCommissions.map((commission) => (
                                            <TableRow key={commission.id}>
                                                <TableCell>
                                                    {sellerStats.find(s => s.seller_id === commission.seller_id)?.seller_name || "N/A"}
                                                </TableCell>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium">{commission.salon_name}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={commission.payment_type === "annual" ? "info" : "secondary"}>
                                                        {commission.payment_type === "annual" ? "Anual" : "Mensal"}
                                                    </Badge>
                                                    <p className="text-xs text-muted-foreground">{commission.subscription_plan}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="font-medium">R$ {commission.amount.toFixed(2)}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Percent className="w-4 h-4 text-primary" />
                                                        <span className="font-medium text-success">
                                                            {commission.commission_percent}%
                                                        </span>
                                                        <p className="text-xs text-muted-foreground font-bold">
                                                            R$ {commission.commission_amount.toFixed(2)}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {getStatusBadge(commission.status)}
                                                </TableCell>
                                                <TableCell>
                                                    <p className="text-sm">
                                                        {format(new Date(commission.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                                    </p>
                                                </TableCell>
                                                <TableCell>
                                                    {commission.status === "pending" && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleApproveCommission(commission.id)}
                                                        >
                                                            Aprovar
                                                        </Button>
                                                    )}
                                                    {commission.status === "approved" && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => {
                                                                setSelectedCommission(commission);
                                                                setShowPayDialog(true);
                                                            }}
                                                        >
                                                            Pagar
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Add Seller Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="w-5 h-5" />
                            Adicionar Novo Vendedor
                        </DialogTitle>
                        <DialogDescription>
                            Cadastre um novo vendedor que poderá indicar e vender o sistema Agenda Fácil 365.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nome Completo *</Label>
                            <Input
                                id="name"
                                placeholder="Ex: João Silva"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email *</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="exemplo@email.com"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="phone">Telefone (Opcional)</Label>
                                <Input
                                    id="phone"
                                    placeholder="11999999999"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="whatsapp">WhatsApp (Opcional)</Label>
                                <Input
                                    id="whatsapp"
                                    placeholder="11999999999"
                                    value={form.whatsapp}
                                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="commission_monthly">
                                    Comissão Plano Mensal * (%)
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="commission_monthly"
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        value={form.commission_monthly_percent}
                                        onChange={(e) => setForm({ ...form, commission_monthly_percent: parseFloat(e.target.value) || 0 })}
                                    />
                                    <Percent className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Padrão: 20% para planos mensais
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="commission_annual">
                                    Comissão Plano Anual * (%)
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="commission_annual"
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        value={form.commission_annual_percent}
                                        onChange={(e) => setForm({ ...form, commission_annual_percent: parseFloat(e.target.value) || 0 })}
                                    />
                                    <Percent className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Padrão: 10% para planos anuais
                                </p>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="notes">Observações (Opcional)</Label>
                            <Textarea
                                id="notes"
                                placeholder="Informações adicionais sobre o vendedor..."
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleAddSeller} disabled={actionLoading}>
                            {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Criar Vendedor
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Seller Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Editar Vendedor: {selectedSeller?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-name">Nome Completo</Label>
                            <Input
                                id="edit-name"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-email">Email</Label>
                            <Input
                                id="edit-email"
                                type="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="edit-phone">Telefone</Label>
                                <Input
                                    id="edit-phone"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="edit-whatsapp">WhatsApp</Label>
                                <Input
                                    id="edit-whatsapp"
                                    value={form.whatsapp}
                                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Comissão Mensal (%)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={form.commission_monthly_percent}
                                    onChange={(e) => setForm({ ...form, commission_monthly_percent: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Comissão Anual (%)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={form.commission_annual_percent}
                                    onChange={(e) => setForm({ ...form, commission_annual_percent: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-notes">Observações</Label>
                            <Textarea
                                id="edit-notes"
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleUpdateSeller} disabled={actionLoading}>
                            {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Excluir Vendedor?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja excluir <strong>{selectedSeller?.name}</strong>?
                            <br /><br />
                            Esta ação não pode ser desfeita. O vendedor perderá acesso ao sistema e
                            não receberá mais comissões por novas vendas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteSeller}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            disabled={actionLoading}
                        >
                            {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Sim, Excluir
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Pay Commission Dialog */}
            <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-success" />
                            Pagamento de Comissão
                        </DialogTitle>
                        <DialogDescription>
                            Confirme o pagamento da comissão de R$ {selectedCommission?.commission_amount?.toFixed(2)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Método de Pagamento</Label>
                            <select
                                className="w-full px-3 py-2 border rounded-md"
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                            >
                                <option value="pix">PIX</option>
                                <option value="bank_transfer">Transferência Bancária</option>
                                <option value="cash">Dinheiro</option>
                                <option value="other">Outro</option>
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Observações (Opcional)</Label>
                            <Textarea
                                placeholder="Notas sobre o pagamento..."
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                        <div className="p-4 bg-surface-1 rounded-lg">
                            <p className="text-sm text-muted-foreground">Vendedor:</p>
                            <p className="font-medium">
                                {sellerStats.find(s => s.seller_id === selectedCommission?.seller_id)?.seller_name}
                            </p>
                            <p className="text-sm text-muted-foreground mt-2">Valor:</p>
                            <p className="text-2xl font-bold text-success">
                                R$ {selectedCommission?.commission_amount?.toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowPayDialog(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handlePayCommission}
                            disabled={actionLoading}
                            className="bg-success hover:bg-success/90 text-success-foreground"
                        >
                            {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Confirmar Pagamento
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
