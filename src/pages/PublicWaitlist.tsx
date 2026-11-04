import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock, Users, Phone, CheckCircle2, ArrowRight } from "lucide-react";
import { BRAND } from "@/config/brand";
import { motion } from "framer-motion";

interface WaitlistEntry {
    position: number;
    estimatedWait: number;
    name: string;
}

const PublicWaitlist = () => {
    const { salonId } = useParams<{ salonId: string }>();
    const [salon, setSalon] = useState<{ name: string; logo_url?: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState<WaitlistEntry | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
    });
    const [queueInfo, setQueueInfo] = useState({
        totalInQueue: 0,
        averageWait: 15,
    });

    useEffect(() => {
        if (salonId) {
            fetchSalonInfo();
        }
    }, [salonId]);

    const fetchSalonInfo = async () => {
        try {
            const { data, error } = await supabase
                .from("salons")
                .select("name, logo_url")
                .eq("id", salonId)
                .single();

            if (error) throw error;
            setSalon(data);

            // Simulate queue info - in production this would come from the database
            setQueueInfo({
                totalInQueue: Math.floor(Math.random() * 5) + 1,
                averageWait: 15,
            });
        } catch (error) {
            console.error("Error fetching salon:", error);
            toast.error("Estabelecimento não encontrado");
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim() || !formData.phone.trim()) {
            toast.error("Preencha todos os campos");
            return;
        }

        setSubmitting(true);
        try {
            // In production, this would save to database
            await new Promise(resolve => setTimeout(resolve, 1000));

            const position = queueInfo.totalInQueue + 1;
            setSubmitted({
                position,
                estimatedWait: position * queueInfo.averageWait,
                name: formData.name,
            });

            toast.success("Você está na fila!");
        } catch (error) {
            console.error("Error joining waitlist:", error);
            toast.error("Erro ao entrar na fila");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
        );
    }

    if (!salon) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
                <Card className="max-w-md w-full glass-card text-center p-8">
                    <h2 className="text-xl font-bold mb-2">Estabelecimento não encontrado</h2>
                    <p className="text-muted-foreground">Verifique o link e tente novamente</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 py-8 px-4">
            <div className="max-w-md mx-auto space-y-6">
                {/* Header */}
                <div className="text-center">
                    {/* Identidade do estabelecimento prevalece; sem logo, só o nome. */}
                    {salon.logo_url && (
                        <img
                            src={salon.logo_url}
                            alt=""
                            className="w-20 h-20 mx-auto mb-4 rounded-2xl object-cover border border-border bg-card"
                        />
                    )}
                    <h1 className="text-2xl font-bold">{salon.name}</h1>
                    <p className="text-muted-foreground">Fila de Espera</p>
                </div>

                {/* Queue Status */}
                <Card className="glass-card">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
                                    <Users className="text-primary" size={24} />
                                </div>
                                <p className="text-2xl font-bold">{queueInfo.totalInQueue}</p>
                                <p className="text-xs text-muted-foreground">Na fila</p>
                            </div>
                            <div>
                                <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
                                    <Clock className="text-primary" size={24} />
                                </div>
                                <p className="text-2xl font-bold">~{queueInfo.totalInQueue * queueInfo.averageWait}min</p>
                                <p className="text-xs text-muted-foreground">Tempo estimado</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Form or Confirmation */}
                {submitted ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <Card className="glass-card border-primary">
                            <CardContent className="p-6 text-center">
                                <div className="w-16 h-16 mx-auto rounded-full bg-primary flex items-center justify-center mb-4">
                                    <CheckCircle2 className="text-primary-foreground" size={32} />
                                </div>
                                <h2 className="text-xl font-bold mb-2">Você está na fila!</h2>
                                <p className="text-muted-foreground mb-4">
                                    Olá, {submitted.name}!
                                </p>

                                <div className="bg-secondary/50 rounded-xl p-4 mb-4">
                                    <p className="text-sm text-muted-foreground">Sua posição</p>
                                    <p className="text-4xl font-bold text-primary">{submitted.position}º</p>
                                    <p className="text-sm text-muted-foreground mt-2">
                                        Tempo estimado: ~{submitted.estimatedWait} minutos
                                    </p>
                                </div>

                                <p className="text-sm text-muted-foreground">
                                    📱 Você receberá uma notificação quando chegar sua vez
                                </p>
                            </CardContent>
                        </Card>
                    </motion.div>
                ) : (
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle>Entrar na Fila</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nome</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Seu nome"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">WhatsApp</Label>
                                    <div className="relative">
                                        <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            id="phone"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="(00) 00000-0000"
                                            className="pl-10"
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Enviaremos uma mensagem quando chegar sua vez
                                    </p>
                                </div>
                                <Button
                                    type="submit"
                                    variant="brand"
                                    className="w-full"
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        "Entrando na fila..."
                                    ) : (
                                        <>
                                            Entrar na Fila
                                            <ArrowRight size={16} className="ml-2" />
                                        </>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Footer */}
                <div className="text-center text-xs text-muted-foreground">
                    <p>Desenvolvido por Código Base</p>
                    <p>{BRAND.poweredBy}</p>
                </div>
            </div>
        </div>
    );
};

export default PublicWaitlist;
