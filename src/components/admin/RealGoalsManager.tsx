import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Target,
    TrendingUp,
    DollarSign,
    Calendar,
    Users,
    Star,
    Plus,
    RefreshCw,
    CheckCircle,
    XCircle,
    Clock,
    Trash2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { goalsService, Goal } from "@/services/goalsService";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RealGoalsManagerProps {
    salonId: string;
}

export const RealGoalsManager = ({ salonId }: RealGoalsManagerProps) => {
    const [loading, setLoading] = useState(true);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [stats, setStats] = useState({
        activeGoals: 0,
        completedGoals: 0,
        failedGoals: 0,
        averageCompletion: 0
    });
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    // Form state
    const [newGoal, setNewGoal] = useState({
        type: 'revenue' as Goal['type'],
        name: '',
        target_value: '',
        period: 'monthly' as Goal['period']
    });

    useEffect(() => {
        if (salonId) {
            loadData();
        }
    }, [salonId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Recalcular metas ativas
            await goalsService.recalculateGoals(salonId);

            // Carregar metas
            const goalsData = await goalsService.getGoals(salonId);
            setGoals(goalsData);

            // Carregar estatísticas
            const statsData = await goalsService.getStats(salonId);
            setStats(statsData);
        } catch (error) {
            console.error('Erro ao carregar metas:', error);
            toast.error('Erro ao carregar metas');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGoal = async () => {
        if (!newGoal.name || !newGoal.target_value) {
            toast.error('Nome e valor da meta são obrigatórios');
            return;
        }

        try {
            await goalsService.createGoalWithPeriod({
                salon_id: salonId,
                type: newGoal.type,
                name: newGoal.name,
                target_value: parseFloat(newGoal.target_value),
                period: newGoal.period
            });

            toast.success('Meta criada com sucesso!');
            setIsAddDialogOpen(false);
            setNewGoal({
                type: 'revenue',
                name: '',
                target_value: '',
                period: 'monthly'
            });
            loadData();
        } catch (error) {
            console.error('Erro ao criar meta:', error);
            toast.error('Erro ao criar meta');
        }
    };

    const handleDeleteGoal = async (goalId: string) => {
        try {
            await goalsService.deleteGoal(goalId);
            toast.success('Meta removida');
            loadData();
        } catch (error) {
            toast.error('Erro ao remover meta');
        }
    };

    const getTypeIcon = (type: string) => {
        const icons: { [key: string]: React.ReactNode } = {
            revenue: <DollarSign className="w-5 h-5" />,
            appointments: <Calendar className="w-5 h-5" />,
            new_clients: <Users className="w-5 h-5" />,
            rating: <Star className="w-5 h-5" />,
            custom: <Target className="w-5 h-5" />
        };
        return icons[type] || icons.custom;
    };

    const getTypeLabel = (type: string) => {
        const labels: { [key: string]: string } = {
            revenue: 'Faturamento',
            appointments: 'Agendamentos',
            new_clients: 'Novos Clientes',
            rating: 'Avaliação',
            custom: 'Personalizada'
        };
        return labels[type] || type;
    };

    const getStatusBadge = (status: string) => {
        const statusConfig: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode } } = {
            active: { label: 'Em andamento', variant: 'default', icon: <Clock className="w-3 h-3" /> },
            completed: { label: 'Concluída', variant: 'secondary', icon: <CheckCircle className="w-3 h-3" /> },
            failed: { label: 'Não atingida', variant: 'destructive', icon: <XCircle className="w-3 h-3" /> },
            cancelled: { label: 'Cancelada', variant: 'outline', icon: <XCircle className="w-3 h-3" /> }
        };
        const config = statusConfig[status] || statusConfig.active;
        return (
            <Badge variant={config.variant} className="flex items-center gap-1">
                {config.icon}
                {config.label}
            </Badge>
        );
    };

    const formatValue = (type: string, value: number) => {
        if (type === 'revenue') {
            return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        }
        if (type === 'rating') {
            return value.toFixed(1);
        }
        return value.toLocaleString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const activeGoals = goals.filter(g => g.status === 'active');
    const completedGoals = goals.filter(g => g.status === 'completed' || g.status === 'failed');

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-tour="advanced-goals-panel">
            {/* Metas Ativas */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">Metas Ativas</h2>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" data-tour="advanced-goals-add">
                                <Plus className="w-4 h-4 mr-1" />
                                Nova Meta
                            </Button>
                        </DialogTrigger>
                        <DialogContent data-tour="advanced-goals-dialog">
                            <DialogHeader>
                                <DialogTitle>Criar Nova Meta</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 mt-4">
                                <div data-tour="advanced-goals-type">
                                    <Label>Tipo de Meta</Label>
                                    <Select
                                        value={newGoal.type}
                                        onValueChange={value => setNewGoal({ ...newGoal, type: value as Goal['type'] })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="revenue">Faturamento</SelectItem>
                                            <SelectItem value="appointments">Agendamentos</SelectItem>
                                            <SelectItem value="new_clients">Novos Clientes</SelectItem>
                                            <SelectItem value="rating">Avaliação Média</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Nome da Meta</Label>
                                    <Input
                                        value={newGoal.name}
                                        onChange={e => setNewGoal({ ...newGoal, name: e.target.value })}
                                        placeholder="Ex: Meta de faturamento mensal"
                                    />
                                </div>
                                <div data-tour="advanced-goals-target">
                                    <Label>Valor Alvo</Label>
                                    <Input
                                        type="number"
                                        value={newGoal.target_value}
                                        onChange={e => setNewGoal({ ...newGoal, target_value: e.target.value })}
                                        placeholder={newGoal.type === 'revenue' ? 'Ex: 25000' : 'Ex: 100'}
                                    />
                                </div>
                                <div data-tour="advanced-goals-period">
                                    <Label>Período</Label>
                                    <Select
                                        value={newGoal.period}
                                        onValueChange={value => setNewGoal({ ...newGoal, period: value as Goal['period'] })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="daily">Diário</SelectItem>
                                            <SelectItem value="weekly">Semanal</SelectItem>
                                            <SelectItem value="monthly">Mensal</SelectItem>
                                            <SelectItem value="quarterly">Trimestral</SelectItem>
                                            <SelectItem value="yearly">Anual</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handleCreateGoal} className="w-full" data-tour="advanced-goals-save">
                                    Criar Meta
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {activeGoals.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center">
                            <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">Nenhuma meta ativa</h3>
                            <p className="text-muted-foreground mb-4">
                                Crie sua primeira meta para acompanhar o crescimento
                            </p>
                            <Button onClick={() => setIsAddDialogOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Criar Meta
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    activeGoals.map((goal, index) => {
                        const progress = Math.min((goal.current_value / goal.target_value) * 100, 100);

                        return (
                            <motion.div
                                key={goal.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Card className="overflow-hidden" data-tour="advanced-goals-progress">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                    {getTypeIcon(goal.type)}
                                                </div>
                                                <div>
                                                    <h3 className="font-medium">{goal.name}</h3>
                                                    <p className="text-xs text-muted-foreground">
                                                        {getTypeLabel(goal.type)} • Até {format(new Date(goal.end_date), "dd/MM/yyyy", { locale: ptBR })}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                data-tour="advanced-goals-delete"
                                                aria-label="Excluir meta"
                                                onClick={() => handleDeleteGoal(goal.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Progresso</span>
                                                <span className="font-medium">{progress.toFixed(0)}%</span>
                                            </div>
                                            <Progress value={progress} className="h-2" />
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-primary font-medium">
                                                    {formatValue(goal.type, goal.current_value)}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    de {formatValue(goal.type, goal.target_value)}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* Estatísticas e Histórico */}
            <div className="space-y-6">
                {/* Estatísticas */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            Estatísticas
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-4 rounded-xl bg-primary/10">
                                <p className="text-2xl font-bold text-primary">{stats.activeGoals}</p>
                                <p className="text-xs text-muted-foreground">Metas ativas</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-success/10">
                                <p className="text-2xl font-bold text-success">{stats.completedGoals}</p>
                                <p className="text-xs text-muted-foreground">Concluídas</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-destructive/10">
                                <p className="text-2xl font-bold text-destructive">{stats.failedGoals}</p>
                                <p className="text-xs text-muted-foreground">Não atingidas</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-warning/10">
                                <p className="text-2xl font-bold text-warning">{stats.averageCompletion}%</p>
                                <p className="text-xs text-muted-foreground">Taxa média</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Histórico */}
                <Card>
                    <CardHeader>
                        <CardTitle>Histórico de Metas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {completedGoals.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">
                                Nenhuma meta concluída ainda
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {completedGoals.slice(0, 5).map(goal => (
                                    <div
                                        key={goal.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                                                {getTypeIcon(goal.type)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{goal.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatValue(goal.type, goal.current_value)} / {formatValue(goal.type, goal.target_value)}
                                                </p>
                                            </div>
                                        </div>
                                        {getStatusBadge(goal.status)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
