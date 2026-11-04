import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Upload, Building2, Link2, Copy, ExternalLink, Globe, Bell, Camera } from "lucide-react";
import { NotificationSettings } from "@/components/pwa/NotificationPrompt";
import { useMarkLinkShared } from "@/features/training/useFirstSteps";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DEFAULT_TENANT_COLOR } from "@/config/brand";
import { PageHeader } from "@/components/ui/page-header";

interface SalonData {
  id?: string;
  name: string;
  business_name: string;
  cnpj: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  opening_time: string;
  closing_time: string;
  working_days: number[];
  primary_color: string;
  logo_url: string;
  slug: string;
  description: string;
  public_booking_enabled: boolean;
  pix_key?: string;
  lunch_break_config: {
    enabled: boolean;
    start_time: string;
    end_time: string;
    days: number[];
  };
  working_hours?: Record<string, { isOpen: boolean; start: string; end: string }>;
}

const defaultSalon: SalonData = {
  name: "",
  business_name: "",
  cnpj: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  opening_time: "09:00",
  closing_time: "19:00",
  working_days: [1, 2, 3, 4, 5, 6],
  primary_color: DEFAULT_TENANT_COLOR,
  logo_url: "",
  slug: "",
  description: "",
  public_booking_enabled: true,
  lunch_break_config: {
    enabled: false,
    start_time: "12:00",
    end_time: "13:00",
    days: [1, 2, 3, 4, 5],
  },
  working_hours: {},
};

const weekDays = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const SalonSettings = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const markLinkShared = useMarkLinkShared();
  const [salon, setSalon] = useState<SalonData>(defaultSalon);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [activeLogoTab, setActiveLogoTab] = useState("link");

  // Camera refs for logo
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    fetchSalon();
    return () => {
      // Cleanup camera on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [user]);

  const fetchSalon = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('salons')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSalon({
          id: data.id,
          name: data.name || "",
          business_name: data.business_name || "",
          cnpj: data.cnpj || "",
          phone: data.phone || "",
          whatsapp: data.whatsapp || "",
          email: data.email || "",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          zip_code: data.zip_code || "",
          opening_time: data.opening_time || "09:00",
          closing_time: data.closing_time || "19:00",
          working_days: data.working_days || [1, 2, 3, 4, 5, 6],
          // Fallback só para cor ausente/vazia; cor já salva pelo estabelecimento é mantida como está.
          primary_color: data.primary_color || DEFAULT_TENANT_COLOR,
          logo_url: data.logo_url || "",
          slug: data.slug || "",
          description: data.description || "",
          public_booking_enabled: data.public_booking_enabled ?? true,
          pix_key: data.pix_key || "",
          lunch_break_config: typeof data.lunch_break_config === 'object' ? data.lunch_break_config : defaultSalon.lunch_break_config,
          working_hours: data.working_hours || null
        });

        // Initialize working_hours from legacy if needed
        if (!data.working_hours) {
          const legacyHours: any = {};
          weekDays.forEach(day => {
            legacyHours[day.value] = {
              isOpen: (data.working_days || []).includes(day.value),
              start: data.opening_time || "09:00",
              end: data.closing_time || "19:00"
            };
          });
          setSalon(prev => ({ ...prev, working_hours: legacyHours }));
        }

        setIsNew(false);
      }
    } catch (error) {
      console.error("Error fetching salon:", error);
      toast.error("Erro ao carregar dados do estabelecimento");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!salon.name.trim()) {
      toast.error("Nome do estabelecimento é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const salonData = {
        name: salon.name,
        business_name: salon.business_name || null,
        cnpj: salon.cnpj || null,
        phone: salon.phone || null,
        whatsapp: salon.whatsapp || null,
        email: salon.email || null,
        address: salon.address || null,
        city: salon.city || null,
        state: salon.state || null,
        zip_code: salon.zip_code || null,
        opening_time: salon.opening_time || "09:00",
        closing_time: salon.closing_time || "19:00",
        working_days: salon.working_days,
        primary_color: salon.primary_color,
        logo_url: salon.logo_url || null,
        slug: salon.slug || null,
        description: salon.description || null,
        public_booking_enabled: salon.public_booking_enabled,
        pix_key: salon.pix_key || null,
        lunch_break_config: salon.lunch_break_config,
        working_hours: salon.working_hours,
        owner_id: user.id,
      };

      if (isNew) {
        const { data, error } = await supabase
          .from('salons')
          .insert(salonData)
          .select()
          .single();

        if (error) throw error;

        setSalon({ ...salon, id: data.id });
        setIsNew(false);
        toast.success("Estabelecimento criado com sucesso!");
      } else {
        const { error } = await supabase
          .from('salons')
          .update(salonData)
          .eq('id', salon.id);

        if (error) throw error;
        toast.success("Configurações salvas com sucesso!");
      }
    } catch (error: any) {
      console.error("Error saving salon:", error);
      toast.error(error.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !salon.id) return;

    const file = event.target.files[0];

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2MB.");
      return;
    }

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      toast.error("Apenas imagens são permitidas.");
      return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${salon.id}/logo-${Date.now()}.${fileExt}`;

    setUploadingLogo(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('gallery')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error details:", uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('gallery')
        .getPublicUrl(fileName);

      setSalon(prev => ({ ...prev, logo_url: publicUrl }));
      toast.success("Logo enviado com sucesso!");
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      toast.error(`Erro ao enviar logo: ${error.message || 'Verifique as permissões do bucket gallery'}`);
    } finally {
      setUploadingLogo(false);
    }
  };

  const startCamera = async () => {
    setCameraActive(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      // Wait a bit for the video element to be available in DOM
      setTimeout(() => {
        const videoElement = document.getElementById('logo-camera-video') as HTMLVideoElement;
        if (videoElement) {
          videoElement.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Erro ao acessar a câmera");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    const videoElement = document.getElementById('logo-camera-video') as HTMLVideoElement;
    const canvasElement = document.createElement('canvas');
    if (videoElement && stream) {
      canvasElement.width = videoElement.videoWidth;
      canvasElement.height = videoElement.videoHeight;
      const ctx = canvasElement.getContext('2d');
      if (ctx && salon.id) {
        ctx.drawImage(videoElement, 0, 0);

        canvasElement.toBlob(async (blob) => {
          if (!blob) return;

          const fileName = `${salon.id}/logo-capture-${Date.now()}.jpg`;
          setUploadingLogo(true);

          try {
            const { error: uploadError } = await supabase.storage
              .from('gallery')
              .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('gallery')
              .getPublicUrl(fileName);

            setSalon(prev => ({ ...prev, logo_url: publicUrl }));
            toast.success("Foto do logo capturada!");
            stopCamera();
          } catch (error) {
            console.error("Error uploading capture:", error);
            toast.error("Erro ao salvar foto.");
          } finally {
            setUploadingLogo(false);
          }
        }, 'image/jpeg');
      }
    }
  };

  const toggleWorkingDay = (day: number) => {
    if (salon.working_days.includes(day)) {
      setSalon({ ...salon, working_days: salon.working_days.filter(d => d !== day) });
    } else {
      setSalon({ ...salon, working_days: [...salon.working_days, day].sort() });
    }
  };

  const getPublicLink = () => {
    if (!salon.slug) return "";
    return `${window.location.origin}/s/${salon.slug}`;
  };

  const copyLink = async () => {
    const link = getPublicLink();
    if (link) {
      try {
        await navigator.clipboard.writeText(link);
      } catch (error) {
        console.error("Error copying public link:", error);
        toast.error("Não foi possível copiar o link");
        return;
      }
      toast.success("Link copiado!");
      void markLinkShared();
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3" role="status">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" aria-hidden></div>
          <p className="text-sm text-muted-foreground">Carregando configurações…</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div data-tour="settings-header">
          <PageHeader
            className="mb-0"
            title={isNew ? "Configurar estabelecimento" : "Configurações do estabelecimento"}
            description={isNew ? "Cadastre os dados do seu estabelecimento para começar." : "Gerencie as informações, horários e a aparência do seu estabelecimento."}
            actions={
              <Button variant="brand" onClick={handleSave} disabled={saving} data-tour="settings-save">
                <Save size={18} className="mr-2" aria-hidden />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            }
          />
        </div>

        {/* Link Público - Card em destaque */}
        {!isNew && salon.slug && (
          <Card className="border-primary/30 bg-primary/5" data-tour="settings-public-link">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe size={20} className="text-primary" />
                Link Público de Agendamento
              </CardTitle>
              <CardDescription>
                Compartilhe este link com seus clientes para que eles possam agendar online
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 bg-background border border-border rounded-lg px-4 py-3 font-mono text-sm truncate" data-tour="settings-public-link-url">
                  {getPublicLink()}
                </div>
                <Button variant="outline" size="icon" onClick={copyLink} title="Copiar link" aria-label="Copiar link" data-tour="settings-public-link-copy">
                  <Copy size={18} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const openedWindow = window.open(getPublicLink(), '_blank');
                    if (openedWindow) void markLinkShared();
                  }}
                  title="Abrir em nova aba"
                  aria-label="Abrir link em nova aba"
                  data-tour="settings-public-link-open"
                >
                  <ExternalLink size={18} />
                </Button>
              </div>

              <div className="flex items-center justify-between" data-tour="settings-public-booking-toggle">
                <div className="space-y-1">
                  <Label htmlFor="public_booking">Agendamento Online Ativo</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando desativado, clientes verão uma mensagem de indisponibilidade
                  </p>
                </div>
                <Switch
                  id="public_booking"
                  checked={salon.public_booking_enabled}
                  onCheckedChange={(checked) => setSalon({ ...salon, public_booking_enabled: checked })}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Informações Básicas */}
          <Card data-tour="settings-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 size={20} className="text-primary" />
                Informações Básicas
              </CardTitle>
              <CardDescription>Dados principais do seu estabelecimento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2" data-tour="settings-name">
                <Label htmlFor="name">Nome do estabelecimento *</Label>
                <Input
                  id="name"
                  value={salon.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setSalon({
                      ...salon,
                      name: newName,
                      slug: salon.slug || generateSlug(newName)
                    });
                  }}
                  placeholder="Ex: Barbearia Premium"
                />
              </div>
              <div className="space-y-2" data-tour="settings-slug">
                <Label htmlFor="slug">Slug do Link Público</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/s/</span>
                  <Input
                    id="slug"
                    value={salon.slug}
                    onChange={(e) => setSalon({ ...salon, slug: generateSlug(e.target.value) })}
                    placeholder="meu-salao"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Este será o endereço do seu link de agendamento
                </p>
              </div>
              <div className="space-y-2" data-tour="settings-description">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={salon.description}
                  onChange={(e) => setSalon({ ...salon, description: e.target.value })}
                  placeholder="Breve descrição do seu estabelecimento para exibir na página pública"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_name">Razão Social</Label>
                <Input
                  id="business_name"
                  value={salon.business_name}
                  onChange={(e) => setSalon({ ...salon, business_name: e.target.value })}
                  placeholder="Ex: Barbearia Premium LTDA"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={salon.cnpj}
                  onChange={(e) => setSalon({ ...salon, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="grid grid-cols-2 gap-4" data-tour="settings-contact">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={salon.phone}
                    onChange={(e) => setSalon({ ...salon, phone: e.target.value })}
                    placeholder="(00) 0000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={salon.whatsapp}
                    onChange={(e) => setSalon({ ...salon, whatsapp: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div className="space-y-2" data-tour="settings-pix">
                <Label htmlFor="pix_key">Chave PIX</Label>
                <Input
                  id="pix_key"
                  value={salon.pix_key || ''}
                  onChange={(e) => setSalon({ ...salon, pix_key: e.target.value })}
                  placeholder="CPF, CNPJ, Email, Telefone ou Chave Aleatória"
                />
                <p className="text-xs text-muted-foreground">
                  Será exibida na confirmação de agendamento para pagamento
                </p>
              </div>
              <div className="space-y-2" data-tour="settings-email">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={salon.email}
                  onChange={(e) => setSalon({ ...salon, email: e.target.value })}
                  placeholder="contato@seudominio.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Endereço */}
          <Card data-tour="settings-address">
            <CardHeader>
              <CardTitle>Endereço</CardTitle>
              <CardDescription>Localização do seu estabelecimento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={salon.address}
                  onChange={(e) => setSalon({ ...salon, address: e.target.value })}
                  placeholder="Rua, número, bairro"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={salon.city}
                    onChange={(e) => setSalon({ ...salon, city: e.target.value })}
                    placeholder="Sua cidade"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={salon.state}
                    onChange={(e) => setSalon({ ...salon, state: e.target.value })}
                    placeholder="UF"
                    maxLength={2}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip_code">CEP</Label>
                <Input
                  id="zip_code"
                  value={salon.zip_code}
                  onChange={(e) => setSalon({ ...salon, zip_code: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
            </CardContent>
          </Card>

          {/* Horário de Funcionamento */}
          <Card data-tour="settings-hours">
            <CardHeader>
              <CardTitle>Horário de Funcionamento</CardTitle>
              <CardDescription>Configure os dias e horários de atendimento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <Label>Configuração Semanal</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-tour="settings-hours-copy-monday"
                    onClick={() => {
                      const monday = salon.working_hours?.["1"];
                      if (monday) {
                        const newHours = { ...salon.working_hours };
                        weekDays.forEach(d => {
                          if (d.value !== 1) newHours[d.value] = { ...monday };
                        });
                        setSalon({ ...salon, working_hours: newHours });
                        toast.success("Horário de segunda aplicado para todos!");
                      }
                    }}
                  >
                    Copiar de Segunda para Todos
                  </Button>
                </div>

                <div className="space-y-3" data-tour="settings-hours-days">
                  {weekDays.map((day) => {
                    const dayConfig = salon.working_hours?.[day.value] || { isOpen: false, start: "09:00", end: "19:00" };
                    return (
                      <div key={day.value} className="flex items-center gap-4 p-2 rounded-lg hover:bg-secondary/20 transition-colors">
                        <div className="w-24 flex items-center gap-2">
                          <Switch
                            checked={dayConfig.isOpen}
                            onCheckedChange={(checked) => {
                              const newHours = { ...salon.working_hours };
                              newHours[day.value] = { ...dayConfig, isOpen: checked };
                              setSalon({ ...salon, working_hours: newHours });
                            }}
                          />
                          <span className={`font-medium ${dayConfig.isOpen ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {day.label}
                          </span>
                        </div>

                        {dayConfig.isOpen ? (
                          <div className="flex items-center gap-2 flex-1 animate-in fade-in slide-in-from-left-2">
                            <Input
                              type="time"
                              className="w-24 h-8"
                              value={dayConfig.start}
                              onChange={(e) => {
                                const newHours = { ...salon.working_hours };
                                newHours[day.value] = { ...dayConfig, start: e.target.value };
                                setSalon({ ...salon, working_hours: newHours });
                              }}
                            />
                            <span className="text-muted-foreground">às</span>
                            <Input
                              type="time"
                              className="w-24 h-8"
                              value={dayConfig.end}
                              onChange={(e) => {
                                const newHours = { ...salon.working_hours };
                                newHours[day.value] = { ...dayConfig, end: e.target.value };
                                setSalon({ ...salon, working_hours: newHours });
                              }}
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground italic flex-1">Fechado</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lunch Break Section */}
              <div className="pt-4 border-t border-border mt-4" data-tour="settings-hours-lunch">
                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-1">
                    <Label>Pausa para Almoço</Label>
                    <p className="text-sm text-muted-foreground">
                      Bloquear agendamentos durante o horário de almoço
                    </p>
                  </div>
                  <Switch
                    checked={salon.lunch_break_config.enabled}
                    onCheckedChange={(checked) => setSalon({
                      ...salon,
                      lunch_break_config: { ...salon.lunch_break_config, enabled: checked }
                    })}
                  />
                </div>

                {salon.lunch_break_config.enabled && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Início</Label>
                        <Input
                          type="time"
                          value={salon.lunch_break_config.start_time}
                          onChange={(e) => setSalon({
                            ...salon,
                            lunch_break_config: { ...salon.lunch_break_config, start_time: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Fim</Label>
                        <Input
                          type="time"
                          value={salon.lunch_break_config.end_time}
                          onChange={(e) => setSalon({
                            ...salon,
                            lunch_break_config: { ...salon.lunch_break_config, end_time: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Aplicar nos dias</Label>
                      <div className="flex flex-wrap gap-2">
                        {weekDays.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => {
                              const currentDays = salon.lunch_break_config.days;
                              const newDays = currentDays.includes(day.value)
                                ? currentDays.filter(d => d !== day.value)
                                : [...currentDays, day.value].sort();
                              setSalon({
                                ...salon,
                                lunch_break_config: { ...salon.lunch_break_config, days: newDays }
                              });
                            }}
                            className={`
                              px-3 py-1 text-sm rounded-lg font-medium transition-all
                              ${salon.lunch_break_config.days.includes(day.value)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                              }
                            `}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Personalização */}
          <Card data-tour="settings-branding">
            <CardHeader>
              <CardTitle>Personalização</CardTitle>
              <CardDescription>Personalize a aparência do seu estabelecimento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2" data-tour="settings-branding-color">
                <Label htmlFor="primary_color">Cor Principal</Label>
                <div className="flex gap-3">
                  <input
                    type="color"
                    id="primary_color"
                    value={salon.primary_color}
                    onChange={(e) => setSalon({ ...salon, primary_color: e.target.value })}
                    className="w-12 h-12 rounded-lg border-0 cursor-pointer"
                  />
                  <Input
                    value={salon.primary_color}
                    onChange={(e) => setSalon({ ...salon, primary_color: e.target.value })}
                    placeholder={DEFAULT_TENANT_COLOR}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2" data-tour="settings-branding-logo">
                <Label htmlFor="logo_url">Logo do estabelecimento</Label>

                <div className="p-4 border rounded-lg bg-secondary/10">
                  <Tabs value={activeLogoTab} onValueChange={setActiveLogoTab}>
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                      <TabsTrigger value="link" data-tour="settings-logo-link-tab">Link URL</TabsTrigger>
                      <TabsTrigger value="upload" data-tour="settings-logo-upload-tab">Upload</TabsTrigger>
                      <TabsTrigger value="camera" data-tour="settings-logo-camera-tab">Câmera</TabsTrigger>
                    </TabsList>

                    <TabsContent value="link" className="space-y-2">
                      <Input
                        id="logo_url"
                        value={salon.logo_url}
                        onChange={(e) => setSalon({ ...salon, logo_url: e.target.value })}
                        placeholder="https://..."
                      />
                    </TabsContent>

                    <TabsContent value="upload" className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                      />
                      {uploadingLogo && <p className="text-xs text-muted-foreground">Enviando...</p>}
                    </TabsContent>

                    <TabsContent value="camera" className="space-y-2">
                      {!cameraActive ? (
                        <Button type="button" variant="outline" onClick={startCamera} className="w-full">
                          <Camera size={18} className="mr-2" />
                          Abrir Câmera
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                            <video id="logo-camera-video" autoPlay playsInline className="w-full h-full object-cover"></video>
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="ghost" onClick={stopCamera} className="flex-1">Cancelar</Button>
                            <Button type="button" onClick={capturePhoto} className="flex-1">Capturar</Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  {salon.logo_url && (
                    <div className="mt-4 p-4 bg-secondary rounded-lg flex items-center justify-center">
                      <img
                        src={salon.logo_url}
                        alt="Logo preview"
                        className="max-h-32 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notificações Push */}
          <Card className="md:col-span-2" data-tour="settings-notifications">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell size={20} className="text-primary" />
                Notificações Push
              </CardTitle>
              <CardDescription>
                Receba alertas de novos agendamentos e lembretes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationSettings />
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SalonSettings;
