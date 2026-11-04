import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/icons/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Clock, 
  Scissors, 
  User, 
  Calendar, 
  Gift,
  MapPin,
  Phone,
  Star,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format, addDays, isSameDay, isToday, isTomorrow, startOfToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const services = [
  { id: 1, name: "Corte Masculino", duration: "30min", price: 45, icon: "✂️" },
  { id: 2, name: "Barba", duration: "20min", price: 30, icon: "🧔" },
  { id: 3, name: "Corte + Barba", duration: "50min", price: 65, icon: "💈", popular: true },
  { id: 4, name: "Corte Degradê", duration: "40min", price: 55, icon: "📐" },
  { id: 5, name: "Tratamento Capilar", duration: "45min", price: 80, icon: "💆" },
  { id: 6, name: "Corte Infantil", duration: "25min", price: 35, icon: "👦" },
];

const professionals = [
  { id: 1, name: "Carlos", avatar: "C", specialty: "Especialista em Degradê", rating: 4.9, reviews: 128 },
  { id: 2, name: "Bruno", avatar: "B", specialty: "Barbeiro Tradicional", rating: 4.8, reviews: 95 },
  { id: 3, name: "André", avatar: "A", specialty: "Cortes Modernos", rating: 4.7, reviews: 72 },
];

const timeSlots = [
  { time: "09:00", available: true },
  { time: "09:30", available: true },
  { time: "10:00", available: false },
  { time: "10:30", available: true },
  { time: "11:00", available: true },
  { time: "11:30", available: false },
  { time: "14:00", available: true },
  { time: "14:30", available: true },
  { time: "15:00", available: true },
  { time: "15:30", available: false },
  { time: "16:00", available: true },
  { time: "16:30", available: true },
  { time: "17:00", available: true },
  { time: "17:30", available: true },
  { time: "18:00", available: false },
  { time: "18:30", available: true },
  { time: "19:00", available: true },
  { time: "19:30", available: true },
];

const Booking = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [couponCode, setCouponCode] = useState("");
  const dateScrollRef = useRef<HTMLDivElement>(null);

  const steps = [
    { number: 1, label: "Serviço", icon: Scissors },
    { number: 2, label: "Profissional", icon: User },
    { number: 3, label: "Data/Hora", icon: Calendar },
    { number: 4, label: "Confirmar", icon: Check },
  ];

  // Generate next 14 days for date picker
  const dateOptions = Array.from({ length: 14 }, (_, i) => addDays(startOfToday(), i));

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return "Hoje";
    if (isTomorrow(date)) return "Amanhã";
    return format(date, "EEE", { locale: ptBR });
  };

  const selectedServiceData = services.find(s => s.id === selectedService);
  const selectedProfessionalData = professionals.find(p => p.id === selectedProfessional);

  // Animation variants
  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky-header">
        <div className="container-responsive">
          <div className="flex items-center justify-between h-14">
            <button 
              onClick={() => step > 1 ? handleBack() : navigate(-1)}
              className="touch-target -ml-2"
            >
              <ArrowLeft size={24} className="text-foreground" />
            </button>
            <div className="text-center flex-1">
              <p className="text-sm font-semibold text-foreground">Barbearia Premium</p>
            </div>
            <div className="w-10" /> {/* Spacer for alignment */}
          </div>
        </div>
      </header>

      {/* Progress Steps - Mobile optimized */}
      <div className="bg-background border-b border-border">
        <div className="container-responsive py-4">
          <div className="flex items-center justify-between">
            {steps.map((s, index) => (
              <div key={s.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                    step >= s.number 
                      ? 'bg-gradient-to-br from-primary to-brand-hover text-primary-foreground' 
                      : 'bg-secondary text-muted-foreground'
                  )}>
                    {step > s.number ? <Check size={18} /> : <s.icon size={18} />}
                  </div>
                  <span className={cn(
                    "text-[10px] sm:text-xs mt-1.5 font-medium",
                    step >= s.number ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {s.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "h-0.5 flex-1 mx-1 sm:mx-2 rounded-full",
                    step > s.number ? 'bg-primary' : 'bg-border'
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto pb-safe">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="container-responsive py-6"
          >
            {/* Step 1: Select Service */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                    Escolha o serviço
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Selecione o que você deseja fazer</p>
                </div>

                <div className="space-y-3">
                  {services.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => setSelectedService(service.id)}
                      className={cn(
                        "relative w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left touch-target",
                        selectedService === service.id 
                          ? 'border-primary bg-primary/5 shadow-brand' 
                          : 'border-border hover:border-primary/50 active:scale-[0.98]'
                      )}
                    >
                      {service.popular && (
                        <span className="absolute -top-2.5 right-3 px-2.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-semibold rounded-full">
                          Popular
                        </span>
                      )}
                      <span className="text-3xl">{service.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{service.name}</p>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock size={14} />
                          <span>{service.duration}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">
                          R$ {service.price}
                        </p>
                      </div>
                      {selectedService === service.id && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <Check size={14} className="text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Select Professional */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                    Escolha o profissional
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Ou deixe sem preferência</p>
                </div>

                <div className="space-y-3">
                  {professionals.map((pro) => (
                    <button
                      key={pro.id}
                      onClick={() => setSelectedProfessional(pro.id)}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left touch-target",
                        selectedProfessional === pro.id 
                          ? 'border-primary bg-primary/5 shadow-brand' 
                          : 'border-border hover:border-primary/50 active:scale-[0.98]'
                      )}
                    >
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-brand-hover flex items-center justify-center text-primary-foreground font-bold text-xl flex-shrink-0">
                        {pro.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">{pro.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{pro.specialty}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star size={14} className="text-primary fill-primary" />
                          <span className="text-sm font-medium text-foreground">{pro.rating}</span>
                          <span className="text-xs text-muted-foreground">({pro.reviews})</span>
                        </div>
                      </div>
                      {selectedProfessional === pro.id && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check size={14} className="text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}

                  <button
                    onClick={() => setSelectedProfessional(0)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left touch-target",
                      selectedProfessional === 0 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50 active:scale-[0.98]'
                    )}
                  >
                    <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-muted-foreground flex-shrink-0">
                      <User size={24} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">Sem preferência</p>
                      <p className="text-sm text-muted-foreground">Qualquer disponível</p>
                    </div>
                    {selectedProfessional === 0 && (
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
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                    Data e horário
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Quando você quer ser atendido?</p>
                </div>

                {/* Date Picker - Horizontal Scroll */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-foreground">Escolha a data</label>
                  <div 
                    ref={dateScrollRef}
                    className="flex gap-2 overflow-x-auto scroll-snap-x pb-2 -mx-4 px-4"
                  >
                    {dateOptions.map((date) => (
                      <button
                        key={date.toISOString()}
                        onClick={() => setSelectedDate(date)}
                        className={cn(
                          "flex flex-col items-center justify-center min-w-[72px] h-20 rounded-2xl border-2 transition-all scroll-snap-item",
                          selectedDate && isSameDay(selectedDate, date)
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card hover:border-primary/50'
                        )}
                      >
                        <span className={cn(
                          "text-xs font-medium uppercase",
                          selectedDate && isSameDay(selectedDate, date) 
                            ? 'text-primary-foreground/80' 
                            : 'text-muted-foreground'
                        )}>
                          {getDateLabel(date)}
                        </span>
                        <span className={cn(
                          "text-2xl font-bold mt-1",
                          selectedDate && isSameDay(selectedDate, date) 
                            ? 'text-primary-foreground' 
                            : 'text-foreground'
                        )}>
                          {format(date, "dd")}
                        </span>
                        <span className={cn(
                          "text-xs",
                          selectedDate && isSameDay(selectedDate, date) 
                            ? 'text-primary-foreground/80' 
                            : 'text-muted-foreground'
                        )}>
                          {format(date, "MMM", { locale: ptBR })}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Slots */}
                {selectedDate && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-foreground">
                      Horários disponíveis
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {timeSlots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => slot.available && setSelectedTime(slot.time)}
                          disabled={!slot.available}
                          className={cn(
                            "py-3 rounded-xl font-medium text-sm transition-all touch-target",
                            !slot.available 
                              ? 'bg-secondary/50 text-muted-foreground/50 cursor-not-allowed line-through'
                              : selectedTime === slot.time 
                                ? 'bg-primary text-primary-foreground shadow-brand' 
                                : 'bg-secondary text-foreground hover:bg-secondary/80 active:scale-95'
                          )}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                    Confirme o agendamento
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Revise os detalhes</p>
                </div>

                {/* Summary Cards */}
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Scissors size={24} className="text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Serviço</p>
                        <p className="font-semibold text-foreground">{selectedServiceData?.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedServiceData?.duration}</p>
                      </div>
                      <p className="text-xl font-bold text-primary">
                        R$ {selectedServiceData?.price}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-brand-hover flex items-center justify-center text-primary-foreground font-bold">
                        {selectedProfessional === 0 ? <User size={20} /> : selectedProfessionalData?.avatar}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Profissional</p>
                        <p className="font-semibold text-foreground">
                          {selectedProfessional === 0 ? "Sem preferência" : selectedProfessionalData?.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Calendar size={24} className="text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Data e Hora</p>
                        <p className="font-semibold text-foreground">
                          {selectedDate && format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                        </p>
                        <p className="text-sm text-muted-foreground">às {selectedTime}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coupon Input */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Gift size={16} className="text-primary" />
                    Cupom de desconto
                  </label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Digite seu cupom"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="h-12 text-base"
                    />
                    <Button variant="outline" className="h-12 px-6 flex-shrink-0">
                      Aplicar
                    </Button>
                  </div>
                </div>

                {/* Total */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-brand-hover/10 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">Total a pagar</span>
                    <span className="text-3xl font-bold text-foreground">
                      R$ {selectedServiceData?.price}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Fixed Bottom Action */}
      <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border p-4 safe-bottom">
        <div className="container-responsive">
          {step < 4 ? (
            <Button 
              variant="brand" 
              size="lg"
              className="w-full h-14 text-base font-semibold"
              onClick={handleNext}
              disabled={
                (step === 1 && !selectedService) ||
                (step === 2 && selectedProfessional === null) ||
                (step === 3 && (!selectedDate || !selectedTime))
              }
            >
              Continuar
              <ArrowRight size={20} className="ml-2" />
            </Button>
          ) : (
            <Button 
              variant="brand" 
              size="lg" 
              className="w-full h-14 text-base font-semibold"
            >
              <Check size={20} className="mr-2" />
              Confirmar Agendamento
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Booking;
