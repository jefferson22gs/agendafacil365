import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Trophy,
    Star,
    Crown,
    Gem,
    Award,
    Gift,
    TrendingUp,
    Sparkles,
    Users,
    RefreshCw,
    Plus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { loyaltyService, LoyaltyPoints, LoyaltyTier } from "@/services/loyaltyService";
import { toast } from "sonner";

interface LoyaltyLevelDisplay {
    name: string;
    minPoints: number;
    discount: number;
    color: string;
    icon: React.ReactNode;
    benefits: string[];
}

const defaultLevels: LoyaltyLevelDisplay[] = [
    {
        name: 'Bronze',
        minPoints: 0,
        discount: 5,
        color: 'from-amber-700 to-amber-500',
        icon: <Award className="w-5 h-5" />,
        benefits: ['5% de desconto', 'Pontos em dobro no aniversário']
    },
    {
        name: 'Prata',
        minPoints: 1000,
        discount: 10,
        color: 'from-gray-400 to-gray-300',
        icon: <Star className="w-5 h-5" />,
        benefits: ['10% de desconto', 'Agendamento prioritário', 'Brinde mensal']
    },
    {
        name: 'Ouro',
        minPoints: 2000,
        discount: 15,
        color: 'from-yellow-500 to-amber-400',
        icon: <Trophy className="w-5 h-5" />,
        benefits: ['15% de desconto', 'Acesso VIP', 'Produtos exclusivos']
    },
    {
        name: 'Diamante',
        minPoints: 4000,
        discount: 20,
        color: 'from-cyan-400 to-blue-500',
        icon: <Gem className="w-5 h-5" />,
        benefits: ['20% de desconto', 'Serviço grátis mensal', 'Atendimento exclusivo']
    },
];

interface Client {
    id: string;
    name: string;
    phone?: string;
}

interface RealLoyaltySystemProps {
    salonId: string;
}

export const RealLoyaltySystem = ({ salonId }: RealLoyaltySystemProps) => {
    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [clientPoints, setClientPoints] = useState<LoyaltyPoints | null>(null);
    const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
    const [stats, setStats] = useState({
        activeClients: 0,
        totalPointsDistributed: 0,
        redemptionsThisMonth: 0,
        totalValueRedeemed: 0
    });

    useEffect(() => {
        if (salonId) {
            loadData();
        }
    }, [salonId]);

    useEffect(() => {
        if (selectedClientId && salonId) {
            loadClientPoints(selectedClientId);
        }
    }, [selectedClientId, salonId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Carregar clientes
            const { data: clientsData } = await supabase
                .from('clients')
                .select('id, name, phone')
                .eq('salon_id', salonId)
                .order('name');

            setClients(clientsData || []);

            // Carregar níveis
            const tiersData = await loyaltyService.getTiers(salonId);
            setTiers(tiersData);

            // Carregar estatísticas
            const statsData = await loyaltyService.getStats(salonId);
            setStats(statsData);

            // Se tiver clientes, selecionar o primeiro
            if (clientsData && clientsData.length > 0) {
                setSelectedClientId(clientsData[0].id);
            }
        } catch (error) {
            console.error('Erro ao carregar dados de fidelidade:', error);
            toast.error('Erro ao carregar dados de fidelidade');
        } finally {
            setLoading(false);
        }
    };

    const loadClientPoints = async (clientId: string) => {
        try {
            const points = await loyaltyService.getClientPoints(salonId, clientId);
            setClientPoints(points);
        } catch (error) {
            console.error('Erro ao carregar pontos do cliente:', error);
        }
    };

    const addBonusPoints = async (points: number, description: string) => {
        if (!selectedClientId) return;

        try {
            await loyaltyService.addPoints(salonId, selectedClientId, points, description);
            toast.success(`${points} pontos adicionados!`);
            loadClientPoints(selectedClientId);
            loadData();
        } catch (error) {
            console.error('Erro ao adicionar pontos:', error);
            toast.error('Erro ao adicionar pontos');
        }
    };

    const getCurrentLevel = (points: number): LoyaltyLevelDisplay => {
        const levels = tiers.length > 0
            ? tiers.map(t => ({
                name: t.name,
                minPoints: t.min_points,
                discount: t.discount_percent,
                color: getLevelColor(t.name),
                icon: getLevelIcon(t.name),
                benefits: Array.isArray(t.benefits) ? t.benefits : []
            }))
            : defaultLevels;

        return levels.reverse().find(l => points >= l.minPoints) || levels[0];
    };

    const getNextLevel = (points: number): LoyaltyLevelDisplay | null => {
        const levels = tiers.length > 0
            ? tiers.map(t => ({
                name: t.name,
                minPoints: t.min_points,
                discount: t.discount_percent,
                color: getLevelColor(t.name),
                icon: getLevelIcon(t.name),
                benefits: Array.isArray(t.benefits) ? t.benefits : []
            }))
            : defaultLevels;

        return levels.find(l => points < l.minPoints) || null;
    };

    const getLevelColor = (name: string): string => {
        const colors: { [key: string]: string } = {
            'Bronze': 'from-amber-700 to-amber-500',
            'Prata': 'from-gray-400 to-gray-300',
            'Ouro': 'from-yellow-500 to-amber-400',
            'Diamante': 'from-cyan-400 to-blue-500',
        };
        return colors[name] || 'from-gray-500 to-gray-400';
    };

    const getLevelIcon = (name: string): React.ReactNode => {
        const icons: { [key: string]: React.ReactNode } = {
            'Bronze': <Award className="w-5 h-5" />,
            'Prata': <Star className="w-5 h-5" />,
            'Ouro': <Trophy className="w-5 h-5" />,
            'Diamante': <Gem className="w-5 h-5" />,
        };
        return icons[name] || <Award className="w-5 h-5" />;
    };

    const selectedClient = clients.find(c => c.id === selectedClientId);
    const points = clientPoints?.points || 0;
    const currentLevel = getCurrentLevel(points);
    const nextLevel = getNextLevel(points);
    const progressToNext = nextLevel
        ? ((points - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100
        : 100;
    const pointsToNext = nextLevel ? nextLevel.minPoints - points : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-tour="advanced-loyalty-panel">
            {/* Card do Cliente */}
            <Card className="overflow-hidden">
                {/* Seletor de Cliente */}
                <div className="p-4 border-b border-border">
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger data-tour="advanced-loyalty-client">
                            <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                        <SelectContent>
                            {clients.map(client => (
                                <SelectItem key={client.id} value={client.id}>
                                    {client.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {selectedClient && (
                    <>
                        {/* Header com Nível */}
                        <div className={`bg-gradient-to-r ${currentLevel.color} p-6 text-white relative overflow-hidden`} data-tour="advanced-loyalty-points">
                            <div className="absolute inset-0 overflow-hidden">
                                {[...Array(5)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{
                                            opacity: [0, 1, 0],
                                            y: [-20, -60],
                                            x: [0, (i % 2 === 0 ? 20 : -20)]
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                            delay: i * 0.4,
                                        }}
                                        className="absolute"
                                        style={{ left: `${20 + i * 15}%`, bottom: 0 }}
                                    >
                                        <Sparkles className="w-4 h-4 text-white/50" />
                                    </motion.div>
                                ))}
                            </div>

                            <div className="relative z-10 flex items-center justify-between">
                                <div>
                                    <p className="text-white/80 text-sm">Cliente</p>
                                    <h3 className="font-display text-2xl font-bold">{selectedClient.name}</h3>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                        {currentLevel.icon}
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white/80 text-sm">Nível</p>
                                        <p className="font-bold text-xl">{currentLevel.name}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="relative z-10 mt-6 flex items-end justify-between">
                                <div>
                                    <p className="text-white/80 text-sm">Pontos acumulados</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="font-display text-4xl font-bold">{points.toLocaleString()}</span>
                                        <span className="text-white/80">pts</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-white/80 text-sm">Desconto atual</p>
                                    <span className="font-display text-3xl font-bold">{currentLevel.discount}%</span>
                                </div>
                            </div>
                        </div>

                        <CardContent className="p-6 space-y-6">
                            {/* Progresso para próximo nível */}
                            {nextLevel && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-muted-foreground">
                                            Progresso para <span className="text-foreground font-medium">{nextLevel.name}</span>
                                        </span>
                                        <span className="text-sm font-medium text-primary">
                                            {pointsToNext} pts restantes
                                        </span>
                                    </div>
                                    <Progress value={progressToNext} className="h-3" />
                                </div>
                            )}

                            {/* Benefícios */}
                            <div>
                                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                                    <Gift className="w-4 h-4 text-primary" />
                                    Benefícios do nível
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {currentLevel.benefits.map((benefit, index) => (
                                        <Badge key={index} variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                                            ✓ {benefit}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            {/* Ações rápidas */}
                            <div className="flex gap-2" data-tour="advanced-loyalty-bonus">
                                <Button
                                    size="sm"
                                    onClick={() => addBonusPoints(100, 'Bônus manual')}
                                    className="flex-1"
                                >
                                    <Plus className="w-4 h-4 mr-1" />
                                    +100 pts
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => addBonusPoints(50, 'Bônus avaliação')}
                                    className="flex-1"
                                >
                                    <Plus className="w-4 h-4 mr-1" />
                                    +50 pts
                                </Button>
                            </div>
                        </CardContent>
                    </>
                )}
            </Card>

            {/* Estatísticas e Configurações */}
            <div className="space-y-6">
                {/* Resumo do Programa */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">Resumo do Programa</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-4 rounded-xl bg-primary/10">
                                <p className="text-2xl font-bold text-primary">{stats.activeClients}</p>
                                <p className="text-xs text-muted-foreground">Clientes ativos</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-success/10">
                                <p className="text-2xl font-bold text-success">
                                    {stats.totalPointsDistributed >= 1000
                                        ? `${(stats.totalPointsDistributed / 1000).toFixed(1)}K`
                                        : stats.totalPointsDistributed}
                                </p>
                                <p className="text-xs text-muted-foreground">Pontos distribuídos</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-primary/10">
                                <p className="text-2xl font-bold text-primary">{stats.redemptionsThisMonth}</p>
                                <p className="text-xs text-muted-foreground">Resgates no mês</p>
                            </div>
                            <div className="text-center p-4 rounded-xl bg-warning/10">
                                <p className="text-2xl font-bold text-warning">
                                    R$ {stats.totalValueRedeemed.toFixed(0)}
                                </p>
                                <p className="text-xs text-muted-foreground">Valor resgatado</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Como ganhar pontos */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-success" />
                            Como ganhar pontos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="text-sm text-muted-foreground space-y-2">
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary"></span>
                                <span className="text-foreground font-medium">R$ 1,00</span> = 1 ponto em serviços
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary"></span>
                                <span className="text-foreground font-medium">Indicar amigo</span> = 100 pontos
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary"></span>
                                <span className="text-foreground font-medium">Avaliar serviço</span> = 10 pontos
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary"></span>
                                <span className="text-foreground font-medium">Aniversário</span> = pontos em dobro
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

// Exportar componente legado para compatibilidade
export { ClientLoyaltyCard, LoyaltyBadge } from "./LoyaltySystemLegacy";
