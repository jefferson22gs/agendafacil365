import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock,
    Users,
    Bell,
    CheckCircle,
    XCircle,
    ArrowUp,
    ArrowDown,
    Sparkles,
    Calendar,
    Phone,
    Mail
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface WaitlistEntry {
    id: string;
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    serviceName: string;
    preferredDate: string;
    preferredTime: string;
    professionalName?: string;
    priority: 'normal' | 'high' | 'vip';
    loyaltyLevel?: string;
    position: number;
    createdAt: Date;
    status: 'waiting' | 'notified' | 'booked' | 'expired';
    notifiedAt?: Date;
}

const mockWaitlist: WaitlistEntry[] = [
    {
        id: '1',
        clientName: 'Maria Silva',
        clientPhone: '(11) 99999-1234',
        clientEmail: 'maria@email.com',
        serviceName: 'Corte + Escova',
        preferredDate: '2024-12-23',
        preferredTime: '15:00',
        professionalName: 'Carlos',
        priority: 'vip',
        loyaltyLevel: 'Diamante',
        position: 1,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'waiting',
    },
    {
        id: '2',
        clientName: 'João Santos',
        clientPhone: '(11) 98888-5678',
        serviceName: 'Barba Completa',
        preferredDate: '2024-12-23',
        preferredTime: '16:00',
        priority: 'normal',
        loyaltyLevel: 'Ouro',
        position: 2,
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        status: 'waiting',
    },
    {
        id: '3',
        clientName: 'Ana Oliveira',
        clientPhone: '(11) 97777-9012',
        serviceName: 'Coloração',
        preferredDate: '2024-12-24',
        preferredTime: '10:00',
        professionalName: 'Julia',
        priority: 'high',
        loyaltyLevel: 'Prata',
        position: 3,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        status: 'notified',
        notifiedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
];

const getPriorityBadge = (priority: string, loyaltyLevel?: string) => {
    switch (priority) {
        case 'vip':
            return <Badge variant="info">👑 VIP</Badge>;
        case 'high':
            return <Badge variant="warning">⭐ Prioridade</Badge>;
        default:
            return loyaltyLevel ? (
                <Badge variant="secondary">{loyaltyLevel}</Badge>
            ) : null;
    }
};

const getStatusBadge = (status: string) => {
    switch (status) {
        case 'waiting':
            return <Badge variant="info">⏳ Aguardando</Badge>;
        case 'notified':
            return <Badge variant="success">🔔 Notificado</Badge>;
        case 'booked':
            return <Badge variant="info">✅ Agendado</Badge>;
        case 'expired':
            return <Badge variant="danger">❌ Expirado</Badge>;
        default:
            return null;
    }
};

const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor(diff / 60000);

    if (hours > 0) return `${hours}h atrás`;
    return `${minutes}min atrás`;
};

interface WaitlistManagerProps {
    salonId?: string;
}

export const WaitlistManager = ({ salonId }: WaitlistManagerProps) => {
    const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(mockWaitlist);
    const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
    const [showNotifyDialog, setShowNotifyDialog] = useState(false);

    const notifyClient = (entry: WaitlistEntry) => {
        setWaitlist(prev =>
            prev.map(e =>
                e.id === entry.id
                    ? { ...e, status: 'notified' as const, notifiedAt: new Date() }
                    : e
            )
        );
        setShowNotifyDialog(false);
        setSelectedEntry(null);
    };

    const removeFromWaitlist = (id: string) => {
        setWaitlist(prev => prev.filter(e => e.id !== id));
    };

    const movePriority = (id: string, direction: 'up' | 'down') => {
        const index = waitlist.findIndex(e => e.id === id);
        if (
            (direction === 'up' && index === 0) ||
            (direction === 'down' && index === waitlist.length - 1)
        ) return;

        const newList = [...waitlist];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];

        // Update positions
        newList.forEach((entry, i) => {
            entry.position = i + 1;
        });

        setWaitlist(newList);
    };

    const waitingCount = waitlist.filter(e => e.status === 'waiting').length;

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-primary" />
                            Fila de Espera Inteligente
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="gap-1">
                                <Users className="w-3 h-3" />
                                {waitingCount} aguardando
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <AnimatePresence>
                        {waitlist.length === 0 ? (
                            <div className="text-center py-8">
                                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                                <p className="text-muted-foreground">Nenhum cliente na fila de espera</p>
                            </div>
                        ) : (
                            waitlist.map((entry, index) => (
                                <motion.div
                                    key={entry.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -100 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`p-4 rounded-xl border transition-all ${entry.status === 'notified'
                                            ? 'bg-success/5 border-success/20'
                                            : 'bg-card/50 border-border/50 hover:border-primary/30'
                                        }`}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Position Number */}
                                        <div className="flex flex-col items-center gap-1">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${entry.priority === 'vip'
                                                    ? 'bg-primary/20 text-primary'
                                                    : entry.priority === 'high'
                                                        ? 'bg-warning/20 text-warning'
                                                        : 'bg-secondary text-muted-foreground'
                                                }`}>
                                                #{entry.position}
                                            </div>
                                            <div className="flex flex-col">
                                                <button
                                                    onClick={() => movePriority(entry.id, 'up')}
                                                    disabled={index === 0}
                                                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                                >
                                                    <ArrowUp size={14} />
                                                </button>
                                                <button
                                                    onClick={() => movePriority(entry.id, 'down')}
                                                    disabled={index === waitlist.length - 1}
                                                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                                                >
                                                    <ArrowDown size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Client Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-medium text-foreground">{entry.clientName}</h4>
                                                {getPriorityBadge(entry.priority, entry.loyaltyLevel)}
                                                {getStatusBadge(entry.status)}
                                            </div>

                                            <p className="text-sm text-muted-foreground mb-2">
                                                {entry.serviceName}
                                                {entry.professionalName && ` • com ${entry.professionalName}`}
                                            </p>

                                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {new Date(entry.preferredDate).toLocaleDateString('pt-BR')} às {entry.preferredTime}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Phone size={12} />
                                                    {entry.clientPhone}
                                                </span>
                                                <span>
                                                    Entrou {formatTimeAgo(entry.createdAt)}
                                                </span>
                                            </div>

                                            {entry.status === 'notified' && entry.notifiedAt && (
                                                <p className="text-xs text-success mt-2">
                                                    🔔 Notificado {formatTimeAgo(entry.notifiedAt)}
                                                </p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-2">
                                            {entry.status === 'waiting' && (
                                                <Button
                                                    size="sm"
                                                    variant="brand"
                                                    onClick={() => {
                                                        setSelectedEntry(entry);
                                                        setShowNotifyDialog(true);
                                                    }}
                                                >
                                                    <Bell size={14} className="mr-1" />
                                                    Notificar
                                                </Button>
                                            )}
                                            {entry.status === 'notified' && (
                                                <Button size="sm" variant="outline">
                                                    <CheckCircle size={14} className="mr-1" />
                                                    Agendar
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => removeFromWaitlist(entry.id)}
                                            >
                                                <XCircle size={14} className="mr-1" />
                                                Remover
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>

                    {/* Auto-fill Info */}
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 mt-4">
                        <div className="flex items-start gap-3">
                            <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-foreground">Encaixe automático ativado</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Quando um horário for liberado por cancelamento, o próximo cliente da fila será notificado automaticamente via WhatsApp.
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Notify Dialog */}
            <Dialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Notificar cliente</DialogTitle>
                        <DialogDescription>
                            Enviar notificação de horário disponível para {selectedEntry?.clientName}?
                        </DialogDescription>
                    </DialogHeader>

                    {selectedEntry && (
                        <div className="p-4 rounded-xl bg-secondary/50 space-y-2">
                            <p><strong>Cliente:</strong> {selectedEntry.clientName}</p>
                            <p><strong>Serviço:</strong> {selectedEntry.serviceName}</p>
                            <p><strong>Data desejada:</strong> {new Date(selectedEntry.preferredDate).toLocaleDateString('pt-BR')} às {selectedEntry.preferredTime}</p>
                            <p><strong>Telefone:</strong> {selectedEntry.clientPhone}</p>
                        </div>
                    )}

                    <div className="text-sm text-muted-foreground">
                        Uma mensagem será enviada via WhatsApp informando que o horário desejado está disponível.
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNotifyDialog(false)}>
                            Cancelar
                        </Button>
                        <Button variant="brand" onClick={() => selectedEntry && notifyClient(selectedEntry)}>
                            <Bell size={16} className="mr-2" />
                            Enviar notificação
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
