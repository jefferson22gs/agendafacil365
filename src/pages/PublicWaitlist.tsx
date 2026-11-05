import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, MessageCircle, Clock } from "lucide-react";
import { BRAND } from "@/config/brand";

/**
 * /waitlist/:salonId — link público mantido (pode ter sido distribuído).
 * ponytail: a versão anterior simulava a fila (posição sorteada, gravação fingida e aviso que nunca era enviado).
 * A tabela `waitlist` só aceita o dono do estabelecimento (RLS), então visitante não tem como entrar na fila.
 * Até existir inserção pública segura (RPC com validação + rate limit), a página encaminha para canais reais.
 */
type PublicSalon = { name: string; logo_url: string | null; slug: string | null; whatsapp: string | null; phone: string | null };

const digits = (v: string | null) => (v ?? "").replace(/\D/g, "");

const PublicWaitlist = () => {
    const { salonId } = useParams<{ salonId: string }>();
    const [salon, setSalon] = useState<PublicSalon | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!salonId) { setLoading(false); return; }
        supabase
            .from("salons")
            .select("name, logo_url, slug, whatsapp, phone")
            .eq("id", salonId)
            .neq("is_active", false)
            .maybeSingle()
            .then(({ data, error }) => {
                if (error) console.error("Erro ao carregar estabelecimento:", error);
                setSalon((data as PublicSalon) ?? null);
                setLoading(false);
            });
    }, [salonId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center" role="status">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" aria-hidden />
                <span className="sr-only">Carregando…</span>
            </div>
        );
    }

    if (!salon) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <Card className="max-w-md w-full text-center p-8">
                    <h1 className="text-xl font-bold mb-2">Estabelecimento não encontrado</h1>
                    <p className="text-muted-foreground">Verifique o link e tente novamente.</p>
                </Card>
            </div>
        );
    }

    const wa = digits(salon.whatsapp) || digits(salon.phone);
    const waLink = wa ? `https://wa.me/${wa.startsWith("55") ? wa : `55${wa}`}?text=${encodeURIComponent(`Olá! Gostaria de entrar na lista de espera do ${salon.name}.`)}` : null;

    return (
        <div className="min-h-screen bg-background py-8 px-4">
            <div className="max-w-md mx-auto space-y-6">
                <div className="text-center">
                    {salon.logo_url && (
                        <img src={salon.logo_url} alt="" className="w-20 h-20 mx-auto mb-4 rounded-2xl object-cover border border-border bg-card" />
                    )}
                    <h1 className="text-2xl font-bold">{salon.name}</h1>
                    <p className="text-muted-foreground">Lista de espera</p>
                </div>

                <Card>
                    <CardContent className="p-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <Clock className="text-primary shrink-0 mt-0.5" size={20} aria-hidden />
                            <p className="text-sm text-foreground">
                                A lista de espera on-line ainda não está disponível. Escolha um horário livre na agenda
                                ou fale com o estabelecimento para entrar na lista.
                            </p>
                        </div>
                        {salon.slug && (
                            <Button asChild variant="brand" className="w-full">
                                <Link to={`/s/${salon.slug}`}><CalendarDays size={16} className="mr-2" aria-hidden />Ver horários disponíveis</Link>
                            </Button>
                        )}
                        {waLink && (
                            <Button asChild variant="outline" className="w-full">
                                <a href={waLink} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} className="mr-2" aria-hidden />Falar pelo WhatsApp</a>
                            </Button>
                        )}
                        {!salon.slug && !waLink && (
                            <p className="text-sm text-muted-foreground">Entre em contato diretamente com o estabelecimento.</p>
                        )}
                    </CardContent>
                </Card>

                <p className="text-center text-xs text-muted-foreground">{BRAND.poweredBy}</p>
            </div>
        </div>
    );
};

export default PublicWaitlist;
