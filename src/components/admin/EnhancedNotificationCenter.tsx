import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Bell,
    Calendar,
    DollarSign,
    MessageSquare,
    Star,
    Users,
    Check,
    Trash2,
    ChevronRight,
    Settings,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Notification {
    id: string;
    type: "appointment" | "payment" | "review" | "message" | "client" | "system";
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    action?: {
        label: string;
        path: string;
    };
    metadata?: Record<string, any>;
}

interface EnhancedNotificationCenterProps {
    notifications: Notification[];
    onMarkAsRead?: (id: string) => void;
    onMarkAllAsRead?: () => void;
    onDelete?: (id: string) => void;
    onAction?: (notification: Notification) => void;
    className?: string;
}

const typeConfig = {
    appointment: {
        icon: Calendar,
        color: "text-primary",
        bgColor: "bg-primary/10",
    },
    payment: {
        icon: DollarSign,
        color: "text-success",
        bgColor: "bg-success/10",
    },
    review: {
        icon: Star,
        color: "text-warning",
        bgColor: "bg-warning/10",
    },
    message: {
        icon: MessageSquare,
        color: "text-primary",
        bgColor: "bg-primary/10",
    },
    client: {
        icon: Users,
        color: "text-primary",
        bgColor: "bg-primary/10",
    },
    system: {
        icon: Settings,
        color: "text-muted-foreground",
        bgColor: "bg-muted",
    },
};

function NotificationItem({
    notification,
    onMarkAsRead,
    onDelete,
    onAction,
}: {
    notification: Notification;
    onMarkAsRead?: (id: string) => void;
    onDelete?: (id: string) => void;
    onAction?: (notification: Notification) => void;
}) {
    const config = typeConfig[notification.type];
    const Icon = config.icon;

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d atrás`;
        if (hours > 0) return `${hours}h atrás`;
        if (minutes > 0) return `${minutes}min atrás`;
        return "Agora";
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className={cn(
                "flex gap-3 p-3 rounded-lg transition-colors cursor-pointer",
                notification.read
                    ? "bg-secondary/30 hover:bg-secondary/50"
                    : "bg-primary/5 hover:bg-primary/10 border-l-2 border-primary"
            )}
            onClick={() => onAction?.(notification)}
        >
            <div className={cn("p-2 rounded-full flex-shrink-0", config.bgColor)}>
                <Icon size={18} className={config.color} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                        "text-sm font-medium truncate",
                        notification.read ? "text-muted-foreground" : "text-foreground"
                    )}>
                        {notification.title}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(notification.timestamp)}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {notification.message}
                </p>
                {notification.action && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 mt-1 text-xs text-primary"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAction?.(notification);
                        }}
                    >
                        {notification.action.label}
                        <ChevronRight size={12} className="ml-1" />
                    </Button>
                )}
            </div>
            <div className="flex flex-col gap-1">
                {!notification.read && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        aria-label="Marcar como lida"
                        onClick={(e) => {
                            e.stopPropagation();
                            onMarkAsRead?.(notification.id);
                        }}
                    >
                        <Check size={12} />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive"
                    aria-label="Excluir notificação"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(notification.id);
                    }}
                >
                    <Trash2 size={12} />
                </Button>
            </div>
        </motion.div>
    );
}

export function EnhancedNotificationCenter({
    notifications,
    onMarkAsRead,
    onMarkAllAsRead,
    onDelete,
    onAction,
    className,
}: EnhancedNotificationCenterProps) {
    const [filter, setFilter] = useState<"all" | Notification["type"]>("all");

    const filteredNotifications = filter === "all"
        ? notifications
        : notifications.filter(n => n.type === filter);

    const unreadCount = notifications.filter(n => !n.read).length;

    const counts = {
        all: notifications.length,
        appointment: notifications.filter(n => n.type === "appointment").length,
        payment: notifications.filter(n => n.type === "payment").length,
        review: notifications.filter(n => n.type === "review").length,
        message: notifications.filter(n => n.type === "message").length,
        client: notifications.filter(n => n.type === "client").length,
        system: notifications.filter(n => n.type === "system").length,
    };

    return (
        <Card className={className}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2">
                    <Bell className="text-primary" />
                    Notificações
                    {unreadCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs">
                            {unreadCount} novas
                        </span>
                    )}
                </CardTitle>
                {unreadCount > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onMarkAllAsRead}
                        className="text-xs"
                    >
                        <Check size={14} className="mr-1" />
                        Marcar todas como lidas
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {/* Filter tabs */}
                <div className="flex gap-2 overflow-x-auto pb-3 mb-3 scrollbar-hide">
                    {(["all", "appointment", "payment", "review", "message", "client"] as const).map((type) => {
                        const config = type === "all" ? { icon: Bell, color: "text-foreground" } : typeConfig[type];
                        const Icon = config.icon;
                        const count = counts[type];

                        return (
                            <Button
                                key={type}
                                variant={filter === type ? "brand" : "outline"}
                                size="sm"
                                onClick={() => setFilter(type)}
                                className="flex-shrink-0"
                            >
                                <Icon size={14} className={cn("mr-1", filter !== type && config.color)} />
                                {type === "all" ? "Todas" :
                                    type === "appointment" ? "Agenda" :
                                        type === "payment" ? "Pagamentos" :
                                            type === "review" ? "Avaliações" :
                                                type === "message" ? "Mensagens" :
                                                    type === "client" ? "Clientes" : type}
                                {count > 0 && (
                                    <span className="ml-1.5 text-xs opacity-70">({count})</span>
                                )}
                            </Button>
                        );
                    })}
                </div>

                {/* Notifications list */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    <AnimatePresence>
                        {filteredNotifications.length === 0 ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="py-8 text-center"
                            >
                                <Bell size={32} className="mx-auto mb-2 text-muted-foreground opacity-50" />
                                <p className="text-muted-foreground">Nenhuma notificação</p>
                            </motion.div>
                        ) : (
                            filteredNotifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onMarkAsRead={onMarkAsRead}
                                    onDelete={onDelete}
                                    onAction={onAction}
                                />
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </CardContent>
        </Card>
    );
}

// Sample notifications generator
export function generateSampleNotifications(): Notification[] {
    const now = new Date();
    return [
        {
            id: "1",
            type: "appointment",
            title: "Novo Agendamento",
            message: "Maria Silva agendou Corte + Escova para amanhã às 10:00",
            timestamp: new Date(now.getTime() - 5 * 60000),
            read: false,
            action: { label: "Ver agenda", path: "/admin/appointments" },
        },
        {
            id: "2",
            type: "payment",
            title: "Pagamento Recebido",
            message: "R$ 150,00 recebido de Carlos Santos via PIX",
            timestamp: new Date(now.getTime() - 30 * 60000),
            read: false,
            action: { label: "Ver detalhes", path: "/admin/financial" },
        },
        {
            id: "3",
            type: "review",
            title: "Nova Avaliação ⭐⭐⭐⭐⭐",
            message: '"Excelente atendimento! Adorei o resultado." - Ana Oliveira',
            timestamp: new Date(now.getTime() - 2 * 3600000),
            read: true,
            action: { label: "Responder", path: "/admin/reviews" },
        },
        {
            id: "4",
            type: "client",
            title: "Cliente VIP",
            message: "Roberto Lima atingiu 10 visitas e agora é cliente VIP!",
            timestamp: new Date(now.getTime() - 24 * 3600000),
            read: true,
        },
        {
            id: "5",
            type: "system",
            title: "Backup Automático",
            message: "Backup dos dados realizado com sucesso",
            timestamp: new Date(now.getTime() - 48 * 3600000),
            read: true,
        },
    ];
}
