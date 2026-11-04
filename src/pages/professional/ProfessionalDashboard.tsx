import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/icons/Logo";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  Clock,
  CheckCircle2,
  DollarSign,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Phone,
  MapPin,
  Bell,
  Settings,
  TrendingUp,
  MoreVertical
} from "lucide-react";
import { format, addDays, subDays, isToday, isTomorrow, parseISO, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/page-header";
import { AppointmentStatusBadge } from "@/components/admin/AppointmentStatusBadge";

interface Appointment {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  client_name: string | null;
  client_phone: string | null;
  price: number;
  final_price: number;
  services: { name: string; duration_minutes: number } | null;
}

interface Professional {
  id: string;
  name: string;
  commission_rate: number;
  salon_id: string;
}

const ProfessionalDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [monthlyCommission, setMonthlyCommission] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null);

  // Generate date options for horizontal scroll
  const dateOptions = Array.from({ length: 7 }, (_, i) => addDays(startOfToday(), i - 1));

  useEffect(() => {
    fetchProfessionalData();
  }, [user]);

  useEffect(() => {
    if (professional) {
      fetchAppointments();
    }
  }, [professional, selectedDate]);

  const fetchProfessionalData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error("Você não está cadastrado como profissional");
        navigate('/');
        return;
      }

      setProfessional(data);

      // Fetch monthly commission
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const { data: monthAppts } = await supabase
        .from('appointments')
        .select('final_price')
        .eq('professional_id', data.id)
        .eq('status', 'completed')
        .gte('date', startOfMonth);

      const totalRevenue = monthAppts?.reduce((sum, apt) => sum + (apt.final_price || 0), 0) || 0;
      const commission = totalRevenue * (data.commission_rate / 100);
      setMonthlyCommission(commission);

    } catch (error) {
      console.error("Error fetching professional:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    if (!professional) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          date,
          start_time,
          end_time,
          status,
          client_name,
          client_phone,
          price,
          final_price,
          services:service_id (name, duration_minutes)
        `)
        .eq('professional_id', professional.id)
        .eq('date', dateStr)
        .order('start_time');

      if (error) throw error;

      setAppointments(data || []);
      
      if (isToday(selectedDate)) {
        setCompletedToday(data?.filter(a => a.status === 'completed').length || 0);
      }
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  };

  const handleCompleteAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success("Atendimento concluído!");
      fetchAppointments();
      fetchProfessionalData();
    } catch (error) {
      console.error("Error completing appointment:", error);
      toast.error("Erro ao atualizar status");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const displayName = profile?.full_name || professional?.name || 'Profissional';

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return "Hoje";
    if (isTomorrow(date)) return "Amanhã";
    return format(date, "EEE", { locale: ptBR });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4" role="status">
          <Loader2 className="w-10 h-10 animate-spin text-primary" aria-hidden />
          <p className="text-muted-foreground text-sm">Carregando sua agenda…</p>
        </div>
      </div>
    );
  }

  const upcomingAppointments = appointments.filter(a => a.status === 'confirmed' || a.status === 'pending');
  const nextAppointment = upcomingAppointments[0];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky-header">
        <div className="container-responsive">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold" aria-hidden>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground">Profissional</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors touch-target" aria-label="Notificações">
                <Bell size={22} className="text-muted-foreground" aria-hidden />
              </button>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-lg hover:bg-secondary transition-colors touch-target"
                aria-label="Sair da conta"
              >
                <LogOut size={22} className="text-muted-foreground" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto pb-safe">
        {/* Stats Cards - Horizontal Scroll on Mobile */}
        <div className="py-4">
          <div className="flex gap-3 overflow-x-auto scroll-snap-x px-4 pb-2">
            <Card className="min-w-[140px] flex-shrink-0 scroll-snap-item">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center" aria-hidden>
                    <Calendar size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{appointments.length}</p>
                    <p className="text-xs text-muted-foreground">Agenda</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-[140px] flex-shrink-0 scroll-snap-item">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center" aria-hidden>
                    <CheckCircle2 size={20} className="text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{completedToday}</p>
                    <p className="text-xs text-muted-foreground">Concluídos</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-[160px] flex-shrink-0 scroll-snap-item">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center" aria-hidden>
                    <DollarSign size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">R$ {monthlyCommission.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground">Comissão Mês</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-[120px] flex-shrink-0 scroll-snap-item">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center" aria-hidden>
                    <TrendingUp size={20} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{professional?.commission_rate}%</p>
                    <p className="text-xs text-muted-foreground">Taxa</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Date Selector - Horizontal Scroll */}
        <div className="px-4 mb-4">
          <div className="flex gap-2 overflow-x-auto scroll-snap-x pb-2 -mx-4 px-4">
            {dateOptions.map((date) => {
              const isSelected = format(selectedDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
              const isPast = date < startOfToday();
              
              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  disabled={isPast}
                  aria-pressed={isSelected}
                  aria-label={format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  className={cn(
                    "flex flex-col items-center justify-center min-w-[64px] h-[76px] rounded-2xl border-2 transition-all scroll-snap-item",
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground shadow-brand'
                      : isPast
                        ? 'border-border/50 bg-secondary/50 text-muted-foreground/50'
                        : 'border-border bg-card hover:border-primary/50'
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-medium uppercase",
                    isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  )}>
                    {getDateLabel(date)}
                  </span>
                  <span className={cn(
                    "text-xl font-bold",
                    isSelected ? 'text-primary-foreground' : 'text-foreground'
                  )}>
                    {format(date, "dd")}
                  </span>
                  <span className={cn(
                    "text-[10px]",
                    isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  )}>
                    {format(date, "MMM", { locale: ptBR })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Next Appointment Highlight */}
        {nextAppointment && isToday(selectedDate) && (
          <div className="px-4 mb-4">
            <Card className="bg-primary/5 border-primary/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-primary" aria-hidden />
                  <span className="text-xs font-medium text-primary uppercase tracking-wide">Próximo</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary flex flex-col items-center justify-center text-primary-foreground shrink-0 tabular-nums">
                    <span className="text-lg font-bold leading-none">{nextAppointment.start_time.slice(0, 5)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {nextAppointment.client_name || 'Cliente'}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {nextAppointment.services?.name}
                    </p>
                  </div>
                  <Button
                    variant="brand"
                    size="sm"
                    onClick={() => handleCompleteAppointment(nextAppointment.id)}
                  >
                    <CheckCircle2 size={16} className="mr-1" aria-hidden />
                    Concluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Appointments List */}
        <div className="px-4 space-y-3 pb-6">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {isToday(selectedDate) ? 'Agenda de Hoje' : format(selectedDate, "EEEE, dd/MM", { locale: ptBR })}
          </h2>

          {appointments.length === 0 ? (
            <EmptyState icon={Calendar} title="Nenhum agendamento" description="Não há atendimentos marcados para este dia." />
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {appointments.map((appointment, index) => {
                  const isExpanded = expandedAppointment === appointment.id;
                  const toggle = () => setExpandedAppointment(isExpanded ? null : appointment.id);
                  
                  return (
                    <motion.div
                      key={appointment.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card 
                        className={cn(
                          "transition-all cursor-pointer overflow-hidden",
                          // Concluído fica esmaecido, mas sem opacidade que prejudique a leitura do texto
                          appointment.status === 'completed' && 'surface-2',
                          isExpanded && 'ring-2 ring-primary/50'
                        )}
                        onClick={toggle}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onKeyDown={(e) => {
                          // Só reage quando o foco está no próprio cartão (não nos botões/links internos)
                          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            toggle();
                          }
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 tabular-nums",
                              appointment.status === 'completed'
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-primary/10 text-primary'
                            )}>
                              <span className="text-base font-bold leading-none">
                                {appointment.start_time.slice(0, 5)}
                              </span>
                              <span className="text-[10px] opacity-80 mt-0.5">
                                {appointment.end_time.slice(0, 5)}
                              </span>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 min-w-0">
                                <p className="font-semibold text-foreground truncate">
                                  {appointment.client_name || 'Cliente'}
                                </p>
                                <AppointmentStatusBadge status={appointment.status} className="flex-shrink-0" />
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {appointment.services?.name}
                              </p>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p className="text-lg font-bold text-foreground tabular-nums">
                                R$ {appointment.final_price?.toFixed(0)}
                              </p>
                            </div>
                          </div>

                          {/* Expanded Content */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-4 pt-4 border-t border-border space-y-3">
                                  {appointment.client_phone && (
                                    <a
                                      href={`tel:${appointment.client_phone}`}
                                      className="flex items-center gap-3 p-3 min-h-[44px] rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                      aria-label={`Ligar para ${appointment.client_name || 'cliente'}: ${appointment.client_phone}`}
                                    >
                                      <Phone size={18} className="text-primary" aria-hidden />
                                      <span className="font-medium text-foreground">
                                        {appointment.client_phone}
                                      </span>
                                    </a>
                                  )}
                                  
                                  {appointment.status === 'confirmed' && (
                                    <Button
                                      variant="brand"
                                      className="w-full"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCompleteAppointment(appointment.id);
                                      }}
                                    >
                                      <CheckCircle2 size={18} className="mr-2" aria-hidden />
                                      Marcar como Concluído
                                    </Button>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProfessionalDashboard;
