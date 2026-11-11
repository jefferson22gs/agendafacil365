import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSalon } from "@/hooks/useSalon";
import { useSalonHead } from '@/components/pwa/useSalonHead';
import { SalonLogo } from '@/components/pwa/SalonLogo';
import { motion, AnimatePresence } from "framer-motion";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Clock,
    User,
    Scissors,
    CreditCard,
    Check,
    MapPin,
    Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Types removidos - usando tipos do useSalon hook

const PublicBookingAdvanced = () => {
    const navigate = useNavigate();
    const { salonSlug } = useParams();
    const { salon, services, professionals, loading, getAvailableTimeSlots } = useSalon(salonSlug);

    useSalonHead(salon);
    const [step, setStep] = useState<'service' | 'professional' | 'datetime' | 'confirm'>('service');
    const [selectedService, setSelectedService] = useState<any | null>(null);
    const [selectedProfessional, setSelectedProfessional] = useState<any | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [wantsPrepayment, setWantsPrepayment] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [timeSlots, setTimeSlots] = useState<string[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // Client info
    const [clientName, setClientName] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [clientEmail, setClientEmail] = useState("");

    // Buscar horários disponíveis quando serviço, profissional ou data mudar
    useEffect(() => {
        const fetchSlots = async () => {
            if (!selectedService || !selectedDate || !salon) return;

            setLoadingSlots(true);
            try {
                const slots = await getAvailableTimeSlots(
                    selectedDate,
                    selectedService.id,
                    selectedProfessional?.id
                );
                setTimeSlots(slots);
            } catch (error) {
                console.error('Erro ao buscar horários:', error);
                toast.error('Erro ao carregar horários disponíveis');
            } finally {
                setLoadingSlots(false);
            }
        };

        fetchSlots();
    }, [selectedService, selectedProfessional, selectedDate, salon, getAvailableTimeSlots]);

    // Calendar helpers
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days: (Date | null)[] = [];

        // Add empty days for the start of the week
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }

        // Add all days in the month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const isPast = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    };

    const isSelected = (date: Date) => {
        return date.toDateString() === selectedDate.toDateString();
    };

    const days = getDaysInMonth(currentMonth);
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // Usar duration_minutes do Supabase, não duration
    const totalDuration = selectedService?.duration_minutes || 0;
    const totalPrice = selectedService?.price || 0;

    const handleConfirmBooking = async () => {
        if (!selectedService || !selectedDate || !selectedTime || !clientName.trim() || !clientPhone.trim()) {
            toast.error("Preencha todos os campos obrigatórios");
            return;
        }

        setSubmitting(true);
        try {
            if (!salon) {
                toast.error("Erro: Estabelecimento não encontrado");
                return;
            }

            // Calcular end_time baseado na duração do serviço
            const [hours, minutes] = selectedTime.split(':').map(Number);
            const startDate = new Date(selectedDate);
            startDate.setHours(hours, minutes, 0, 0);

            const endDate = new Date(startDate);
            endDate.setMinutes(endDate.getMinutes() + totalDuration);

            const endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;

            // Criar agendamento no Supabase
            const { data: appointment, error } = await supabase
                .from("appointments")
                .insert({
                    salon_id: salon.id,
                    service_id: selectedService.id,
                    professional_id: selectedProfessional?.id || professionals[0]?.id,
                    client_name: clientName.trim(),
                    client_phone: clientPhone.trim(),
                    client_email: clientEmail.trim() || null,
                    date: format(selectedDate, 'yyyy-MM-dd'),
                    start_time: selectedTime,
                    end_time: endTime,
                    status: 'confirmed',
                    price: totalPrice,
                    final_price: wantsPrepayment ? totalPrice * 0.95 : totalPrice,
                })
                .select()
                .single();

            if (error) throw error;

            if (appointment) {
      // Notificações são enfileiradas no servidor, nunca enviadas pelo navegador.

                toast.success("Agendamento confirmado!");

                // Redirecionar para página de confirmação
                navigate(`/appointment-confirmation?id=${appointment.id}`);
            }
        } catch (error: any) {
            console.error("Erro ao criar agendamento:", error);
            toast.error(error.message || "Erro ao criar agendamento");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card/90 backdrop-blur-sm sticky top-0 z-50">
                {/* Identidade do estabelecimento prevalece; a marca da plataforma vira assinatura no rodapé */}
                <div className="container mx-auto px-4 min-h-16 py-2 flex items-center gap-3">
                    {salon && <SalonLogo salon={salon} className="w-10 h-10 rounded-xl border border-border bg-card shrink-0" />}
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{salon?.name || 'Carregando...'}</p>
                        {salon?.address && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                                <MapPin size={12} className="shrink-0" aria-hidden="true" />
                                <span className="truncate">{salon.address}</span>
                            </p>
                        )}
                    </div>
                </div>
            </header>

            {/* Progress Steps */}
            <div className="border-b border-border/50 bg-card/30">
                <div className="container mx-auto px-4 py-4">
                    <ol className="flex items-center justify-center gap-1 sm:gap-2" aria-label="Etapas do agendamento">
                        {['Serviço', 'Profissional', 'Data/Hora', 'Confirmar'].map((label, index) => {
                            const stepOrder = ['service', 'professional', 'datetime', 'confirm'];
                            const currentIndex = stepOrder.indexOf(step);
                            const isActive = index === currentIndex;
                            const isCompleted = index < currentIndex;

                            return (
                                <li key={label} className="flex items-center" aria-current={isActive ? "step" : undefined}>
                                    <div className={cn(
                                        "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                                        isActive && "bg-primary text-primary-foreground",
                                        isCompleted && "bg-success text-white",
                                        !isActive && !isCompleted && "bg-secondary text-muted-foreground"
                                    )}>
                                        {isCompleted ? <Check size={16} aria-hidden="true" /> : index + 1}
                                    </div>
                                    {/* No mobile só a etapa atual mostra o rótulo; as demais ficam para leitores de tela */}
                                    <span className={cn(
                                        "ml-2 text-sm",
                                        isActive ? "text-foreground font-medium" : "text-muted-foreground sr-only sm:not-sr-only"
                                    )}>
                                        {label}
                                    </span>
                                    {index < 3 && (
                                        <ChevronRight className="mx-1 sm:mx-2 text-muted-foreground" size={16} aria-hidden="true" />
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </div>
            </div>

            <div className="container mx-auto px-4 py-6 sm:py-8">
                <AnimatePresence mode="wait">
                    {/* Step 1: Select Service */}
                    {step === 'service' && (
                        <motion.div
                            key="service"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <h2 className="font-display text-2xl font-bold text-foreground mb-6">
                                Escolha o serviço
                            </h2>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                                {loading ? (
                                    <div className="col-span-full text-center py-8 text-muted-foreground">
                                        Carregando serviços...
                                    </div>
                                ) : services.length === 0 ? (
                                    <div className="col-span-full text-center py-8 text-muted-foreground">
                                        Nenhum serviço disponível
                                    </div>
                                ) : (
                                    services.map((service) => (
                                        <motion.div
                                            key={service.id}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            role="button"
                                            tabIndex={0}
                                            aria-pressed={selectedService?.id === service.id}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); }
                                            }}
                                            onClick={() => {
                                                setSelectedService(service);
                                                setStep('professional');
                                            }}
                                            className={cn(
                                                "cursor-pointer rounded-2xl overflow-hidden border-2 transition-colors",
                                                selectedService?.id === service.id
                                                    ? "border-primary shadow-brand"
                                                    : "border-border/50 hover:border-primary/50"
                                            )}
                                        >
                                            {service.icon && (
                                                <div className="w-full aspect-square bg-gradient-to-br from-primary/20 to-brand-hover/20 flex items-center justify-center text-6xl">
                                                    {service.icon}
                                                </div>
                                            )}
                                            <div className="p-4 bg-card">
                                                <h3 className="font-medium text-foreground">{service.name}</h3>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                                                        <Clock size={14} />
                                                        {service.duration_minutes}min
                                                    </span>
                                                    <span className="font-bold text-primary">
                                                        R$ {service.price}
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 2: Select Professional */}
                    {step === 'professional' && (
                        <motion.div
                            key="professional"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="font-display text-2xl font-bold text-foreground">
                                    Escolha o profissional
                                </h2>
                                <Button variant="ghost" onClick={() => setStep('service')}>
                                    <ChevronLeft size={18} className="mr-1" />
                                    Voltar
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {loading ? (
                                    <div className="col-span-full text-center py-8 text-muted-foreground">
                                        Carregando profissionais...
                                    </div>
                                ) : professionals.length === 0 ? (
                                    <div className="col-span-full text-center py-8 text-muted-foreground">
                                        Nenhum profissional disponível
                                    </div>
                                ) : (
                                    <>
                                        {professionals.map((professional) => (
                                            <motion.div
                                                key={professional.id}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                <Card
                                                    role="button"
                                                    tabIndex={professional.is_active ? 0 : -1}
                                                    aria-disabled={!professional.is_active}
                                                    aria-pressed={selectedProfessional?.id === professional.id}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); }
                                                    }}
                                                    onClick={() => {
                                                        if (professional.is_active) {
                                                            setSelectedProfessional(professional);
                                                            setStep('datetime');
                                                        }
                                                    }}
                                                    className={cn(
                                                        "cursor-pointer transition-all overflow-hidden",
                                                        !professional.is_active && "opacity-50 cursor-not-allowed",
                                                        selectedProfessional?.id === professional.id && "ring-2 ring-primary shadow-brand"
                                                    )}
                                                >
                                                    <CardContent className="p-6">
                                                        <div className="flex items-start gap-4">
                                                            {professional.avatar_url ? (
                                                                <img
                                                                    src={professional.avatar_url}
                                                                    alt={professional.name}
                                                                    className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/20"
                                                                />
                                                            ) : (
                                                                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-brand-hover flex items-center justify-center text-primary-foreground font-bold text-xl">
                                                                    {professional.name.charAt(0).toUpperCase()}
                                                                </div>
                                                            )}
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="font-semibold text-foreground">{professional.name}</h3>
                                                                    {!professional.is_active && (
                                                                        <Badge variant="secondary" className="text-xs">Indisponível</Badge>
                                                                    )}
                                                                </div>
                                                                {professional.specialty && (
                                                                    <p className="text-sm text-muted-foreground mt-1">
                                                                        {professional.specialty}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </motion.div>
                                        ))}

                                        {/* Any Professional Option */}
                                        <motion.div
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <Card
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); }
                                                }}
                                                onClick={() => {
                                                    setSelectedProfessional(null);
                                                    setStep('datetime');
                                                }}
                                                className="cursor-pointer transition-all border-dashed"
                                            >
                                                <CardContent className="p-6 flex items-center justify-center h-full min-h-[120px]">
                                                    <div className="text-center">
                                                        <User className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                                                        <p className="font-medium text-foreground">Sem preferência</p>
                                                        <p className="text-sm text-muted-foreground">Qualquer profissional</p>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Step 3: Select Date/Time */}
                    {step === 'datetime' && (
                        <motion.div
                            key="datetime"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="font-display text-2xl font-bold text-foreground">
                                    Escolha data e horário
                                </h2>
                                <Button variant="ghost" onClick={() => setStep('professional')}>
                                    <ChevronLeft size={18} className="mr-1" />
                                    Voltar
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Calendar */}
                                <Card className="glass-card">
                                    <CardContent className="p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <button
                                                type="button"
                                                aria-label="Mês anterior"
                                                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                                                className="w-11 h-11 flex items-center justify-center hover:bg-secondary rounded-lg transition-colors"
                                            >
                                                <ChevronLeft size={20} aria-hidden="true" />
                                            </button>
                                            <h3 className="font-semibold text-foreground">
                                                {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                            </h3>
                                            <button
                                                type="button"
                                                aria-label="Próximo mês"
                                                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                                                className="w-11 h-11 flex items-center justify-center hover:bg-secondary rounded-lg transition-colors"
                                            >
                                                <ChevronRight size={20} aria-hidden="true" />
                                            </button>
                                        </div>

                                        {/* Week days */}
                                        <div className="grid grid-cols-7 gap-1 mb-2">
                                            {weekDays.map((day) => (
                                                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                                                    {day}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Days */}
                                        <div className="grid grid-cols-7 gap-1">
                                            {days.map((date, index) => (
                                                <button
                                                    type="button"
                                                    key={index}
                                                    aria-pressed={date ? isSelected(date) : undefined}
                                                    aria-label={date ? date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) : undefined}
                                                    onClick={() => date && !isPast(date) && setSelectedDate(date)}
                                                    disabled={!date || isPast(date)}
                                                    className={cn(
                                                        "aspect-square rounded-lg flex items-center justify-center text-sm transition-colors",
                                                        !date && "invisible",
                                                        date && isPast(date) && "text-muted-foreground/30 cursor-not-allowed",
                                                        date && !isPast(date) && "hover:bg-secondary cursor-pointer",
                                                        date && isToday(date) && "ring-2 ring-primary/50",
                                                        date && isSelected(date) && "bg-primary text-primary-foreground"
                                                    )}
                                                >
                                                    {date?.getDate()}
                                                </button>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Time Slots */}
                                <Card className="glass-card">
                                    <CardContent className="p-6">
                                        <h3 className="font-semibold text-foreground mb-4">
                                            Horários disponíveis para {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </h3>

                                        <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto py-2">
                                            {loadingSlots ? (
                                                <div className="col-span-3 text-center py-8 text-muted-foreground" role="status">
                                                    Carregando horários...
                                                </div>
                                            ) : timeSlots.length === 0 ? (
                                                <div className="col-span-3 text-center py-8 text-muted-foreground">
                                                    Nenhum horário disponível para esta data
                                                </div>
                                            ) : (
                                                timeSlots.map((slot) => (
                                                    <button
                                                        type="button"
                                                        key={slot}
                                                        aria-pressed={selectedTime === slot}
                                                        onClick={() => setSelectedTime(slot)}
                                                        className={cn(
                                                            "p-3 rounded-lg text-sm font-medium transition-colors",
                                                            "hover:bg-primary/20 cursor-pointer border border-border/50",
                                                            selectedTime === slot && "bg-primary text-primary-foreground border-primary"
                                                        )}
                                                    >
                                                        {slot}
                                                    </button>
                                                ))
                                            )}
                                        </div>

                                        {selectedTime && (
                                            <Button
                                                variant="brand"
                                                className="w-full mt-6"
                                                onClick={() => setStep('confirm')}
                                            >
                                                Continuar
                                                <ChevronRight size={18} className="ml-1" />
                                            </Button>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </motion.div>
                    )}

                    {/* Step 4: Confirm */}
                    {step === 'confirm' && (
                        <motion.div
                            key="confirm"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="max-w-2xl mx-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="font-display text-2xl font-bold text-foreground">
                                    Confirme seu agendamento
                                </h2>
                                <Button variant="ghost" onClick={() => setStep('datetime')}>
                                    <ChevronLeft size={18} className="mr-1" />
                                    Voltar
                                </Button>
                            </div>

                            <Card className="glass-card overflow-hidden">
                                <div className="bg-gradient-to-r from-primary/20 to-brand-hover/20 p-6 border-b border-border/50">
                                    <div className="flex items-center gap-4">
                                        <CalendarIcon className="w-12 h-12 text-primary" />
                                        <div>
                                            <p className="text-sm text-muted-foreground">Data e horário</p>
                                            <p className="text-xl font-bold text-foreground">
                                                {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </p>
                                            <p className="text-lg text-primary font-semibold">{selectedTime}</p>
                                        </div>
                                    </div>
                                </div>

                                <CardContent className="p-6 space-y-6">
                                    {/* Client Info Form */}
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-foreground">Seus dados</h3>

                                        <div className="space-y-2">
                                            <Label htmlFor="clientName">Nome completo *</Label>
                                            <Input
                                                id="clientName"
                                                value={clientName}
                                                onChange={(e) => setClientName(e.target.value)}
                                                placeholder="Digite seu nome completo"
                                                className="h-12"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="clientPhone">WhatsApp *</Label>
                                            <Input
                                                id="clientPhone"
                                                value={clientPhone}
                                                onChange={(e) => setClientPhone(e.target.value)}
                                                placeholder="(00) 00000-0000"
                                                type="tel"
                                                className="h-12"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="clientEmail">E-mail (opcional)</Label>
                                            <Input
                                                id="clientEmail"
                                                value={clientEmail}
                                                onChange={(e) => setClientEmail(e.target.value)}
                                                placeholder="seu@email.com"
                                                type="email"
                                                className="h-12"
                                            />
                                        </div>
                                    </div>
                                    {/* Service */}
                                    <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30">
                                        {selectedService?.icon && (
                                            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-brand-hover/20 flex items-center justify-center text-3xl">
                                                {selectedService.icon}
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <p className="font-medium text-foreground">{selectedService?.name}</p>
                                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                <Clock size={14} />
                                                {totalDuration} minutos
                                            </p>
                                        </div>
                                        <p className="font-bold text-primary">R$ {totalPrice}</p>
                                    </div>

                                    {/* Professional */}
                                    {selectedProfessional && (
                                        <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30">
                                            {selectedProfessional.avatar_url ? (
                                                <img
                                                    src={selectedProfessional.avatar_url}
                                                    alt={selectedProfessional.name}
                                                    className="w-12 h-12 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-brand-hover flex items-center justify-center text-primary-foreground font-bold">
                                                    {selectedProfessional.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-medium text-foreground">{selectedProfessional.name}</p>
                                                {selectedProfessional.specialty && (
                                                    <p className="text-sm text-muted-foreground">{selectedProfessional.specialty}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Prepayment Option */}
                                    <div className="p-4 rounded-xl border border-border/50">
                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={wantsPrepayment}
                                                onChange={(e) => setWantsPrepayment(e.target.checked)}
                                                className="mt-1 w-5 h-5 rounded border-border text-primary"
                                            />
                                            <div>
                                                <p className="font-medium text-foreground flex items-center gap-2">
                                                    <CreditCard size={18} className="text-primary" />
                                                    Pagar antecipado (opcional)
                                                </p>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Garanta seu horário pagando agora e ganhe <span className="text-success font-medium">5% de desconto</span>
                                                </p>
                                                {wantsPrepayment && (
                                                    <p className="text-lg font-bold text-primary mt-2">
                                                        Total: R$ {(totalPrice * 0.95).toFixed(2)}
                                                    </p>
                                                )}
                                            </div>
                                        </label>
                                    </div>

                                    {/* Estimated Time */}
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-primary/10">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-5 h-5 text-primary" />
                                            <span className="text-foreground">Tempo estimado</span>
                                        </div>
                                        <span className="font-bold text-primary">{totalDuration} minutos</span>
                                    </div>

                                    {/* Confirm Button */}
                                    <Button
                                        variant="brand"
                                        size="lg"
                                        className="w-full"
                                        onClick={handleConfirmBooking}
                                        disabled={submitting || !clientName.trim() || !clientPhone.trim()}
                                    >
                                        {submitting ? (
                                            <>
                                                <Clock size={18} className="mr-2 animate-spin" />
                                                Processando...
                                            </>
                                        ) : wantsPrepayment ? (
                                            <>
                                                <CreditCard size={18} className="mr-2" />
                                                Pagar e Confirmar
                                            </>
                                        ) : (
                                            <>
                                                <Check size={18} className="mr-2" />
                                                Confirmar Agendamento
                                            </>
                                        )}
                                    </Button>

                                    <p className="text-xs text-center text-muted-foreground">
                                        Você receberá uma confirmação por WhatsApp
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Assinatura discreta da plataforma (substitui o logo do SaaS que ficava no cabeçalho) */}
                <p className="mt-10 text-center text-xs text-muted-foreground">{BRAND.poweredBy}</p>
            </div>
        </div>
    );
};


export default PublicBookingAdvanced;
