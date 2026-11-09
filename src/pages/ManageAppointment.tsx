import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { AppointmentPushOptIn } from "@/components/pwa/AppointmentPushOptIn";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  User,
  Scissors,
  MapPin,
  Phone,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";

interface Appointment {
  id: string;
  salon_id: string;
  service_id: string;
  professional_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  client_name: string;
  client_phone: string;
  price: number;
  final_price: number;
  notes: string | null;
  can_be_modified: boolean;
  salon: {
    name: string;
    slug: string | null;
    address: string | null;
    phone: string | null;
    primary_color: string | null;
  };
  service: {
    name: string;
    duration_minutes: number;
  };
  professional: {
    name: string;
  };
}

export default function ManageAppointment() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'view' | 'cancel' | 'reschedule'>('view');
  const [submitting, setSubmitting] = useState(false);

  // Reschedule state
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [loadingTimes, setLoadingTimes] = useState(false);

  useEffect(() => {
    if (token) {
      fetchAppointment();
    }
  }, [token]);

  useEffect(() => {
    if (newDate && appointment) {
      fetchAvailableTimes(newDate);
    }
  }, [newDate]);

  const fetchAppointment = async () => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          salon:salons(name, slug, address, phone, primary_color),
          service:services(name, duration_minutes),
          professional:professionals(name)
        `)
        .eq('cancellation_token', token)
        .single();

      if (error) throw error;

      if (!data) {
        toast.error("Agendamento não encontrado");
        return;
      }

      setAppointment(data as any);
    } catch (error: any) {
      console.error("Error fetching appointment:", error);
      toast.error("Erro ao carregar agendamento");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTimes = async (date: Date) => {
    if (!appointment) return;

    setLoadingTimes(true);
    try {
      const { data, error } = await supabase.rpc('get_available_time_slots', {
        p_salon_id: appointment.salon_id,
        p_professional_id: appointment.professional_id,
        p_service_id: appointment.service_id,
        p_date: format(date, 'yyyy-MM-dd'),
        p_exclude_appointment_id: appointment.id
      });

      if (error) throw error;

      setAvailableTimes(data || []);
    } catch (error) {
      console.error("Error fetching times:", error);
      toast.error("Erro ao carregar horários disponíveis");
    } finally {
      setLoadingTimes(false);
    }
  };

  const handleCancel = async () => {
    if (!appointment || !token) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('cancel_appointment_by_token', {
        p_token: token,
        p_reason: 'Cancelado pelo cliente'
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        throw new Error(result.message || 'Erro ao cancelar agendamento');
      }

      toast.success("Agendamento cancelado com sucesso!");
      setAction('view');
      fetchAppointment();
    } catch (error: any) {
      console.error("Error canceling:", error);
      toast.error(error.message || "Erro ao cancelar agendamento");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async () => {
    if (!appointment || !token || !newDate || !selectedTime) {
      toast.error("Selecione uma nova data e horário");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('reschedule_appointment_by_token', {
        p_token: token,
        p_new_date: format(newDate, 'yyyy-MM-dd'),
        p_new_time: selectedTime
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        throw new Error(result.message || 'Erro ao reagendar');
      }

      toast.success("Agendamento alterado com sucesso!");
      setAction('view');
      setNewDate(undefined);
      setSelectedTime("");
      fetchAppointment();
    } catch (error: any) {
      console.error("Error rescheduling:", error);
      toast.error(error.message || "Erro ao reagendar");
    } finally {
      setSubmitting(false);
    }
  };

  const canModify = () => {
    if (!appointment) return false;
    if (appointment.status !== 'pending' && appointment.status !== 'confirmed') return false;
    if (!appointment.can_be_modified) return false;

    const appointmentDateTime = new Date(`${appointment.date}T${appointment.start_time}`);
    const hoursUntil = (appointmentDateTime.getTime() - Date.now()) / (1000 * 60 * 60);

    return hoursUntil >= 24;
  };

  const isDateDisabled = (date: Date) => {
    const today = startOfDay(new Date());
    const maxDate = addDays(today, 60);
    return isBefore(date, today) || isBefore(maxDate, date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-bold mb-2">Agendamento não encontrado</h1>
          <p className="text-muted-foreground">O link pode estar inválido ou expirado.</p>
        </div>
      </div>
    );
  }

  const primaryColor = appointment.salon.primary_color || '#000000';
  const appointmentDate = new Date(`${appointment.date}T${appointment.start_time}`);
  const canModifyAppointment = canModify();

  // View mode
  if (action === 'view') {
    return (
      <div className="min-h-screen bg-background">
        <header
          className="sticky top-0 z-30 backdrop-blur-xl border-b"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}10 0%, transparent 100%)`,
            borderColor: `${primaryColor}20`
          }}
        >
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-xl font-bold">{appointment.salon.name}</h1>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 max-w-2xl">
          {appointment.status === 'cancelled' ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-2">
                <XCircle className="w-6 h-6 text-destructive" />
                <h2 className="text-xl font-bold text-destructive">Agendamento Cancelado</h2>
              </div>
              <p className="text-muted-foreground">Este agendamento foi cancelado.</p>
            </div>
          ) : (
            <div className="bg-card border rounded-2xl p-6 mb-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-6 h-6" style={{ color: primaryColor }} />
                <h2 className="text-xl font-bold">Seu Agendamento</h2>
              </div>
              {appointment.salon.slug && appointment.status !== 'completed' && (
                <div className="mb-4">
                  <AppointmentPushOptIn salonSlug={appointment.salon.slug} cancellationToken={token} salonName={appointment.salon.name} />
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Scissors className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Serviço</p>
                    <p className="font-medium">{appointment.service.name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Profissional</p>
                    <p className="font-medium">{appointment.professional.name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CalendarIcon className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Data</p>
                    <p className="font-medium">{format(appointmentDate, "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Horário</p>
                    <p className="font-medium">{appointment.start_time}</p>
                  </div>
                </div>

                {appointment.salon.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Endereço</p>
                      <p className="font-medium">{appointment.salon.address}</p>
                    </div>
                  </div>
                )}

                {appointment.salon.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">{appointment.salon.phone}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {canModifyAppointment && appointment.status !== 'cancelled' && (
            <div className="space-y-3">
              <Button
                onClick={() => setAction('reschedule')}
                className="w-full"
                style={{ backgroundColor: primaryColor }}
              >
                Alterar Data/Horário
              </Button>

              <Button
                onClick={() => setAction('cancel')}
                variant="outline"
                className="w-full border-destructive text-destructive hover:bg-destructive hover:text-white"
              >
                Cancelar Agendamento
              </Button>
            </div>
          )}

          {!canModifyAppointment && appointment.status !== 'cancelled' && (
            <div className="bg-muted/50 border rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Não é possível modificar</p>
                  <p className="text-sm text-muted-foreground">
                    Alterações só podem ser feitas com pelo menos 24 horas de antecedência.
                    Entre em contato com o salão para mais informações.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Cancel mode
  if (action === 'cancel') {
    return (
      <div className="min-h-screen bg-background">
        <header
          className="sticky top-0 z-30 backdrop-blur-xl border-b"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}10 0%, transparent 100%)`,
            borderColor: `${primaryColor}20`
          }}
        >
          <div className="container mx-auto px-4 py-4 flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setAction('view')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Cancelar Agendamento</h1>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold text-destructive mb-2">Tem certeza?</h2>
            <p className="text-muted-foreground mb-4">
              Você está prestes a cancelar seu agendamento para {format(appointmentDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.
            </p>
            <p className="text-sm text-muted-foreground">
              Esta ação não pode ser desfeita. Você precisará fazer um novo agendamento se mudar de ideia.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleCancel}
              disabled={submitting}
              className="w-full bg-destructive hover:bg-destructive/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                'Confirmar Cancelamento'
              )}
            </Button>

            <Button
              onClick={() => setAction('view')}
              variant="outline"
              className="w-full"
              disabled={submitting}
            >
              Voltar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Reschedule mode
  return (
    <div className="min-h-screen bg-background">
      <header
        className="sticky top-0 z-30 backdrop-blur-xl border-b"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}10 0%, transparent 100%)`,
          borderColor: `${primaryColor}20`
        }}
      >
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAction('view')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Alterar Data/Horário</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-card border rounded-2xl p-6 mb-6">
          <h3 className="font-medium mb-4">Selecione a nova data</h3>
          <Calendar
            mode="single"
            selected={newDate}
            onSelect={setNewDate}
            disabled={isDateDisabled}
            locale={ptBR}
            className="rounded-md border"
          />
        </div>

        {newDate && (
          <div className="bg-card border rounded-2xl p-6 mb-6">
            <h3 className="font-medium mb-4">Horários disponíveis</h3>
            {loadingTimes ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : availableTimes.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nenhum horário disponível para esta data
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableTimes.map((time) => (
                  <Button
                    key={time}
                    variant={selectedTime === time ? "default" : "outline"}
                    onClick={() => setSelectedTime(time)}
                    style={selectedTime === time ? { backgroundColor: primaryColor } : {}}
                  >
                    {time}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {newDate && selectedTime && (
          <Button
            onClick={handleReschedule}
            disabled={submitting}
            className="w-full"
            style={{ backgroundColor: primaryColor }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Alterando...
              </>
            ) : (
              'Confirmar Alteração'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
