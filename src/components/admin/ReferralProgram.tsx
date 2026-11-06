import { publicOrigin } from "@/config/brand";
import { useState } from "react";
import { motion } from "framer-motion";
import {
    Share2,
    Copy,
    CheckCircle,
    Gift,
    Users,
    TrendingUp,
    Crown,
    Sparkles,
    Link2,
    MessageCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Referral {
    id: string;
    name: string;
    date: Date;
    status: 'pending' | 'completed' | 'expired';
    reward: number;
}

interface ReferralStats {
    totalReferrals: number;
    pendingReferrals: number;
    completedReferrals: number;
    totalEarnings: number;
    ranking: number;
}

const mockReferrals: Referral[] = [
    { id: '1', name: 'Ana Costa', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), status: 'completed', reward: 15 },
    { id: '2', name: 'Pedro Lima', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), status: 'completed', reward: 15 },
    { id: '3', name: 'Julia Santos', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), status: 'pending', reward: 15 },
    { id: '4', name: 'Carlos Mendes', date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), status: 'completed', reward: 15 },
];

const mockStats: ReferralStats = {
    totalReferrals: 12,
    pendingReferrals: 3,
    completedReferrals: 9,
    totalEarnings: 135,
    ranking: 5,
};

const topReferrers = [
    { name: 'Maria Silva', referrals: 25, avatar: '👩' },
    { name: 'João Santos', referrals: 18, avatar: '👨' },
    { name: 'Ana Oliveira', referrals: 15, avatar: '👩' },
    { name: 'Pedro Costa', referrals: 12, avatar: '👨' },
    { name: 'Você', referrals: 9, avatar: '⭐', isCurrentUser: true },
];

interface ReferralProgramProps {
    clientId?: string;
    clientName?: string;
    referralCode?: string;
}

export const ReferralProgram = ({
    clientName = "Maria Silva",
    referralCode = "MARIA2024"
}: ReferralProgramProps) => {
    const [copied, setCopied] = useState(false);
    // ponytail: rota /ref/:code não existe em App.tsx (componente órfão; ver docs/REBRANDING.md). Origem atual em vez de domínio fixo antigo.
    const referralLink = `${publicOrigin()}/ref/${referralCode}`;

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareViaWhatsApp = () => {
        const message = encodeURIComponent(
            `🌟 Olha que legal! Eu uso o Agenda Fácil 365 para agendar meus serviços de beleza e você pode ganhar 10% OFF na primeira visita usando meu código: ${referralCode}\n\nAgende aqui: ${referralLink}`
        );
        window.open(`https://wa.me/?text=${message}`, '_blank');
    };

    return (
        <Card className="overflow-hidden">
            {/* Header Banner */}
            {/* Banner sólido navy da marca (sem brilhos animados) */}
            <div className="bg-brand-navy p-6 text-white relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <Gift className="w-6 h-6" />
                        <h3 className="font-display text-2xl font-bold">Indique e Ganhe!</h3>
                    </div>
                    <p className="text-white/80 max-w-md">
                        Indique amigos e ganhe <span className="font-bold text-white underline underline-offset-2">15% OFF</span> no seu próximo serviço.
                        Seu amigo ganha <span className="font-bold text-white underline underline-offset-2">10% OFF</span> na primeira visita!
                    </p>
                </div>
            </div>

            <CardContent className="p-6 space-y-6">
                {/* Your Referral Code */}
                <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
                    <p className="text-sm text-muted-foreground mb-2">Seu código de indicação</p>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 p-3 rounded-lg bg-background border border-border font-mono text-2xl font-bold text-center text-primary">
                            {referralCode}
                        </div>
                        <Button
                            variant="brand"
                            size="icon"
                            onClick={() => copyToClipboard(referralCode)}
                            className="h-12 w-12"
                        >
                            {copied ? <CheckCircle size={20} /> : <Copy size={20} />}
                        </Button>
                    </div>
                </div>

                {/* Referral Link */}
                <div>
                    <p className="text-sm text-muted-foreground mb-2">Link de indicação</p>
                    <div className="flex items-center gap-2">
                        <Input
                            value={referralLink}
                            readOnly
                            className="font-mono text-sm"
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(referralLink)}
                        >
                            <Link2 size={18} />
                        </Button>
                    </div>
                </div>

                {/* Share Buttons */}
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        className="flex-1 bg-success/10 border-success/30 text-success hover:bg-success/20"
                        onClick={shareViaWhatsApp}
                    >
                        <MessageCircle size={18} className="mr-2" />
                        Compartilhar no WhatsApp
                    </Button>
                    <Button variant="outline" className="flex-1">
                        <Share2 size={18} className="mr-2" />
                        Outras opções
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { icon: <Users size={20} />, value: mockStats.totalReferrals, label: 'Indicações' },
                        { icon: <CheckCircle size={20} />, value: mockStats.completedReferrals, label: 'Convertidas' },
                        { icon: <Gift size={20} />, value: `R$ ${mockStats.totalEarnings}`, label: 'Ganhos' },
                        { icon: <Crown size={20} />, value: `#${mockStats.ranking}`, label: 'Ranking' },
                    ].map((stat, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-3 rounded-xl bg-secondary/30 text-center"
                        >
                            <div className="text-primary mb-1 flex justify-center">{stat.icon}</div>
                            <p className="font-bold text-lg text-foreground">{stat.value}</p>
                            <p className="text-xs text-muted-foreground">{stat.label}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Recent Referrals */}
                <div>
                    <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                        <TrendingUp size={18} className="text-primary" />
                        Suas indicações recentes
                    </h4>
                    <div className="space-y-2">
                        {mockReferrals.slice(0, 4).map((referral) => (
                            <div
                                key={referral.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm">
                                        {referral.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{referral.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {referral.date.toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {referral.status === 'completed' ? (
                                        <Badge variant="success">
                                            +{referral.reward}% OFF
                                        </Badge>
                                    ) : referral.status === 'pending' ? (
                                        <Badge variant="secondary">Pendente</Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-muted-foreground">Expirado</Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Leaderboard */}
                <div>
                    <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                        <Crown size={18} className="text-yellow-500" />
                        Top Indicadores do Mês
                    </h4>
                    <div className="space-y-2">
                        {topReferrers.map((referrer, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`flex items-center justify-between p-3 rounded-lg ${referrer.isCurrentUser
                                        ? 'bg-primary/10 border border-primary/30'
                                        : 'bg-secondary/30'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${index === 0 ? 'bg-yellow-500/20' :
                                            index === 1 ? 'bg-gray-300/20' :
                                                index === 2 ? 'bg-amber-700/20' :
                                                    'bg-secondary'
                                        }`}>
                                        {index < 3 ? ['🥇', '🥈', '🥉'][index] : referrer.avatar}
                                    </div>
                                    <span className={`font-medium ${referrer.isCurrentUser ? 'text-primary' : 'text-foreground'}`}>
                                        {referrer.name}
                                    </span>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {referrer.referrals} indicações
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Bonus Alert */}
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" aria-hidden />
                        <div>
                            <p className="text-sm font-medium text-foreground">🎯 Meta do mês: 15 indicações</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Faltam apenas 6 indicações para você ganhar um serviço GRÁTIS!
                                Seu progresso: <span className="text-primary font-medium">9/15</span>
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
