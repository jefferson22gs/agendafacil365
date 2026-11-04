import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AppointmentStatusBadge } from "@/components/admin/AppointmentStatusBadge";

interface Appointment {
  id: string;
  client_name: string;
  client_phone: string;
  date: string;
  start_time: string;
  status: string;
  services: {
    name: string;
    duration_minutes: number;
    price: number;
  };
  professionals: {
    name: string;
  };
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
}

interface Professional {
  id: string;
  name: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  appointments: Appointment[];
}

export function EnhancedSalonCalendar() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonConfig, setSalonConfig] = useState<{
    opening_time: string;
    closing_time: string;
    working_days: number[];
  } | null>(null);

  // Modal de adicionar agendamento
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTime, setSelectedTime] = useState("");
  const [newAppointment, setNewAppointment] = useState({
    client_name: "",
    client_phone: "",
    service_id: "",
    professional_id: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSalonId();
  }, []);

  useEffect(() => {
    if (salonId) {
      loadData();
    }
  }, [salonId, selectedDate]);

  const loadSalonId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: salon } = await supabase
      .from("salons")
      .select("id, opening_time, closing_time, working_days")
      .eq("owner_id", user.id)
      .single();

    if (salon) {
      setSalonId(salon.id);
      setSalonConfig({
        opening_time: salon.opening_time || '08:00',
        closing_time: salon.closing_time || '20:00',
        working_days: salon.working_days || [1, 2, 3, 4, 5, 6],
      });
    }
  };

  const loadData = async () => {
    if (!salonId) return;

    setLoading(true);
    try {
      // Carregar agendamentos do dia
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from("appointments")
        .select(`
          *,
          services (name, duration_minutes, price),
          professionals (name)
        `)
        .eq("salon_id", salonId)
        .eq("date", dateStr)
        .order("start_time", { ascending: true });

      if (appointmentsError) throw appointmentsError;

      setAppointments(appointmentsData || []);

      // Carregar serviços
      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price")
        .eq("salon_id", salonId)
        .eq("is_active", true);

      if (servicesError) throw servicesError;
      setServices(servicesData || []);

      // Carregar profissionais
      const { data: professionalsData, error: professionalsError } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("salon_id", salonId)
        .eq("is_active", true);

      if (professionalsError) throw professionalsError;
      setProfessionals(professionalsData || []);

      // Gerar time slots
      generateTimeSlots(appointmentsData || []);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = (appointmentsData: Appointment[]) => {
    if (!salonConfig) return;

    const slots: TimeSlot[] = [];

    // Pegar horários de funcionamento do salão
    const [openHour, openMin] = salonConfig.opening_time.split(':').map(Number);
    const [closeHour, closeMin] = salonConfig.closing_time.split(':').map(Number);

    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;

    // Encontrar a menor duração de serviço para usar como intervalo
    const minDuration = services.length > 0
      ? Math.min(...services.map(s => s.duration_minutes))
      : 30;

    // Gerar TODOS os horários baseados na menor duração de serviço
    for (let currentMinutes = openMinutes; currentMinutes < closeMinutes; currentMinutes += minDuration) {
      const hours = Math.floor(currentMinutes / 60);
      const minutes = currentMinutes % 60;
      const time = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

      // Pegar agendamentos que começam exatamente neste horário
      const appointmentsStartingHere = appointmentsData.filter(apt => apt.start_time === time);

      // Verificar se há agendamentos que ocupam este horário (considerando duração)
      const isOccupied = appointmentsData.some(apt => {
        const aptStartMinutes = parseInt(apt.start_time.split(':')[0]) * 60 + parseInt(apt.start_time.split(':')[1]);
        const aptEndMinutes = aptStartMinutes + (apt.services?.duration_minutes || 0);

        // Verifica se o horário atual está dentro do período do agendamento
        return currentMinutes >= aptStartMinutes && currentMinutes < aptEndMinutes;
      });

      slots.push({
        time,
        available: !isOccupied,
        appointments: appointmentsStartingHere,
      });
    }

    setTimeSlots(slots);
  };

  const handlePreviousDay = () => {
    setSelectedDate(prev => addDays(prev, -1));
  };

  const handleNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1));
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const openAddModal = (time: string) => {
    setSelectedTime(time);
    setNewAppointment({
      client_name: "",
      client_phone: "",
      service_id: "",
      professional_id: "",
    });
    setShowAddModal(true);
  };

  const handleAddAppointment = async () => {
    if (!salonId || !selectedTime) return;

    if (!newAppointment.client_name || !newAppointment.client_phone || !newAppointment.service_id || !newAppointment.professional_id) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Buscar duração do serviço
      const selectedService = services.find(s => s.id === newAppointment.service_id);
      if (!selectedService) {
        throw new Error("Serviço não encontrado");
      }

      // Buscar nome do profissional
      const selectedProfessional = professionals.find(p => p.id === newAppointment.professional_id);

      // Calcular end_time
      const [hours, minutes] = selectedTime.split(":");
      const startMinutes = parseInt(hours) * 60 + parseInt(minutes);
      const endMinutes = startMinutes + selectedService.duration_minutes;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      const endTime = `${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`;

      const { data: appointment, error } = await supabase
        .from("appointments")
        .insert({
          salon_id: salonId,
          service_id: newAppointment.service_id,
          professional_id: newAppointment.professional_id,
          client_name: newAppointment.client_name,
          client_phone: newAppointment.client_phone,
          date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: selectedTime,
          end_time: endTime,
          status: "confirmed",
          price: selectedService.price,
          final_price: selectedService.price,
        })
        .select()
        .single();

      if (error) throw error;

      // Notificações são enfileiradas no servidor, nunca enviadas pelo navegador.

      toast({
        title: "Agendamento criado",
        description: "O agendamento foi adicionado. O envio de avisos depende das automações configuradas no salão.",
      });

      setShowAddModal(false);
      setNewAppointment({
        client_name: "",
        client_phone: "",
        service_id: "",
        professional_id: "",
      });
      loadData();
    } catch (error: any) {
      console.error("Error creating appointment:", error);
      toast({
        title: "Erro ao criar agendamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <CheckCircle size={14} className="text-success" />;
      case "completed":
        return <CheckCircle size={14} className="text-primary" />;
      case "cancelled":
        return <XCircle size={14} className="text-destructive" />;
      default:
        return <Clock size={14} className="text-muted-foreground" />;
    }
  };

  const stats = {
    total: appointments.length,
    confirmed: appointments.filter(a => a.status === "confirmed").length,
    completed: appointments.filter(a => a.status === "completed").length,
    cancelled: appointments.filter(a => a.status === "cancelled").length,
    available: timeSlots.filter(s => s.available).length,
  };

  return (
    <div className="space-y-6" data-tour="appointments-calendar">
      {/* Header com navegação de data */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="text-primary" />
              Agenda do estabelecimento
            </CardTitle>
            <div className="flex w-full md:w-auto items-center gap-2" data-tour="appointments-calendar-dates">
              <Button variant="outline" size="icon" onClick={handlePreviousDay} aria-label="Dia anterior">
                <ChevronLeft size={20} />
              </Button>
              <Button variant="outline" onClick={handleToday}>
                Hoje
              </Button>
              <div className="flex-1 md:flex-none px-3 py-2 bg-muted rounded-lg font-semibold md:min-w-[200px] text-center text-sm sm:text-base capitalize truncate" aria-live="polite">
                {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </div>
              <Button variant="outline" size="icon" onClick={handleNextDay} aria-label="Próximo dia">
                <ChevronRight size={20} />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Estatísticas do dia */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-success">{stats.confirmed}</p>
            <p className="text-sm text-muted-foreground">Confirmados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-primary">{stats.completed}</p>
            <p className="text-sm text-muted-foreground">Concluídos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.cancelled}</p>
            <p className="text-sm text-muted-foreground">Cancelados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-2xl font-bold text-primary">{stats.available}</p>
            <p className="text-sm text-muted-foreground">Horários Vagos</p>
          </CardContent>
        </Card>
      </div>

      {/* Grade de horários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Horários do Dia</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={40} aria-hidden />
              <span className="sr-only">Carregando horários…</span>
            </div>
          ) : salonConfig && !salonConfig.working_days.includes(selectedDate.getDay()) ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <XCircle size={48} className="text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground">Estabelecimento fechado neste dia</p>
              <p className="text-sm text-muted-foreground">
                Selecione outro dia para visualizar os horários
              </p>
            </div>
          ) : timeSlots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock size={48} className="text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground">Nenhum horário disponível</p>
              <p className="text-sm text-muted-foreground">
                Configure os horários de funcionamento e serviços do estabelecimento
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[600px] overflow-y-auto" data-tour="appointments-calendar-slots">
              {timeSlots.map((slot) => (
                <div
                  key={slot.time}
                  className={cn(
                    "flex items-start gap-4 p-3 rounded-lg border transition-colors",
                    slot.available ? "bg-success/5 border-success/20 hover:bg-success/10" : "bg-muted/50"
                  )}
                >
                  <div className="w-16 flex-shrink-0">
                    <p className="font-semibold text-sm">{slot.time}</p>
                  </div>

                  <div className="flex-1">
                    {slot.available ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openAddModal(slot.time)}
                        data-tour="appointments-calendar-add"
                        className="w-full justify-start text-success hover:text-success hover:bg-success/10"
                      >
                        <Plus size={16} className="mr-2" aria-hidden />
                        <span className="truncate">Horário disponível – agendar</span>
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        {slot.appointments.map((apt) => (
                          <div
                            key={apt.id}
                            className="flex items-start gap-3 p-3 bg-background rounded-lg border"
                          >
                            <div className="mt-1" aria-hidden>
                              {getStatusBadge(apt.status)}
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Status com texto (não só ícone/cor) */}
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-sm">{apt.client_name}</p>
                                <AppointmentStatusBadge status={apt.status} />
                              </div>
                              <p className="text-xs text-muted-foreground">{apt.services.name}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <User size={12} />
                                  {apt.professionals.name}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Phone size={12} />
                                  {apt.client_phone}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {apt.services.duration_minutes}min
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de adicionar agendamento */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md" data-tour="appointments-calendar-dialog">
          <DialogHeader>
            <DialogTitle>Adicionar Agendamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Horário</Label>
              <Input value={selectedTime} disabled className="bg-muted" />
            </div>

            <div>
              <Label>Nome do Cliente *</Label>
              <Input
                placeholder="Nome completo"
                data-tour="appointments-calendar-client"
                value={newAppointment.client_name}
                onChange={(e) => setNewAppointment({ ...newAppointment, client_name: e.target.value })}
              />
            </div>

            <div>
              <Label>Telefone *</Label>
              <Input
                placeholder="(00) 00000-0000"
                data-tour="appointments-calendar-phone"
                value={newAppointment.client_phone}
                onChange={(e) => setNewAppointment({ ...newAppointment, client_phone: e.target.value })}
              />
            </div>

            <div>
              <Label>Serviço *</Label>
              <select
                className="w-full border rounded-md px-3 py-2 bg-background"
                data-tour="appointments-calendar-service"
                value={newAppointment.service_id}
                onChange={(e) => setNewAppointment({ ...newAppointment, service_id: e.target.value })}
              >
                <option value="">Selecione um serviço</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} - {service.duration_minutes}min - R$ {service.price.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Profissional *</Label>
              <select
                className="w-full border rounded-md px-3 py-2 bg-background"
                data-tour="appointments-calendar-professional"
                value={newAppointment.professional_id}
                onChange={(e) => setNewAppointment({ ...newAppointment, professional_id: e.target.value })}
              >
                <option value="">Selecione um profissional</option>
                {professionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddAppointment} disabled={saving} data-tour="appointments-calendar-save">
              {saving ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={16} />
                  Salvando...
                </>
              ) : (
                "Adicionar Agendamento"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
