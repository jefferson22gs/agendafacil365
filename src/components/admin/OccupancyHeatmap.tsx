import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface HeatmapData {
    day: number; // 0-6 (Sun-Sat)
    hour: number; // 0-23
    value: number;
}

interface OccupancyHeatmapProps {
    data: HeatmapData[];
    maxValue?: number;
    className?: string;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8:00 - 19:00

function getColorIntensity(value: number, max: number): string {
    if (value === 0) return "bg-muted/30";

    const intensity = value / max;

    // Escala sequencial de um só tom (ocupação não é erro/aviso): mais forte = mais ocupado.
    if (intensity < 0.2) return "bg-primary/15";
    if (intensity < 0.4) return "bg-primary/35";
    if (intensity < 0.6) return "bg-primary/55";
    if (intensity < 0.8) return "bg-primary/75";
    return "bg-primary";
}

export function OccupancyHeatmap({ data, maxValue, className }: OccupancyHeatmapProps) {
    const heatmapGrid = useMemo(() => {
        const grid: Record<string, number> = {};
        data.forEach((item) => {
            grid[`${item.day}-${item.hour}`] = item.value;
        });
        return grid;
    }, [data]);

    const max = maxValue || Math.max(...data.map((d) => d.value), 1);

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                    Heatmap de Ocupação
                    <div className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                        <span>Baixa</span>
                        <div className="flex gap-0.5">
                            <div className="w-3 h-3 rounded-sm bg-muted/30" />
                            <div className="w-3 h-3 rounded-sm bg-primary/15" />
                            <div className="w-3 h-3 rounded-sm bg-primary/35" />
                            <div className="w-3 h-3 rounded-sm bg-primary/55" />
                            <div className="w-3 h-3 rounded-sm bg-primary" />
                        </div>
                        <span>Alta</span>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <div className="min-w-[400px]">
                        {/* Header - Hours */}
                        <div className="flex gap-1 mb-2">
                            <div className="w-12 flex-shrink-0" />
                            {HOURS.map((hour) => (
                                <div
                                    key={hour}
                                    className="flex-1 text-xs text-center text-muted-foreground"
                                >
                                    {hour}h
                                </div>
                            ))}
                        </div>

                        {/* Grid */}
                        {DAYS.map((day, dayIndex) => (
                            <div key={day} className="flex gap-1 mb-1">
                                <div className="w-12 flex-shrink-0 text-xs text-muted-foreground flex items-center">
                                    {day}
                                </div>
                                {HOURS.map((hour) => {
                                    const value = heatmapGrid[`${dayIndex}-${hour}`] || 0;
                                    return (
                                        <div
                                            key={`${dayIndex}-${hour}`}
                                            className={cn(
                                                "flex-1 aspect-square rounded-sm transition-colors cursor-pointer group relative",
                                                getColorIntensity(value, max)
                                            )}
                                            title={`${day} ${hour}:00 - ${value} agendamentos`}
                                        >
                                            {/* Tooltip */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border border-border rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                {value} agendamentos
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                        Distribuição de agendamentos por dia/horário
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

// Helper to generate sample data
export function generateSampleHeatmapData(): HeatmapData[] {
    const data: HeatmapData[] = [];

    // Generate realistic-ish salon scheduling patterns
    for (let day = 0; day < 7; day++) {
        for (let hour = 8; hour <= 19; hour++) {
            let baseValue = 0;

            // Weekdays are busier
            if (day >= 1 && day <= 5) {
                baseValue = 3;

                // Lunch hour less busy
                if (hour === 12 || hour === 13) baseValue = 1;

                // Peak hours
                if (hour >= 10 && hour <= 11) baseValue = 5;
                if (hour >= 14 && hour <= 16) baseValue = 5;

                // Friday afternoon busy
                if (day === 5 && hour >= 14) baseValue = 6;
            }

            // Saturday is popular
            if (day === 6) {
                baseValue = 4;
                if (hour >= 9 && hour <= 14) baseValue = 7;
            }

            // Sunday less busy or closed
            if (day === 0) {
                baseValue = hour >= 10 && hour <= 15 ? 2 : 0;
            }

            // Add some randomness
            const randomFactor = Math.random() * 0.4 + 0.8;
            const value = Math.round(baseValue * randomFactor);

            data.push({ day, hour, value });
        }
    }

    return data;
}
