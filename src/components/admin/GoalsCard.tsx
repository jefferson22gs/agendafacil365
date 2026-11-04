import { useState } from "react";
import { motion } from "framer-motion";
import {
    Target,
    TrendingUp,
    Users,
    DollarSign,
    Calendar,
    Award,
    ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Goal {
    id: string;
    title: string;
    current: number;
    target: number;
    unit: string;
    icon: React.ReactNode;
    color: string;
    period: string;
}

const mockGoals: Goal[] = [
    {
        id: '1',
        title: 'Faturamento Mensal',
        current: 12500,
        target: 20000,
        unit: 'R$',
        icon: <DollarSign className="w-5 h-5" />,
        color: 'success',
        period: 'Dezembro 2024'
    },
    {
        id: '2',
        title: 'Agendamentos',
        current: 156,
        target: 200,
        unit: '',
        icon: <Calendar className="w-5 h-5" />,
        color: 'primary',
        period: 'Este mês'
    },
    {
        id: '3',
        title: 'Novos Clientes',
        current: 23,
        target: 30,
        unit: '',
        icon: <Users className="w-5 h-5" />,
        color: 'primary',
        period: 'Este mês'
    },
    {
        id: '4',
        title: 'Avaliação Média',
        current: 4.7,
        target: 5,
        unit: '⭐',
        icon: <Award className="w-5 h-5" />,
        color: 'warning',
        period: 'Geral'
    },
];

// Tom do ícone e da barra por meta (tokens da marca; sem gradiente).
const GOAL_TONE: Record<string, string> = { success: 'bg-success/10 text-success', primary: 'bg-primary/10 text-primary', warning: 'bg-warning/10 text-warning' };
const GOAL_BAR: Record<string, string> = { success: 'bg-success', primary: 'bg-primary', warning: 'bg-warning' };

interface GoalsCardProps {
    salonId?: string;
}

export const GoalsCard = ({ salonId }: GoalsCardProps) => {
    const [goals] = useState<Goal[]>(mockGoals);

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-primary" />
                        Metas & OKRs
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                        Dezembro 2024
                    </span>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {goals.map((goal, index) => {
                    const percentage = Math.min((goal.current / goal.target) * 100, 100);
                    const isCompleted = percentage >= 100;

                    return (
                        <motion.div
                            key={goal.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="group"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-lg ${GOAL_TONE[goal.color]} flex items-center justify-center`} aria-hidden>
                                        {goal.icon}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{goal.title}</p>
                                        <p className="text-xs text-muted-foreground">{goal.period}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-foreground">
                                        {goal.unit === 'R$' ? `R$ ${goal.current.toLocaleString()}` : `${goal.current}${goal.unit}`}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        de {goal.unit === 'R$' ? `R$ ${goal.target.toLocaleString()}` : `${goal.target}${goal.unit}`}
                                    </p>
                                </div>
                            </div>

                            <div className="relative">
                                <Progress
                                    value={percentage}
                                    className="h-2 bg-secondary"
                                />
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    transition={{ duration: 1, delay: index * 0.1 }}
                                    className={`absolute top-0 left-0 h-2 rounded-full ${GOAL_BAR[goal.color]}`}
                                />
                            </div>

                            <div className="flex items-center justify-between mt-1">
                                <span className={`text-xs font-medium ${isCompleted ? 'text-success' : percentage >= 75 ? 'text-primary' : 'text-muted-foreground'
                                    }`}>
                                    {isCompleted ? '✅ Meta atingida!' : `${percentage.toFixed(0)}% concluído`}
                                </span>
                                {!isCompleted && (
                                    <span className="text-xs text-muted-foreground">
                                        Faltam {goal.unit === 'R$'
                                            ? `R$ ${(goal.target - goal.current).toLocaleString()}`
                                            : `${(goal.target - goal.current).toFixed(goal.unit === '⭐' ? 1 : 0)}${goal.unit}`
                                        }
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    );
                })}

                {/* Weekly Trend */}
                <div className="pt-4 border-t border-border/50">
                    <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-success" />
                            <span className="text-muted-foreground">Tendência semanal</span>
                        </div>
                        <span className="text-success font-medium">+12% vs. semana passada</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
