import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { SalonInstallPrompt } from "@/components/pwa/SalonInstallPrompt";
import { safeHexColor } from "@/config/brand";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Scissors,
  User,
  Calendar as CalendarIcon,
  Gift,
  Loader2,
  Phone,
  MapPin,
  MessageCircle,
  AlertCircle,
  ShoppingCart,
  Store,
  Plus,
  Minus,
  Package,
  Star,
  Download,
  Image,
  Camera,
  Copy
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePWA } from "@/hooks/usePWA";
import { usePushNotificationsFCM } from "@/hooks/usePushNotificationsFCM";
import { NotificationPrompt } from "@/components/pwa/NotificationPrompt";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  icon: string | null;
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  avatar_url: string | null;
  working_hours: { start: string; end: string } | null;
  working_days: number[] | null;
}

interface Salon {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  opening_time: string;
  closing_time: string;
  working_days: number[];
  primary_color: string | null;
  logo_url: string | null;
  public_booking_enabled: boolean;
  slug: string;
  pix_key: string | null;
  lunch_break_config?: {
    enabled: boolean;
    start_time: string;
    end_time: string;
    days: number[];
  };
  working_hours?: Record<string, { isOpen: boolean; start: string; end: string }>;
}

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_purchase: number | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  category: string | null;
}

interface CartItem {
  id: string;
  type: 'service' | 'product' | 'package';
  name: string;
  price: number;
  quantity: number;
  duration_minutes?: number;
  package_items?: Array<{ service_id: string; quantity: number }>;
}

interface PendingReview {
  appointment_id: string;
  professional_id: string;
  professional_name: string;
  service_name: string;
  date: string;
  client_id: string;
}

interface GalleryImage {
  id: string;
  before_image_url: string | null;
  after_image_url: string | null;
  description: string | null;
  created_at: string;
  professional_name?: string;
  service_name?: string;
}

interface ServicePackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discount_percent: number;
  validity_days: number;
  is_active: boolean;
  items?: Array<{
    service_id: string;
    quantity: number;
    service_name?: string;
  }>;
}

const PublicSalon = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isInstallable, isInstalled, installApp } = usePWA();

  const [salon, setSalon] = useState<Salon | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  // Push notifications - subscription será salva no banco quando cliente permitir
  // Usando Firebase Cloud Messaging para mensagens completas
  const { subscribe: subscribePush, isSupported: pushSupported, permission: pushPermission } = usePushNotificationsFCM(salon?.id);

  const [step, setStep] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [activeTab, setActiveTab] = useState<'services' | 'products' | 'packages' | 'gallery'>('services');
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientBirthday, setClientBirthday] = useState("");

  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ id: string; discount: number; message: string } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [allowPhotos, setAllowPhotos] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Review system states
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [currentRating, setCurrentRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const steps = [
    { number: 1, label: "Serviço", icon: Scissors },
    { number: 2, label: "Profissional", icon: User },
    { number: 3, label: "Data e Hora", icon: CalendarIcon },
    { number: 4, label: "Confirmar", icon: Check },
  ];

  useEffect(() => {
    if (slug) {
      fetchSalonBySlug();
    }
  }, [slug]);

  // PWA do estabelecimento: manifest dinâmico + theme-color + título enquanto a página está montada.
  // O SW NÃO é registrado aqui: o build (VitePWA/registerSW.js) já registra o worker no scope "/";
  // registrar outro arquivo no mesmo scope substituiria o worker de precache.
  // Tudo é restaurado no cleanup para não vazar a identidade do tenant para outras rotas.
  useEffect(() => {
    if (!slug || import.meta.env.MODE === 'demo') return;
    const manifestHref = `/api/manifest/${slug}`;
    let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const createdManifest = !manifestLink;
    const previousManifestHref = manifestLink?.getAttribute('href') ?? '/manifest.webmanifest';
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.setAttribute('href', manifestHref);

    let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const createdMeta = !themeColorMeta;
    const previousThemeColor = themeColorMeta?.getAttribute('content') ?? null;
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.head.appendChild(themeColorMeta);
    }

    const previousTitle = document.title;

    return () => {
      // Restauração incondicional (dono externo); o SalonInstallPrompt só desfaz o que ainda é dele,
      // então o resultado final é o original independentemente da ordem de desmontagem.
      if (manifestLink) {
        if (createdManifest) manifestLink.remove();
        else manifestLink.setAttribute('href', previousManifestHref);
      }
      if (themeColorMeta) {
        if (createdMeta) themeColorMeta.remove();
        else if (previousThemeColor !== null) themeColorMeta.setAttribute('content', previousThemeColor);
      }
      document.title = previousTitle;
    };
  }, [slug]);

  // Título e cor do navegador seguem o estabelecimento carregado (cor validada; fallback azul).
  useEffect(() => {
    if (!salon) return;
    document.title = `${salon.name} | Agendamento`;
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute('content', safeHexColor(salon.primary_color));
  }, [salon]);

  // Auto-selecionar "any" quando entrar no step 2 sem profissional selecionado
  useEffect(() => {
    if (step === 2 && !selectedProfessional && hasBookableItems) {
      setSelectedProfessional("any");
    }
  }, [step]);

  const fetchSalonBySlug = async () => {
    try {
      const { data: salonData, error: salonError } = await supabase
        .from('salons')
        .select('*')
        .eq('slug', slug)
        .neq('is_active', false)
        .maybeSingle();

      if (salonError) throw salonError;

      if (!salonData) {
        setError("Estabelecimento não encontrado");
        setLoading(false);
        return;
      }

      if (!salonData.public_booking_enabled) {
        setError("Agendamento online não está disponível para este estabelecimento");
        setLoading(false);
        return;
      }

      setSalon({
        id: salonData.id,
        name: salonData.name,
        description: salonData.description,
        address: salonData.address,
        city: salonData.city,
        state: salonData.state,
        phone: salonData.phone,
        whatsapp: salonData.whatsapp,
        opening_time: salonData.opening_time || '09:00',
        closing_time: salonData.closing_time || '19:00',
        working_days: salonData.working_days || [1, 2, 3, 4, 5, 6],
        primary_color: salonData.primary_color,
        logo_url: salonData.logo_url,
        public_booking_enabled: salonData.public_booking_enabled ?? true,
        slug: salonData.slug || '',
        pix_key: salonData.pix_key || null,
        lunch_break_config: salonData.lunch_break_config as unknown as Salon['lunch_break_config'],
        working_hours: salonData.working_hours as unknown as Salon['working_hours'],
      });

      // Fetch services
      const { data: servicesData } = await supabase
        .from('services')
        .select('id, name, description, price, duration_minutes, icon')
        .eq('salon_id', salonData.id)
        .eq('is_active', true)
        .order('name');

      if (servicesData) setServices(servicesData);

      // Fetch professionals
      const { data: professionalsData } = await supabase
        .from('professionals')
        .select('id, name, specialty, avatar_url, working_hours, working_days')
        .eq('salon_id', salonData.id)
        .eq('is_active', true)
        .order('name');

      if (professionalsData) {
        setProfessionals(professionalsData.map(p => ({
          ...p,
          working_hours: p.working_hours as { start: string; end: string } | null,
        })));
      }

      // Fetch products
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, description, price, stock, image_url, category')
        .eq('salon_id', salonData.id)
        .eq('is_active', true)
        .gt('stock', 0)
        .order('name');

      if (productsData) setProducts(productsData);

      // Fetch packages
      const { data: packagesData } = await supabase
        .from('service_packages_with_items')
        .select('*')
        .eq('salon_id', salonData.id)
        .eq('is_active', true)
        .order('name');

      if (packagesData) setPackages(packagesData);

      // Fetch public gallery images
      const { data: galleryData } = await supabase
        .from('client_gallery')
        .select(`
          id,
          before_image_url,
          after_image_url,
          description,
          created_at,
          professionals:professional_id (name),
          services:service_id (name)
        `)
        .eq('salon_id', salonData.id)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(20);

      if (galleryData) {
        setGallery(galleryData.map(g => ({
          id: g.id,
          before_image_url: g.before_image_url,
          after_image_url: g.after_image_url,
          description: g.description,
          created_at: g.created_at,
          professional_name: (g.professionals as any)?.name,
          service_name: (g.services as any)?.name,
        })));
      }
    } catch (err) {
      console.error("Error fetching salon:", err);
      setError("Erro ao carregar dados do estabelecimento");
    } finally {
      setLoading(false);
    }
  };

  // Cart helper functions
  const addToCart = (item: Service | Product | ServicePackage, type: 'service' | 'product' | 'package') => {
    const existing = cart.find(c => c.id === item.id && c.type === type);
    if (existing) {
      if (type === 'product') {
        setCart(cart.map(c =>
          c.id === item.id && c.type === type
            ? { ...c, quantity: c.quantity + 1 }
            : c
        ));
      }
      return;
    }

    const cartItem: CartItem = {
      id: item.id,
      type,
      name: item.name,
      price: item.price,
      quantity: 1,
      duration_minutes: type === 'service' ? (item as Service).duration_minutes : undefined,
      package_items: type === 'package' ? (item as ServicePackage).items : undefined,
    };
    setCart([...cart, cartItem]);
  };

  const removeFromCart = (id: string, type: 'service' | 'product' | 'package') => {
    const existing = cart.find(c => c.id === id && c.type === type);
    if (existing && existing.quantity > 1 && type === 'product') {
      setCart(cart.map(c =>
        c.id === id && c.type === type
          ? { ...c, quantity: c.quantity - 1 }
          : c
      ));
    } else {
      setCart(cart.filter(c => !(c.id === id && c.type === type)));
    }
  };

  const isInCart = (id: string, type: 'service' | 'product' | 'package') => {
    return cart.some(c => c.id === id && c.type === type);
  };

  const getCartQuantity = (id: string, type: 'service' | 'product') => {
    return cart.find(c => c.id === id && c.type === type)?.quantity || 0;
  };

  const cartServices = cart.filter(c => c.type === 'service');
  const cartProducts = cart.filter(c => c.type === 'product');
  const cartPackages = cart.filter(c => c.type === 'package');
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartServicesDuration = cartServices.reduce((sum, item) => sum + (item.duration_minutes || 0), 0);

  // Pacotes também precisam de agendamento
  const hasBookableItems = cartServices.length > 0 || cartPackages.length > 0;

  const selectedProfessionalData = professionals.find(p => p.id === selectedProfessional);

  useEffect(() => {
    if (selectedDate && hasBookableItems && salon) {
      fetchAvailableSlots();
    }
  }, [selectedDate, cartServices.length, selectedProfessional]);

  const fetchAvailableSlots = async () => {
    if (!selectedDate || !hasBookableItems || !salon) return;

    setLoadingSlots(true);
    setSelectedTime("");

    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const dayOfWeek = selectedDate.getDay();

      let dayOpen = salon.opening_time;
      let dayClose = salon.closing_time;
      let isWorkingDay = salon.working_days.includes(dayOfWeek);

      // Override with specific working hours if available
      if (salon.working_hours && salon.working_hours[dayOfWeek]) {
        const dailyConfig = salon.working_hours[dayOfWeek];
        if (dailyConfig.isOpen) {
          isWorkingDay = true;
          dayOpen = dailyConfig.start;
          dayClose = dailyConfig.end;
        } else {
          isWorkingDay = false;
        }
      }

      if (!isWorkingDay) {
        setAvailableSlots([]);
        setLoadingSlots(false);
        return;
      }

      // Calculate total duration from all services in cart
      const totalDuration = cartServicesDuration;
      if (totalDuration === 0) {
        setAvailableSlots([]);
        setLoadingSlots(false);
        return;
      }

      const duration = totalDuration;
      const slots: string[] = [];
      const [openHour, openMin] = dayOpen.split(':').map(Number);
      const [closeHour, closeMin] = dayClose.split(':').map(Number);

      let currentTime = openHour * 60 + openMin;
      const endTime = closeHour * 60 + closeMin - duration;

      // Filter past times if date is today
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

      // Get existing appointments
      let query = supabase
        .from('appointments')
        .select('start_time, end_time, professional_id')
        .eq('salon_id', salon.id)
        .eq('date', dateStr)
        .in('status', ['pending', 'confirmed']);

      const professionalId = selectedProfessional === "any" ? undefined : selectedProfessional;
      if (professionalId) {
        query = query.eq('professional_id', professionalId);
      }

      const { data: existingAppointments } = await query;

      // Filter out busy slots
      const availableSlots = slots.filter(slot => {
        const slotMinutes = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]);

        // Lunch break check
        if (salon.lunch_break_config?.enabled && salon.lunch_break_config.days.includes(dayOfWeek)) {
          const [startH, startM] = salon.lunch_break_config.start_time.split(':').map(Number);
          const [endH, endM] = salon.lunch_break_config.end_time.split(':').map(Number);

          const lunchStart = startH * 60 + startM;
          const lunchEnd = endH * 60 + endM;

          // Se o início do slot cai dentro do almoço
          if (slotMinutes >= lunchStart && slotMinutes < lunchEnd) {
            return false;
          }
          // Se o agendamento termina após o início do almoço (caso de serviços longos)
          if (slotMinutes < lunchStart && (slotMinutes + duration) > lunchStart) {
            return false;
          }
        }

        const slotEnd = `${Math.floor((slotMinutes + duration) / 60).toString().padStart(2, '0')}:${((slotMinutes + duration) % 60).toString().padStart(2, '0')}`;

        const hasConflict = existingAppointments?.some(apt => {
          if (professionalId && apt.professional_id !== professionalId) {
            return false;
          }
          return (slot < apt.end_time && slotEnd > apt.start_time);
        });

        return !hasConflict;
      });

      setAvailableSlots(availableSlots);
    } catch (err) {
      console.error("Error fetching slots:", err);
      toast.error("Erro ao buscar horários");
    } finally {
      setLoadingSlots(false);
    }
  };

  const validateCoupon = async () => {
    if (!couponCode.trim() || cart.length === 0 || !salon) return;

    setValidatingCoupon(true);
    try {
      const { data: couponData, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('salon_id', salon.id)
        .eq('code', couponCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error || !couponData) {
        toast.error("Cupom não encontrado");
        setCouponApplied(null);
        return;
      }

      const now = new Date();
      if (couponData.valid_from && new Date(couponData.valid_from) > now) {
        toast.error("Cupom ainda não está válido");
        return;
      }
      if (couponData.valid_until && new Date(couponData.valid_until) < now) {
        toast.error("Cupom expirado");
        return;
      }
      if (couponData.max_uses && couponData.uses_count && couponData.uses_count >= couponData.max_uses) {
        toast.error("Cupom esgotado");
        return;
      }
      if (couponData.min_purchase && cartTotal < couponData.min_purchase) {
        toast.error(`Valor mínimo de R$ ${couponData.min_purchase.toFixed(2)} necessário`);
        return;
      }

      let discount = 0;
      if (couponData.type === 'percentage') {
        discount = cartTotal * (couponData.value / 100);
      } else {
        discount = Math.min(couponData.value, cartTotal);
      }

      setCouponApplied({
        id: couponData.id,
        discount,
        message: couponData.type === 'percentage'
          ? `${couponData.value}% de desconto!`
          : `R$ ${couponData.value.toFixed(2)} de desconto!`
      });
      toast.success("Cupom aplicado!");
    } catch (err) {
      toast.error("Erro ao validar cupom");
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Check for pending reviews when client enters phone
  const checkPendingReviews = async (phone: string) => {
    if (!salon || !phone || phone.length < 10) return;

    try {
      // Find client by phone
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('salon_id', salon.id)
        .eq('phone', phone.trim())
        .maybeSingle();

      if (!client) return;

      // Find completed appointments without reviews
      const { data: completedAppointments } = await supabase
        .from('appointments')
        .select(`
          id,
          date,
          professional_id,
          professionals:professional_id (name),
          services:service_id (name)
        `)
        .eq('salon_id', salon.id)
        .eq('client_phone', phone.trim())
        .eq('status', 'completed')
        .order('date', { ascending: false })
        .limit(5);

      if (!completedAppointments || completedAppointments.length === 0) return;

      // Check which appointments don't have reviews
      const pendingList: PendingReview[] = [];
      for (const apt of completedAppointments) {
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id')
          .eq('appointment_id', apt.id)
          .maybeSingle();

        if (!existingReview) {
          pendingList.push({
            appointment_id: apt.id,
            professional_id: apt.professional_id,
            professional_name: (apt.professionals as any)?.name || 'Profissional',
            service_name: (apt.services as any)?.name || 'Serviço',
            date: apt.date,
            client_id: client.id,
          });
        }
      }

      if (pendingList.length > 0) {
        setPendingReviews(pendingList);
        setShowReviewModal(true);
      }
    } catch (err) {
      console.error("Error checking pending reviews:", err);
    }
  };

  // Submit review for a past appointment
  const submitReview = async () => {
    if (pendingReviews.length === 0 || !salon) return;

    const review = pendingReviews[0];
    setSubmittingReview(true);

    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          salon_id: salon.id,
          client_id: review.client_id,
          professional_id: review.professional_id,
          appointment_id: review.appointment_id,
          rating: currentRating,
          comment: reviewComment.trim() || null,
          is_public: true,
        });

      if (error) throw error;

      toast.success("Avaliação enviada! Obrigado pelo feedback!");

      // Remove this review from pending list
      setPendingReviews(prev => prev.slice(1));
      setCurrentRating(5);
      setReviewComment("");

      if (pendingReviews.length <= 1) {
        setShowReviewModal(false);
      }
    } catch (err: any) {
      console.error("Error submitting review:", err);
      toast.error(err.message || "Erro ao enviar avaliação");
    } finally {
      setSubmittingReview(false);
    }
  };

  const skipReview = () => {
    setPendingReviews(prev => prev.slice(1));
    setCurrentRating(5);
    setReviewComment("");

    if (pendingReviews.length <= 1) {
      setShowReviewModal(false);
    }
  };

  const handleBirthdayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);

    if (value.length >= 5) {
      value = `${value.slice(0, 2)}/${value.slice(2, 4)}/${value.slice(4)}`;
    } else if (value.length >= 3) {
      value = `${value.slice(0, 2)}/${value.slice(2)}`;
    }

    setClientBirthday(value);
  };

  const handleConfirmBooking = async () => {
    if (!hasBookableItems || !selectedDate || !selectedTime || !clientName.trim() || !clientPhone.trim() || !clientBirthday || !salon) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    let finalProfessionalId = selectedProfessional;
    if (selectedProfessional === "any" || !selectedProfessional) {
      if (professionals.length > 0) {
        finalProfessionalId = professionals[0].id;
      } else {
        toast.error("Nenhum profissional disponível");
        return;
      }
    }

    setSubmitting(true);
    try {
      const discount = couponApplied?.discount || 0;
      const finalPrice = cartTotal - discount;

      const [hours, minutes] = selectedTime.split(':').map(Number);
      const endMinutes = hours * 60 + minutes + cartServicesDuration;
      const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

      // Create appointment for the first service (main service)
      // Additional services are stored in notes
      const mainService = cartServices[0];
      const additionalServices = cartServices.slice(1);
      const servicesNotes = cart.map(item => `${item.name} (R$ ${item.price.toFixed(2)})`).join(', ');

      // Build notes with birthday and services
      const notesArray: string[] = [];
      if (clientBirthday) {
        notesArray.push(`Aniversário: ${clientBirthday}`);
      }
      if (additionalServices.length > 0) {
        notesArray.push(`Serviços: ${servicesNotes}`);
      }
      if (cartProducts.length > 0) {
        const productsNotes = cartProducts.map(p => `${p.name} x${p.quantity}`).join(', ');
        notesArray.push(`Produtos: ${productsNotes}`);
      }

      // Add photo consent to notes
      if (allowPhotos) {
        notesArray.push('✅ CLIENTE AUTORIZOU FOTOS ANTES/DEPOIS');
      }

      // Buscar nome do profissional
      const professionalName = professionals.find(p => p.id === finalProfessionalId)?.name || "Qualquer profissional";

      const { data: appointmentData, error } = await supabase
        .from('appointments')
        .insert({
          salon_id: salon.id,
          service_id: mainService.id,
          professional_id: finalProfessionalId,
          date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: selectedTime,
          end_time: endTime,
          client_name: clientName.trim(),
          client_phone: clientPhone.trim(),
          coupon_id: couponApplied?.id || null,
          price: cartTotal,
          discount,
          final_price: finalPrice,
          status: 'pending',
          notes: notesArray.length > 0 ? notesArray.join(' | ') : null,
        })
        .select()
        .single();

      if (error) throw error;

      // Enviar confirmação WhatsApp
      try {
        const { error: whatsappError } = await supabase.functions.invoke('auto-appointment-confirmation', {
          body: {
            id: appointmentData.id,
            salon_id: salon.id,
            client_name: clientName.trim(),
            client_phone: clientPhone.trim(),
            service_name: mainService.name,
            professional_name: professionalName,
            appointment_date: format(selectedDate, 'yyyy-MM-dd'),
            appointment_time: selectedTime,
            total_price: finalPrice,
            status: 'pending'
          }
        });

        if (whatsappError) {
          console.error("WhatsApp confirmation error:", whatsappError);
        }
      } catch (whatsappError) {
        console.error("WhatsApp confirmation error:", whatsappError);
        // Não bloqueia o agendamento se WhatsApp falhar
      }

      // Enviar notificação push para o dono do salão
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            salonId: salon.id,
            title: '🎉 Novo Agendamento!',
            body: `${clientName.trim()} agendou ${mainService.name} para ${format(selectedDate, 'dd/MM')} às ${selectedTime}`,
            data: {
              appointmentId: appointmentData.id,
              type: 'new_appointment'
            }
          }
        });
      } catch (pushError) {
        console.error("Push notification error:", pushError);
        // Não bloqueia o agendamento se push falhar
      }

      // Auto-create or update client in clients table with loyalty points
      // Rule: R$ 1 spent = 1 loyalty point
      try {
        const pointsEarned = Math.floor(finalPrice);

        // Check if client already exists (by phone)
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id, total_visits, total_spent, loyalty_points')
          .eq('salon_id', salon.id)
          .eq('phone', clientPhone.trim())
          .maybeSingle();

        if (existingClient) {
          // Update existing client
          await supabase
            .from('clients')
            .update({
              name: clientName.trim(),
              total_visits: (existingClient.total_visits || 0) + 1,
              total_spent: (existingClient.total_spent || 0) + finalPrice,
              loyalty_points: (existingClient.loyalty_points || 0) + pointsEarned,
              last_visit_at: new Date().toISOString(),
            })
            .eq('id', existingClient.id);
        } else {
          // Create new client with loyalty points
          // Converter data de aniversário DD/MM/YYYY para YYYY-MM-DD
          let birthDate = null;
          if (clientBirthday) {
            const [day, month, year] = clientBirthday.split('/');
            if (day && month && year && year.length === 4) {
              birthDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
          }

          await supabase
            .from('clients')
            .insert({
              salon_id: salon.id,
              name: clientName.trim(),
              phone: clientPhone.trim(),
              birth_date: birthDate,
              notes: clientBirthday ? `Aniversário: ${clientBirthday}` : null,
              total_visits: 1,
              total_spent: finalPrice,
              loyalty_points: pointsEarned,
              last_visit_at: new Date().toISOString(),
            });
        }
      } catch (clientError) {
        console.error("Error creating/updating client:", clientError);
        // Don't throw - appointment was created successfully
      }

      // Increment coupon usage if applied
      if (couponApplied?.id) {
        const { data: couponData } = await supabase
          .from('coupons')
          .select('uses_count')
          .eq('id', couponApplied.id)
          .single();

        await supabase
          .from('coupons')
          .update({ uses_count: (couponData?.uses_count || 0) + 1 })
          .eq('id', couponApplied.id);
      }

      toast.success("Agendamento realizado com sucesso!");
      setStep(5);
    } catch (err: any) {
      console.error("Error creating appointment:", err);
      toast.error(err.message || "Erro ao criar agendamento");
    } finally {
      setSubmitting(false);
    }
  };

  // Gerar link do Google Calendar
  const generateGoogleCalendarLink = () => {
    if (!selectedDate || !selectedTime || !salon) return '';

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const endMinutes = hours * 60 + minutes + cartServicesDuration;
    const endHours = Math.floor(endMinutes / 60);
    const endMins = endMinutes % 60;

    const startDateTime = `${format(selectedDate, 'yyyyMMdd')}T${selectedTime.replace(':', '')}00`;
    const endDateTime = `${format(selectedDate, 'yyyyMMdd')}T${endHours.toString().padStart(2, '0')}${endMins.toString().padStart(2, '0')}00`;

    const servicesText = cartServices.map(s => s.name).join(', ');
    const professionalName = selectedProfessional === "any" ? "A definir" : selectedProfessionalData?.name || "Profissional";

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `${servicesText} - ${salon.name}`,
      dates: `${startDateTime}/${endDateTime}`,
      details: `Agendamento confirmado!\n\nServiços: ${servicesText}\nProfissional: ${professionalName}\nValor: R$ ${finalPrice.toFixed(2)}\n\nCliente: ${clientName}`,
      location: salon.address || salon.name,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const isDateDisabled = (date: Date) => {
    const today = startOfDay(new Date());
    if (isBefore(date, today)) return true;
    if (salon) {
      const dayOfWeek = date.getDay();
      return !salon.working_days.includes(dayOfWeek);
    }
    return false;
  };

  const price = cartTotal;
  const discount = couponApplied?.discount || 0;
  const finalPrice = price - discount;

  const formatWorkingDays = () => {
    if (!salon) return "";
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const sortedDays = [...salon.working_days].sort();
    if (sortedDays.length === 0) return "Fechado";

    const first = sortedDays[0];
    const last = sortedDays[sortedDays.length - 1];

    if (sortedDays.length === last - first + 1) {
      return `${dayNames[first]} a ${dayNames[last]}`;
    }
    return sortedDays.map(d => dayNames[d]).join(", ");
  };

  // Cor do estabelecimento (só HEX válido; ausente/inválida cai no azul padrão)
  const primaryColor = safeHexColor(salon?.primary_color);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} aria-hidden="true" />
        <span className="sr-only">Carregando</span>
      </div>
    );
  }

  if (error || !salon) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md" role="alert">
          <AlertCircle size={48} className="mx-auto text-destructive mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Ops!</h1>
          <p className="text-muted-foreground mb-6">{error || "Estabelecimento não encontrado"}</p>
          <Button onClick={() => navigate('/')}>Voltar ao início</Button>
        </div>
      </div>
    );
  }

  // Success step
  if (step === 5) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div
            className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${primaryColor}20` }}
          >
            <Check size={40} style={{ color: primaryColor }} />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-4">
            Agendamento Confirmado!
          </h1>
          <p className="text-muted-foreground mb-6">
            Seu agendamento foi realizado com sucesso em <strong>{salon.name}</strong>.
          </p>
          <div className="bg-card border border-border rounded-2xl p-6 mb-6 text-left shadow-lg">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Serviços</span>
                <span className="font-medium text-foreground text-right">
                  {cartServices.map(s => s.name).join(', ') || 'Nenhum'}
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Profissional</span>
                <span className="font-medium text-foreground">
                  {selectedProfessional === "any" ? "A definir" : selectedProfessionalData?.name}
                </span>
              </div>
              <div className="border-t border-border pt-3 mt-3">
                <div className="flex justify-between">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="text-xl font-bold" style={{ color: primaryColor }}>
                    R$ {finalPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => window.open(generateGoogleCalendarLink(), '_blank')}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: primaryColor }}
            >
              <CalendarIcon size={20} aria-hidden />
              Adicionar ao Google Calendar
            </button>

            {salon.whatsapp && (
              <a
                href={`https://wa.me/${salon.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: '#25D366' }}
              >
                <MessageCircle size={20} />
                Falar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with salon branding */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl border-b border-border"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}10 0%, transparent 100%)`,
          borderColor: `${primaryColor}20`
        }}
      >
        <div className="container px-4 py-6">
          {/* Centered Salon Header */}
          <div className="flex flex-col items-center text-center">
            {/* Logo */}
            {salon.logo_url ? (
              <img
                src={salon.logo_url}
                alt={`Logo de ${salon.name}`}
                className="h-20 w-20 rounded-2xl object-cover shadow-lg mb-4 border-2"
                style={{ borderColor: primaryColor }}
              />
            ) : (
              <div
                className="h-20 w-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-4"
                style={{ backgroundColor: primaryColor }}
                aria-hidden="true"
              >
                {salon.name.charAt(0)}
              </div>
            )}

            {/* Salon Name */}
            <h1 className="font-display text-2xl font-bold text-foreground mb-1">
              {salon.name}
            </h1>

            {/* Address */}
            {(salon.address || salon.city) && (
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-3 max-w-full">
                <MapPin size={14} className="shrink-0" style={{ color: primaryColor }} aria-hidden="true" />
                <span>
                  {salon.address ? `${salon.address}` : ''}
                  {salon.address && salon.city ? ' - ' : ''}
                  {salon.city ? `${salon.city}, ${salon.state}` : ''}
                </span>
              </div>
            )}

            {/* Info Pills */}
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {/* Working Hours */}
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
              >
                <Clock size={14} />
                <span>{salon.opening_time?.slice(0, 5)} - {salon.closing_time?.slice(0, 5)} • {formatWorkingDays()}</span>
              </div>

              {/* Phone */}
              {salon.phone && (
                <a
                  href={`tel:${salon.phone}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-secondary/50 text-foreground hover:bg-secondary transition-colors"
                >
                  <Phone size={14} />
                  <span>{salon.phone}</span>
                </a>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap justify-center gap-2">
              {/* WhatsApp Button */}
              {salon.whatsapp && (
                <a
                  href={`https://wa.me/${salon.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium transition-all hover:opacity-90 hover:scale-105"
                  style={{ backgroundColor: '#25D366' }}
                >
                  <MessageCircle size={18} />
                  <span>WhatsApp</span>
                </a>
              )}

              {/* Install PWA Button */}
              {isInstallable && !isInstalled && (
                <button
                  type="button"
                  onClick={installApp}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover:opacity-90 hover:scale-105"
                  style={{ backgroundColor: primaryColor, color: 'white' }}
                >
                  <Download size={18} />
                  <span>Instalar App</span>
                </button>
              )}

              {/* Already Installed Badge */}
              {isInstalled && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium bg-secondary/50 text-muted-foreground">
                  <Check size={14} />
                  <span>App instalado</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Salon Description (only on step 1) */}
      {step === 1 && salon.description && (
        <div className="border-b border-border bg-card/50">
          <div className="container px-4 py-4">
            <div className="max-w-2xl mx-auto text-center">
              <p className="text-sm text-muted-foreground">{salon.description}</p>
            </div>
          </div>
        </div>
      )}

      <main className="container px-4 py-6 sm:py-8 max-w-2xl mx-auto">
        {/* Progress Steps */}
        <ol className="flex items-center justify-between mb-8" aria-label="Etapas do agendamento">
          {steps.map((s, index) => (
            <li key={s.number} className="flex items-center" aria-current={step === s.number ? "step" : undefined}>
              <div className="flex flex-col items-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: step >= s.number
                      ? `linear-gradient(135deg, ${primaryColor}, ${primaryColor}CC)`
                      : 'hsl(var(--secondary))',
                    color: step >= s.number ? 'white' : 'hsl(var(--muted-foreground))'
                  }}
                >
                  {step > s.number ? <Check size={18} aria-hidden="true" /> : <s.icon size={18} aria-hidden="true" />}
                </div>
                <span
                  className={`text-[11px] sm:text-xs mt-2 text-center ${step === s.number ? 'font-semibold' : ''}`}
                  style={{ color: step >= s.number ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}
                >
                  {s.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className="w-3 sm:w-12 md:w-20 h-0.5 mx-1 sm:mx-2"
                  style={{ backgroundColor: step > s.number ? primaryColor : 'hsl(var(--border))' }}
                  aria-hidden="true"
                />
              )}
            </li>
          ))}
        </ol>

        {/* Step Content */}
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm">
          {/* Step 1: Select Services & Products */}
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Monte seu pedido
              </h2>
              <p className="text-muted-foreground mb-6">Selecione serviços e produtos que deseja</p>

              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'services' | 'products' | 'packages' | 'gallery')} className="w-full">
                {/* Em 360px os 4 rótulos com ícone ao lado estouravam a largura: ícone empilha no mobile */}
                <TabsList className="grid w-full grid-cols-4 mb-6 h-auto">
                  <TabsTrigger value="services" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 text-xs sm:text-sm">
                    <Scissors size={16} aria-hidden="true" />
                    Serviços
                  </TabsTrigger>
                  <TabsTrigger value="products" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 text-xs sm:text-sm">
                    <Store size={16} aria-hidden="true" />
                    Loja
                  </TabsTrigger>
                  <TabsTrigger value="packages" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 text-xs sm:text-sm">
                    <Package size={16} aria-hidden="true" />
                    Pacotes
                  </TabsTrigger>
                  <TabsTrigger value="gallery" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-1 sm:px-3 text-xs sm:text-sm">
                    <Camera size={16} aria-hidden="true" />
                    Galeria
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="services">
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
                          aria-pressed={isInCart(service.id, 'service')}
                          onClick={() => isInCart(service.id, 'service')
                            ? removeFromCart(service.id, 'service')
                            : addToCart(service, 'service')
                          }
                          className="relative flex items-center gap-3 sm:gap-4 p-4 rounded-2xl border-2 transition-all text-left"
                          style={{
                            borderColor: isInCart(service.id, 'service') ? primaryColor : 'hsl(var(--border))',
                            backgroundColor: isInCart(service.id, 'service') ? `${primaryColor}08` : 'transparent'
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
                              backgroundColor: isInCart(service.id, 'service') ? primaryColor : 'transparent'
                            }}
                          >
                            {isInCart(service.id, 'service') && (
                              <Check size={14} className="text-white" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="products">
                  {products.length === 0 ? (
                    <div className="text-center py-12">
                      <Package size={48} className="mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nenhum produto disponível</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {products.map((product) => (
                        <div
                          key={product.id}
                          className="relative flex items-center gap-3 sm:gap-4 p-4 rounded-2xl border-2 transition-all"
                          style={{
                            borderColor: isInCart(product.id, 'product') ? primaryColor : 'hsl(var(--border))',
                            backgroundColor: isInCart(product.id, 'product') ? `${primaryColor}08` : 'transparent'
                          }}
                        >
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-14 h-14 shrink-0 rounded-lg object-cover" />
                          ) : (
                            <div className="w-14 h-14 shrink-0 rounded-lg bg-secondary flex items-center justify-center">
                              <Package size={24} className="text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground">{product.name}</p>
                            {product.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">{product.description}</p>
                            )}
                            {product.category && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                                {product.category}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-foreground">
                              R$ {product.price.toFixed(2)}
                            </p>
                            {isInCart(product.id, 'product') ? (
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(product.id, 'product')}
                                  aria-label={`Diminuir quantidade de ${product.name}`}
                                  className="w-11 h-11 rounded-full border flex items-center justify-center hover:bg-secondary"
                                  style={{ borderColor: primaryColor }}
                                >
                                  <Minus size={14} style={{ color: primaryColor }} aria-hidden="true" />
                                </button>
                                <span className="font-medium w-6 text-center" aria-live="polite">{getCartQuantity(product.id, 'product')}</span>
                                <button
                                  type="button"
                                  onClick={() => addToCart(product, 'product')}
                                  aria-label={`Aumentar quantidade de ${product.name}`}
                                  className="w-11 h-11 rounded-full flex items-center justify-center text-white"
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  <Plus size={14} aria-hidden="true" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addToCart(product, 'product')}
                                className="mt-2 px-4 py-2 rounded-full text-sm font-medium text-white"
                                style={{ backgroundColor: primaryColor }}
                              >
                                Adicionar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="packages">
                  {packages.length === 0 ? (
                    <div className="text-center py-12">
                      <Package size={48} className="mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nenhum pacote disponível</p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {packages.map((pkg) => (
                        <button
                          type="button"
                          key={pkg.id}
                          aria-pressed={isInCart(pkg.id, 'package')}
                          onClick={() => isInCart(pkg.id, 'package')
                            ? removeFromCart(pkg.id, 'package')
                            : addToCart(pkg, 'package')
                          }
                          className="relative flex flex-col gap-3 p-4 rounded-2xl border-2 transition-all text-left"
                          style={{
                            borderColor: isInCart(pkg.id, 'package') ? primaryColor : 'hsl(var(--border))',
                            backgroundColor: isInCart(pkg.id, 'package') ? `${primaryColor}08` : 'transparent'
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                                style={{ backgroundColor: primaryColor }}
                              >
                                <Package size={24} />
                              </div>
                              <div className="flex-1">
                                <p className="font-bold text-foreground">{pkg.name}</p>
                                {pkg.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">{pkg.description}</p>
                                )}
                              </div>
                            </div>
                            {isInCart(pkg.id, 'package') && (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white"
                                style={{ backgroundColor: primaryColor }}
                              >
                                <Check size={14} />
                              </div>
                            )}
                          </div>

                          {/* Lista de serviços inclusos */}
                          {Array.isArray(pkg.items) && pkg.items.length > 0 && (
                            <div className="space-y-1 pl-2 border-l-2" style={{ borderColor: `${primaryColor}30` }}>
                              {pkg.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    • {item.service_name || 'Serviço'}
                                  </span>
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}>
                                    {item.quantity}x
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success font-medium">
                                {pkg.discount_percent}% OFF
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Válido por {pkg.validity_days} dias
                              </span>
                            </div>
                            <p className="text-xl font-bold" style={{ color: primaryColor }}>
                              R$ {pkg.price.toFixed(2)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="gallery">
                  {gallery.length === 0 ? (
                    <div className="text-center py-12">
                      <Camera size={48} className="mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nenhuma foto na galeria ainda</p>
                      <p className="text-sm text-muted-foreground mt-1">Em breve, fotos de trabalhos realizados!</p>
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
                              alt={photo.description || 'Trabalho realizado'}
                              className="w-full aspect-square object-cover rounded-xl border border-border"
                            />
                          )}
                          {(photo.service_name || photo.professional_name) && (
                            <div className="text-center">
                              {photo.service_name && (
                                <p className="text-sm font-medium text-foreground">{photo.service_name}</p>
                              )}
                              {photo.professional_name && (
                                <p className="text-xs text-muted-foreground">por {photo.professional_name}</p>
                              )}
                            </div>
                          )}
                          {photo.description && (
                            <p className="text-xs text-muted-foreground text-center line-clamp-2">
                              {photo.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {/* Cart Summary */}
              {cart.length > 0 && (
                <div className="mt-6 p-4 rounded-2xl border-2" style={{ borderColor: primaryColor, backgroundColor: `${primaryColor}08` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ShoppingCart size={18} style={{ color: primaryColor }} />
                      <span className="font-medium">Carrinho ({cart.length} {cart.length === 1 ? 'item' : 'itens'})</span>
                    </div>
                    <span className="text-lg font-bold" style={{ color: primaryColor }}>
                      R$ {cartTotal.toFixed(2)}
                    </span>
                  </div>
                  {cartServicesDuration > 0 && (
                    <p className="text-sm text-muted-foreground">
                      <Clock size={12} className="inline mr-1" />
                      Tempo estimado: {cartServicesDuration} min
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Professional */}
          {step === 2 && (
            <div className="animate-fade-in">
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Escolha o profissional
              </h2>
              <p className="text-muted-foreground mb-6">Ou deixe em branco para qualquer um disponível</p>

              <div className="grid gap-3">
                {professionals.map((pro) => (
                  <button
                    type="button"
                    key={pro.id}
                    aria-pressed={selectedProfessional === pro.id}
                    onClick={() => setSelectedProfessional(pro.id)}
                    className="flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left"
                    style={{
                      borderColor: selectedProfessional === pro.id ? primaryColor : 'hsl(var(--border))',
                      backgroundColor: selectedProfessional === pro.id ? `${primaryColor}08` : 'transparent'
                    }}
                  >
                    <div
                      className="w-14 h-14 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-xl overflow-hidden"
                      style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}CC)` }}
                    >
                      {pro.avatar_url ? (
                        <img src={pro.avatar_url} alt={pro.name} className="w-full h-full object-cover" />
                      ) : (
                        pro.name.charAt(0)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{pro.name}</p>
                      {pro.specialty && (
                        <p className="text-sm text-muted-foreground">{pro.specialty}</p>
                      )}
                    </div>
                    {selectedProfessional === pro.id && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <Check size={14} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}

                <button
                  type="button"
                  aria-pressed={selectedProfessional === "any"}
                  onClick={() => setSelectedProfessional("any")}
                  className="flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left"
                  style={{
                    borderColor: selectedProfessional === "any" ? primaryColor : 'hsl(var(--border))',
                    backgroundColor: selectedProfessional === "any" ? `${primaryColor}08` : 'transparent'
                  }}
                >
                  <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                    <User size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Sem preferência</p>
                    <p className="text-sm text-muted-foreground">Qualquer profissional disponível</p>
                  </div>
                  {selectedProfessional === "any" && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Check size={14} className="text-white" />
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Select Date and Time */}
          {step === 3 && (
            <div className="animate-fade-in">
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Data e horário
              </h2>
              <p className="text-muted-foreground mb-6">Escolha quando você quer ser atendido</p>

              <div className="mb-6">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={isDateDisabled}
                  locale={ptBR}
                  className="rounded-xl border border-border p-3"
                />
              </div>

              {selectedDate && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    Horários disponíveis para {format(selectedDate, "dd/MM", { locale: ptBR })}
                  </label>

                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} aria-hidden="true" />
                      <span className="sr-only">Carregando horários</span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock size={32} className="mx-auto mb-2 opacity-50" />
                      <p>Nenhum horário disponível nesta data</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 min-[400px]:grid-cols-4 sm:grid-cols-6 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          type="button"
                          key={slot}
                          aria-pressed={selectedTime === slot}
                          onClick={() => setSelectedTime(slot)}
                          className="py-3 px-2 rounded-lg text-sm font-medium transition-all"
                          style={{
                            backgroundColor: selectedTime === slot ? primaryColor : 'hsl(var(--secondary))',
                            color: selectedTime === slot ? 'white' : 'hsl(var(--foreground))'
                          }}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 4 && (
            <div className="animate-fade-in">
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Confirme seu agendamento
              </h2>
              <p className="text-muted-foreground mb-6">Revise os detalhes e preencha seus dados</p>

              {/* Summary */}
              <div className="bg-secondary/50 rounded-2xl p-4 mb-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Serviços</span>
                    <span className="font-medium text-right">{cartServices.map(s => s.name).join(', ') || 'Nenhum'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profissional</span>
                    <span className="font-medium">
                      {selectedProfessional === "any" ? "Qualquer disponível" : selectedProfessionalData?.name}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data</span>
                    <span className="font-medium">
                      {selectedDate && format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Horário</span>
                    <span className="font-medium">{selectedTime}</span>
                  </div>
                </div>
              </div>

              {/* Client Info */}
              <div className="space-y-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Seu nome *</Label>
                  <Input
                    id="clientName"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">WhatsApp *</Label>
                  <Input
                    id="clientPhone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="(00) 00000-0000"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    onBlur={(e) => checkPendingReviews(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientBirthday">Data de nascimento (Opcional)</Label>
                  <Input
                    id="clientBirthday"
                    type="tel"
                    placeholder="DD/MM/AAAA"
                    value={clientBirthday}
                    onChange={handleBirthdayChange}
                    maxLength={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    🎂 No seu aniversário você pode ganhar um presente especial!
                  </p>
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
                      Concordo que o estabelecimento tire fotos do meu procedimento para compor o portfólio (Galeria),
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
                        1. <strong>Objeto:</strong> Autorizo o uso da minha imagem (fotografia e vídeo) capturada durante o procedimento estético realizado neste estabelecimento.
                      </p>
                      <p>
                        2. <strong>Finalidade:</strong> As imagens serão utilizadas exclusivamente para fins de divulgação do trabalho profissional (portfólio), podendo ser veiculadas em:
                        <ul className="list-disc pl-5 mt-1">
                          <li>Redes sociais do estabelecimento e profissionais (Instagram, Facebook, etc.);</li>
                          <li>Site oficial e aplicativos do estabelecimento;</li>
                          <li>Materiais impressos de divulgação interna.</li>
                        </ul>
                      </p>
                      <p>
                        3. <strong>Gratuidade:</strong> A presente autorização é concedida a título gratuito, não havendo nada a ser reclamado a título de direitos autorais ou conexos.
                      </p>
                      <p>
                        4. <strong>Vigência:</strong> Esta autorização é válida por tempo indeterminado e pode ser revogada a qualquer momento mediante solicitação por escrito.
                      </p>
                    </div>
                    <div className="flex justify-end pt-4">
                      <Button onClick={() => setShowTerms(false)}>Entendi</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>


              {/* Coupon */}
              <div className="mb-6">
                <Label className="flex items-center gap-2 mb-2">
                  <Gift size={16} style={{ color: primaryColor }} />
                  Cupom de desconto
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Digite o código"
                    disabled={!!couponApplied}
                    maxLength={30}
                  />
                  <Button
                    onClick={validateCoupon}
                    disabled={validatingCoupon || !couponCode.trim() || !!couponApplied}
                    variant="outline"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    {validatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                  </Button>
                </div>
                {couponApplied && (
                  <p className="text-sm mt-2" style={{ color: primaryColor }}>
                    ✓ {couponApplied.message}
                  </p>
                )}
              </div>

              {/* Price Summary */}
              <div className="border-t border-border pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>R$ {price.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm" style={{ color: primaryColor }}>
                      <span>Desconto</span>
                      <span>- R$ {discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2">
                    <span>Total</span>
                    <span style={{ color: primaryColor }}>R$ {finalPrice.toFixed(2)}</span>
                  </div>
                </div>

                {/* PIX Payment Info */}
                {salon?.pix_key && finalPrice > 0 && (
                  <div className="mt-6 p-4 bg-secondary/30 rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg">💳</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Pagamento via PIX</p>
                        <p className="text-xs text-muted-foreground">Pague no dia do atendimento</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">Chave PIX</p>
                          <p className="font-mono text-sm font-medium break-all">{salon.pix_key}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(salon.pix_key || '');
                            toast.success('Chave PIX copiada!');
                          }}
                          className="ml-2"
                          aria-label="Copiar chave PIX"
                        >
                          <Copy size={16} aria-hidden="true" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        💡 Você pode pagar via PIX no dia do atendimento
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-border">
            {step > 1 ? (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={18} className="mr-2" />
                Voltar
              </Button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <Button
                size="lg"
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && cart.length === 0) ||
                  (step === 2 && !selectedProfessional && hasBookableItems) ||
                  (step === 3 && (!selectedDate || !selectedTime))
                }
                style={{
                  backgroundColor: primaryColor,
                  color: 'white'
                }}
              >
                Próximo
                <ArrowRight size={18} className="ml-2" />
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={handleConfirmBooking}
                disabled={submitting || !clientName.trim() || !clientPhone.trim() || !clientBirthday}
                style={{
                  backgroundColor: primaryColor,
                  color: 'white'
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Agendando...
                  </>
                ) : (
                  <>
                    <Check size={18} className="mr-2" />
                    Confirmar Agendamento
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Ao agendar, você concorda com os termos de uso do estabelecimento.
        </p>
      </main >

      {/* Review Modal */}
      {
        showReviewModal && pendingReviews.length > 0 && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-in" role="dialog" aria-modal="true" aria-label="Avalie sua visita anterior">
              <div className="text-center mb-6">
                <div
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}20` }}
                >
                  <Star size={28} style={{ color: primaryColor }} />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-2">
                  Avalie sua visita anterior
                </h3>
                <p className="text-sm text-muted-foreground">
                  {pendingReviews[0].service_name} com {pendingReviews[0].professional_name}
                  <br />
                  <span className="text-xs">
                    {new Date(pendingReviews[0].date + 'T12:00:00').toLocaleDateString('pt-BR', {
                      day: 'numeric',
                      month: 'long'
                    })}
                  </span>
                </p>
              </div>

              {/* Star Rating */}
              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setCurrentRating(star)}
                    aria-label={`${star} de 5 estrelas`}
                    aria-pressed={star === currentRating}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      size={36}
                      fill={star <= currentRating ? primaryColor : 'transparent'}
                      stroke={star <= currentRating ? primaryColor : 'hsl(var(--muted-foreground))'}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
              </div>

              {/* Comment */}
              <div className="mb-6">
                <Label htmlFor="reviewComment" className="text-sm text-muted-foreground">
                  Comentário (opcional)
                </Label>
                <textarea
                  id="reviewComment"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Conte como foi sua experiência..."
                  className="w-full mt-2 p-3 rounded-lg bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground resize-none h-24"
                  maxLength={500}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={skipReview}
                  className="flex-1"
                >
                  Pular
                </Button>
                <Button
                  onClick={submitReview}
                  disabled={submittingReview}
                  style={{ backgroundColor: primaryColor, color: 'white' }}
                  className="flex-1"
                >
                  {submittingReview ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Enviar Avaliação'
                  )}
                </Button>
              </div>

              {pendingReviews.length > 1 && (
                <p className="text-xs text-center text-muted-foreground mt-4">
                  +{pendingReviews.length - 1} avaliações pendentes
                </p>
              )}
            </div>
          </div>
        )
      }

      {/* Prompt para ativar notificações - só renderiza quando salon está carregado */}
      {salon?.id && <NotificationPrompt salonId={salon.id} />}

      {/* PWA Install Prompt for Salon */}
      {salon && slug && (
        <SalonInstallPrompt
          salonName={salon.name}
          salonSlug={slug}
          salonLogo={salon.logo_url || undefined}
          salonThemeColor={safeHexColor(salon.primary_color)}

        />
      )}
    </div >
  );
};

export default PublicSalon;