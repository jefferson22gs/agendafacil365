import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    Store,
    MapPin,
    Clock,
    Phone,
    Users,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    Sparkles,
    Building2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OnboardingWizardProps {
    userId: string;
    sellerId?: string | null; // Adicionado vendedor que indicou
    onComplete: () => void;
}

interface SalonFormData {
    name: string;
    address: string;
    city: string;
    state: string;
    phone: string;
    whatsapp: string;
    opening_time: string;
    closing_time: string;
    working_days: number[];
}

const STEPS = [
    { id: 1, title: "Dados do estabelecimento", icon: Store },
    { id: 2, title: "Localização", icon: MapPin },
    { id: 3, title: "Horários", icon: Clock },
    { id: 4, title: "Contato", icon: Phone },
    { id: 5, title: "Conclusão", icon: CheckCircle2 },
];

const DAYS_OF_WEEK = [
    { id: 0, label: "Dom" },
    { id: 1, label: "Seg" },
    { id: 2, label: "Ter" },
    { id: 3, label: "Qua" },
    { id: 4, label: "Qui" },
    { id: 5, label: "Sex" },
    { id: 6, label: "Sáb" },
];

export function OnboardingWizard({ userId, sellerId, onComplete }: OnboardingWizardProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<SalonFormData>({
        name: "",
        address: "",
        city: "",
        state: "",
        phone: "",
        whatsapp: "",
        opening_time: "09:00",
        closing_time: "19:00",
        working_days: [1, 2, 3, 4, 5, 6],
    });

    const progress = (currentStep / STEPS.length) * 100;

    const updateField = (field: keyof SalonFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const toggleDay = (dayId: number) => {
        setFormData(prev => ({
            ...prev,
            working_days: prev.working_days.includes(dayId)
                ? prev.working_days.filter(d => d !== dayId)
                : [...prev.working_days, dayId].sort()
        }));
    };

    const canProceed = () => {
        switch (currentStep) {
            case 1:
                return formData.name.trim().length > 0;
            case 2:
                return formData.city.trim().length > 0 && formData.state.trim().length > 0;
            case 3:
                return formData.working_days.length > 0;
            case 4:
                return formData.phone.trim().length > 0 || formData.whatsapp.trim().length > 0;
            default:
                return true;
        }
    };

    const handleNext = () => {
        if (currentStep < STEPS.length) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleComplete = async () => {
        setLoading(true);
        try {
            // Preparar dados do salão
            const salonData: any = {
                owner_id: userId,
                name: formData.name,
                address: formData.address || null,
                city: formData.city || null,
                state: formData.state || null,
                phone: formData.phone || null,
                whatsapp: formData.whatsapp || null,
                opening_time: formData.opening_time,
                closing_time: formData.closing_time,
                working_days: formData.working_days,
                is_active: true,
            };

            // Adicionar seller_id se houver vendedor indicado
            if (sellerId) {
                salonData.seller_id = sellerId;
            }

            const { error } = await supabase
                .from('salons')
                .insert([salonData])
                .select()
                .single();

            if (error) throw error;

            toast.success("Estabelecimento configurado com sucesso!");
            
            // Limpar seller_id do localStorage após uso
            if (sellerId) {
                localStorage.removeItem('seller_id');
            }
            
            onComplete();
        } catch (error: any) {
            console.error("Error creating salon:", error);
            toast.error(error.message || "Erro ao criar estabelecimento");
        } finally {
            setLoading(false);
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        <div className="text-center mb-6">
                            <Store className="w-16 h-16 mx-auto text-primary mb-4" aria-hidden />
                            <h2 className="text-2xl font-bold text-foreground">Vamos configurar seu estabelecimento!</h2>
                            <p className="text-muted-foreground">Qual é o nome do seu estabelecimento?</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome do estabelecimento *</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => updateField("name", e.target.value)}
                                placeholder="Ex: Studio Beleza & Estilo"
                                className="text-lg py-6"
                            />
                        </div>
                    </motion.div>
                );

            case 2:
                return (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        <div className="text-center mb-6">
                            <MapPin className="w-16 h-16 mx-auto text-primary mb-4" />
                            <h2 className="text-2xl font-bold text-foreground">Onde você está localizado?</h2>
                            <p className="text-muted-foreground">Informe o endereço do seu estabelecimento</p>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="address">Endereço</Label>
                                <Input
                                    id="address"
                                    value={formData.address}
                                    onChange={(e) => updateField("address", e.target.value)}
                                    placeholder="Rua, número, bairro"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="city">Cidade *</Label>
                                    <Input
                                        id="city"
                                        value={formData.city}
                                        onChange={(e) => updateField("city", e.target.value)}
                                        placeholder="São Paulo"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="state">Estado *</Label>
                                    <Input
                                        id="state"
                                        value={formData.state}
                                        onChange={(e) => updateField("state", e.target.value)}
                                        placeholder="SP"
                                        maxLength={2}
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                );

            case 3:
                return (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        <div className="text-center mb-6">
                            <Clock className="w-16 h-16 mx-auto text-primary mb-4" />
                            <h2 className="text-2xl font-bold text-foreground">Horário de funcionamento</h2>
                            <p className="text-muted-foreground">Configure seus dias e horários</p>
                        </div>
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="opening">Abertura</Label>
                                    <Input
                                        id="opening"
                                        type="time"
                                        value={formData.opening_time}
                                        onChange={(e) => updateField("opening_time", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="closing">Fechamento</Label>
                                    <Input
                                        id="closing"
                                        type="time"
                                        value={formData.closing_time}
                                        onChange={(e) => updateField("closing_time", e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Dias de funcionamento *</Label>
                                <div className="flex flex-wrap gap-2">
                                    {DAYS_OF_WEEK.map((day) => (
                                        <Button
                                            key={day.id}
                                            type="button"
                                            variant={formData.working_days.includes(day.id) ? "brand" : "outline"}
                                            size="sm"
                                            onClick={() => toggleDay(day.id)}
                                            className="w-12"
                                        >
                                            {day.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                );

            case 4:
                return (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        <div className="text-center mb-6">
                            <Phone className="w-16 h-16 mx-auto text-primary mb-4" />
                            <h2 className="text-2xl font-bold text-foreground">Como clientes entram em contato?</h2>
                            <p className="text-muted-foreground">Informe pelo menos um contato</p>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">Telefone</Label>
                                <Input
                                    id="phone"
                                    value={formData.phone}
                                    onChange={(e) => updateField("phone", e.target.value)}
                                    placeholder="(11) 3456-7890"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="whatsapp">WhatsApp</Label>
                                <Input
                                    id="whatsapp"
                                    value={formData.whatsapp}
                                    onChange={(e) => updateField("whatsapp", e.target.value)}
                                    placeholder="(11) 99999-9999"
                                />
                            </div>
                        </div>
                    </motion.div>
                );

            case 5:
                return (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <div className="text-center mb-6">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", delay: 0.2 }}
                            >
                                <Sparkles className="w-20 h-20 mx-auto text-primary mb-4" />
                            </motion.div>
                            <h2 className="text-2xl font-bold text-foreground">Tudo pronto!</h2>
                            <p className="text-muted-foreground">Confira os dados do seu estabelecimento</p>
                        </div>
                        <Card>
                            <CardContent className="p-6 space-y-4">
                                <div className="flex items-center gap-3">
                                    <Store className="text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Nome</p>
                                        <p className="font-medium">{formData.name}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <MapPin className="text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Localização</p>
                                        <p className="font-medium">{formData.city}/{formData.state}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Clock className="text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Horário</p>
                                        <p className="font-medium">{formData.opening_time} - {formData.closing_time}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Users className="text-primary" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Dias</p>
                                        <p className="font-medium">
                                            {formData.working_days.map(d => DAYS_OF_WEEK.find(day => day.id === d)?.label).join(", ")}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="max-w-lg mx-auto">
            {/* Progress */}
            <div className="mb-8">
                <div className="flex justify-between mb-2">
                    {STEPS.map((step) => (
                        <div
                            key={step.id}
                            className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${step.id <= currentStep
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary text-muted-foreground"
                                }`}
                        >
                            <step.icon size={18} aria-hidden />
                            <span className="sr-only">{`Etapa ${step.id}: ${step.title}${step.id === currentStep ? " (atual)" : ""}`}</span>
                        </div>
                    ))}
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-center text-sm text-muted-foreground mt-2">
                    Passo {currentStep} de {STEPS.length}: {STEPS[currentStep - 1].title}
                </p>
            </div>

            {/* Content */}
            <Card>
                <CardContent className="p-6">
                    <AnimatePresence mode="wait">
                        {renderStepContent()}
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex justify-between mt-8">
                        <Button
                            variant="outline"
                            onClick={handleBack}
                            disabled={currentStep === 1}
                        >
                            <ArrowLeft size={16} className="mr-2" />
                            Voltar
                        </Button>

                        {currentStep < STEPS.length ? (
                            <Button
                                variant="brand"
                                onClick={handleNext}
                                disabled={!canProceed()}
                            >
                                Próximo
                                <ArrowRight size={16} className="ml-2" />
                            </Button>
                        ) : (
                            <Button
                                variant="brand"
                                onClick={handleComplete}
                                disabled={loading}
                            >
                                {loading ? "Criando..." : "Concluir"}
                                <CheckCircle2 size={16} className="ml-2" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
