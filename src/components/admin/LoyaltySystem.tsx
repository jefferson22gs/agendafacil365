import { motion } from "framer-motion";
import {
    Trophy,
    Star,
    Crown,
    Gem,
    Award,
    Gift,
    TrendingUp,
    Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface LoyaltyLevel {
    name: string;
    minPoints: number;
    maxPoints: number;
    discount: number;
    color: string;
    icon: React.ReactNode;
    benefits: string[];
}

const loyaltyLevels: LoyaltyLevel[] = [
    {
        name: 'Bronze',
        minPoints: 0,
        maxPoints: 499,
        discount: 5,
        color: 'from-amber-700 to-amber-500',
        icon: <Award className="w-5 h-5" />,
        benefits: ['5% de desconto', 'Pontos em dobro no aniversário']
    },
    {
        name: 'Prata',
        minPoints: 500,
        maxPoints: 1499,
        discount: 10,
        color: 'from-gray-400 to-gray-300',
        icon: <Star className="w-5 h-5" />,
        benefits: ['10% de desconto', 'Agendamento prioritário', 'Brinde mensal']
    },
    {
        name: 'Ouro',
        minPoints: 1500,
        maxPoints: 3999,
        discount: 15,
        color: 'from-yellow-500 to-amber-400',
        icon: <Trophy className="w-5 h-5" />,
        benefits: ['15% de desconto', 'Acesso VIP', 'Produtos exclusivos']
    },
    {
        name: 'Diamante',
        minPoints: 4000,
        maxPoints: 9999,
        discount: 20,
        color: 'from-cyan-400 to-blue-500',
        icon: <Gem className="w-5 h-5" />,
        benefits: ['20% de desconto', 'Serviço grátis mensal', 'Atendimento exclusivo']
    },
    {
        name: 'VIP',
        minPoints: 10000,
        maxPoints: Infinity,
        discount: 25,
        color: 'from-purple-600 to-pink-500',
        icon: <Crown className="w-5 h-5" />,
        benefits: ['25% de desconto', 'Tudo liberado', 'Experiência premium total']
    },
];

interface LoyaltyBadge {
    id: string;
    name: string;
    description: string;
    icon: string;
    earned: boolean;
    earnedAt?: Date;
}

const badges: LoyaltyBadge[] = [
    { id: '1', name: 'Primeira Visita', description: 'Completou o primeiro agendamento', icon: '🎉', earned: true },
    { id: '2', name: 'Fã de Coloração', description: '5 serviços de coloração', icon: '🎨', earned: true },
    { id: '3', name: 'Cliente Frequente', description: '10 visitas', icon: '⭐', earned: true },
    { id: '4', name: 'Indicador', description: 'Indicou 3 amigos', icon: '👥', earned: false },
    { id: '5', name: 'Avaliador', description: '5 avaliações deixadas', icon: '📝', earned: true },
    { id: '6', name: 'Aniversariante', description: 'Visitou no mês do aniversário', icon: '🎂', earned: false },
    { id: '7', name: 'Top 10', description: 'Entre os 10 maiores clientes', icon: '🏆', earned: false },
    { id: '8', name: 'Madrugador', description: '5 agendamentos antes das 9h', icon: '🌅', earned: true },
];

interface ClientLoyaltyCardProps {
    clientId?: string;
    clientName?: string;
    points?: number;
}

export const ClientLoyaltyCard = ({
    clientName = "Maria Silva",
    points = 2450
}: ClientLoyaltyCardProps) => {

    const getCurrentLevel = (pts: number) => {
        return loyaltyLevels.find(level => pts >= level.minPoints && pts <= level.maxPoints) || loyaltyLevels[0];
    };

    const getNextLevel = (pts: number) => {
        const currentIndex = loyaltyLevels.findIndex(level => pts >= level.minPoints && pts <= level.maxPoints);
        return loyaltyLevels[currentIndex + 1] || null;
    };

    const currentLevel = getCurrentLevel(points);
    const nextLevel = getNextLevel(points);
    const progressToNext = nextLevel
        ? ((points - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100
        : 100;
    const pointsToNext = nextLevel ? nextLevel.minPoints - points : 0;

    return (
        <Card className="overflow-hidden">
            {/* Header with Level Banner */}
            <div className={`bg-gradient-to-r ${currentLevel.color} p-6 text-white relative overflow-hidden`}>
                {/* Sparkles Animation */}
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
                        <h3 className="font-display text-2xl font-bold">{clientName}</h3>
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

                {/* Points Display */}
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
                {/* Progress to Next Level */}
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
                        <div className="relative">
                            <Progress value={progressToNext} className="h-3" />
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressToNext}%` }}
                                transition={{ duration: 1 }}
                                className={`absolute top-0 left-0 h-3 rounded-full bg-gradient-to-r ${nextLevel.color}`}
                            />
                        </div>
                    </div>
                )}

                {/* Benefits */}
                <div>
                    <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                        <Gift className="w-4 h-4 text-primary" />
                        Seus benefícios
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {currentLevel.benefits.map((benefit, index) => (
                            <Badge key={index} variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                                ✓ {benefit}
                            </Badge>
                        ))}
                    </div>
                </div>

                {/* Badges Collection */}
                <div>
                    <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-primary" />
                        Suas conquistas
                    </h4>
                    <div className="grid grid-cols-4 gap-3">
                        {badges.map((badge) => (
                            <motion.div
                                key={badge.id}
                                whileHover={{ scale: badge.earned ? 1.1 : 1 }}
                                className={`text-center p-3 rounded-xl border ${badge.earned
                                        ? 'bg-primary/10 border-primary/30'
                                        : 'bg-secondary/30 border-border/30 opacity-50'
                                    }`}
                            >
                                <span className="text-2xl">{badge.icon}</span>
                                <p className="text-xs mt-1 text-muted-foreground truncate">{badge.name}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* How to Earn Points */}
                <div className="p-4 rounded-xl bg-secondary/30 border border-border/30">
                    <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-success" />
                        Como ganhar pontos
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• <span className="text-foreground">R$ 1,00</span> = 1 ponto em serviços</li>
                        <li>• <span className="text-foreground">Indicar amigo</span> = 100 pontos</li>
                        <li>• <span className="text-foreground">Avaliar serviço</span> = 10 pontos</li>
                        <li>• <span className="text-foreground">Aniversário</span> = pontos em dobro</li>
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
};

// Compact version for dashboard
export const LoyaltyBadge = ({ level = "Ouro", points = 2450 }: { level?: string; points?: number }) => {
    const levelData = loyaltyLevels.find(l => l.name === level) || loyaltyLevels[2];

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${levelData.color} text-white text-sm font-medium`}>
            {levelData.icon}
            <span>{level}</span>
            <span className="opacity-75">•</span>
            <span>{points.toLocaleString()} pts</span>
        </div>
    );
};
