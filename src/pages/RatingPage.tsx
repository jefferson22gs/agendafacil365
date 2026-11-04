import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Send, CheckCircle, Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const RatingPage = () => {
    const { appointmentId } = useParams<{ appointmentId: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState("");
    const [appointment, setAppointment] = useState<any>(null);
    const [salonSlug, setSalonSlug] = useState<string | null>(null);

    useEffect(() => {
        if (appointmentId) {
            loadAppointment();
        }
    }, [appointmentId]);

    const loadAppointment = async () => {
        try {
            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    *,
                    services:service_id (name),
                    professionals:professional_id (name),
                    salons:salon_id (name, slug)
                `)
                .eq('id', appointmentId)
                .single();

            if (error) throw error;
            setAppointment(data);

            // Guardar o slug do salão para redirecionamento
            if (data?.salons?.slug) {
                setSalonSlug(data.salons.slug);
            }
        } catch (error) {
            console.error('Erro ao carregar agendamento:', error);
            toast.error('Agendamento não encontrado');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (rating === 0) {
            toast.error('Por favor, selecione uma nota');
            return;
        }

        setSubmitting(true);
        try {
            // Salvar avaliação na tabela reviews
            const { error } = await (supabase as any)
                .from('reviews')
                .insert({
                    salon_id: appointment.salon_id,
                    client_id: appointment.client_id || null,
                    appointment_id: appointmentId,
                    professional_id: appointment.professional_id,
                    rating: rating,
                    comment: comment || null,
                    is_public: true,
                });

            if (error) throw error;

            setSubmitted(true);
            toast.success('Avaliação enviada com sucesso!');

            // Redirecionar para página do salão após 3 segundos
            setTimeout(() => {
                if (salonSlug) {
                    navigate(`/s/${salonSlug}`);
                } else {
                    // Fechar aba ou mostrar apenas mensagem
                    window.close();
                }
            }, 3000);
        } catch (error: any) {
            console.error('Erro ao enviar avaliação:', error);
            toast.error(error.message || 'Erro ao enviar avaliação');
        } finally {
            setSubmitting(false);
        }
    };

    const getRatingLabel = (value: number) => {
        switch (value) {
            case 1: return 'Péssimo 😞';
            case 2: return 'Ruim 😕';
            case 3: return 'Regular 😐';
            case 4: return 'Bom 😊';
            case 5: return 'Excelente 🤩';
            default: return 'Toque para avaliar';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" aria-hidden="true"></div>
                <span className="sr-only">Carregando</span>
            </div>
        );
    }

    if (!appointment) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4" role="alert">
                <X className="w-16 h-16 text-destructive mb-4" aria-hidden="true" />
                <h1 className="text-xl font-bold mb-2">Agendamento não encontrado</h1>
                <p className="text-muted-foreground mb-4">Este link pode ter expirado.</p>
                <Button onClick={() => salonSlug ? navigate(`/s/${salonSlug}`) : window.close()}>Voltar</Button>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-center"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                        className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6"
                    >
                        <CheckCircle className="w-12 h-12 text-success" />
                    </motion.div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">
                        Obrigado pela avaliação!
                    </h1>
                    <p className="text-muted-foreground mb-4">
                        Sua opinião é muito importante para nós.
                    </p>
                    <div className="flex justify-center gap-1 mb-6">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                                key={star}
                                className={`w-8 h-8 ${star <= rating ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
                            />
                        ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Você pode fechar esta janela.
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-brand-hover p-6 text-center text-primary-foreground">
                <Heart className="w-10 h-10 mx-auto mb-2" />
                <h1 className="text-2xl font-bold">Como foi seu atendimento?</h1>
                <p className="text-sm opacity-90 mt-1">
                    Sua avaliação ajuda a melhorar nossos serviços
                </p>
            </div>

            {/* Content */}
            <div className="p-6 max-w-md mx-auto">
                {/* Service Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-2xl p-4 mb-6 border border-border"
                >
                    <p className="text-sm text-muted-foreground mb-1">Serviço realizado</p>
                    <p className="font-bold text-lg text-foreground">
                        {appointment.services?.name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                        Profissional: <span className="text-foreground">{appointment.professionals?.name}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Local: <span className="text-foreground">{appointment.salons?.name}</span>
                    </p>
                </motion.div>

                {/* Rating Stars */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-center mb-6"
                >
                    <p className="text-sm text-muted-foreground mb-3">
                        Toque nas estrelas para avaliar
                    </p>
                    <div className="flex justify-center gap-2 mb-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <motion.button
                                type="button"
                                key={star}
                                aria-label={`${star} de 5 estrelas`}
                                aria-pressed={star === rating}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setRating(star)}
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                                className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <Star
                                    className={`w-12 h-12 transition-all ${star <= (hoverRating || rating)
                                        ? 'text-yellow-500 fill-yellow-500 drop-shadow-lg'
                                        : 'text-gray-300'
                                        }`}
                                />
                            </motion.button>
                        ))}
                    </div>
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={hoverRating || rating}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="text-lg font-medium text-foreground"
                        >
                            {getRatingLabel(hoverRating || rating)}
                        </motion.p>
                    </AnimatePresence>
                </motion.div>

                {/* Comment */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-6"
                >
                    <label htmlFor="ratingComment" className="text-sm text-muted-foreground mb-2 block">
                        Deixe um comentário (opcional)
                    </label>
                    <Textarea
                        id="ratingComment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Conte como foi sua experiência..."
                        className="min-h-[100px] resize-none"
                    />
                </motion.div>

                {/* Submit Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Button
                        onClick={handleSubmit}
                        disabled={rating === 0 || submitting}
                        className="w-full h-14 text-lg font-bold"
                        variant="brand"
                    >
                        {submitting ? (
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current"></div>
                        ) : (
                            <>
                                <Send className="w-5 h-5 mr-2" />
                                Enviar Avaliação
                            </>
                        )}
                    </Button>
                </motion.div>

                {/* Skip */}
                <button
                    type="button"
                    onClick={() => salonSlug ? navigate(`/s/${salonSlug}`) : window.close()}
                    className="w-full min-h-11 text-center text-sm text-muted-foreground mt-4 hover:text-foreground transition-colors"

                >
                    Avaliar depois
                </button>
            </div>
        </div>
    );
};

export default RatingPage;
