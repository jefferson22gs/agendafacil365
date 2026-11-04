import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock,
    User,
    Phone,
    Calendar,
    Bell,
    Check,
    X,
    Plus,
    RefreshCw,
    ChevronUp,
    ChevronDown,
    MessageSquare
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { waitlistService, WaitlistItem } from "@/services/waitlistService";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Service {
    id: string;
    name: string;
}

interface Professional {
    id: string;
    name: string;
}

interface RealWaitlistManagerProps {
    salonId: string;
}

export const RealWaitlistManager = ({ salonId }: RealWaitlistManagerProps) => {
    const [loading, setLoading] = useState(true);
    const [waitlist, setWaitlist] = useState<WaitlistItem[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

    // Form state
    const [newEntry, setNewEntry] = useState({
        client_name: "",
        client_phone: "",
        service_id: "",
        professional_id: "",
        preferred_date: "",
        notes: ""
    });

    useEffect(() => {
        if (salonId) {
            loadData();
        }
    }, [salonId]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Carregar fila de espera
            const waitlistData = await waitlistService.getWaitlist(salonId);
            setWaitlist(waitlistData);

            // Carregar serviços
            const { data: servicesData } = await supabase
                .from('services')
                .select('id, name')
                .eq('salon_id', salonId)
                .eq('is_active', true);
            setServices(servicesData || []);

            // Carregar profissionais
            const { data: professionalsData } = await supabase
                .from('professionals')
                .select('id, name')
                .eq('salon_id', salonId)
                .eq('is_active', true);
            setProfessionals(professionalsData || []);
        } catch (error) {
            console.error('Erro ao carregar fila de espera:', error);
            toast.error('Erro ao carregar fila de espera');
        } finally {
            setLoading(false);
        }
    };

    const handleAddToWaitlist = async () => {
        if (!newEntry.client_name || !newEntry.client_phone) {
            toast.error('Nome e telefone são obrigatórios');
            return;
        }

        try {
            await waitlistService.addToWaitlist({
                salon_id: salonId,
                client_name: newEntry.client_name,
                client_phone: newEntry.client_phone,
                service_id: newEntry.service_id || undefined,
                professional_id: newEntry.professional_id || undefined,
                preferred_date: newEntry.preferred_date || undefined,
                notes: newEntry.notes || undefined
            });

            toast.success('Cliente adicionado à fila de espera!');
            setIsAddDialogOpen(false);
            setNewEntry({
                client_name: "",
                client_phone: "",
                service_id: "",
                professional_id: "",
                preferred_date: "",
                notes: ""
            });
            loadData();
        } catch (error) {
            console.error('Erro ao adicionar à fila:', error);
            toast.error('Erro ao adicionar à fila de espera');
        }
    };

    const handleNotify = async (item: WaitlistItem) => {
        try {
            await waitlistService.updateStatus(item.id, 'notified');
            toast.success(`${item.client_name} foi notificado!`);
            loadData();
        } catch (error) {
            toast.error('Erro ao notificar cliente');
        }
    };

    const handleSchedule = async (item: WaitlistItem) => {
        try {
            await waitlistService.updateStatus(item.id, 'scheduled', {
                scheduled_at: new Date().toISOString()
            });
            toast.success(`${item.client_name} foi agendado!`);
            loadData();
        } catch (error) {
            toast.error('Erro ao agendar cliente');
        }
    };

    const handleRemove = async (item: WaitlistItem) => {
        try {
            await waitlistService.updateStatus(item.id, 'cancelled');
            toast.success('Cliente removido da fila');
            loadData();
        } catch (error) {
            toast.error('Erro ao remover cliente');
        }
    };

    const handlePriorityChange = async (item: WaitlistItem, direction: 'up' | 'down') => {
        try {
            const newPriority = direction === 'up' ? (item.priority + 1) : Math.max(0, item.priority - 1);
            await waitlistService.updatePriority(item.id, newPriority);
            loadData();
        } catch (error) {
            toast.error('Erro ao alterar prioridade');
        }
    };

    const getStatusBadge = (status: string) => {
        const statusConfig: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" } } = {
            waiting: { label: 'Aguardando', variant: 'default' },
            notified: { label: 'Notificado', variant: 'secondary' },
            scheduled: { label: 'Agendado', variant: 'outline' },
            cancelled: { label: 'Cancelado', variant: 'destructive' }
        };
        const config = statusConfig[status] || statusConfig.waiting;
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between" data-tour="advanced-waitlist-panel">
                <div>
                    <h2 className="text-2xl font-bold">Fila de Espera</h2>
                    <p className="text-muted-foreground">
                        {waitlist.length} cliente(s) aguardando
                    </p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button data-tour="advanced-waitlist-add">
                            <Plus className="w-4 h-4 mr-2" />
                            Adicionar à Fila
                        </Button>
                    </DialogTrigger>
                    <DialogContent data-tour="advanced-waitlist-dialog">
                        <DialogHeader>
                            <DialogTitle>Adicionar à Fila de Espera</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div data-tour="advanced-waitlist-name">
                                <Label>Nome do Cliente *</Label>
                                <Input
                                    value={newEntry.client_name}
                                    onChange={e => setNewEntry({ ...newEntry, client_name: e.target.value })}
                                    placeholder="Nome completo"
                                />
                            </div>
                            <div data-tour="advanced-waitlist-phone">
                                <Label>Telefone *</Label>
                                <Input
                                    value={newEntry.client_phone}
                                    onChange={e => setNewEntry({ ...newEntry, client_phone: e.target.value })}
                                    placeholder="(11) 99999-9999"
                                />
                            </div>
                            <div>
                                <Label>Serviço desejado</Label>
                                <Select
                                    value={newEntry.service_id}
                                    onValueChange={value => setNewEntry({ ...newEntry, service_id: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o serviço" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {services.map(service => (
                                            <SelectItem key={service.id} value={service.id}>
                                                {service.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Profissional preferido</Label>
                                <Select
                                    value={newEntry.professional_id}
                                    onValueChange={value => setNewEntry({ ...newEntry, professional_id: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Qualquer profissional" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {professionals.map(prof => (
                                            <SelectItem key={prof.id} value={prof.id}>
                                                {prof.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Data preferida</Label>
                                <Input
                                    type="date"
                                    value={newEntry.preferred_date}
                                    onChange={e => setNewEntry({ ...newEntry, preferred_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Observações</Label>
                                <Input
                                    value={newEntry.notes}
                                    onChange={e => setNewEntry({ ...newEntry, notes: e.target.value })}
                                    placeholder="Notas adicionais..."
                                />
                            </div>
                            <Button onClick={handleAddToWaitlist} className="w-full" data-tour="advanced-waitlist-save">
                                Adicionar à Fila
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Lista */}
            {waitlist.length === 0 ? (
                <Card data-tour="advanced-waitlist-empty">
                    <CardContent className="p-8 text-center">
                        <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">Fila de espera vazia</h3>
                        <p className="text-muted-foreground">
                            Nenhum cliente aguardando no momento
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3" data-tour="advanced-waitlist-list">
                    <AnimatePresence>
                        {waitlist.map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -100 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card>
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                {/* Prioridade */}
                                                <div className="flex flex-col gap-1">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-6 w-6"
                                                        onClick={() => handlePriorityChange(item, 'up')}
                                                        aria-label="Subir prioridade na fila"
                                                    >
                                                        <ChevronUp className="w-4 h-4" />
                                                    </Button>
                                                    <span className="text-xs text-center text-muted-foreground">
                                                        #{index + 1}
                                                    </span>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-6 w-6"
                                                        onClick={() => handlePriorityChange(item, 'down')}
                                                        aria-label="Descer prioridade na fila"
                                                    >
                                                        <ChevronDown className="w-4 h-4" />
                                                    </Button>
                                                </div>

                                                {/* Info do Cliente */}
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <User className="w-4 h-4 text-muted-foreground" />
                                                        <span className="font-medium">{item.client_name}</span>
                                                        {getStatusBadge(item.status)}
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <Phone className="w-3 h-3" />
                                                            {item.client_phone}
                                                        </span>
                                                        {item.service && (
                                                            <span>{item.service.name}</span>
                                                        )}
                                                        {item.preferred_date && (
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" />
                                                                {format(new Date(item.preferred_date), "dd/MM", { locale: ptBR })}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.notes && (
                                                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                            <MessageSquare className="w-3 h-3" />
                                                            {item.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Ações */}
                                            <div className="flex items-center gap-2">
                                                {item.status === 'waiting' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        data-tour="advanced-waitlist-notify"
                                                        onClick={() => handleNotify(item)}
                                                    >
                                                        <Bell className="w-4 h-4 mr-1" />
                                                        Notificar
                                                    </Button>
                                                )}
                                                {(item.status === 'waiting' || item.status === 'notified') && (
                                                    <Button
                                                        size="sm"
                                                        data-tour="advanced-waitlist-schedule"
                                                        onClick={() => handleSchedule(item)}
                                                    >
                                                        <Check className="w-4 h-4 mr-1" />
                                                        Agendar
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleRemove(item)}
                                                    aria-label="Remover cliente da fila"
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};
