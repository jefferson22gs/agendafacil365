import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BRAND, safeHexColor } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useSalon, Product } from "@/hooks/useSalon";
import { SalonStore } from "@/components/booking/SalonStore";
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
  Mail,
  Cake,
  MapPin,
  ShoppingBag,
  Plus,
  Minus,
  Copy,
  DollarSign
} from "lucide-react";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CartItem {
  product: Product;
  quantity: number;
}

interface ServiceCartItem {
  service: {
    id: string;
    name: string;
    price: number;
    duration_minutes: number;
    icon: string | null;
  };
  quantity: number;
}

const BookingFlow = () => {
  const { salonId } = useParams();
  const navigate = useNavigate();
  const { salon, services, professionals, products, packages, loading, error, validateCoupon, getAvailableTimeSlots, createAppointment } = useSalon(salonId);

  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState<'services' | 'packages'>('services');
  const [selectedServices, setSelectedServices] = useState<ServiceCartItem[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // Client info
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientBirthDate, setClientBirthDate] = useState("");
  
  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ id: string; discount: number; message: string } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Cart for products
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showStore, setShowStore] = useState(false);

  // Service cart functions
  const addServiceToCart = (service: typeof services[0]) => {
    setSelectedServices(prev => {
      const existing = prev.find(item => item.service.id === service.id);
      if (existing) {
        return prev.map(item =>
          item.service.id === service.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        service: {
          id: service.id,
          name: service.name,
          price: service.price,
          duration_minutes: service.duration_minutes,
          icon: service.icon
        },
        quantity: 1
      }];
    });
  };

  const addPackageToCart = (pkg: typeof packages[0]) => {
    if (!pkg.items || pkg.items.length === 0) {
      toast.error("Pacote sem serviços");
      return;
    }

    // Adicionar todos os serviços do pacote ao carrinho
    pkg.items.forEach(item => {
      const service = services.find(s => s.id === item.service_id);
      if (service) {
        for (let i = 0; i < item.quantity; i++) {
          addServiceToCart(service);
        }
      }
    });

    toast.success(`Pacote "${pkg.name}" adicionado!`);
  };

  const removeServiceFromCart = (serviceId: string) => {
    setSelectedServices(prev => prev.filter(item => item.service.id !== serviceId));
  };

  const updateServiceQuantity = (serviceId: string, quantity: number) => {
    if (quantity <= 0) {
      removeServiceFromCart(serviceId);
      return;
    }
    setSelectedServices(prev =>
      prev.map(item =>
        item.service.id === serviceId
          ? { ...item, quantity }
          : item
      )
    );
  };

  const getServiceQuantityInCart = (serviceId: string) => {
    const item = selectedServices.find(i => i.service.id === serviceId);
    return item?.quantity || 0;
  };

  const servicesTotal = selectedServices.reduce(
    (total, item) => total + item.service.price * item.quantity,
    0
  );

  const totalDuration = selectedServices.reduce(
    (total, item) => total + item.service.duration_minutes * item.quantity,
    0
  );

  const [submitting, setSubmitting] = useState(false);

  const steps = [
    { number: 1, label: "Serviço", icon: Scissors },
    { number: 2, label: "Profissional", icon: User },
    { number: 3, label: "Data e Hora", icon: CalendarIcon },
    { number: 4, label: "Confirmar", icon: Check },
  ];

  // Cart functions
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity: Math.min(quantity, item.product.stock) }
          : item
      )
    );
  };

  const cartTotal = cart.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );

  const selectedProfessionalData = professionals.find(p => p.id === selectedProfessional);
  
  // Get the first service for time slot calculation (uses max duration)
  const primaryServiceId = selectedServices.length > 0 ? selectedServices[0].service.id : null;

  useEffect(() => {
    if (selectedDate && primaryServiceId) {
      fetchAvailableSlots();
    }
  }, [selectedDate, primaryServiceId, selectedProfessional]);

  // Debug: Log packages when they change
  useEffect(() => {
    console.log('📦 Packages loaded:', packages.length, packages);
    console.log('📦 Packages is array?', Array.isArray(packages));
    console.log('📦 First package:', packages[0]);
  }, [packages]);

  const fetchAvailableSlots = async () => {
    if (!selectedDate || !primaryServiceId) return;

    setLoadingSlots(true);
    setSelectedTime("");

    try {
      const slots = await getAvailableTimeSlots(
        selectedDate, 
        primaryServiceId, 
        selectedProfessional === "any" ? undefined : selectedProfessional || undefined
      );
      setAvailableSlots(slots);
    } catch (err) {
      console.error("Error fetching slots:", err);
      toast.error("Erro ao buscar horários disponíveis");
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || selectedServices.length === 0) return;

    setValidatingCoupon(true);
    try {
      const result = await validateCoupon(couponCode, servicesTotal);
      
      if (result.valid && result.coupon && result.discount !== undefined) {
        setCouponApplied({
          id: result.coupon.id,
          discount: result.discount,
          message: result.message || '',
        });
        toast.success(result.message);
      } else {
        toast.error(result.message || "Cupom inválido");
        setCouponApplied(null);
      }
    } catch (err) {
      toast.error("Erro ao validar cupom");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (selectedServices.length === 0 || !selectedDate || !selectedTime || !clientName.trim() || !clientPhone.trim() || !clientBirthDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    // Get a professional if "any" was selected
    let finalProfessionalId = selectedProfessional;
    if (selectedProfessional === "any" || !selectedProfessional) {
      // Pick the first available professional
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
      const finalServicePrice = servicesTotal - discount;

      // Create appointment for the first service (main service)
      const firstService = selectedServices[0];

      const appointmentData = await createAppointment({
        serviceId: firstService.service.id,
        professionalId: finalProfessionalId!,
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: selectedTime,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim() || undefined,
        clientBirthDate: clientBirthDate || undefined,
        couponId: couponApplied?.id,
        price: servicesTotal,
        discount,
        finalPrice: finalServicePrice + cartTotal,
      });

      if (appointmentData) {
      // Notificações são enfileiradas no servidor, nunca enviadas pelo navegador.

        // Status real: salão com confirmação automática devolve "confirmed" já no INSERT.
        toast.success(appointmentData.status === "confirmed" ? "Agendamento confirmado!" : "Solicitação enviada! Aguardando confirmação do salão.");

        // Redirecionar para página de confirmação
        navigate(`/appointment-confirmation?id=${appointmentData.id}`);
      }
    } catch (err: any) {
      console.error("Error creating appointment:", err);
      toast.error(err.message || "Erro ao criar agendamento");
    } finally {
      setSubmitting(false);
    }
  };

  const discount = couponApplied?.discount || 0;
  const servicePrice = servicesTotal - discount;
  const finalPrice = servicePrice + cartTotal;

  const isDateDisabled = (date: Date) => {
    const today = startOfDay(new Date());
    if (isBefore(date, today)) return true;
    
    if (salon) {
      const dayOfWeek = date.getDay();
      return !salon.working_days.includes(dayOfWeek);
    }
    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Carregando</span>
      </div>
    );
  }

  if (error || !salon) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-4" role="alert">
          <p className="text-muted-foreground mb-4">{error
 || "Estabelecimento não encontrado"}</p>
          <Button variant="brand" onClick={() => navigate('/')}>Voltar ao início</Button>
        </div>
      </div>
    );
  }

  // Success step
  if (step === 5) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-success/20 flex items-center justify-center">
            <Check size={40} className="text-success" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-4">
            Agendamento Confirmado!
          </h1>
          <p className="text-muted-foreground mb-6">
            Seu agendamento foi realizado com sucesso. Você receberá uma confirmação em breve.
          </p>
          <div className="bg-card border border-border shadow-sm rounded-2xl p-6 mb-6 text-left">
            <div className="space-y-3">
              <div>
                <span className="text-muted-foreground">Serviços</span>
                <div className="mt-1 space-y-1">
                  {selectedServices.map((item) => (
                    <div key={item.service.id} className="flex justify-between">
                      <span className="font-medium text-foreground">
                        {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.service.name}
                      </span>
                      <span className="text-muted-foreground">
                        R$ {(item.service.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
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
                  {selectedProfessional === "any" ? "Qualquer" : selectedProfessionalData?.name}
                </span>
              </div>
              <div className="border-t border-border pt-3 mt-3">
                <div className="flex justify-between">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="text-xl font-bold text-primary">R$ {finalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* PIX Payment Card */}
          {salon?.pix_key && (
            <div className="glass-card border-primary/30 bg-primary/5 rounded-2xl p-6 mb-6 text-left">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="text-primary" size={24} />
                <h3 className="font-semibold text-lg text-foreground">Pagamento via PIX</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Você pode pagar agora via PIX usando a chave abaixo:
              </p>
              <div className="flex items-center gap-2 p-3 bg-background rounded-lg border border-border">
                <code className="flex-1 text-sm font-mono text-foreground break-all">
                  {salon.pix_key}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(salon.pix_key || '');
                    toast.success("Chave PIX copiada!");
                  }}
                >
                  <Copy size={16} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Após o pagamento, envie o comprovante via WhatsApp
              </p>
            </div>
          )}

          <Button variant="brand" size="lg" onClick={() => navigate('/')}>
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="container px-4">
          <div className="flex items-center justify-between gap-3 min-h-16 py-2">
            {/* Identidade do estabelecimento (logo/nome do tenant) prevalece sobre a marca da plataforma */}
            <div className="flex items-center gap-3 min-w-0">
              {salon.logo_url && (
                <img
                  src={salon.logo_url}
                  alt=""
                  className="w-10 h-10 rounded-xl object-cover border border-border bg-card shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{salon.name}</p>
                {salon.address && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 min-w-0">
                    <MapPin size={12} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{salon.address}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {products.length > 0 && (
                <Button
                  variant={showStore ? "brand" : "outline"}
                  size="sm"
                  onClick={() => setShowStore(!showStore)}
                  className="relative"
                >
                  <ShoppingBag size={16} className="mr-2" />
                  Loja
                  {cart.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {cart.reduce((t, i) => t + i.quantity, 0)}
                    </span>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container px-4 py-6 sm:py-8 max-w-2xl mx-auto">
        {/* Store View */}
        {showStore ? (
          <div className="animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Loja do estabelecimento
                </h2>
                <p className="text-muted-foreground">
                  Produtos disponíveis para compra
                </p>
              </div>
              <Button variant="outline" onClick={() => setShowStore(false)}>
                <ArrowLeft size={16} className="mr-2" />
                Voltar ao agendamento
              </Button>
            </div>
            <SalonStore
              products={products}
              cart={cart}
              onAddToCart={addToCart}
              onRemoveFromCart={removeFromCart}
              onUpdateQuantity={updateCartQuantity}
            />
          </div>
        ) : (
          <>
        {/* Progress Steps */}
        <ol className="flex items-center justify-between mb-8" aria-label="Etapas do agendamento">
          {steps.map((s, index) => (
            <li key={s.number} className="flex items-center" aria-current={step === s.number ? "step" : undefined}>
              <div className="flex flex-col items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all
                  ${step >= s.number 
                    ? 'bg-gradient-to-br from-primary to-brand-hover text-primary-foreground' 
                    : 'bg-secondary text-muted-foreground'
                  }
                `}>
                  {step > s.number ? <Check size={18} aria-hidden="true" /> : <s.icon size={18} aria-hidden="true" />}
                </div>
                <span className={`text-[11px] sm:text-xs mt-2 text-center ${step === s.number ? 'text-foreground font-semibold' : step > s.number ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-3 sm:w-12 md:w-20 h-0.5 mx-1 sm:mx-2 ${step > s.number ? 'bg-primary' : 'bg-border'}`} aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>

        {/* Step Content */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-6 md:p-8">
          {/* Step 1: Select Service */}
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Escolha o serviço
              </h2>
              <p className="text-muted-foreground mb-4">Selecione o que você deseja fazer</p>

              {/* Tabs */}
              <div className="flex gap-2 mb-6 border-b border-border">
                <button
                  type="button"
                  aria-pressed={activeTab === 'services'}
                  onClick={() => setActiveTab('services')}
                  className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                    activeTab === 'services'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Serviços
                </button>
                {packages.length > 0 && (
                  <button
                    type="button"
                    aria-pressed={activeTab === 'packages'}
                    onClick={() => setActiveTab('packages')}
                    className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                      activeTab === 'packages'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Gift size={16} className="inline mr-1" />
                    Pacotes
                  </button>
                )}
              </div>

              {/* Services Tab */}
              {activeTab === 'services' && (
                services.length === 0 ? (
                  <div className="text-center py-12">
                    <Scissors size={48} className="mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhum serviço disponível</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Cart Summary */}
                    {selectedServices.length > 0 && (
                      <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-foreground">
                            {selectedServices.reduce((t, i) => t + i.quantity, 0)} serviço(s) selecionado(s)
                          </span>
                          <span className="font-bold text-primary">R$ {servicesTotal.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Duração total: {totalDuration} minutos
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3">
                      {services.map((service) => {
                        const quantityInCart = getServiceQuantityInCart(service.id);

                        return (
                          <div
                            key={service.id}
                            className={`
                              relative flex flex-wrap items-center gap-3 sm:gap-4 p-4 rounded-2xl border-2 transition-all
                              ${quantityInCart > 0
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                              }
                            `}
                          >
                            <span className="text-2xl" aria-hidden="true">{service.icon || '✂️'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground">{service.name}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock size={14} />
                                {service.duration_minutes}min
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
                            <p className="text-lg font-bold text-foreground">
                              R$ {service.price.toFixed(2)}
                            </p>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-2">
                              {quantityInCart > 0 ? (
                                <>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-11 w-11"
                                    aria-label={`Diminuir quantidade de ${service.name}`}
                                    onClick={() => updateServiceQuantity(service.id, quantityInCart - 1)}
                                  >
                                    <Minus size={14} />
                                  </Button>
                                  <span className="w-6 text-center font-medium" aria-live="polite">{quantityInCart}</span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-11 w-11"
                                    aria-label={`Aumentar quantidade de ${service.name}`}
                                    onClick={() => updateServiceQuantity(service.id, quantityInCart + 1)}
                                  >
                                    <Plus size={14} />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="brand"
                                  size="sm"
                                  onClick={() => addServiceToCart(service)}
                                >
                                  <Plus size={14} className="mr-1" />
                                  Adicionar
                                </Button>
                              )}
                            </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}

              {/* Packages Tab */}
              {activeTab === 'packages' && (
                packages.length === 0 ? (
                  <div className="text-center py-12">
                    <Gift size={48} className="mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhum pacote disponível</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Cart Summary */}
                    {selectedServices.length > 0 && (
                      <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-foreground">
                            {selectedServices.reduce((t, i) => t + i.quantity, 0)} serviço(s) selecionado(s)
                          </span>
                          <span className="font-bold text-primary">R$ {servicesTotal.toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Duração total: {totalDuration} minutos
                        </div>
                      </div>
                    )}

                    <div className="grid gap-4">
                      {packages.map((pkg) => {
                        const originalPrice = pkg.items?.reduce((sum, item) => sum + (item.service_price * item.quantity), 0) || 0;
                        const savings = originalPrice - pkg.price;

                        return (
                          <div
                            key={pkg.id}
                            className="relative p-4 sm:p-6 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-brand-hover/5 hover:border-primary/50 transition-all"
                          >
                            <div className="flex items-start gap-4 mb-4">
                              <div className="p-3 rounded-xl bg-primary/10">
                                <Gift size={24} className="text-primary" />
                              </div>
                              <div className="flex-1 min-w-0 pr-24">
                                <h3 className="font-bold text-lg text-foreground mb-1">{pkg.name}</h3>
                                {pkg.description && (
                                  <p className="text-sm text-muted-foreground mb-2">{pkg.description}</p>
                                )}
                                <div className="flex items-center gap-2 text-sm">
                                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                                    {pkg.discount_percent}% OFF
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    Válido por {pkg.validity_days} dias
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Services in Package */}
                            <div className="mb-4 p-3 rounded-lg bg-background/50">
                              <p className="text-xs font-medium text-muted-foreground mb-2">Serviços inclusos:</p>
                              <div className="space-y-1">
                                {pkg.items?.map((item, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-sm">
                                    <Check size={14} className="text-primary" />
                                    <span className="text-foreground">
                                      {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.service_name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Pricing */}
                            <div className="flex flex-wrap items-end justify-between gap-3">
                              <div>
                                <p className="text-xs text-muted-foreground line-through">
                                  De R$ {originalPrice.toFixed(2)}
                                </p>
                                <p className="text-2xl font-bold text-primary">
                                  R$ {pkg.price.toFixed(2)}
                                </p>
                                <p className="text-xs text-success">
                                  Economize R$ {savings.toFixed(2)}
                                </p>
                              </div>
                              <Button
                                variant="brand"
                                onClick={() => addPackageToCart(pkg)}
                              >
                                <Plus size={16} className="mr-2" />
                                Adicionar Pacote
                              </Button>
                            </div>

                            {/* Non-cumulative badge */}
                            <div className="absolute top-3 right-3">
                              <Badge variant="outline" className="text-xs">
                                Não acumulativo
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
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
                    className={`
                      flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left
                      ${selectedProfessional === pro.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                      }
                    `}
                  >
                    <div className="w-14 h-14 shrink-0 rounded-full bg-gradient-to-br from-primary to-brand-hover flex items-center justify-center text-primary-foreground font-bold text-xl">
                      {pro.avatar_url ? (
                        <img src={pro.avatar_url} alt={pro.name} className="w-full h-full rounded-full object-cover" />
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
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check size={14} className="text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}

                <button
                  type="button"
                  aria-pressed={selectedProfessional === "any"}
                  onClick={() => setSelectedProfessional("any")}
                  className={`
                    flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left
                    ${selectedProfessional === "any" 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                    }
                  `}
                >
                  <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                    <User size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">Sem preferência</p>
                    <p className="text-sm text-muted-foreground">Qualquer profissional disponível</p>
                  </div>
                  {selectedProfessional === "any" && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check size={14} className="text-primary-foreground" />
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

              {/* Calendar */}
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

              {/* Time Slots */}
              {selectedDate && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    Horários disponíveis para {format(selectedDate, "dd/MM")}
                  </label>
                  
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden="true" />
                      <span className="sr-only">Carregando horários</span>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum horário disponível para esta data
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {availableSlots.map((time) => (
                        <button
                          type="button"
                          key={time}
                          aria-pressed={selectedTime === time}
                          onClick={() => setSelectedTime(time)}
                          className={`
                            py-3 rounded-lg font-medium transition-all
                            ${selectedTime === time 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-secondary text-foreground hover:bg-secondary/80'
                            }
                          `}
                        >
                          {time}
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
              <p className="text-muted-foreground mb-6">Preencha seus dados e revise os detalhes</p>

              {/* Client Info */}
              <div className="space-y-4 mb-6">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Seu nome *</Label>
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
                  <Label htmlFor="clientEmail">E-mail</Label>
                  <Input
                    id="clientEmail"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="seu@email.com"
                    type="email"
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientBirthDate" className="flex items-center gap-2">
                    <Cake size={16} className="text-primary" />
                    Data de nascimento *
                  </Label>
                  <Input
                    id="clientBirthDate"
                    value={clientBirthDate}
                    onChange={(e) => setClientBirthDate(e.target.value)}
                    type="date"
                    className="h-12"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Usamos para enviar promoções especiais no seu aniversário!
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-4 mb-6">
                {/* Services Summary */}
                <div className="p-4 rounded-xl bg-secondary/50">
                  <div className="flex items-center gap-3 mb-3">
                    <Scissors size={20} className="text-primary" />
                    <span className="text-foreground font-medium">Serviços</span>
                  </div>
                  <div className="space-y-2">
                    {selectedServices.map((item) => (
                      <div key={item.service.id} className="flex justify-between text-sm">
                        <span className="text-foreground">
                          {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.service.name}
                        </span>
                        <span className="text-muted-foreground">
                          R$ {(item.service.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <User size={20} className="text-primary" />
                    <span className="text-foreground">Profissional</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {selectedProfessional === "any" ? "Sem preferência" : selectedProfessionalData?.name}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <CalendarIcon size={20} className="text-primary" />
                    <span className="text-foreground">Data e hora</span>
                  </div>
                  <span className="font-medium text-foreground text-right">
                    {selectedDate && format(selectedDate, "dd/MM/yyyy")} às {selectedTime}
                  </span>
                </div>
              </div>

              {/* Coupon Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">
                  <Gift size={16} className="inline mr-2" />
                  Cupom de desconto
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite seu cupom"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="h-12"
                    disabled={!!couponApplied}
                  />
                  <Button 
                    variant="outline" 
                    className="h-12 px-6"
                    onClick={handleApplyCoupon}
                    disabled={validatingCoupon || !!couponApplied}
                  >
                    {validatingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
                  </Button>
                </div>
                {couponApplied && (
                  <p className="text-sm text-success mt-2">✓ {couponApplied.message}</p>
                )}
              </div>

              {/* Cart Products */}
              {cart.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <ShoppingBag size={16} className="text-primary" />
                    Produtos adicionados
                  </h4>
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-secondary/50"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity}x R$ {item.product.price.toFixed(2)}
                          </p>
                        </div>
                        <span className="font-medium text-foreground">
                          R$ {(item.product.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="text-muted-foreground">Serviços</span>
                  <span className="text-muted-foreground">R$ {servicesTotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <span className="text-success">Desconto cupom</span>
                    <span className="text-success">- R$ {discount.toFixed(2)}</span>
                  </div>
                )}
                {cartTotal > 0 && (
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <span className="text-muted-foreground">Produtos</span>
                    <span className="text-muted-foreground">R$ {cartTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="font-medium text-foreground">Total</span>
                  <span className="text-2xl font-bold text-foreground">
                    R$ {finalPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-border">
            {step > 1 ? (
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft size={18} className="mr-2" />
                Voltar
              </Button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <Button 
                variant="brand" 
                size="lg"
                onClick={handleNext}
                disabled={
                  (step === 1 && selectedServices.length === 0) ||
                  (step === 2 && !selectedProfessional) ||
                  (step === 3 && (!selectedDate || !selectedTime))
                }
              >
                Continuar
                <ArrowRight size={18} className="ml-2" />
              </Button>
            ) : (
              <Button 
                variant="brand" 
                size="lg"
                onClick={handleConfirmBooking}
                disabled={submitting || !clientName.trim() || !clientPhone.trim() || !clientBirthDate}
              >
                {submitting ? (
                  <Loader2 size={18} className="mr-2 animate-spin" />
                ) : (
                  <Check size={18} className="mr-2" />
                )}
                Confirmar agendamento
              </Button>
            )}
          </div>
        </div>
          </>
        )}
        {/* Assinatura discreta da plataforma (substitui o logo do SaaS que ficava no cabeçalho) */}
        <p className="mt-8 text-center text-xs text-muted-foreground">{BRAND.poweredBy}</p>
      </main>

      {/* ponytail: /booking/:salonId usa id (sem slug) e fica fora do scope do app do salão; instalar/notificar é feito em /s/:slug. */}
    </div>
  );
};

export default BookingFlow;
