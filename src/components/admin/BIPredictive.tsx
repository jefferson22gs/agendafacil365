import { useState } from "react";
import { motion } from "framer-motion";
import {
    Brain,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Lightbulb,
    DollarSign,
    Users,
    Calendar,
    ShoppingBag,
    Sparkles,
    ArrowRight,
    ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
} from "recharts";

// Mock forecast data
const revenueForcast = [
    { month: 'Set', real: 18500, previsto: null },
    { month: 'Out', real: 21200, previsto: null },
    { month: 'Nov', real: 19800, previsto: null },
    { month: 'Dez', real: 24500, previsto: 24500 },
    { month: 'Jan', real: null, previsto: 22800 },
    { month: 'Fev', real: null, previsto: 25500 },
    { month: 'Mar', real: null, previsto: 28200 },
];

const hourlyConversion = [
    { hour: '08h', taxa: 45 },
    { hour: '09h', taxa: 62 },
    { hour: '10h', taxa: 78 },
    { hour: '11h', taxa: 85 },
    { hour: '12h', taxa: 55 },
    { hour: '13h', taxa: 48 },
    { hour: '14h', taxa: 72 },
    { hour: '15h', taxa: 88 },
    { hour: '16h', taxa: 92 },
    { hour: '17h', taxa: 78 },
    { hour: '18h', taxa: 65 },
    { hour: '19h', taxa: 45 },
];

interface ChurnRiskClient {
    id: string;
    name: string;
    lastVisit: Date;
    totalSpent: number;
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    suggestedAction: string;
}

const churnRiskClients: ChurnRiskClient[] = [
    {
        id: '1',
        name: 'Maria Santos',
        lastVisit: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        totalSpent: 1250,
        riskScore: 85,
        riskLevel: 'critical',
        suggestedAction: 'Enviar cupom 20% OFF'
    },
    {
        id: '2',
        name: 'João Lima',
        lastVisit: new Date(Date.now() - 38 * 24 * 60 * 60 * 1000),
        totalSpent: 890,
        riskScore: 72,
        riskLevel: 'high',
        suggestedAction: 'Lembrete via WhatsApp'
    },
    {
        id: '3',
        name: 'Ana Oliveira',
        lastVisit: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        totalSpent: 2100,
        riskScore: 55,
        riskLevel: 'medium',
        suggestedAction: 'Mensagem personalizada'
    },
];

interface CrossSellInsight {
    service: string;
    product: string;
    probability: number;
    avgTicketIncrease: number;
}

const crossSellInsights: CrossSellInsight[] = [
    { service: 'Corte Feminino', product: 'Shampoo Reconstrutor', probability: 68, avgTicketIncrease: 45 },
    { service: 'Coloração', product: 'Máscara Tonalizante', probability: 72, avgTicketIncrease: 55 },
    { service: 'Escova Progressiva', product: 'Kit Manutenção', probability: 81, avgTicketIncrease: 120 },
    { service: 'Corte Masculino', product: 'Pomada Finalizadora', probability: 58, avgTicketIncrease: 35 },
];

interface BIPredictiveProps {
    salonId?: string;
}

export const BIPredictive = ({ salonId }: BIPredictiveProps) => {
    const [activeTab, setActiveTab] = useState<'forecast' | 'churn' | 'crosssell'>('forecast');

    const getRiskColor = (level: string) => {
        switch (level) {
            case 'critical': return 'bg-destructive/20 text-destructive border-destructive/30';
            // alto = vermelho suave (distinto de crítico); médio = aviso
            case 'high': return 'bg-destructive/10 text-destructive border-destructive/20';
            case 'medium': return 'bg-warning/20 text-warning border-warning/30';
            default: return 'bg-success/20 text-success border-success/30';
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-primary" />
                        BI Preditivo com IA
                    </CardTitle>
                    <Badge variant="info">
                        <Sparkles size={12} className="mr-1" />
                        Machine Learning
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Tabs */}
                <div className="flex gap-2 p-1 bg-secondary/30 rounded-xl">
                    {[
                        { id: 'forecast', label: 'Previsões', icon: <TrendingUp size={16} /> },
                        { id: 'churn', label: 'Risco de Churn', icon: <AlertTriangle size={16} /> },
                        { id: 'crosssell', label: 'Cross-Sell', icon: <ShoppingBag size={16} /> },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Forecast Tab */}
                {activeTab === 'forecast' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {/* Revenue Forecast */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h4 className="font-medium text-foreground">Previsão de Faturamento</h4>
                                    <p className="text-sm text-muted-foreground">Próximos 3 meses baseado em ML</p>
                                </div>
                                <div className="flex items-center gap-2 text-success">
                                    <TrendingUp size={18} />
                                    <span className="font-bold">+15%</span>
                                    <span className="text-sm text-muted-foreground">tendência</span>
                                </div>
                            </div>

                            <div className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={revenueForcast}>
                                        <defs>
                                            <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorPrevisto" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                                        <YAxis
                                            stroke="hsl(var(--muted-foreground))"
                                            fontSize={12}
                                            tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'hsl(var(--card))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '8px'
                                            }}
                                            formatter={(value: number) => [`R$ ${value?.toLocaleString()}`, '']}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="real"
                                            stroke="hsl(var(--primary))"
                                            fillOpacity={1}
                                            fill="url(#colorReal)"
                                            strokeWidth={2}
                                            name="Realizado"
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="previsto"
                                            stroke="hsl(var(--chart-2))"
                                            fillOpacity={1}
                                            fill="url(#colorPrevisto)"
                                            strokeWidth={2}
                                            strokeDasharray="5 5"
                                            name="Previsto"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Hourly Conversion */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h4 className="font-medium text-foreground">Taxa de Conversão por Horário</h4>
                                    <p className="text-sm text-muted-foreground">Melhor horário: 16h (92%)</p>
                                </div>
                            </div>

                            <div className="h-[150px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={hourlyConversion}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                                        <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'hsl(var(--card))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: '8px'
                                            }}
                                            formatter={(value: number) => [`${value}%`, 'Conversão']}
                                        />
                                        <Bar
                                            dataKey="taxa"
                                            fill="hsl(var(--primary))"
                                            radius={[4, 4, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Insights */}
                        <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                            <div className="flex items-start gap-3">
                                <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-foreground">💡 Insight da IA</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Baseado nos dados, recomendo aumentar os preços em 5% nos horários de 15h-17h
                                        (alta conversão) e oferecer 10% OFF nos horários de 12h-13h para aumentar a ocupação.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Churn Risk Tab */}
                {activeTab === 'churn' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-medium text-foreground">Clientes em Risco</h4>
                                <p className="text-sm text-muted-foreground">Ordenados por probabilidade de perda</p>
                            </div>
                            <Badge variant="destructive">
                                {churnRiskClients.filter(c => c.riskLevel === 'critical').length} críticos
                            </Badge>
                        </div>

                        <div className="space-y-3">
                            {churnRiskClients.map((client, index) => (
                                <motion.div
                                    key={client.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="p-4 rounded-xl bg-card/50 border border-border/50"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-xl font-bold">
                                                {client.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-medium text-foreground">{client.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Última visita: {Math.floor((Date.now() - client.lastVisit.getTime()) / (1000 * 60 * 60 * 24))} dias atrás
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Total gasto: R$ {client.totalSpent.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="outline" className={getRiskColor(client.riskLevel)}>
                                                {client.riskScore}% risco
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Lightbulb size={14} className="text-warning" />
                                            <span className="text-muted-foreground">{client.suggestedAction}</span>
                                        </div>
                                        <Button size="sm" variant="brand">
                                            Executar Ação
                                            <ChevronRight size={14} className="ml-1" />
                                        </Button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Cross-Sell Tab */}
                {activeTab === 'crosssell' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        <div>
                            <h4 className="font-medium text-foreground">Oportunidades de Venda Cruzada</h4>
                            <p className="text-sm text-muted-foreground">Baseado em padrões de compra dos clientes</p>
                        </div>

                        <div className="space-y-3">
                            {crossSellInsights.map((insight, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="p-4 rounded-xl bg-primary/5 border border-primary/20"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-foreground">{insight.service}</span>
                                                <ArrowRight size={16} className="text-primary" />
                                                <span className="text-sm font-medium text-primary">{insight.product}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Badge variant="secondary">
                                                {insight.probability}% chance
                                            </Badge>
                                            <span className="text-sm text-success font-medium">
                                                +R$ {insight.avgTicketIncrease}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <div className="p-4 rounded-xl bg-success/10 border border-success/30">
                            <div className="flex items-start gap-3">
                                <DollarSign className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-foreground">💰 Potencial de Receita</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Aplicando estas recomendações de cross-sell, você pode aumentar o ticket médio em até
                                        <span className="text-success font-bold"> R$ 63,75</span> por atendimento.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </CardContent>
        </Card>
    );
};
