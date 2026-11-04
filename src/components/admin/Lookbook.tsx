import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Image,
    Heart,
    MessageCircle,
    Share2,
    Calendar,
    Sparkles,
    ChevronLeft,
    ChevronRight,
    X,
    Star,
    ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";

interface LookbookPost {
    id: string;
    beforeImage: string;
    afterImage: string;
    professionalName: string;
    professionalAvatar: string;
    serviceName: string;
    servicePrice: number;
    description: string;
    likes: number;
    comments: number;
    tags: string[];
    createdAt: Date;
    isLiked?: boolean;
}

const mockPosts: LookbookPost[] = [
    {
        id: '1',
        beforeImage: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=500&fit=crop',
        afterImage: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=500&fit=crop',
        professionalName: 'Julia Santos',
        professionalAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
        serviceName: 'Coloração + Corte',
        servicePrice: 250,
        description: 'Transformação incrível! Loiro dourado com babylights para iluminar o rosto 🌟',
        likes: 127,
        comments: 23,
        tags: ['loiro', 'babylights', 'transformação'],
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        isLiked: true,
    },
    {
        id: '2',
        beforeImage: 'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=400&h=500&fit=crop',
        afterImage: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=400&h=500&fit=crop',
        professionalName: 'Carlos Eduardo',
        professionalAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
        serviceName: 'Corte Masculino + Barba',
        servicePrice: 80,
        description: 'Degradê perfeito com barba desenhada. Estilo moderno e elegante! 💈',
        likes: 89,
        comments: 15,
        tags: ['degradê', 'barba', 'masculino'],
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
        id: '3',
        beforeImage: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400&h=500&fit=crop',
        afterImage: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=400&h=500&fit=crop',
        professionalName: 'Ana Oliveira',
        professionalAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
        serviceName: 'Mechas + Tratamento',
        servicePrice: 320,
        description: 'Mechas mel com tratamento de reconstrução. Cabelo super hidratado! ✨',
        likes: 156,
        comments: 31,
        tags: ['mechas', 'mel', 'tratamento'],
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        isLiked: true,
    },
];

interface LookbookProps {
    salonId?: string;
}

export const Lookbook = ({ salonId }: LookbookProps) => {
    const [posts, setPosts] = useState<LookbookPost[]>(mockPosts);
    const [selectedPost, setSelectedPost] = useState<LookbookPost | null>(null);
    const [showBeforeAfter, setShowBeforeAfter] = useState(false);
    const [sliderPosition, setSliderPosition] = useState(50);

    const toggleLike = (postId: string) => {
        setPosts(prev =>
            prev.map(post =>
                post.id === postId
                    ? {
                        ...post,
                        isLiked: !post.isLiked,
                        likes: post.isLiked ? post.likes - 1 : post.likes + 1
                    }
                    : post
            )
        );
    };

    const formatDate = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Hoje';
        if (days === 1) return 'Ontem';
        if (days < 7) return `${days} dias atrás`;
        return date.toLocaleDateString('pt-BR');
    };

    return (
        <>
            <Card data-tour="advanced-lookbook-panel">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Image className="w-5 h-5 text-primary" />
                            Lookbook Social
                        </CardTitle>
                        <Button variant="brand" size="sm" data-tour="advanced-lookbook-new">
                            <Sparkles size={16} className="mr-1" />
                            Novo Post
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Posts Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4" data-tour="advanced-lookbook-grid">
                        {posts.map((post, index) => (
                            <motion.div
                                key={post.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="relative group cursor-pointer"
                                onClick={() => setSelectedPost(post)}
                            >
                                {/* Image */}
                                <div className="aspect-[4/5] rounded-xl overflow-hidden relative">
                                    <img
                                        src={post.afterImage}
                                        alt={post.description}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />

                                    {/* Overlay on Hover */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                                        <div className="flex items-center gap-4 text-white">
                                            <span className="flex items-center gap-1">
                                                <Heart size={16} className={post.isLiked ? 'fill-red-500 text-red-500' : ''} />
                                                {post.likes}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MessageCircle size={16} />
                                                {post.comments}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Before/After Badge */}
                                    <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-black/50 text-white text-xs backdrop-blur-sm">
                                        Before/After
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="mt-2">
                                    <p className="text-sm font-medium text-foreground truncate">{post.serviceName}</p>
                                    <p className="text-xs text-muted-foreground">por {post.professionalName}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Post Detail Dialog */}
            <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden" data-tour="advanced-lookbook-detail">
                    {selectedPost && (
                        <div className="flex flex-col md:flex-row">
                            {/* Image Section */}
                            <div className="md:w-1/2 bg-black relative">
                                {/* Before/After Slider */}
                                <div
                                    className="relative w-full aspect-[4/5] overflow-hidden cursor-ew-resize"
                                    data-tour="advanced-lookbook-slider"
                                    onMouseMove={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                                        setSliderPosition(Math.min(100, Math.max(0, x)));
                                    }}
                                    onTouchMove={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
                                        setSliderPosition(Math.min(100, Math.max(0, x)));
                                    }}
                                >
                                    {/* After Image (background) */}
                                    <img
                                        src={selectedPost.afterImage}
                                        alt="Depois"
                                        className="absolute inset-0 w-full h-full object-cover"
                                    />

                                    {/* Before Image (clipped) */}
                                    <div
                                        className="absolute inset-0 overflow-hidden"
                                        style={{ width: `${sliderPosition}%` }}
                                    >
                                        <img
                                            src={selectedPost.beforeImage}
                                            alt="Antes"
                                            className="absolute inset-0 w-full h-full object-cover"
                                            style={{ width: `${100 / (sliderPosition / 100)}%` }}
                                        />
                                    </div>

                                    {/* Slider Line */}
                                    <div
                                        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                                        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
                                    >
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center">
                                            <ChevronLeft size={16} className="text-gray-600 -mr-1" />
                                            <ChevronRight size={16} className="text-gray-600 -ml-1" />
                                        </div>
                                    </div>

                                    {/* Labels */}
                                    <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/50 text-white text-sm backdrop-blur-sm">
                                        Antes
                                    </div>
                                    <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/50 text-white text-sm backdrop-blur-sm">
                                        Depois
                                    </div>
                                </div>
                            </div>

                            {/* Info Section */}
                            <div className="md:w-1/2 p-6 flex flex-col">
                                {/* Professional Info */}
                                <div className="flex items-center gap-3 mb-4">
                                    <img
                                        src={selectedPost.professionalAvatar}
                                        alt={selectedPost.professionalName}
                                        className="w-12 h-12 rounded-full object-cover ring-2 ring-primary/20"
                                    />
                                    <div>
                                        <p className="font-medium text-foreground">{selectedPost.professionalName}</p>
                                        <p className="text-sm text-muted-foreground">{formatDate(selectedPost.createdAt)}</p>
                                    </div>
                                </div>

                                {/* Description */}
                                <p className="text-foreground mb-4">{selectedPost.description}</p>

                                {/* Tags */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {selectedPost.tags.map((tag) => (
                                        <Badge key={tag} variant="secondary" className="text-xs">
                                            #{tag}
                                        </Badge>
                                    ))}
                                </div>

                                {/* Service Info */}
                                <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 mb-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-foreground">{selectedPost.serviceName}</p>
                                            <p className="text-sm text-muted-foreground">Serviço realizado</p>
                                        </div>
                                        <p className="text-xl font-bold text-primary">
                                            R$ {selectedPost.servicePrice}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-4 mb-4">
                                    <button
                                        onClick={() => toggleLike(selectedPost.id)}
                                        className="flex items-center gap-2 text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                        <Heart
                                            size={24}
                                            className={selectedPost.isLiked ? 'fill-red-500 text-red-500' : ''}
                                        />
                                        <span>{selectedPost.likes}</span>
                                    </button>
                                    <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                                        <MessageCircle size={24} />
                                        <span>{selectedPost.comments}</span>
                                    </button>
                                    <button type="button" aria-label="Compartilhar" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors ml-auto">
                                        <Share2 size={24} />
                                    </button>
                                </div>

                                {/* CTA Buttons */}
                                <div className="mt-auto space-y-3">
                                    <Button variant="brand" className="w-full" size="lg" data-tour="advanced-lookbook-cta">
                                        <Calendar size={18} className="mr-2" />
                                        Quero esse look! Agendar agora
                                    </Button>
                                    <Button variant="outline" className="w-full">
                                        <ExternalLink size={18} className="mr-2" />
                                        Ver perfil de {selectedPost.professionalName}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
};
