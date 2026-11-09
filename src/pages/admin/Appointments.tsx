import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calendar, Clock, User, Check, X, ChevronLeft, ChevronRight, MoreVertical, CheckCircle, XCircle, Edit, Ban, UserX, Phone, MessageCircle, AlertCircle } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EnhancedSalonCalendar } from "@/components/admin/EnhancedSalonCalendar";
import { TrainingEmptyActions } from "@/features/training/TrainingEmptyActions";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { sendPush } from "@/hooks/usePushNotificationsFCM";
import { AppointmentStatusBadge } from "@/components/admin/AppointmentStatusBadge";

type Appointment = Tables<"appointments"> & {
  services?: { name: string; duration_minutes: number } | null;
  professionals?: { name: string } | null;
};

type Service = Tables<"services">;
type Professional = Tables<"professionals">;

const statusLabels = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};

const Appointments = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [salonId, setSalonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  // Use local date to avoid UTC timezone offset (Brazil UTC-3 can show tomorrow after 21h)
  const getLocalToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [selectedDate, setSelectedDate] = useState(getLocalToday());
  // Filtros locais sobre os agendamentos já carregados do dia (não alteram a query).
  const [professionalFilter, setProfessionalFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formData, setFormData] = useState({
    client_name: "",
    client_phone: "",
    service_id: "",
    professional_id: "",
    date: getLocalToday(),
    start_time: "09:00",
  });

  useEffect(() => {
    fetchData();
  }, [user, selectedDate]);

  const fetchData = async () => {
    if (!user) return;

    try {
      const { data: salon } = await supabase
        .from('salons')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!salon) {
        setLoading(false);
        return;
      }

      setSalonId(salon.id);

      // Fetch appointments APENAS da data selecionada pelo usuário
      const { data: appointmentsData, error } = await supabase
        .from('appointments')
        .select(`
          *,
          services:service_id (name, duration_minutes),
          professionals:professional_id (name)
        `)
        .eq('salon_id', salon.id)
        .eq('date', selectedDate)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setAppointments(appointmentsData || []);

      // Fetch services and professionals
      const [servicesRes, professionalsRes] = await Promise.all([
        supabase.from('services').select('*').eq('salon_id', salon.id).eq('is_active', true),
        supabase.from('professionals').select('*').eq('salon_id', salon.id).eq('is_active', true),
      ]);

      setServices(servicesRes.data || []);
      setProfessionals(professionalsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar agendamentos");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!salonId) return;

    if (!formData.client_name || !formData.service_id || !formData.professional_id) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const service = services.find(s => s.id === formData.service_id);
    if (!service) return;

    // Calculate end time
    const [hours, minutes] = formData.start_time.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0);
    const endDate = new Date(startDate.getTime() + service.duration_minutes * 60000);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    try {
      const { error } = await supabase
        .from('appointments')
        .insert({
          salon_id: salonId,
          client_name: formData.client_name,
          client_phone: formData.client_phone || null,
          service_id: formData.service_id,
          professional_id: formData.professional_id,
          date: formData.date,
          start_time: formData.start_time,
          end_time: endTime,
          price: service.price,
          final_price: service.price,
          status: 'confirmed',
        });

      if (error) throw error;
      toast.success("Agendamento criado!");
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error creating appointment:", error);
      toast.error(error.message || "Erro ao criar agendamento");
    }
  };

  const updateStatus = async (id: string, status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show") => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      toast.success("Status atualizado!");

      // Serviço concluído: pede avaliação ao cliente deste agendamento. O servidor confere o salão e só envia
      // aos aparelhos vinculados a esse cliente (sem vínculo, ninguém recebe). Falha não bloqueia a mudança de status.
      if (status === 'completed' && salonId) {
        void sendPush({
          salon_id: salonId,
          type: 'rating_request',
          appointment_id: id,
          title: 'Como foi seu atendimento?',
          body: 'Avalie o serviço e ganhe pontos de fidelidade!',
        });
      }

      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar status");
    }
  };

  const pendingAppointments = appointments.filter(a => a.status === 'pending');

  const confirmAllPending = async () => {
    if (!pendingAppointments.length || batchBusy) return;
    setBatchBusy(true);
    try {
      const ids = pendingAppointments.map(a => a.id);
      const { error } = await supabase.from('appointments').update({ status: 'confirmed' }).in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} agendamento(s) confirmado(s)!`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao confirmar agendamentos");
    } finally {
      setBatchBusy(false);
    }
  };

  const rejectAllPending = async () => {
    if (!pendingAppointments.length || batchBusy) return;
    if (!window.confirm(`Recusar todos os ${pendingAppointments.length} agendamentos pendentes deste dia?`)) return;
    setBatchBusy(true);
    try {
      const ids = pendingAppointments.map(a => a.id);
      const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} agendamento(s) recusado(s).`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao recusar agendamentos");
    } finally {
      setBatchBusy(false);
    }
  };

  const resetForm = () => {
    setFormData({
      client_name: "",
      client_phone: "",
      service_id: "",
      professional_id: "",
      date: selectedDate,
      start_time: "09:00",
    });
  };

  const changeDate = (days: number) => {
    // Use T12:00:00 to avoid UTC midnight timezone offset shifting the date
    const date = new Date(selectedDate + 'T12:00:00');
    date.setDate(date.getDate() + days);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
  };

  const visibleAppointments = appointments.filter((a) =>
    (professionalFilter === "all" || a.professional_id === professionalFilter) &&
    (statusFilter === "all" || a.status === statusFilter)
  );
  const hasFilters = professionalFilter !== "all" || statusFilter !== "all";

  const timeSlots = [];
  for (let h = 8; h <= 20; h++) {
    timeSlots.push(`${String(h).padStart(2, '0')}:00`);
    timeSlots.push(`${String(h).padStart(2, '0')}:30`);
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3" role="status">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" aria-hidden></div>
          <p className="text-sm text-muted-foreground">Carregando agendamentos…</p>
        </div>
      </AdminLayout>
    );
  }

  if (!salonId) {
    return (
      <AdminLayout>
        <EmptyState
          icon={Calendar}
          title="Configure seu estabelecimento primeiro"
          description="Depois de cadastrar o estabelecimento você poderá criar e acompanhar agendamentos."
          action={
            <Button variant="brand" onClick={() => window.location.href = '/admin/settings'}>
              Configurar estabelecimento
            </Button>
          }
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div data-tour="appointments-header">
          <PageHeader
            className="mb-0"
            title="Agendamentos"
            description="Veja a agenda do dia, confirme atendimentos e acompanhe o status."
            actions={
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="brand" data-tour="appointments-new-button">
                <Plus size={18} className="mr-2" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md" data-tour="appointments-new-dialog">
              <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
                <DialogDescription>
                  Preencha os dados do agendamento
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="client_name">Nome do Cliente *</Label>
                  <Input
                    id="client_name"
                    data-tour="appointments-new-client"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    placeholder="Nome do cliente"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client_phone">Telefone</Label>
                  <Input
                    id="client_phone"
                    data-tour="appointments-new-phone"
                    value={formData.client_phone}
                    onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Serviço *</Label>
                  <Select
                    value={formData.service_id}
                    onValueChange={(value) => setFormData({ ...formData, service_id: value })}
                  >
                    <SelectTrigger data-tour="appointments-new-service">
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} - R$ {service.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Profissional *</Label>
                  <Select
                    value={formData.professional_id}
                    onValueChange={(value) => setFormData({ ...formData, professional_id: value })}
                  >
                    <SelectTrigger data-tour="appointments-new-professional">
                      <SelectValue placeholder="Selecione o profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals.map((pro) => (
                        <SelectItem key={pro.id} value={pro.id}>
                          {pro.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data *</Label>
                    <Input
                      id="date"
                      data-tour="appointments-new-date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Horário *</Label>
                    <Select
                      value={formData.start_time}
                      onValueChange={(value) => setFormData({ ...formData, start_time: value })}
                    >
                      <SelectTrigger data-tour="appointments-new-time">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="brand" onClick={handleSubmit} data-tour="appointments-new-save">
                  Criar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
            }
          />
        </div>

        {/* Tabs para alternar entre visualizações */}
        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="list" data-tour="appointments-list-tab">Lista do dia</TabsTrigger>
            <TabsTrigger value="calendar" data-tour="appointments-calendar-tab">Agenda Completa</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {/* Destaque: Aguardando sua confirmação */}
            {pendingAppointments.length > 0 && (
              <Card className="border-amber-500/40 bg-amber-500/10">
                <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" aria-hidden />
                    <div>
                      <p className="font-semibold text-sm sm:text-base text-foreground">
                        Aguardando sua confirmação ({pendingAppointments.length})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Clientes aguardando aprovação para os horários solicitados neste dia.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="brand" onClick={confirmAllPending} disabled={batchBusy}>
                      Confirmar todos ({pendingAppointments.length})
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={rejectAllPending} disabled={batchBusy}>
                      Recusar todos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Navegação de data: setas + seletor; no mobile o nome do dia vai para a linha de baixo */}
            <Card data-tour="appointments-date-navigation">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => changeDate(-1)} aria-label="Dia anterior">
                <ChevronLeft size={20} aria-hidden />
              </Button>
              <div className="flex flex-1 min-w-0 flex-col items-center gap-1 sm:flex-row sm:justify-center sm:gap-4">
                <Label htmlFor="appointments-date" className="sr-only">Data da agenda</Label>
                <div className="flex items-center gap-2">
                  <Calendar size={20} className="text-primary hidden sm:block" aria-hidden />
                  <Input
                    id="appointments-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
                <span className="text-sm sm:text-base text-foreground font-medium capitalize truncate">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  })}
                </span>
              </div>
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => changeDate(1)} aria-label="Próximo dia">
                <ChevronRight size={20} aria-hidden />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filtros do dia: profissional e status */}
        {appointments.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,240px)_minmax(0,200px)_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="appointments-filter-professional">Profissional</Label>
              <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
                <SelectTrigger id="appointments-filter-professional"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os profissionais</SelectItem>
                  {professionals.map((pro) => (
                    <SelectItem key={pro.id} value={pro.id}>{pro.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appointments-filter-status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="appointments-filter-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <Button variant="ghost" onClick={() => { setProfessionalFilter("all"); setStatusFilter("all"); }}>
                <X size={16} className="mr-2" aria-hidden />
                Limpar filtros
              </Button>
            )}
          </div>
        )}

        {/* Appointments List */}
        {appointments.length === 0 ? (
          <div data-tour="appointments-empty">
            <EmptyState
              icon={Calendar}
              title="Nenhum agendamento para esta data"
              description="Use as setas para ver outros dias ou crie um novo agendamento."
              action={<TrainingEmptyActions tourId="appointments" />}
            />
          </div>
        ) : (
          <div className="space-y-3" data-tour="appointments-list">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {hasFilters
                ? `${visibleAppointments.length} de ${appointments.length} agendamentos com os filtros aplicados`
                : `${appointments.length} ${appointments.length === 1 ? 'agendamento' : 'agendamentos'} neste dia`}
            </p>
            {visibleAppointments.length === 0 && (
              <EmptyState title="Nenhum agendamento com esses filtros" description="Altere o profissional ou o status, ou limpe os filtros." className="py-8" />
            )}
            {visibleAppointments.map((appointment) => (
              <Card key={appointment.id}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                      <div className="w-16 h-16 shrink-0 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center tabular-nums">
                        <span className="text-lg font-bold leading-none">{appointment.start_time?.slice(0, 5)}</span>
                        <span className="text-xs mt-1">até {appointment.end_time?.slice(0, 5)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground sm:text-lg truncate">
                          {appointment.client_name || 'Cliente'}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1 min-w-0">
                            <Clock size={14} aria-hidden />
                            <span className="truncate">{appointment.services?.name}</span>
                          </span>
                          <span className="flex items-center gap-1 min-w-0">
                            <User size={14} aria-hidden />
                            <span className="truncate">{appointment.professionals?.name}</span>
                          </span>
                        </div>
                        {appointment.client_phone && (
                          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <Phone size={14} aria-hidden />
                            {appointment.client_phone}
                          </p>
                        )}
                        {appointment.notes && (
                          <p className="text-xs text-muted-foreground mt-1 surface-2 px-2 py-1 rounded break-words">
                            Obs.: {appointment.notes}
                          </p>
                        )}
                        {/* Mobile: status e valor abaixo dos dados para não espremer o nome */}
                        <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
                          <AppointmentStatusBadge data-tour="appointments-status" status={appointment.status} />
                          <span className="text-sm font-semibold text-foreground tabular-nums">R$ {appointment.final_price.toFixed(2)}</span>
                          {appointment.status === 'pending' && (
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-emerald-700 border-emerald-600/30 hover:bg-emerald-50 dark:text-emerald-400" onClick={() => updateStatus(appointment.id, 'confirmed')}>
                                <Check size={12} className="mr-1" /> Confirmar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10" onClick={() => updateStatus(appointment.id, 'cancelled')}>
                                <X size={12} className="mr-1" /> Recusar
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      {appointment.status === 'pending' && (
                        <div className="hidden sm:flex items-center gap-1.5">
                          <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs text-emerald-700 border-emerald-600/30 hover:bg-emerald-50 dark:text-emerald-400" onClick={() => updateStatus(appointment.id, 'confirmed')}>
                            <Check size={14} className="mr-1" /> Confirmar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10" onClick={() => updateStatus(appointment.id, 'cancelled')}>
                            <X size={14} className="mr-1" /> Recusar
                          </Button>
                        </div>
                      )}
                      <AppointmentStatusBadge data-tour="appointments-status" status={appointment.status} className="hidden sm:inline-flex" />
                      <div className="text-right hidden sm:block">
                        <p className="font-bold text-foreground tabular-nums">
                          R$ {appointment.final_price.toFixed(2)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-tour="appointments-actions" aria-label="Ações do agendamento">
                            <MoreVertical size={18} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {/* Actions based on current status */}
                          {appointment.status === 'pending' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => updateStatus(appointment.id, 'confirmed')}
                                className="text-success"
                              >
                                <CheckCircle size={16} className="mr-2" />
                                Confirmar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateStatus(appointment.id, 'cancelled')}
                                className="text-destructive"
                              >
                                <XCircle size={16} className="mr-2" />
                                Recusar
                              </DropdownMenuItem>
                            </>
                          )}

                          {appointment.status === 'confirmed' && (
                            <>
                              <DropdownMenuItem
                                onClick={() => updateStatus(appointment.id, 'completed')}
                                className="text-success"
                              >
                                <Check size={16} className="mr-2" />
                                Marcar como Concluído
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateStatus(appointment.id, 'no_show')}
                                className="text-warning"
                              >
                                <UserX size={16} className="mr-2" />
                                Não Compareceu
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateStatus(appointment.id, 'cancelled')}
                                className="text-destructive"
                              >
                                <Ban size={16} className="mr-2" />
                                Cancelar
                              </DropdownMenuItem>
                            </>
                          )}

                          {(appointment.status === 'cancelled' || appointment.status === 'no_show') && (
                            <DropdownMenuItem
                              onClick={() => updateStatus(appointment.id, 'pending')}
                            >
                              <Edit size={16} className="mr-2" />
                              Reabrir (Pendente)
                            </DropdownMenuItem>
                          )}

                          {appointment.status === 'completed' && (
                            <DropdownMenuItem
                              onClick={() => updateStatus(appointment.id, 'confirmed')}
                            >
                              <Edit size={16} className="mr-2" />
                              Voltar para Confirmado
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />

                          {/* Contact options */}
                          {appointment.client_phone && (
                            <>
                              <DropdownMenuItem
                                onClick={() => window.open(`tel:${appointment.client_phone}`, '_blank')}
                              >
                                <Phone size={16} className="mr-2" />
                                Ligar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  const phone = appointment.client_phone?.replace(/\D/g, '');
                                  const message = encodeURIComponent(
                                    `Olá ${appointment.client_name}! Seu agendamento está ${statusLabels[appointment.status as keyof typeof statusLabels].toLowerCase()} para ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR')} às ${appointment.start_time?.slice(0, 5)}.`
                                  );
                                  window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
                                }}
                              >
                                <MessageCircle size={16} className="mr-2" />
                                WhatsApp
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
          </TabsContent>

          <TabsContent value="calendar">
            <EnhancedSalonCalendar />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Appointments;
