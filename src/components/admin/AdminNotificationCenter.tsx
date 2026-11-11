import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Bell,
  Calendar,
  X,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  User,
  Phone,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface AdminNotification {
  id: string;
  salon_id: string;
  appointment_id: string | null;
  type: string;
  title: string;
  message: string;
  client_name: string | null;
  client_phone: string | null;
  appointment_date: string | null;
  read: boolean;
  metadata: any;
  created_at: string;
}

export function AdminNotificationCenter() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AdminNotification | null>(null);

  // Carregar salon_id do usuário
  useEffect(() => {
    loadSalonId();
  }, []);

  // Carregar notificações quando tiver salon_id
  useEffect(() => {
    if (salonId) {
      loadNotifications();
      subscribeToNotifications();
    }
  }, [salonId]);

  const loadSalonId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: salon } = await supabase
      .from("salons")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (salon) {
      setSalonId(salon.id);
    }
  };

  const loadNotifications = async () => {
    if (!salonId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .eq("salon_id", salonId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications((data || []) as AdminNotification[]);
      setUnreadCount(data?.filter(n => !n.read).length || 0);
    } catch (error: any) {
      console.error("Error loading notifications:", error);
      toast({
        title: "Erro ao carregar notificações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNotifications = () => {
    if (!salonId) return;

    const channel = supabase
      .channel(`admin_notifications_${salonId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_notifications",
          filter: `salon_id=eq.${salonId}`,
        },
        (payload) => {
          const newNotification = payload.new as AdminNotification;

          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Mostrar toast de notificação
          toast({
            title: newNotification.title,
            description: newNotification.message,
            duration: 5000,
          });

          // Tocar som de notificação (opcional)
          playNotificationSound();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const playNotificationSound = () => {
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Ignorar erro se não conseguir tocar
      });
    } catch (error) {
      // Ignorar erro
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("admin_notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error: any) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!salonId) return;

    try {
      const { error } = await supabase
        .from("admin_notifications")
        .update({ read: true })
        .eq("salon_id", salonId)
        .eq("read", false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);

      toast({
        title: "Todas marcadas como lidas",
        description: "Todas as notificações foram marcadas como lidas",
      });
    } catch (error: any) {
      console.error("Error marking all as read:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("admin_notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;

      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      toast({
        title: "Notificação removida",
        description: "A notificação foi excluída",
      });
    } catch (error: any) {
      console.error("Error deleting notification:", error);
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const viewDetails = (notification: AdminNotification) => {
    setSelectedNotification(notification);
    setShowModal(true);
    if (!notification.read) {
      markAsRead(notification.id);
    }
  };

  const goToAppointment = (appointmentId: string | null) => {
    if (appointmentId) {
      window.location.href = `/admin/appointments?id=${appointmentId}`;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_appointment":
        return <Calendar className="text-success" size={20} />;
      case "cancelled_appointment":
        return <X className="text-destructive" size={20} />;
      case "rescheduled_appointment":
        return <Clock className="text-primary" size={20} />;
      case "procedure_return":
        return <RotateCcw className="text-primary" size={20} aria-hidden />;
      default:
        return <Bell className="text-muted-foreground" size={20} />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "new_appointment":
        return "bg-success/10 border-success/30";
      case "cancelled_appointment":
        return "bg-destructive/10 border-destructive/30";
      case "rescheduled_appointment":
      case "procedure_return":
        return "bg-primary/10 border-primary/30";
      default:
        return "bg-muted border-border";
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
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
    <>
      <Card className="relative" data-tour="dashboard-notifications">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="text-primary" size={20} />
              Notificações
              {unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground">
                  {unreadCount}
                </Badge>
              )}
            </CardTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                <CheckCheck size={14} className="mr-1" />
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando notificações...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell size={48} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              <AnimatePresence>
                {notifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all",
                      notification.read
                        ? "bg-muted/30 hover:bg-muted/50"
                        : getNotificationColor(notification.type),
                      !notification.read && "border-l-4"
                    )}
                    onClick={() => viewDetails(notification)}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={cn(
                            "text-sm font-semibold",
                            notification.read ? "text-muted-foreground" : "text-foreground"
                          )}>
                            {notification.title}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTimeAgo(notification.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        {notification.client_name && (
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <span className="flex items-center gap-1">
                              <User size={12} />
                              {notification.client_name}
                            </span>
                            {notification.client_phone && (
                              <span className="flex items-center gap-1">
                                <Phone size={12} />
                                {notification.client_phone}
                              </span>
                            )}
                          </div>
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
                              markAsRead(notification.id);
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
                            deleteNotification(notification.id);
                          }}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNotification && getNotificationIcon(selectedNotification.type)}
              Detalhes da Notificação
            </DialogTitle>
          </DialogHeader>
          {selectedNotification && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">{selectedNotification.title}</h3>
                <p className="text-sm text-muted-foreground">{selectedNotification.message}</p>
              </div>

              {selectedNotification.client_name && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium">{selectedNotification.client_name}</span>
                  </div>
                  {selectedNotification.client_phone && (
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-muted-foreground" />
                      <span className="text-sm">{selectedNotification.client_phone}</span>
                    </div>
                  )}
                  {selectedNotification.appointment_date && (
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-muted-foreground" />
                      <span className="text-sm">
                        {new Date(selectedNotification.appointment_date).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {typeof selectedNotification.metadata?.url === "string" && selectedNotification.metadata.url.startsWith("/admin/") && (
                <Button asChild className="h-11 w-full"><a href={selectedNotification.metadata.url}>Abrir</a></Button>
              )}

              {selectedNotification.metadata?.service_name && (
                <div className="text-xs text-muted-foreground">
                  <p>Serviço: {selectedNotification.metadata.service_name}</p>
                  {selectedNotification.type === "rescheduled_appointment" && (
                    <>
                      <p className="mt-1">
                        Data anterior: {new Date(selectedNotification.metadata.old_date).toLocaleString("pt-BR")}
                      </p>
                      <p>
                        Nova data: {new Date(selectedNotification.metadata.new_date).toLocaleString("pt-BR")}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Fechar
            </Button>
            {selectedNotification?.appointment_id && (
              <Button onClick={() => goToAppointment(selectedNotification.appointment_id)}>
                Ver Agendamento
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
