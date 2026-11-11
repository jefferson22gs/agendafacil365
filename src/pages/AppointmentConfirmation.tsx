import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getAppointmentManageLink } from "@/lib/appointmentLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddToGoogleCalendar } from "@/components/booking/AddToGoogleCalendar";
import {
  CheckCircle,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Scissors,
  Share2,
  Loader2,
} from "lucide-react";
import { format, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AppointmentDetails {
  id: string;
  salon_id: string;
  client_name: string;
  client_phone: string;
  appointment_date: string;
  services: {
    name: string;
    duration: number;
    price: number;
  };
  professionals: {
    name: string;
  };
  salons: {
    name: string;
    address: string;
    phone: string;
  };
}

export default function AppointmentConfirmation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const appointmentId = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (appointmentId) {
      loadAppointment();
    }
  }, [appointmentId]);

  const loadAppointment = async () => {
    if (!appointmentId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          services (name, duration, price),
          professionals (name),
          salons (name, address, phone)
        `)
        .eq("id", appointmentId)
        .single();

      if (error) throw error;
      setAppointment(data as unknown as AppointmentDetails);
    } catch (error) {
      console.error("Error loading appointment:", error);
    } finally {
      setLoading(false);
    }
  };

  const getManageLink = () => {
    if (!appointment) return "";
    return getAppointmentManageLink(appointment);
  };

  const copyManageLink = async () => {
    try {
      await navigator.clipboard.writeText(getManageLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying:", error);
    }
  };

  const shareViaWhatsApp = () => {
    const message = `🎉 Agendamento Confirmado!\n\n📍 ${appointment?.salons.name}\n✂️ ${appointment?.services.name}\n👤 ${appointment?.professionals.name}\n📅 ${appointment ? format(new Date(appointment.appointment_date), "dd/MM/yyyy 'às' HH:mm") : ""}\n\n🔗 Gerenciar agendamento:\n${getManageLink()}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="animate-spin text-primary" size={48} aria-hidden="true" />
        <span className="sr-only">Carregando</span>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Agendamento não encontrado</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const appointmentDate = new Date(appointment.appointment_date);
  const endDate = addMinutes(appointmentDate, appointment.services.duration);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Success Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/20 mb-4">
            <CheckCircle className="text-success" size={48} aria-hidden="true" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">
            Agendamento Confirmado!
          </h1>
          <p className="text-muted-foreground text-lg">
            Seu horário foi reservado com sucesso
          </p>
        </div>

        {/* Appointment Details */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhes do Agendamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <MapPin className="text-primary mt-1" size={20} />
                <div className="flex-1">
                  <p className="font-semibold">{appointment.salons.name}</p>
                  <p className="text-sm text-muted-foreground">{appointment.salons.address}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <Phone size={14} className="inline mr-1" />
                    {appointment.salons.phone}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Calendar className="text-primary" size={20} />
                <div className="flex-1">
                  <p className="font-semibold">
                    {format(appointmentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <Clock size={14} className="inline mr-1" />
                    {format(appointmentDate, "HH:mm")} ({appointment.services.duration} minutos)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Scissors className="text-primary" size={20} />
                <div className="flex-1">
                  <p className="font-semibold">{appointment.services.name}</p>
                  <p className="text-sm text-muted-foreground">
                    R$ {appointment.services.price.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <User className="text-primary" size={20} />
                <div className="flex-1">
                  <p className="font-semibold">{appointment.professionals.name}</p>
                  <p className="text-sm text-muted-foreground">Profissional</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <AddToGoogleCalendar
            title={`${appointment.services.name} - ${appointment.salons.name}`}
            description={`Serviço: ${appointment.services.name}\nProfissional: ${appointment.professionals.name}\nCliente: ${appointment.client_name}`}
            location={appointment.salons.address}
            startDate={appointmentDate}
            endDate={endDate}
            className="w-full h-12 text-base font-semibold"
          />

          <Button
            variant="outline"
            size="lg"
            onClick={shareViaWhatsApp}
            className="w-full"
          >
            <Share2 size={18} className="mr-2" />
            Compartilhar no WhatsApp
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={copyManageLink}
            className="w-full"
          >
            {copied ? (
              <>
                <CheckCircle size={18} className="mr-2 text-success" aria-hidden="true" />

                Link Copiado!
              </>
            ) : (
              <>
                <Share2 size={18} className="mr-2" />
                Copiar Link de Gerenciamento
              </>
            )}
          </Button>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-blue-500">📱 Gerenciar Agendamento</p>
              <p className="text-muted-foreground">
                Use o link acima para cancelar ou reagendar seu horário com até 2 horas de antecedência.
              </p>
              <p className="text-muted-foreground">
                Você também receberá um lembrete por WhatsApp antes do seu horário.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
          >
            Voltar ao Início
          </Button>
        </div>
      </div>
    </div>
  );
}
