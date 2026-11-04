import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PeriodData {
    label: string;
    current: number;
    previous: number;
    format?: "currency" | "number" | "percent";
}

interface PeriodComparisonProps {
    data: PeriodData[];
    periods?: { value: string; label: string }[];
    onPeriodChange?: (period: string) => void;
    className?: string;
}

const defaultPeriods = [
    { value: "week", label: "Semana" },
    { value: "month", label: "Mês" },
    { value: "quarter", label: "Trimestre" },
    { value: "year", label: "Ano" },
];

function formatValue(value: number, format?: "currency" | "number" | "percent"): string {
    switch (format) {
        case "currency":
            return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
        case "percent":
            return `${value.toFixed(1)}%`;
        default:
            return value.toLocaleString("pt-BR");
    }
}

function calculateChange(current: number, previous: number): { value: number; trend: "up" | "down" | "neutral" } {
    if (previous === 0) return { value: 0, trend: "neutral" };
    const change = ((current - previous) / previous) * 100;
    return {
        value: Math.abs(change),
        trend: change > 0 ? "up" : change < 0 ? "down" : "neutral",
    };
}

export function PeriodComparison({
    data,
    periods = defaultPeriods,
    onPeriodChange,
    className
}: PeriodComparisonProps) {
    const [selectedPeriod, setSelectedPeriod] = useState("month");

    const handlePeriodChange = (value: string) => {
        setSelectedPeriod(value);
        onPeriodChange?.(value);
    };

    const trendColors = {
        up: "text-success",
        down: "text-destructive",
        neutral: "text-muted-foreground",
    };

    const trendBgColors = {
        up: "bg-success/10",
        down: "bg-destructive/10",
        neutral: "bg-muted",
    };

    return (
        <Card className={className}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Comparativo de Períodos</CardTitle>
                <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                    <SelectTrigger className="w-32">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {periods.map((period) => (
                            <SelectItem key={period.value} value={period.value}>
                                {period.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent className="space-y-4">
                {data.map((item, index) => {
                    const { value: changeValue, trend } = calculateChange(item.current, item.previous);

                    return (
                        <motion.div
                            key={item.label}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                        >
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">{item.label}</p>
                                <p className="text-xl font-bold text-foreground">
                                    {formatValue(item.current, item.format)}
                                </p>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                                <div className={cn(
                                    "flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium",
                                    trendBgColors[trend],
                                    trendColors[trend]
                                )}>
                                    {trend === "up" && <ArrowUpRight size={14} />}
                                    {trend === "down" && <ArrowDownRight size={14} />}
                                    {trend === "neutral" && <Minus size={14} />}
                                    <span>{changeValue.toFixed(1)}%</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    vs. {formatValue(item.previous, item.format)}
                                </p>
                            </div>
                        </motion.div>
                    );
                })}

                <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                        Comparando período atual vs. anterior
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
