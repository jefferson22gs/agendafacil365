import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/icons/Logo";
import { EmptyState } from "@/components/ui/page-header";
import { AppointmentStatusBadge } from "@/components/admin/AppointmentStatusBadge";
import { toast } from "sonner";
import { 
  User,
  Calendar,
  Clock,
  History,
  Settings,
  LogOut,
  Save,
  Loader2,
  Star,
  DollarSign,
  MapPin
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AppointmentHistory {
  id: string;
  date: string;
  start_time: string;
  status: string;
  final_price: number;
  services: { name: string } | null;
  professionals: { name: string } | null;
  salons: { name: string; address: string | null } | null;
}

const ClientProfile = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'profile'>('history');
  const [appointments, setAppointments] = useState<AppointmentHistory[]>([]);
  const [profileData, setProfileData] = useState({
    full_name: '',
    phone: '',
  });
  const [stats, setStats] = useState({
    totalAppointments: 0,
    totalSpent: 0,
  });

  useEffect(() => {
    fetchClientData();
  }, [user]);

  const fetchClientData = async () => {
    if (!user) return;

    try {
      // Fetch profile
      if (profile) {
        setProfileData({
          full_name: profile.full_name || '',
          phone: profile.phone || '',
        });
      }

      // Fetch appointments
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id);

      if (clientData && clientData.length > 0) {
        const clientIds = clientData.map(c => c.id);

        const { data: appointmentsData } = await supabase
          .from('appointments')
          .select(`
            id,
            date,
            start_time,
            status,
            final_price,
            services:service_id (name),
            professionals:professional_id (name),
            salons:salon_id (name, address)
          `)
          .in('client_id', clientIds)
          .order('date', { ascending: false })
          .limit(20);

        setAppointments(appointmentsData || []);

        // Calculate stats
        const completed = appointmentsData?.filter(a => a.status === 'completed') || [];
        setStats({
          totalAppointments: completed.length,
          totalSpent: completed.reduce((sum, a) => sum + (a.final_price || 0), 0),
        });
      }
    } catch (error) {
      console.error("Error fetching client data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const displayName = profileData.full_name || profile?.full_name || user?.email?.split('@')[0] || 'Cliente';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3" role="status">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Carregando seu perfil…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 border-b border-border">
        <div className="container px-4">
          <div className="flex flex-wrap items-center justify-between gap-2 min-h-16 py-2">
            <Logo size="sm" />
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="brand" size="sm" onClick={() => navigate('/booking')}>
                <Calendar size={16} className="mr-2" aria-hidden />
                Novo Agendamento
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sair da conta">
                <LogOut size={20} aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 max-w-4xl mx-auto">
        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-3xl font-bold shrink-0" aria-hidden>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="text-center md:text-left flex-1 min-w-0">
                <h1 className="text-2xl font-semibold text-foreground break-words">
                  Olá, {displayName}!
                </h1>
                <p className="text-muted-foreground break-all">
                  {user?.email}
                </p>
              </div>
              <div className="flex gap-4">
                <div className="text-center px-4">
                  <p className="text-2xl font-bold text-foreground tabular-nums">{stats.totalAppointments}</p>
                  <p className="text-xs text-muted-foreground">Agendamentos</p>
                </div>
                <div className="text-center px-4 border-l border-border">
                  <p className="text-2xl font-bold text-primary tabular-nums">R$ {stats.totalSpent.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Total Gasto</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'history' ? 'brand' : 'outline'}
            onClick={() => setActiveTab('history')}
            className="flex-1 sm:flex-none"
            aria-pressed={activeTab === 'history'}
          >
            <History size={16} className="mr-2" aria-hidden />
            Histórico
          </Button>
          <Button
            variant={activeTab === 'profile' ? 'brand' : 'outline'}
            onClick={() => setActiveTab('profile')}
            className="flex-1 sm:flex-none"
            aria-pressed={activeTab === 'profile'}
          >
            <Settings size={16} className="mr-2" aria-hidden />
            Meus Dados
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === 'history' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History size={20} className="text-primary" aria-hidden />
                Histórico de Agendamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="Você ainda não tem agendamentos"
                  description="Quando você agendar um horário, ele aparecerá aqui."
                  className="border-0 bg-transparent py-8"
                  action={
                    <Button variant="brand" onClick={() => navigate('/booking')}>
                      Fazer Primeiro Agendamento
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {appointments.map((appointment) => (
                    <li
                      key={appointment.id}
                      className="p-4 rounded-xl surface-2 border border-border"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <AppointmentStatusBadge status={appointment.status} />
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(appointment.date), "dd 'de' MMM", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="font-medium text-foreground">
                            {appointment.services?.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock size={14} aria-hidden />
                              {appointment.start_time.slice(0, 5)}
                            </span>
                            <span className="flex items-center gap-1">
                              <User size={14} aria-hidden />
                              {appointment.professionals?.name || 'Profissional'}
                            </span>
                          </div>
                          {appointment.salons && (
                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                              <MapPin size={14} aria-hidden />
                              {appointment.salons.name}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-foreground tabular-nums">
                            R$ {appointment.final_price?.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === 'profile' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User size={20} className="text-primary" aria-hidden />
                Meus Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome Completo</Label>
                <Input
                  id="full_name"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  placeholder="Seu nome"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="opacity-60"
                />
                <p className="text-xs text-muted-foreground">
                  O e-mail não pode ser alterado
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <Button 
                variant="brand" 
                className="w-full mt-6"
                onClick={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 size={16} className="mr-2 animate-spin" aria-hidden />
                ) : (
                  <Save size={16} className="mr-2" aria-hidden />
                )}
                Salvar Alterações
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ClientProfile;
