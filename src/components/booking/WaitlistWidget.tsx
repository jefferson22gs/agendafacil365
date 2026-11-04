import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Users, Bell, X, Phone, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WaitlistEntry {
    id: string;
    name: string;
    phone: string;
    service?: string;
    priority: "normal" | "high" | "urgent";
    estimatedWait: number; // minutes
    joinedAt: Date;
    status: "waiting" | "notified" | "ready" | "cancelled";
}

interface WaitlistWidgetProps {
    salonId: string;
    entries: WaitlistEntry[];
    onCallNext?: (id: string) => void;
    onRemove?: (id: string) => void;
    className?: string;
}

const priorityColors = {
    normal: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    high: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    urgent: "bg-red-500/10 text-red-500 border-red-500/20",
};

const priorityLabels = {
    normal: "Normal",
    high: "Alta",
    urgent: "Urgente",
};

const statusIcons = {
    waiting: Clock,
    notified: Bell,
    ready: Check,
    cancelled: X,
};

export function WaitlistWidget({
    salonId,
    entries,
    onCallNext,
    onRemove,
    className
}: WaitlistWidgetProps) {
    const [loading, setLoading] = useState<string | null>(null);

    const handleCall = async (entry: WaitlistEntry) => {
        setLoading(entry.id);
        try {
            // In production, this would send WhatsApp notification
            toast.success(`Notificação enviada para ${entry.name}!`);
            onCallNext?.(entry.id);
        } finally {
            setLoading(null);
        }
    };

    const waitingEntries = entries.filter(e => e.status === "waiting");
    const totalWait = waitingEntries.reduce((sum, e) => sum + e.estimatedWait, 0);

    return (
        <Card className={cn("glass-card", className)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="text-primary" />
                    Fila de Espera
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{waitingEntries.length}</span>
                    na fila
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-secondary/30">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{waitingEntries.length}</p>
                        <p className="text-xs text-muted-foreground">Aguardando</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">{totalWait}min</p>
                        <p className="text-xs text-muted-foreground">Tempo total</p>
                    </div>
                </div>

                {/* Entries */}
                {waitingEntries.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Clock size={32} className="mx-auto mb-2 opacity-50" />
                        <p>Nenhum cliente na fila</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {waitingEntries.map((entry, index) => {
                            const StatusIcon = statusIcons[entry.status];
                            return (
                                <motion.div
                                    key={entry.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <p className="font-medium text-foreground">{entry.name}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Clock size={12} />
                                                ~{entry.estimatedWait}min
                                                <span className={cn(
                                                    "px-1.5 py-0.5 rounded-full border text-[10px] font-medium",
                                                    priorityColors[entry.priority]
                                                )}>
                                                    {priorityLabels[entry.priority]}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleCall(entry)}
                                            disabled={loading === entry.id}
                                            className="h-8"
                                        >
                                            <Bell size={14} />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => onRemove?.(entry.id)}
                                            className="h-8 text-destructive"
                                        >
                                            <X size={14} />
                                        </Button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Add to waitlist form
interface AddToWaitlistFormProps {
    salonId: string;
    onSuccess?: (entry: WaitlistEntry) => void;
    className?: string;
}

export function AddToWaitlistForm({ salonId, onSuccess, className }: AddToWaitlistFormProps) {
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        priority: "normal" as WaitlistEntry["priority"],
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            toast.error("Preencha nome e telefone");
            return;
        }

        setLoading(true);
        try {
            const newEntry: WaitlistEntry = {
                id: Date.now().toString(),
                name: formData.name,
                phone: formData.phone,
                priority: formData.priority,
                estimatedWait: formData.priority === "urgent" ? 5 : formData.priority === "high" ? 10 : 20,
                joinedAt: new Date(),
                status: "waiting",
            };

            onSuccess?.(newEntry);
            setFormData({ name: "", phone: "", priority: "normal" });
            toast.success("Adicionado à fila!");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className={cn("glass-card", className)}>
            <CardHeader>
                <CardTitle className="text-lg">Adicionar à Fila</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nome</Label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Nome do cliente"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="(00) 00000-0000"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Prioridade</Label>
                        <div className="flex gap-2">
                            {(["normal", "high", "urgent"] as const).map((p) => (
                                <Button
                                    key={p}
                                    type="button"
                                    variant={formData.priority === p ? "brand" : "outline"}
                                    size="sm"
                                    onClick={() => setFormData({ ...formData, priority: p })}
                                >
                                    {priorityLabels[p]}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <Button type="submit" variant="brand" className="w-full" disabled={loading}>
                        {loading ? "Adicionando..." : "Adicionar à Fila"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
