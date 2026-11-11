import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Clock,
    Scissors,
    Calendar as CalendarIcon,
    Loader2,
    Phone,
    MapPin,
    MessageCircle,
    AlertCircle,
    Star,
    Camera,
    Instagram,
    User,
    Store
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { safeHexColor } from "@/config/brand";
import { accessibleBackground, textOnColor } from '../../api/_pwa';
import { useSalonHead } from '@/components/pwa/useSalonHead';
import { SalonLogo } from '@/components/pwa/SalonLogo';
import { useAuth } from '@/hooks/useAuth';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

interface Professional {
    id: string;
    name: string;
    specialty: string | null;
    avatar_url: string | null;
    bio: string | null;
    instagram: string | null;
    working_hours: { start: string; end: string } | null;
    working_days: number[] | null;
    slug: string;
}

interface Salon {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    whatsapp: string | null;
    primary_color: string | null;
    logo_url: string | null;
    slug: string;
}

interface Service {
    id: string;
    name: string;
    description: string | null;
    price: number;
    duration_minutes: number;
    icon: string | null;
}

interface GalleryImage {
    id: string;
    before_image_url: string | null;
    after_image_url: string | null;
    description: string | null;
    created_at: string;
    service_name?: string;
}

interface CartItem {
    id: string;
    name: string;
    price: number;
    duration_minutes: number;
}

const PublicProfessional = () => {
    const { salonSlug, professionalSlug } = useParams();
    const navigate = useNavigate();

    const [salon, setSalon] = useState<Salon | null>(null);
    const [professional, setProfessional] = useState<Professional | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    const [gallery, setGallery] = useState<GalleryImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<'services' | 'gallery' | 'about'>('services');
    const [step, setStep] = useState(1);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [selectedTime, setSelectedTime] = useState("");
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    const [clientName, setClientName] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [clientBirthday, setClientBirthday] = useState("");
    const [allowPhotos, setAllowPhotos] = useState(false);
    const [showTerms, setShowTerms] = useState(false);

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (salonSlug && professionalSlug) {
            loadData();
        }
    }, [salonSlug, professionalSlug]);

    const loadData = async () => {
        setLoading(true);
        setError(null);

        try {
            // Buscar salão pelo slug
            const { data: salonData, error: salonError } = await supabase
                .from('salons')
                .select('*')
                .eq('slug', salonSlug)
                .eq('is_active', true)
                .maybeSingle();

            if (salonError || !salonData) {
                setError("Estabelecimento não encontrado");
                setLoading(false);
                return;
            }

            setSalon({
                id: salonData.id,
                name: salonData.name,
                address: salonData.address,
                city: salonData.city,
                state: salonData.state,
                phone: salonData.phone,
                whatsapp: salonData.whatsapp,
                primary_color: salonData.primary_color,
                logo_url: salonData.logo_url,
                slug: salonData.slug || '',
            });

            // Buscar profissional pelo slug
            const { data: professionalData, error: professionalError } = await supabase
                .from('professionals')
                .select('*')
                .eq('salon_id', salonData.id)
                .eq('slug', professionalSlug)
                .eq('is_active', true)
                .maybeSingle();

            if (professionalError || !professionalData) {
                setError("Profissional não encontrado");
                setLoading(false);
                return;
            }

            setProfessional({
                id: professionalData.id,
                name: professionalData.name,
                specialty: professionalData.specialty,
                avatar_url: professionalData.avatar_url,
                bio: professionalData.bio,
                instagram: professionalData.instagram,
                working_hours: professionalData.working_hours as { start: string; end: string } | null,
                working_days: professionalData.working_days,
                slug: professionalData.slug || '',
            });

            // Buscar serviços do salão
            const { data: servicesData } = await supabase
                .from('services')
                .select('id, name, description, price, duration_minutes, icon')
                .eq('salon_id', salonData.id)
                .eq('is_active', true)
                .order('name');

            if (servicesData) setServices(servicesData);

            // Buscar galeria do profissional
            const { data: galleryData } = await supabase
                .from('client_gallery')
                .select(`
          id,
          before_image_url,
          after_image_url,
          description,
          created_at,
          services:service_id (name)
        `)
                .eq('salon_id', salonData.id)
                .eq('professional_id', professionalData.id)
                .eq('visibility', 'public')
                .order('created_at', { ascending: false })
                .limit(20);

            if (galleryData) {
                setGallery(galleryData.map((g: any) => ({
                    id: g.id,
                    before_image_url: g.before_image_url,
                    after_image_url: g.after_image_url,
                    description: g.description,
                    created_at: g.created_at,
                    service_name: g.services?.name,
                })));
            }

        } catch (err) {
            console.error("Error loading data:", err);
            setError("Erro ao carregar dados");
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (service: Service) => {
        if (cart.some(c => c.id === service.id)) return;
        setCart([...cart, {
            id: service.id,
            name: service.name,
            price: service.price,
            duration_minutes: service.duration_minutes,
        }]);
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(c => c.id !== id));
    };

    const isInCart = (id: string) => cart.some(c => c.id === id);

    const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);
    const cartDuration = cart.reduce((sum, item) => sum + item.duration_minutes, 0);

    useEffect(() => {
        if (selectedDate && cart.length > 0 && professional && salon) {
            fetchAvailableSlots();
        }
    }, [selectedDate, cart.length]);

    const fetchAvailableSlots = async () => {
        if (!selectedDate || cart.length === 0 || !professional || !salon) return;

        setLoadingSlots(true);
        setSelectedTime("");

        try {
            const dateStr = selectedDate.toISOString().split('T')[0];
            const dayOfWeek = selectedDate.getDay();

            // Verificar dias de trabalho do profissional
            const workingDays = professional.working_days || [1, 2, 3, 4, 5, 6];
            if (!workingDays.includes(dayOfWeek)) {
                setAvailableSlots([]);
                setLoadingSlots(false);
                return;
            }

            // Horários do profissional
            const workingHours = professional.working_hours || { start: '09:00', end: '19:00' };
            const [openHour, openMin] = workingHours.start.split(':').map(Number);
            const [closeHour, closeMin] = workingHours.end.split(':').map(Number);

            const slots: string[] = [];
            let currentTime = openHour * 60 + openMin;
            const endTime = closeHour * 60 + closeMin - cartDuration;

            // Filtrar horários passados para hoje
            const now = new Date();
            const isToday = selectedDate.toDateString() === now.toDateString();
            const currentMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : 0;

            while (currentTime <= endTime) {
                if (!isToday || currentTime > currentMinutes + 30) {
                    const hours = Math.floor(currentTime / 60);
                    const minutes = currentTime % 60;
                    slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
                }
                currentTime += 30;
            }

            // Buscar agendamentos existentes do profissional
            const { data: existingAppointments } = await supabase
                .from('appointments')
                .select('start_time, end_time')
                .eq('salon_id', salon.id)
                .eq('professional_id', professional.id)
                .eq('date', dateStr)
                .in('status', ['pending', 'confirmed']);

            // Filtrar slots ocupados
            const available = slots.filter(slot => {
                const slotMinutes = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]);
                const slotEnd = `${Math.floor((slotMinutes + cartDuration) / 60).toString().padStart(2, '0')}:${((slotMinutes + cartDuration) % 60).toString().padStart(2, '0')}`;

                const hasConflict = existingAppointments?.some((apt: any) => {
                    return (slot < apt.end_time && slotEnd > apt.start_time);
                });

                return !hasConflict;
            });

            setAvailableSlots(available);
        } catch (err) {
            console.error("Error fetching slots:", err);
            toast.error("Erro ao buscar horários");
        } finally {
            setLoadingSlots(false);
        }
    };

    const isDateDisabled = (date: Date) => {
        const today = startOfDay(new Date());
        if (isBefore(date, today)) return true;

        if (professional?.working_days) {
            const dayOfWeek = date.getDay();
            return !professional.working_days.includes(dayOfWeek);
        }
        return false;
    };

    const handleConfirmBooking = async () => {
        if (cart.length === 0 || !selectedDate || !selectedTime || !clientName.trim() || !clientPhone.trim() || !salon || !professional) {
            toast.error("Preencha todos os campos obrigatórios");
            return;
        }

        setSubmitting(true);
        try {
            const [hours, minutes] = selectedTime.split(':').map(Number);
            const endMinutes = hours * 60 + minutes + cartDuration;
            const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

            const mainService = cart[0];
            const additionalNotesArray = [];
            if (cart.length > 1) {
                additionalNotesArray.push(`Serviços: ${cart.map(s => s.name).join(', ')}`);
            }
            if (allowPhotos) {
                additionalNotesArray.push('✅ CLIENTE AUTORIZOU FOTOS ANTES/DEPOIS');
            }

            const additionalNotes = additionalNotesArray.length > 0 ? additionalNotesArray.join(' | ') : null;

            const { error } = await supabase
                .from('appointments')
                .insert({
                    salon_id: salon.id,
                    service_id: mainService.id,
                    professional_id: professional.id,
                    date: format(selectedDate, 'yyyy-MM-dd'),
                    start_time: selectedTime,
                    end_time: endTime,
                    client_name: clientName.trim(),
                    client_phone: clientPhone.trim(),
                    price: cartTotal,
                    final_price: cartTotal,
                    status: 'pending',
                    notes: additionalNotes,
                });

            if (error) throw error;

            // Criar/atualizar cliente
            try {
                const { data: existingClient } = await supabase
                    .from('clients')
                    .select('id, total_visits, total_spent')
                    .eq('salon_id', salon.id)
                    .eq('phone', clientPhone.trim())
                    .maybeSingle();

                if (existingClient) {
                    await supabase
                        .from('clients')
                        .update({
                            name: clientName.trim(),
                            total_visits: (existingClient.total_visits || 0) + 1,
                            total_spent: (existingClient.total_spent || 0) + cartTotal,
                            last_visit_at: new Date().toISOString(),
                        })
                        .eq('id', existingClient.id);
                } else {
                    await supabase
                        .from('clients')
                        .insert({
                            salon_id: salon.id,
                            name: clientName.trim(),
                            phone: clientPhone.trim(),
                            total_visits: 1,
                            total_spent: cartTotal,
                            last_visit_at: new Date().toISOString(),
                        });
                }
            } catch (clientError) {
                console.error("Error creating client:", clientError);
            }

            toast.success("Agendamento realizado com sucesso!");
            setStep(4); // Success step

        } catch (err: any) {
            console.error("Error creating appointment:", err);
            toast.error(err.message || "Erro ao criar agendamento");
        } finally {
            setSubmitting(false);
        }
    };

    // Cor do estabelecimento (só HEX válido; ausente/inválida cai no azul padrão)
    useSalonHead(salon);
    const primaryColor = accessibleBackground(safeHexColor(salon?.primary_color));
    const primaryForeground = textOnColor(primaryColor);
    const primaryText = 'var(--tenant-text, currentColor)';

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryText }} aria-hidden="true" />
                <span className="sr-only">Carregando</span>
            </div>
        );
    }

    if (error || !salon || !professional) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="text-center max-w-md" role="alert">
                    <AlertCircle size={48} className="mx-auto text-destructive mb-4" aria-hidden="true" />
                    <h1 className="text-2xl font-bold text-foreground mb-2">Ops!</h1>
                    <p className="text-muted-foreground mb-6">{error || "Página não encontrada"}</p>
                    <Button onClick={() => navigate(`/s/${salonSlug}`)}>Voltar ao estabelecimento</Button>
                </div>
            </div>
        );
    }

    // Success step
    if (step === 4) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div
                        className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${primaryColor}20` }}
                    >
                        <Check size={40} style={{ color: primaryText }} />
                    </div>
                    <h1 className="font-display text-3xl font-bold text-foreground mb-4">
                        Agendamento Confirmado!
                    </h1>
                    <p className="text-muted-foreground mb-6">
                        Seu agendamento com <strong>{professional.name}</strong> foi realizado com sucesso!
                    </p>
                    <div className="bg-card border border-border rounded-2xl p-6 mb-6 text-left">
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Profissional</span>
                                <span className="font-medium text-foreground">{professional.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Serviços</span>
                                <span className="font-medium text-foreground text-right">
                                    {cart.map(s => s.name).join(', ')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Data</span>
                                <span className="font-medium text-foreground">
                                    {selectedDate && format(selectedDate, "dd/MM/yyyy")}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Horário</span>
                                <span className="font-medium text-foreground">{selectedTime}</span>
                            </div>
                            <div className="border-t border-border pt-3 mt-3">
                                <div className="flex justify-between">
                                    <span className="font-medium text-foreground">Total</span>
                                    <span className="text-xl font-bold" style={{ color: primaryText }}>
                                        R$ {cartTotal.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                        <Button variant="outline" onClick={() => navigate(`/s/${salonSlug}`)}>
                            Voltar ao estabelecimento
                        </Button>
                        {salon.whatsapp && (
                            <Button
                                style={{ backgroundColor: '#25D366' }}
                                onClick={() => window.open(`https://wa.me/55${salon.whatsapp?.replace(/\D/g, '')}`, '_blank')}
                            >
                                <MessageCircle className="w-4 h-4 mr-2" />
                                WhatsApp
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header com foto do profissional */}
            <div className="relative bg-gradient-to-b from-card to-background border-b border-border">
                <div className="container mx-auto px-4 py-8">
                    {/* Voltar ao salão */}
                    <Link
                        to={`/s/${salonSlug}`}
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
                    >
                        <ArrowLeft size={16} />
                        <SalonLogo salon={salon} className="w-10 h-10 rounded-lg" />
                        Voltar para {salon.name}
                    </Link>

                    <div className="flex flex-col md:flex-row items-center gap-6">
                        {/* Avatar do profissional */}
                        {professional.avatar_url ? (
                            <img
                                src={professional.avatar_url}
                                alt={professional.name}
                                className="w-28 h-28 rounded-full object-cover border-4"
                                style={{ borderColor: primaryColor }}
                            />
                        ) : (
                            <div
                                className="w-28 h-28 rounded-full flex items-center justify-center text-4xl font-bold"
                                style={{ backgroundColor: `${primaryColor}20`, color: primaryText }}
                            >
                                {professional.name.charAt(0)}
                            </div>
                        )}

                        <div className="text-center md:text-left flex-1">
                            <h1 className="text-3xl font-bold text-foreground">{professional.name}</h1>
                            {professional.specialty && (
                                <p className="text-lg text-muted-foreground mt-1">{professional.specialty}</p>
                            )}

                            <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
                                {professional.instagram && (
                                    <a
                                        href={`https://instagram.com/${professional.instagram.replace('@', '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90"
                                    >
                                        <Instagram size={14} />
                                        {professional.instagram}
                                    </a>
                                )}
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    <Store size={12} />
                                    {salon.name}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Conteúdo principal */}
            <div className="container mx-auto px-4 py-8">
                {step === 1 && (
                    <div className="max-w-4xl mx-auto">
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                            <TabsList className="grid w-full grid-cols-3 mb-6 h-auto">
                                <TabsTrigger value="services" className="flex items-center gap-2">
                                    <Scissors size={16} />
                                    Serviços
                                </TabsTrigger>
                                <TabsTrigger value="gallery" className="flex items-center gap-2">
                                    <Camera size={16} />
                                    Galeria
                                </TabsTrigger>
                                <TabsTrigger value="about" className="flex items-center gap-2">
                                    <User size={16} />
                                    Sobre
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="services">
                                <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
                                    <h2 className="text-xl font-bold mb-4">Selecione os serviços</h2>

                                    {services.length === 0 ? (
                                        <div className="text-center py-12">
                                            <Scissors size={48} className="mx-auto text-muted-foreground mb-4" />
                                            <p className="text-muted-foreground">Nenhum serviço disponível</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {services.map((service) => (
                                                <button
                                                    type="button"
                                                    key={service.id}
                                                    aria-pressed={isInCart(service.id)}
                                                    onClick={() => isInCart(service.id) ? removeFromCart(service.id) : addToCart(service)}
                                                    className="relative flex items-center gap-3 sm:gap-4 p-4 rounded-2xl border-2 transition-all text-left"
                                                    style={{
                                                        borderColor: isInCart(service.id) ? primaryColor : 'hsl(var(--border))',
                                                        backgroundColor: isInCart(service.id) ? `${primaryColor}08` : 'transparent'
                                                    }}
                                                >
                                                    <span className="text-2xl" aria-hidden="true">{service.icon || '✂️'}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-foreground">{service.name}</p>
                                                        {service.description && (
                                                            <p className="text-sm text-muted-foreground line-clamp-1">{service.description}</p>
                                                        )}
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                                            <Clock size={14} />
                                                            {service.duration_minutes}min
                                                        </div>
                                                    </div>
                                                    <p className="text-base sm:text-lg font-bold text-foreground whitespace-nowrap">
                                                        R$ {service.price.toFixed(2)}
                                                    </p>
                                                    <div
                                                        className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center border-2"
                                                        aria-hidden="true"
                                                        style={{
                                                            borderColor: primaryColor,
                                                            backgroundColor: isInCart(service.id) ? primaryColor : 'transparent'
                                                        }}
                                                    >
                                                        {isInCart(service.id) && (
                                                            <Check size={14} style={{ color: primaryForeground }} aria-hidden />
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Cart summary */}
                                    {cart.length > 0 && (
                                        <div
                                            className="mt-6 p-4 rounded-xl border-2"
                                            style={{ borderColor: primaryColor, backgroundColor: `${primaryColor}08` }}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium">
                                                    {cart.length} {cart.length === 1 ? 'serviço' : 'serviços'} selecionado(s)
                                                </span>
                                                <span className="text-lg font-bold" style={{ color: primaryText }}>
                                                    R$ {cartTotal.toFixed(2)}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-4">
                                                <Clock size={12} className="inline mr-1" />
                                                Tempo estimado: {cartDuration} min
                                            </p>
                                            <Button
                                                className="w-full"
                                                style={{ backgroundColor: primaryColor, color: primaryForeground }}
                                                onClick={() => setStep(2)}
                                            >
                                                Escolher Data e Horário
                                                <ArrowRight className="ml-2 w-4 h-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="gallery">
                                <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
                                    <h2 className="text-xl font-bold mb-4">Trabalhos de {professional.name}</h2>

                                    {gallery.length === 0 ? (
                                        <div className="text-center py-12">
                                            <Camera size={48} className="mx-auto text-muted-foreground mb-4" />
                                            <p className="text-muted-foreground">Nenhuma foto na galeria ainda</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {gallery.map((photo) => (
                                                <div key={photo.id} className="space-y-2">
                                                    {photo.after_image_url ? (
                                                        <div className="relative group">
                                                            <img
                                                                src={photo.after_image_url}
                                                                alt={photo.description || 'Trabalho realizado'}
                                                                className="w-full aspect-square object-cover rounded-xl border border-border"
                                                            />
                                                            {photo.before_image_url && (
                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                                                                    <div className="text-center text-white p-2">
                                                                        <p className="text-xs mb-1">Antes</p>
                                                                        <img
                                                                            src={photo.before_image_url}
                                                                            alt="Antes"
                                                                            className="w-16 h-16 object-cover rounded-lg mx-auto"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : photo.before_image_url && (
                                                        <img
                                                            src={photo.before_image_url}
                                                            alt={photo.description || 'Trabalho'}
                                                            className="w-full aspect-square object-cover rounded-xl border border-border"
                                                        />
                                                    )}
                                                    {photo.service_name && (
                                                        <p className="text-sm font-medium text-foreground text-center">{photo.service_name}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="about">
                                <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
                                    <h2 className="text-xl font-bold mb-4">Sobre {professional.name}</h2>

                                    {professional.bio ? (
                                        <p className="text-muted-foreground whitespace-pre-wrap">{professional.bio}</p>
                                    ) : (
                                        <p className="text-muted-foreground">
                                            {professional.name} é profissional do {salon.name}.
                                            {professional.specialty && ` Especialista em ${professional.specialty}.`}
                                        </p>
                                    )}

                                    <div className="mt-6 pt-6 border-t border-border">
                                        <h3 className="font-medium mb-3">Dias de atendimento</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, index) => {
                                                const isWorking = professional.working_days?.includes(index) ?? (index > 0 && index < 7);
                                                return (
                                                    <Badge
                                                        key={day}
                                                        variant={isWorking ? 'default' : 'secondary'}
                                                        style={isWorking ? { backgroundColor: primaryColor, color: primaryForeground } : {}}
                                                    >
                                                        {day}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {professional.working_hours && (
                                        <div className="mt-4">
                                            <h3 className="font-medium mb-2">Horário</h3>
                                            <p className="text-muted-foreground">
                                                <Clock size={14} className="inline mr-2" />
                                                {professional.working_hours.start} às {professional.working_hours.end}
                                            </p>
                                        </div>
                                    )}

                                    <div className="mt-6 pt-6 border-t border-border">
                                        <h3 className="font-medium mb-3">Localização</h3>
                                        <p className="text-muted-foreground flex items-start gap-2">
                                            <MapPin size={16} className="mt-0.5 flex-shrink-0" />
                                            {salon.address}
                                            {salon.city && `, ${salon.city}`}
                                            {salon.state && ` - ${salon.state}`}
                                        </p>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                )}

                {/* Step 2: Date & Time */}
                {step === 2 && (
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">Escolha data e horário</h2>
                                <Button variant="ghost" onClick={() => setStep(1)}>
                                    <ArrowLeft size={16} className="mr-2" />
                                    Voltar
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Calendar */}
                                <div>
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={setSelectedDate}
                                        disabled={isDateDisabled}
                                        locale={ptBR}
                                        className="rounded-xl border p-4"
                                    />
                                </div>

                                {/* Time slots */}
                                <div>
                                    {selectedDate ? (
                                        <>
                                            <h3 className="font-medium mb-4">
                                                Horários para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                                            </h3>
                                            {loadingSlots ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryText }} />
                                                </div>
                                            ) : availableSlots.length === 0 ? (
                                                <div className="text-center py-8">
                                                    <AlertCircle size={32} className="mx-auto text-muted-foreground mb-2" />
                                                    <p className="text-muted-foreground">Nenhum horário disponível</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                                                    {availableSlots.map((slot) => (
                                                        <button
                                                            type="button"
                                                            key={slot}
                                                            aria-pressed={selectedTime === slot}
                                                            onClick={() => setSelectedTime(slot)}
                                                            className="p-3 rounded-lg text-sm font-medium border transition-colors"
                                                            style={{
                                                                borderColor: selectedTime === slot ? primaryColor : 'hsl(var(--border))',
                                                                backgroundColor: selectedTime === slot ? primaryColor : 'transparent',
                                                                color: selectedTime === slot ? primaryForeground : undefined,
                                                            }}
                                                        >
                                                            {slot}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center py-8">
                                            <CalendarIcon size={32} className="mx-auto text-muted-foreground mb-2" />
                                            <p className="text-muted-foreground">Selecione uma data</p>
                                        </div>
                                    )}

                                    {selectedTime && (
                                        <Button
                                            className="w-full mt-6"
                                            style={{ backgroundColor: primaryColor, color: primaryForeground }}
                                            onClick={() => setStep(3)}
                                        >
                                            Continuar
                                            <ArrowRight className="ml-2 w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Confirm */}
                {step === 3 && (
                    <div className="max-w-lg mx-auto">
                        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold">Confirme seu agendamento</h2>
                                <Button variant="ghost" onClick={() => setStep(2)}>
                                    <ArrowLeft size={16} className="mr-2" />
                                    Voltar
                                </Button>
                            </div>

                            {/* Resumo */}
                            <div className="p-4 rounded-xl bg-secondary/30 mb-6">
                                <div className="flex items-center gap-3 mb-4">
                                    {professional.avatar_url ? (
                                        <img src={professional.avatar_url} alt={professional.name} className="w-12 h-12 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                                            <User size={24} style={{ color: primaryText }} />
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-medium">{professional.name}</p>
                                        <p className="text-sm text-muted-foreground">{professional.specialty}</p>
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Data</span>
                                        <span className="font-medium">{selectedDate && format(selectedDate, "dd/MM/yyyy")}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Horário</span>
                                        <span className="font-medium">{selectedTime}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Serviços</span>
                                        <span className="font-medium text-right">{cart.map(s => s.name).join(', ')}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-border">
                                        <span className="font-medium">Total</span>
                                        <span className="font-bold" style={{ color: primaryText }}>R$ {cartTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Dados do cliente */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="proClientName">Seu nome *</Label>
                                    <Input
                                        id="proClientName"
                                        autoComplete="name"
                                        placeholder="Nome completo"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="proClientPhone">WhatsApp *</Label>
                                    <Input
                                        id="proClientPhone"
                                        type="tel"
                                        autoComplete="tel"
                                        placeholder="(00) 00000-0000"
                                        value={clientPhone}
                                        onChange={(e) => setClientPhone(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="proClientBirthday">Data de nascimento</Label>
                                    <Input
                                        id="proClientBirthday"
                                        type="date"
                                        value={clientBirthday}
                                        onChange={(e) => setClientBirthday(e.target.value)}
                                    />
                                </div>

                                {/* Photo Consent Checkbox */}
                                <div className="flex items-start space-x-3 pt-4 border-t border-border mt-4">
                                    <Checkbox
                                        id="photos"
                                        checked={allowPhotos}
                                        onCheckedChange={(checked) => setAllowPhotos(checked as boolean)}
                                    />
                                    <div className="grid gap-1.5 leading-none">
                                        <label
                                            htmlFor="photos"
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                        >
                                            Autorizo tirar fotos de "Antes e Depois"
                                        </label>
                                        <p className="text-sm text-muted-foreground">
                                            Concordo que o profissional tire fotos do meu procedimento para compor o portfólio,
                                            conforme os <button type="button" onClick={() => setShowTerms(true)} className="text-primary underline hover:text-primary/80">Termos de Uso de Imagem</button>.
                                        </p>
                                    </div>
                                </div>

                                <Dialog open={showTerms} onOpenChange={setShowTerms}>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Termo de Autorização de Uso de Imagem</DialogTitle>
                                            <DialogDescription>
                                                Ao marcar a opção de autorização, você concorda com os seguintes termos:
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="max-h-[60vh] overflow-y-auto space-y-4 text-sm text-muted-foreground">
                                            <p>
                                                1. <strong>Objeto:</strong> Autorizo o uso da minha imagem (fotografia e vídeo) capturada durante o procedimento estético realizado por este profissional.
                                            </p>
                                            <p>
                                                2. <strong>Finalidade:</strong> As imagens serão utilizadas exclusivamente para fins de divulgação do trabalho profissional (portfólio), podendo ser veiculadas em:
                                                <ul className="list-disc pl-5 mt-1">
                                                    <li>Redes sociais do profissional e do estabelecimento (Instagram, Facebook, etc.);</li>
                                                    <li>Site oficial;</li>
                                                    <li>Materiais impressos de divulgação.</li>
                                                </ul>
                                            </p>
                                            <p>
                                                3. <strong>Gratuidade:</strong> A presente autorização é concedida a título gratuito.
                                            </p>
                                            <p>
                                                4. <strong>Vigência:</strong> Esta autorização é válida por tempo indeterminado e pode ser revogada a qualquer momento.
                                            </p>
                                        </div>
                                        <div className="flex justify-end pt-4">
                                            <Button onClick={() => setShowTerms(false)}>Entendi</Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            <Button
                                className="w-full mt-6"
                                style={{ backgroundColor: primaryColor, color: primaryForeground }}
                                onClick={handleConfirmBooking}
                                disabled={submitting || !clientName.trim() || !clientPhone.trim()}
                            >
                                {submitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <Check className="w-4 h-4 mr-2" />
                                )}
                                Confirmar Agendamento
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PublicProfessional;
