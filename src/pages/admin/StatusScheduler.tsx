import { useState, useEffect, useRef } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { validateMedia, MIME_EXTENSIONS } from "@/features/whatsapp/media";
import {
    Calendar,
    Clock,
    Image,
    Video,
    Type,
    Plus,
    Trash2,
    Edit,
    Play,
    Pause,
    RefreshCw,
    Upload,
    X,
    Check,
    AlertCircle,
    CheckCircle,
    XCircle,
    Loader2,
    CalendarDays,
    Repeat,
    Send,
    Eye,
    Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageShell as AdminLayout } from "@/pages/admin/whatsapp/Shell";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// Tipos
interface ScheduledPost {
    id: string;
    content_type: 'text' | 'image' | 'video';
    text_content: string;
    media_url: string;
    media_filename: string;
    media_path?: string | null;
    timezone?: string;
    scheduled_at: string;
    recurrence_type: 'once' | 'daily' | 'weekly' | 'monthly';
    recurrence_days: number[];
    recurrence_end_date: string | null;
    status: 'scheduled' | 'processing' | 'posted' | 'failed' | 'cancelled';
    posted_at: string | null;
    error_message: string | null;
    created_at: string;
}

interface WhatsAppInstance {
    id: string;
    instance_name: string;
    status: 'disconnected' | 'connecting' | 'connected' | 'qrcode';
    phone_number: string;
    qrcode: string | null;
}

const DAYS_OF_WEEK = [
    { id: 0, name: 'Dom', fullName: 'Domingo' },
    { id: 1, name: 'Seg', fullName: 'Segunda' },
    { id: 2, name: 'Ter', fullName: 'Terça' },
    { id: 3, name: 'Qua', fullName: 'Quarta' },
    { id: 4, name: 'Qui', fullName: 'Quinta' },
    { id: 5, name: 'Sex', fullName: 'Sexta' },
    { id: 6, name: 'Sáb', fullName: 'Sábado' },
];

const StatusScheduler = () => {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [salonId, setSalonId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('calendar');
    const [timezone, setTimezone] = useState('America/Sao_Paulo');
    const postSubmission = useRef<string | null>(null);

    // Estados dos posts
    const [posts, setPosts] = useState<ScheduledPost[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentWeek, setCurrentWeek] = useState(new Date());

    // Estados da instância WhatsApp
    const [instance, setInstance] = useState<WhatsAppInstance | null>(null);

    // Estados do modal de criação
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [generatingCaption, setGeneratingCaption] = useState(false);
    const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);

    // Estados do formulário
    const [formData, setFormData] = useState({
        content_type: 'image' as 'text' | 'image' | 'video',
        text_content: '',
        media_file: null as File | null,
        media_preview: '',
        scheduled_date: format(new Date(), 'yyyy-MM-dd'),
        scheduled_time: '09:00',
        recurrence_type: 'once' as 'once' | 'daily' | 'weekly' | 'monthly',
        recurrence_days: [] as number[],
        recurrence_end_date: '',
    });

    // Carregar dados iniciais
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: salon } = await supabase
                .from('salons')
                .select('id,timezone')
                .eq('owner_id', user.id)
                .single();

            if (!salon) return;
            setSalonId(salon.id);
            if (salon.timezone) setTimezone(salon.timezone);

            // Status só sai por QR Code (Evolution ou com botões): a mesma regra do servidor escolhe a conexão.
            const { data: statusId } = await supabase.rpc('whatsapp_instance_for' as never, { p_salon_id: salon.id, p_purpose: 'status' } as never);
            const { data: instanceData } = statusId
                ? await supabase.from('whatsapp_instances').select('*').eq('id', statusId as string).maybeSingle()
                : { data: null };

            if (instanceData) {
                setInstance(instanceData as WhatsAppInstance);
            }

            // Buscar posts agendados
            await loadPosts(salon.id);

        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadPosts = async (salonIdParam?: string) => {
        const id = salonIdParam || salonId;
        if (!id) return;

        const { data } = await supabase
            .from('scheduled_posts')
            .select('*')
            .eq('salon_id', id)
            .order('scheduled_at', { ascending: true });

        if (data) {
            const withPreviews = await Promise.all((data as ScheduledPost[]).map(async post => {
                if (!post.media_path || !post.media_path.startsWith(`${id}/`)) return post;
                const { data: signed } = await supabase.storage.from('whatsapp-media').createSignedUrl(post.media_path, 300);
                return { ...post, media_url: signed?.signedUrl ?? '' };
            }));
            setPosts(withPreviews);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar tipo de arquivo
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');

        if (!isImage && !isVideo) {
            toast({
                title: "Arquivo inválido",
                description: "Selecione uma imagem ou vídeo.",
                variant: "destructive",
            });
            return;
        }

        // Criar preview
        const reader = new FileReader();
        reader.onload = (e) => {
            setFormData(prev => ({
                ...prev,
                content_type: isVideo ? 'video' : 'image',
                media_file: file,
                media_preview: e.target?.result as string,
            }));
        };
        reader.readAsDataURL(file);
    };

    const generateCaption = async () => {
        setGeneratingCaption(true);
        try {
            const { data, error } = await supabase.functions.invoke('generate-image-caption', {
                body: { salonId, imageBase64: formData.media_preview, context: 'Legenda curta para o salão' },
            });
            if (error || !data?.caption) throw new Error('Não foi possível gerar a legenda. Você pode escrever manualmente.');
            setFormData(prev => ({ ...prev, text_content: data.caption }));
        } catch { toast({ title: 'Legenda indisponível', description: 'Escreva a legenda manualmente ou tente depois.', variant: 'destructive' }); }
        finally { setGeneratingCaption(false); }
    };

    const handleSubmit = async () => {
        if (!salonId) return;

        // Validações
        if (formData.content_type !== 'text' && !formData.media_file && !editingPost?.media_path) {
            toast({
                title: "Mídia obrigatória",
                description: "Selecione uma imagem ou vídeo.",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);

        try {
            if (instance?.status !== 'connected') throw new Error('Conecte o WhatsApp do salão antes de agendar.');
            let mediaPath = editingPost?.media_path ?? null;
            if (formData.media_file) {
                await validateMedia(formData.media_file);
                mediaPath = `${salonId}/${crypto.randomUUID()}.${MIME_EXTENSIONS[formData.media_file.type]}`;
                const { error: uploadError } = await supabase.storage.from('whatsapp-media').upload(mediaPath, formData.media_file, { upsert: false, contentType: formData.media_file.type });
                if (uploadError) throw new Error('Não foi possível salvar a mídia.');
            }
            if (formData.content_type !== 'text' && !mediaPath) throw new Error('Envie novamente a mídia antiga para o armazenamento privado.');
            postSubmission.current ??= editingPost?.id ?? crypto.randomUUID();
            const { data, error } = await supabase.functions.invoke('whatsapp-status', { body: {
                action: 'save', id: postSubmission.current, salonId,
                contentType: formData.content_type, text: formData.text_content,
                mediaPath, mediaFilename: formData.media_file?.name ?? editingPost?.media_filename,
                localDateTime: `${formData.scheduled_date}T${formData.scheduled_time}:00`, timezone,
                recurrenceType: formData.recurrence_type, recurrenceDays: formData.recurrence_days,
                endDate: formData.recurrence_end_date || null,
            }});
            if (error || !data?.success) throw new Error('Não foi possível agendar. Confira conexão, data, fuso e mídia.');
            postSubmission.current = null;
            toast({ title: 'Post agendado', description: `${formData.scheduled_date} às ${formData.scheduled_time} (${timezone}). Acompanhe o resultado na lista.` });

            // Recarregar posts e fechar modal
            await loadPosts();
            handleCloseModal();

        } catch (error: any) {
            toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (postId: string) => {
        if (!salonId || !window.confirm('Cancelar este agendamento e suas próximas recorrências?')) return;
        try {
            const { error } = await supabase.rpc('whatsapp_cancel_status', { p_post_id: postId, p_salon_id: salonId });
            if (error) throw new Error('Não foi possível cancelar.');
            await loadPosts();
            toast({ title: 'Agendamento cancelado', description: 'Publicações já aceitas não podem ser recolhidas.' });
        } catch { toast({ title: 'Erro', description: 'Não foi possível cancelar o agendamento.', variant: 'destructive' }); }
    };

    const handleEdit = (post: ScheduledPost) => {
        if (post.status !== 'scheduled') { toast({ title: 'Este post não pode mais ser editado.' }); return; }
        const zone = post.timezone ?? timezone;
        const local = Temporal.Instant.from(post.scheduled_at).toZonedDateTimeISO(zone);
        postSubmission.current = post.id;
        setEditingPost(post);
        setFormData({
            content_type: post.content_type,
            text_content: post.text_content || '',
            media_file: null,
            media_preview: post.media_url || '',
            scheduled_date: local.toPlainDate().toString(),
            scheduled_time: local.toPlainTime().toString().slice(0, 5),
            recurrence_type: post.recurrence_type,
            recurrence_days: post.recurrence_days || [],
            recurrence_end_date: post.recurrence_end_date || '',
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        postSubmission.current = null;
        setIsModalOpen(false);
        setEditingPost(null);
        setFormData({
            content_type: 'image',
            text_content: '',
            media_file: null,
            media_preview: '',
            scheduled_date: format(new Date(), 'yyyy-MM-dd'),
            scheduled_time: '09:00',
            recurrence_type: 'once',
            recurrence_days: [],
            recurrence_end_date: '',
        });
    };

    const toggleRecurrenceDay = (dayId: number) => {
        setFormData(prev => ({
            ...prev,
            recurrence_days: prev.recurrence_days.includes(dayId)
                ? prev.recurrence_days.filter(d => d !== dayId)
                : [...prev.recurrence_days, dayId].sort()
        }));
    };

    // Obter dias da semana atual
    const weekDays = eachDayOfInterval({
        start: startOfWeek(currentWeek, { weekStartsOn: 0 }),
        end: endOfWeek(currentWeek, { weekStartsOn: 0 }),
    });

    // Filtrar posts por dia
    const getPostsForDay = (date: Date) => {
        const day = format(date, 'yyyy-MM-dd');
        return posts.filter(post => Temporal.Instant.from(post.scheduled_at).toZonedDateTimeISO(post.timezone ?? timezone).toPlainDate().toString() === day);
    };
    const postTime = (post: ScheduledPost) => Temporal.Instant.from(post.scheduled_at).toZonedDateTimeISO(post.timezone ?? timezone).toPlainTime().toString().slice(0, 5);
    const postDateTime = (post: ScheduledPost) => `${Temporal.Instant.from(post.scheduled_at).toZonedDateTimeISO(post.timezone ?? timezone).toPlainDate().toString()} às ${postTime(post)} (${post.timezone ?? timezone})`;

    const getStatusBadge = (status: string) => {
        switch (status) {
            // Status semântico: agendado = informação, processando = aviso, publicado = sucesso, falhou = erro
            case 'scheduled':
                return <Badge variant="info" className="gap-1"><Clock size={10} aria-hidden />Agendado</Badge>;
            case 'processing':
                return <Badge variant="warning" className="gap-1"><Loader2 size={10} className="animate-spin" aria-hidden />Processando</Badge>;
            case 'posted':
                return <Badge variant="success" className="gap-1"><CheckCircle size={10} aria-hidden />Publicado</Badge>;
            case 'failed':
                return <Badge variant="danger" className="gap-1"><XCircle size={10} aria-hidden />Falhou</Badge>;
            case 'cancelled':
                return <Badge variant="secondary">Cancelado</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center h-96 gap-3" role="status">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden />
                    <p className="text-sm text-muted-foreground">Carregando agendador…</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div data-tour="status-scheduler-header">
                    <PageHeader
                        className="mb-0"
                        title={<span className="flex items-center gap-2"><CalendarDays className="w-6 h-6 text-primary" aria-hidden />Agendador de Status</span>}
                        description="Agende fotos e vídeos para publicar automaticamente no Status do WhatsApp."
                        actions={
                    <div className="flex flex-wrap items-center gap-3" data-tour="status-scheduler-connection">
                        {instance?.status === 'connected' ? (
                            <Badge variant="success" className="px-3 py-1.5">
                                <CheckCircle size={14} className="mr-2" aria-hidden />
                                WhatsApp Conectado
                            </Badge>
                        ) : (
                            <Badge variant="danger" className="px-3 py-1.5">
                                <XCircle size={14} className="mr-2" aria-hidden />
                                WhatsApp Desconectado
                            </Badge>
                        )}

                        <Button variant="brand" onClick={() => setIsModalOpen(true)} data-tour="status-scheduler-new">
                            <Plus className="w-4 h-4 mr-2" aria-hidden />
                            Agendar Post
                        </Button>
                    </div>
                        }
                    />
                </div>

                {/* Alerta se WhatsApp não conectado (aviso, não erro: o agendamento continua salvo) */}
                {instance?.status !== 'connected' && (
                    <Card className="border-warning/40 bg-warning/10" role="alert">
                        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                            <AlertCircle className="w-6 h-6 text-warning shrink-0" aria-hidden />
                            <div className="flex-1">
                                <p className="font-medium text-foreground">Conexão por QR Code não conectada</p>
                                <p className="text-sm text-muted-foreground">
                                    O Status só é publicado pela conexão por QR Code (a API oficial do WhatsApp não publica Status). Conecte em WhatsApp &gt; Conexão &gt; Disparador e Status.
                                </p>
                            </div>
                            <Button variant="outline" onClick={() => window.location.assign("/admin/whatsapp?aba=conexao")}>Conectar WhatsApp</Button>
                        </CardContent>
                    </Card>
                )}

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="calendar" className="flex items-center gap-2">
                            <Calendar size={16} aria-hidden />
                            Calendário
                        </TabsTrigger>
                        <TabsTrigger value="list" className="flex items-center gap-2" data-tour="status-scheduler-list-tab">
                            <CalendarDays size={16} aria-hidden />
                            Lista
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab: Calendário */}
                    <TabsContent value="calendar" className="mt-6" data-tour="status-scheduler-calendar">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <CardTitle className="capitalize">
                                        {format(currentWeek, "MMMM 'de' yyyy", { locale: ptBR })}
                                    </CardTitle>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
                                        >
                                            ← Anterior
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentWeek(new Date())}
                                        >
                                            Hoje
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
                                        >
                                            Próxima →
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            {/* Semana com rolagem contida no mobile: evita espremer as 7 colunas em 360px */}
                            <CardContent className="overflow-x-auto">
                                <div className="grid grid-cols-7 gap-2 min-w-[560px]">
                                    {/* Headers dos dias */}
                                    {DAYS_OF_WEEK.map(day => (
                                        <div key={day.id} className="text-center py-2 font-medium text-muted-foreground">
                                            {day.name}
                                        </div>
                                    ))}

                                    {/* Células dos dias */}
                                    {weekDays.map(day => {
                                        const dayPosts = getPostsForDay(day);
                                        const isToday = isSameDay(day, new Date());

                                        return (
                                            <div
                                                key={day.toISOString()}
                                                className={cn(
                                                    "min-h-[120px] p-2 rounded-lg border transition-colors cursor-pointer",
                                                    isToday ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
                                                    isSameDay(day, selectedDate) && "ring-2 ring-primary"
                                                )}
                                                onClick={() => setSelectedDate(day)}
                                            >
                                                <div className={cn(
                                                    "text-sm font-medium mb-2",
                                                    isToday && "text-primary"
                                                )}>
                                                    {format(day, 'd')}
                                                </div>

                                                <div className="space-y-1">
                                                    {dayPosts.slice(0, 3).map(post => (
                                                        <div
                                                            key={post.id}
                                                            className={cn(
                                                                "text-xs p-1.5 rounded flex items-center gap-1 truncate",
                                                                post.status === 'posted' && "bg-success/10 text-success",
                                                                post.status === 'scheduled' && "bg-primary/10 text-primary",
                                                                post.status === 'failed' && "bg-destructive/10 text-destructive"
                                                            )}
                                                            title={post.status === 'posted' ? 'Publicado' : post.status === 'scheduled' ? 'Agendado' : post.status === 'failed' ? 'Falhou' : undefined}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEdit(post);
                                                            }}
                                                        >
                                                            {post.content_type === 'image' && <Image size={10} />}
                                                            {post.content_type === 'video' && <Video size={10} />}
                                                            {post.content_type === 'text' && <Type size={10} />}
                                                            <span className="truncate">
                                                                {postTime(post)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {dayPosts.length > 3 && (
                                                        <div className="text-xs text-muted-foreground text-center">
                                                            +{dayPosts.length - 3} mais
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab: Lista */}
                    <TabsContent value="list" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Todos os Posts Agendados</CardTitle>
                                <CardDescription>
                                    {posts.filter(p => p.status === 'scheduled').length} posts aguardando publicação
                                </CardDescription>
                            </CardHeader>
                            <CardContent data-tour="status-scheduler-list">
                                {posts.length === 0 ? (
                                    <EmptyState
                                        icon={CalendarDays}
                                        title="Nenhum post agendado"
                                        description="Agende fotos, vídeos ou textos para publicar no Status do WhatsApp."
                                        className="border-0 bg-transparent"
                                        action={
                                            <Button variant="outline" onClick={() => setIsModalOpen(true)}>
                                                <Plus className="w-4 h-4 mr-2" aria-hidden />
                                                Agendar primeiro post
                                            </Button>
                                        }
                                    />
                                ) : (
                                    <div className="space-y-3">
                                        {posts.map(post => (
                                            <div
                                                key={post.id}
                                                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
                                            >
                                                {/* Preview da mídia */}
                                                <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                                                    {post.content_type === 'image' && post.media_url ? (
                                                        <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                                                    ) : post.content_type === 'video' ? (
                                                        <Video className="w-6 h-6 text-muted-foreground" />
                                                    ) : (
                                                        <Type className="w-6 h-6 text-muted-foreground" />
                                                    )}
                                                </div>

                                                {/* Informações */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        {getStatusBadge(post.status)}
                                                        {post.recurrence_type !== 'once' && (
                                                            <Badge variant="outline" className="text-xs">
                                                                <Repeat size={10} className="mr-1" />
                                                                {post.recurrence_type === 'daily' && 'Diário'}
                                                                {post.recurrence_type === 'weekly' && 'Semanal'}
                                                                {post.recurrence_type === 'monthly' && 'Mensal'}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-medium truncate">
                                                        {post.text_content || post.media_filename || 'Sem texto'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <Clock size={12} />
                                                        {postDateTime(post)}
                                                    </p>
                                                </div>

                                                {/* Ações */}
                                                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleEdit(post)}
                                                        disabled={post.status === 'posted'}
                                                        aria-label="Editar post"
                                                    >
                                                        <Edit size={16} aria-hidden />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDelete(post.id)}
                                                        disabled={post.status === 'posted'}
                                                        aria-label="Cancelar agendamento do post"
                                                    >
                                                        <Trash2 size={16} aria-hidden />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Modal de Criação/Edição */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-tour="status-scheduler-dialog">
                        <DialogHeader>
                            <DialogTitle>
                                {editingPost ? 'Editar Post' : 'Agendar Novo Post'}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-6 py-4">
                            {/* Tipo de conteúdo */}
                            <div className="space-y-2" data-tour="status-scheduler-type">
                                <Label>Tipo de Conteúdo</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'image', icon: Image, label: 'Imagem' },
                                        { id: 'video', icon: Video, label: 'Vídeo' },
                                        { id: 'text', icon: Type, label: 'Texto' },
                                    ].map(type => (
                                        <button
                                            key={type.id}
                                            type="button"
                                            aria-pressed={formData.content_type === type.id}
                                            onClick={() => setFormData(prev => ({ ...prev, content_type: type.id as any }))}
                                            className={cn(
                                                "flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors",
                                                formData.content_type === type.id
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border hover:border-primary/50"
                                            )}
                                        >
                                            <type.icon size={20} />
                                            <span>{type.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Upload de mídia */}
                            {formData.content_type !== 'text' && (
                                <div className="space-y-2" data-tour="status-scheduler-media">
                                    <Label>Mídia</Label>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept={formData.content_type === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4'}
                                        className="hidden"
                                        onChange={handleFileSelect}
                                    />

                                    {formData.media_preview ? (
                                        <div className="relative rounded-lg overflow-hidden border">
                                            {formData.content_type === 'image' ? (
                                                <img
                                                    src={formData.media_preview}
                                                    alt="Preview"
                                                    className="w-full h-48 object-cover"
                                                />
                                            ) : (
                                                <video
                                                    src={formData.media_preview}
                                                    className="w-full h-48 object-cover"
                                                    controls
                                                />
                                            )}
                                            <Button
                                                size="icon"
                                                variant="destructive"
                                                className="absolute top-2 right-2"
                                                aria-label="Remover mídia"
                                                onClick={() => setFormData(prev => ({
                                                    ...prev,
                                                    media_file: null,
                                                    media_preview: ''
                                                }))}
                                            >
                                                <X size={16} />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="h-48 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 text-muted-foreground"
                                        >
                                            <Upload size={32} />
                                            <p>Clique para fazer upload</p>
                                            <p className="text-xs">
                                                {formData.content_type === 'image' ? 'JPG, PNG, WebP até 5 MB' : 'MP4 até 16 MB; compatibilidade depende do WhatsApp'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Texto/Legenda */}
                            <div className="space-y-2" data-tour="status-scheduler-caption">
                                <div className="flex items-center justify-between">
                                    <Label>{formData.content_type === 'text' ? 'Texto do Status' : 'Legenda (opcional)'}</Label>
                                    {formData.content_type !== 'text' && (formData.media_preview || editingPost?.media_url) && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={generateCaption}
                                            disabled={generatingCaption}
                                            className="text-xs gap-1 border-primary/50 hover:bg-primary/10"
                                        >
                                            {generatingCaption ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    Gerando...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={14} className="text-primary" />
                                                    Gerar com IA
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                                <Textarea
                                    placeholder={formData.content_type === 'text' ? 'Digite o texto do status...' : 'Digite uma legenda ou clique em "Gerar com IA"...'}
                                    value={formData.text_content}
                                    onChange={(e) => setFormData(prev => ({ ...prev, text_content: e.target.value }))}
                                    rows={3}
                                />
                            </div>

                            {/* Data e Hora */}
                            <div className="grid grid-cols-2 gap-4" data-tour="status-scheduler-date-time">
                                <div className="space-y-2">
                                    <Label htmlFor="status-scheduled-date">Data</Label>
                                    <Input
                                        id="status-scheduled-date"
                                        type="date"
                                        value={formData.scheduled_date}
                                        onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="status-scheduled-time">Hora</Label>
                                    <Input
                                        id="status-scheduled-time"
                                        type="time"
                                        value={formData.scheduled_time}
                                        onChange={(e) => setFormData(prev => ({ ...prev, scheduled_time: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <p className="text-sm text-muted-foreground">Horário no fuso do estabelecimento: <strong>{timezone}</strong> (altere em Configurações).</p>
                            {/* Recorrência */}
                            <div className="space-y-4" data-tour="status-scheduler-recurrence">
                                <div className="space-y-2">
                                    <Label htmlFor="status-recurrence">Recorrência</Label>
                                    <Select
                                        value={formData.recurrence_type}
                                        onValueChange={(v: any) => setFormData(prev => ({ ...prev, recurrence_type: v }))}
                                    >
                                        <SelectTrigger id="status-recurrence">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="once">Uma vez</SelectItem>
                                            <SelectItem value="daily">Diariamente</SelectItem>
                                            <SelectItem value="weekly">Semanalmente</SelectItem>
                                            <SelectItem value="monthly">Mensalmente</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {formData.recurrence_type === 'weekly' && (
                                    <div className="space-y-2">
                                        <Label>Dias da Semana</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {DAYS_OF_WEEK.map(day => (
                                                <button
                                                    key={day.id}
                                                    type="button"
                                                    aria-pressed={formData.recurrence_days.includes(day.id)}
                                                    onClick={() => toggleRecurrenceDay(day.id)}
                                                    className={cn(
                                                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                                        formData.recurrence_days.includes(day.id)
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                                                    )}
                                                >
                                                    {day.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {formData.recurrence_type !== 'once' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="status-recurrence-end">Data Final (opcional)</Label>
                                        <Input
                                            id="status-recurrence-end"
                                            type="date"
                                            value={formData.recurrence_end_date}
                                            onChange={(e) => setFormData(prev => ({ ...prev, recurrence_end_date: e.target.value }))}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={handleCloseModal} data-tour="status-scheduler-cancel">
                                Cancelar
                            </Button>
                            <Button variant="brand" onClick={handleSubmit} disabled={isSubmitting} data-tour="status-scheduler-save">
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4 mr-2" />
                                )}
                                {editingPost ? 'Atualizar' : 'Agendar'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AdminLayout>
    );
};

export default StatusScheduler;
