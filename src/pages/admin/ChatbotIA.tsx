import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    Bot,
    Settings,
    MessageSquare,
    History,
    Play,
    Save,
    RefreshCw,
    Send,
    Sparkles,
    Brain,
    Zap,
    Clock,
    ToggleLeft,
    ToggleRight,
    ChevronDown,
    Trash2,
    Plus,
    Search,
    Filter,
    Download,
    AlertCircle,
    CheckCircle,
    XCircle,
    Loader2,
    User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/layouts/AdminLayout";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Tipos
interface ChatbotSettings {
    id?: string;
    enabled: boolean;
    ai_provider: 'openai' | 'gemini' | 'grok' | 'perplexity' | 'groq';
    ai_model: string;
    api_key: string;
    bot_name: string;
    welcome_message: string;
    system_prompt: string;
    custom_instructions: string;
    temperature: number;
    max_tokens: number;
    response_delay_ms: number;
    active_hours_start: string;
    active_hours_end: string;
    active_days: number[];
    out_of_hours_message: string;
    fallback_message: string;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface ConversationHistory {
    id: string;
    client_phone: string;
    client_name: string;
    direction: 'incoming' | 'outgoing';
    content: string;
    ai_response: boolean;
    created_at: string;
}

interface KnowledgeItem {
    id: string;
    category: string;
    question: string;
    answer: string;
    keywords: string[];
    enabled: boolean;
}

// Provedores de IA disponíveis
const AI_PROVIDERS = [
    { id: 'openai', name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { id: 'gemini', name: 'Google Gemini', models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-pro'] },
    { id: 'grok', name: 'xAI Grok', models: ['grok-2', 'grok-2-mini'] },
    { id: 'perplexity', name: 'Perplexity', models: ['llama-3.1-sonar-large', 'llama-3.1-sonar-small'] },
    { id: 'groq', name: 'Groq (Ultra Rápido)', models: ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768', 'gemma-7b-it'] },
];

const DAYS_OF_WEEK = [
    { id: 0, name: 'Dom', fullName: 'Domingo' },
    { id: 1, name: 'Seg', fullName: 'Segunda' },
    { id: 2, name: 'Ter', fullName: 'Terça' },
    { id: 3, name: 'Qua', fullName: 'Quarta' },
    { id: 4, name: 'Qui', fullName: 'Quinta' },
    { id: 5, name: 'Sex', fullName: 'Sexta' },
    { id: 6, name: 'Sáb', fullName: 'Sábado' },
];

const DEFAULT_SETTINGS: ChatbotSettings = {
    enabled: false,
    ai_provider: 'openai',
    ai_model: 'gpt-4o-mini',
    api_key: '',
    bot_name: 'Assistente',
    welcome_message: 'Olá! Sou o assistente virtual do salão. Como posso ajudar?',
    system_prompt: `Você é um assistente virtual profissional de um salão de beleza.

Suas responsabilidades:
- Responder dúvidas sobre serviços, preços e horários
- Ajudar clientes a agendar atendimentos
- Fornecer informações sobre o salão
- Ser educado, prestativo e profissional

Sempre responda em português brasileiro de forma amigável e objetiva.`,
    custom_instructions: '',
    temperature: 0.7,
    max_tokens: 500,
    response_delay_ms: 1000,
    active_hours_start: '08:00',
    active_hours_end: '22:00',
    active_days: [1, 2, 3, 4, 5, 6],
    out_of_hours_message: 'Olá! No momento estamos fora do horário de atendimento. Retornaremos em breve!',
    fallback_message: 'Desculpe, não entendi sua mensagem. Pode reformular?',
};

const ChatbotIA = () => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState('settings');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [salonId, setSalonId] = useState<string | null>(null);
    const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null);

    // Estados das configurações
    const [settings, setSettings] = useState<ChatbotSettings>(DEFAULT_SETTINGS);

    // Estados do teste
    const [testMessages, setTestMessages] = useState<ChatMessage[]>([]);
    const [testInput, setTestInput] = useState('');
    const [isTesting, setIsTesting] = useState(false);

    // Estados do histórico
    const [conversations, setConversations] = useState<ConversationHistory[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('today');

    // Estados da base de conhecimento
    const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
    const [newKnowledge, setNewKnowledge] = useState({ category: 'general', question: '', answer: '', keywords: '' });

    // Carregar dados iniciais
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Buscar salon_id do usuário
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: salon } = await supabase
                .from('salons')
                .select('id')
                .eq('owner_id', user.id)
                .single();

            if (!salon) return;
            setSalonId(salon.id);

            const { data: instance } = await supabase.from('whatsapp_instances').select('status').eq('salon_id', salon.id).maybeSingle();
            setWhatsappConnected(instance?.status === 'connected');

            // Buscar configurações do chatbot
            const { data: chatbotSettings, error: chatbotError } = await supabase
                .from('chatbot_settings')
                .select('*')
                .eq('salon_id', salon.id)
                .maybeSingle();

            if (chatbotError) {
                console.error('Erro ao buscar chatbot_settings:', chatbotError);
            }

            if (chatbotSettings) {
                setSettings({
                    id: chatbotSettings.id,
                    enabled: chatbotSettings.enabled ?? false,
                    ai_provider: (chatbotSettings.ai_provider as any) || 'openai',
                    ai_model: chatbotSettings.ai_model || 'gpt-4o-mini',
                    api_key: chatbotSettings.api_key || '',
                    bot_name: chatbotSettings.bot_name || 'Assistente',
                    welcome_message: chatbotSettings.welcome_message || DEFAULT_SETTINGS.welcome_message,
                    system_prompt: chatbotSettings.system_prompt || DEFAULT_SETTINGS.system_prompt,
                    custom_instructions: chatbotSettings.custom_instructions || '',
                    temperature: chatbotSettings.temperature ?? 0.7,
                    max_tokens: chatbotSettings.max_tokens ?? 500,
                    response_delay_ms: chatbotSettings.response_delay_ms ?? 1000,
                    active_hours_start: chatbotSettings.active_hours_start || '08:00',
                    active_hours_end: chatbotSettings.active_hours_end || '22:00',
                    active_days: chatbotSettings.active_days || [1, 2, 3, 4, 5, 6],
                    out_of_hours_message: chatbotSettings.out_of_hours_message || DEFAULT_SETTINGS.out_of_hours_message,
                    fallback_message: chatbotSettings.fallback_message || DEFAULT_SETTINGS.fallback_message,
                });
            }

            // Buscar base de conhecimento
            const { data: knowledge } = await supabase
                .from('chatbot_knowledge_base')
                .select('*')
                .eq('salon_id', salon.id)
                .order('priority', { ascending: false });

            if (knowledge) {
                setKnowledgeBase(knowledge as KnowledgeItem[]);
            }

            // Buscar histórico de conversas
            await loadConversations(salon.id);

        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadConversations = async (salonIdParam?: string) => {
        const id = salonIdParam || salonId;
        if (!id) return;

        let query = supabase
            .from('chatbot_conversations')
            .select('*')
            .eq('salon_id', id)
            .order('created_at', { ascending: false })
            .limit(100);

        if (searchTerm) {
            query = query.or(`content.ilike.%${searchTerm}%,client_phone.ilike.%${searchTerm}%`);
        }

        const { data } = await query;
        if (data) {
            setConversations(data as ConversationHistory[]);
        }
    };

    const handleSaveSettings = async () => {
        if (!salonId) return;
        setIsSaving(true);

        try {
            // Remove id and created_at to avoid primary key conflicts on upsert
            const { id: _id, ...settingsWithoutId } = settings as any;

            const payload = {
                salon_id: salonId,
                enabled: settingsWithoutId.enabled,
                ai_provider: settingsWithoutId.ai_provider,
                ai_model: settingsWithoutId.ai_model,
                api_key: null,
                bot_name: settingsWithoutId.bot_name,
                welcome_message: settingsWithoutId.welcome_message,
                system_prompt: settingsWithoutId.system_prompt,
                custom_instructions: settingsWithoutId.custom_instructions,
                temperature: settingsWithoutId.temperature,
                max_tokens: settingsWithoutId.max_tokens,
                response_delay_ms: settingsWithoutId.response_delay_ms,
                active_hours_start: settingsWithoutId.active_hours_start,
                active_hours_end: settingsWithoutId.active_hours_end,
                active_days: settingsWithoutId.active_days,
                out_of_hours_message: settingsWithoutId.out_of_hours_message,
                fallback_message: settingsWithoutId.fallback_message,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('chatbot_settings')
                .upsert(payload, { onConflict: 'salon_id' });

            if (error) throw error;
            if (settings.api_key?.trim()) {
                const { data: savedKey, error: keyError } = await supabase.functions.invoke('whatsapp-chatbot', { body: { action: 'save_key', salonId, key: settings.api_key.trim() } });
                if (keyError || !savedKey?.success) throw new Error('Não foi possível guardar a credencial privada.');
                setSettings(prev => ({ ...prev, api_key: '' }));
            }

            toast({
                title: "Configurações salvas!",
                description: "As configurações do chatbot foram atualizadas com sucesso.",
            });
        } catch (error: any) {
            console.error('Erro ao salvar configurações do chatbot:', error);
            toast({
                title: "Erro ao salvar",
                description: error.message || "Erro desconhecido ao salvar configurações",
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestMessage = async () => {
        if (!testInput.trim() || !salonId) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: testInput,
            timestamp: new Date(),
        };

        setTestMessages(prev => [...prev, userMessage]);
        setTestInput('');
        setIsTesting(true);

        try {
            const { data, error } = await supabase.functions.invoke('whatsapp-chatbot', { body: { action: 'test', salonId, text: userMessage.content } });
            if (error || !data?.success) throw new Error('Teste indisponível. Salve a configuração e confira o provedor.');
            const aiResponse: ChatMessage = {
                id: crypto.randomUUID(), role: 'assistant',
                content: data.text, timestamp: new Date(),
            };

            setTestMessages(prev => [...prev, aiResponse]);
        } catch (error: any) {
            toast({
                title: "Erro no teste",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleAddKnowledge = async () => {
        if (!salonId || !newKnowledge.question || !newKnowledge.answer) return;

        try {
            const { data, error } = await supabase
                .from('chatbot_knowledge_base')
                .insert({
                    salon_id: salonId,
                    category: newKnowledge.category,
                    question: newKnowledge.question,
                    answer: newKnowledge.answer,
                    keywords: newKnowledge.keywords.split(',').map(k => k.trim()).filter(k => k),
                })
                .select()
                .single();

            if (error) throw error;

            setKnowledgeBase(prev => [data as KnowledgeItem, ...prev]);
            setNewKnowledge({ category: 'general', question: '', answer: '', keywords: '' });

            toast({
                title: "Conhecimento adicionado!",
                description: "A base de conhecimento foi atualizada.",
            });
        } catch (error: any) {
            toast({
                title: "Erro ao adicionar",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleDeleteKnowledge = async (id: string) => {
        try {
            await supabase.from('chatbot_knowledge_base').delete().eq('id', id);
            setKnowledgeBase(prev => prev.filter(k => k.id !== id));
            toast({ title: "Removido!", description: "Item removido da base de conhecimento." });
        } catch (error: any) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    };

    const toggleDay = (dayId: number) => {
        setSettings(prev => ({
            ...prev,
            active_days: prev.active_days.includes(dayId)
                ? prev.active_days.filter(d => d !== dayId)
                : [...prev.active_days, dayId].sort()
        }));
    };

    const getAvailableModels = () => {
        const provider = AI_PROVIDERS.find(p => p.id === settings.ai_provider);
        return provider?.models || [];
    };

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center h-96 gap-3" role="status">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden />
                    <p className="text-sm text-muted-foreground">Carregando chatbot…</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                {whatsappConnected === false && (
                    <Card className="border-warning/40 bg-warning/10" role="alert">
                        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-warning shrink-0" aria-hidden /><span>Seu WhatsApp está desconectado. O chatbot só responde clientes com o WhatsApp conectado.</span></div>
                            <Button asChild variant="outline" size="sm"><Link to="/admin/whatsapp">Conectar WhatsApp</Link></Button>
                        </CardContent>
                    </Card>
                )}
                {/* Header */}
                <div data-tour="chatbot-header">
                    <PageHeader
                        className="mb-0"
                        title={<span className="flex items-center gap-2"><Bot className="w-6 h-6 text-primary" aria-hidden />Chatbot IA</span>}
                        description="Configure a inteligência artificial para atender seus clientes automaticamente."
                        actions={
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border">
                            <span className="text-sm text-muted-foreground">Status:</span>
                            {settings.enabled ? (
                                <Badge variant="success">
                                    <CheckCircle size={12} className="mr-1" aria-hidden />
                                    Ativo
                                </Badge>
                            ) : (
                                <Badge variant="secondary">
                                    <XCircle size={12} className="mr-1" aria-hidden />
                                    Inativo
                                </Badge>
                            )}
                        </div>
                        }
                    />
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid grid-cols-4 w-full max-w-2xl">
                        <TabsTrigger value="settings" className="flex items-center gap-2" data-tour="chatbot-settings-tab" aria-label="Configurações">
                            <Settings size={16} />
                            <span className="hidden sm:inline">Configurações</span>
                        </TabsTrigger>
                        <TabsTrigger value="training" className="flex items-center gap-2" data-tour="chatbot-training-tab" aria-label="Treinamento">
                            <Brain size={16} />
                            <span className="hidden sm:inline">Treinamento</span>
                        </TabsTrigger>
                        <TabsTrigger value="test" className="flex items-center gap-2" data-tour="chatbot-test-tab" aria-label="Testar">
                            <Play size={16} />
                            <span className="hidden sm:inline">Testar</span>
                        </TabsTrigger>
                        <TabsTrigger value="history" className="flex items-center gap-2" data-tour="chatbot-history-tab" aria-label="Histórico">
                            <History size={16} />
                            <span className="hidden sm:inline">Histórico</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab: Configurações */}
                    <TabsContent value="settings" className="space-y-6">
                        {/* Ativar/Desativar */}
                        <Card className="border-primary/20">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center" aria-hidden>
                                            <Zap className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-lg">Ativar Chatbot IA</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Quando ativo, a IA responderá automaticamente as mensagens dos clientes
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        data-tour="chatbot-enabled"
                                        aria-label="Ativar Chatbot IA"
                                        checked={settings.enabled}
                                        onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enabled: checked }))}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Provedor e Modelo */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-primary" />
                                        Provedor de IA
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="chatbot-provider">Provedor</Label>
                                        <Select
                                            value={settings.ai_provider}
                                            onValueChange={(value: any) => setSettings(prev => ({
                                                ...prev,
                                                ai_provider: value,
                                                ai_model: AI_PROVIDERS.find(p => p.id === value)?.models[0] || ''
                                            }))}
                                        >
                                            <SelectTrigger id="chatbot-provider" data-tour="chatbot-provider">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {AI_PROVIDERS.map(provider => (
                                                    <SelectItem key={provider.id} value={provider.id}>
                                                        {provider.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="chatbot-field-1">Modelo</Label>
                                        <Select
                                            value={settings.ai_model}
                                            onValueChange={(value) => setSettings(prev => ({ ...prev, ai_model: value }))}
                                        >
                                            <SelectTrigger id="chatbot-field-1" data-tour="chatbot-model">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {getAvailableModels().map(model => (
                                                    <SelectItem key={model} value={model}>
                                                        {model}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2" data-tour="chatbot-api-key">
                                        <Label htmlFor="chatbot-field-2">API Key</Label>
                                        <Input id="chatbot-field-2"
                                            type="password"
                                            placeholder="sk-..."
                                            value={settings.api_key}
                                            onChange={(e) => setSettings(prev => ({ ...prev, api_key: e.target.value }))}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Sua chave de API do provedor selecionado
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Personalização */}
                            <Card data-tour="chatbot-personalization">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <MessageSquare className="w-5 h-5 text-primary" />
                                        Personalização
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="chatbot-field-3">Nome do Bot</Label>
                                        <Input id="chatbot-field-3"
                                            placeholder="Ex: Sofia, Assistente..."
                                            value={settings.bot_name}
                                            onChange={(e) => setSettings(prev => ({ ...prev, bot_name: e.target.value }))}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="chatbot-field-4">Mensagem de Boas-vindas</Label>
                                        <Textarea id="chatbot-field-4"
                                            placeholder="Mensagem enviada ao iniciar conversa..."
                                            value={settings.welcome_message}
                                            onChange={(e) => setSettings(prev => ({ ...prev, welcome_message: e.target.value }))}
                                            rows={3}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="chatbot-field-5">Mensagem de Fallback</Label>
                                        <Input id="chatbot-field-5"
                                            placeholder="Quando a IA não entender..."
                                            value={settings.fallback_message}
                                            onChange={(e) => setSettings(prev => ({ ...prev, fallback_message: e.target.value }))}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Configurações Avançadas */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Settings className="w-5 h-5 text-primary" />
                                        Configurações Avançadas
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <Label>Temperatura: {settings.temperature}</Label>
                                            <span className="text-xs text-muted-foreground">
                                                {settings.temperature < 0.5 ? 'Mais preciso' : settings.temperature > 1 ? 'Mais criativo' : 'Balanceado'}
                                            </span>
                                        </div>
                                        <Slider
                                            value={[settings.temperature]}
                                            onValueChange={(v) => setSettings(prev => ({ ...prev, temperature: v[0] }))}
                                            min={0}
                                            max={2}
                                            step={0.1}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="chatbot-field-6">Máximo de Tokens</Label>
                                        <Input id="chatbot-field-6"
                                            type="number"
                                            value={settings.max_tokens}
                                            onChange={(e) => setSettings(prev => ({ ...prev, max_tokens: parseInt(e.target.value) || 500 }))}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Limite de tokens por resposta (afeta custo e tamanho)
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="chatbot-field-7">Delay de Resposta (ms)</Label>
                                        <Input id="chatbot-field-7"
                                            type="number"
                                            value={settings.response_delay_ms}
                                            onChange={(e) => setSettings(prev => ({ ...prev, response_delay_ms: parseInt(e.target.value) || 1000 }))}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Tempo de espera antes de enviar resposta (parecer mais humano)
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Horário de Funcionamento */}
                            <Card data-tour="chatbot-hours">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-primary" />
                                        Horário de Funcionamento
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="chatbot-field-8">Início</Label>
                                            <Input id="chatbot-field-8"
                                                type="time"
                                                value={settings.active_hours_start}
                                                onChange={(e) => setSettings(prev => ({ ...prev, active_hours_start: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="chatbot-field-9">Fim</Label>
                                            <Input id="chatbot-field-9"
                                                type="time"
                                                value={settings.active_hours_end}
                                                onChange={(e) => setSettings(prev => ({ ...prev, active_hours_end: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Dias Ativos</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {DAYS_OF_WEEK.map(day => (
                                                <button
                                                    key={day.id}
                                                    type="button"
                                                    aria-pressed={settings.active_days.includes(day.id)}
                                                    onClick={() => toggleDay(day.id)}
                                                    className={cn(
                                                        "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                                        settings.active_days.includes(day.id)
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                                                    )}
                                                >
                                                    {day.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="chatbot-field-10">Mensagem Fora do Horário</Label>
                                        <Textarea id="chatbot-field-10"
                                            placeholder="Mensagem quando o bot está inativo..."
                                            value={settings.out_of_hours_message}
                                            onChange={(e) => setSettings(prev => ({ ...prev, out_of_hours_message: e.target.value }))}
                                            rows={2}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Botão Salvar */}
                        <div className="flex justify-end">
                            <Button
                                variant="brand"
                                size="lg"
                                onClick={handleSaveSettings}
                                data-tour="chatbot-save-settings"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Salvar Configurações
                            </Button>
                        </div>
                    </TabsContent>

                    {/* Tab: Treinamento */}
                    <TabsContent value="training" className="space-y-6">
                        {/* Prompt do Sistema */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Brain className="w-5 h-5 text-primary" />
                                    Prompt do Sistema
                                </CardTitle>
                                <CardDescription>
                                    Defina a personalidade e instruções gerais da IA
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Textarea
                                    data-tour="chatbot-prompt"
                                    placeholder="Defina como a IA deve se comportar..."
                                    value={settings.system_prompt}
                                    onChange={(e) => setSettings(prev => ({ ...prev, system_prompt: e.target.value }))}
                                    rows={8}
                                    className="font-mono text-sm"
                                />

                                <div className="space-y-2">
                                    <Label htmlFor="chatbot-field-11">Instruções Personalizadas (adicional)</Label>
                                    <Textarea id="chatbot-field-11"
                                        data-tour="chatbot-instructions"
                                        placeholder="Informações específicas do seu salão..."
                                        value={settings.custom_instructions}
                                        onChange={(e) => setSettings(prev => ({ ...prev, custom_instructions: e.target.value }))}
                                        rows={4}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Adicione informações sobre serviços, preços, horários, etc.
                                    </p>
                                </div>

                                <Button onClick={handleSaveSettings} disabled={isSaving} data-tour="chatbot-save-prompt">
                                    {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                    Salvar Prompt
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Base de Conhecimento */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-primary" />
                                    Base de Conhecimento
                                </CardTitle>
                                <CardDescription>
                                    Adicione perguntas e respostas frequentes para treinar a IA
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Formulário para adicionar */}
                                <div className="p-4 rounded-lg bg-secondary/30 space-y-4" data-tour="chatbot-knowledge-form">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="chatbot-field-12">Categoria</Label>
                                            <Select
                                                value={newKnowledge.category}
                                                onValueChange={(v) => setNewKnowledge(prev => ({ ...prev, category: v }))}
                                            >
                                                <SelectTrigger id="chatbot-field-12">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="general">Geral</SelectItem>
                                                    <SelectItem value="services">Serviços</SelectItem>
                                                    <SelectItem value="prices">Preços</SelectItem>
                                                    <SelectItem value="schedule">Horários</SelectItem>
                                                    <SelectItem value="location">Localização</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="chatbot-field-13">Palavras-chave (separadas por vírgula)</Label>
                                            <Input id="chatbot-field-13"
                                                placeholder="corte, cabelo, preço..."
                                                value={newKnowledge.keywords}
                                                onChange={(e) => setNewKnowledge(prev => ({ ...prev, keywords: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="chatbot-field-14">Pergunta</Label>
                                        <Input id="chatbot-field-14"
                                            placeholder="Ex: Qual o preço do corte masculino?"
                                            value={newKnowledge.question}
                                            onChange={(e) => setNewKnowledge(prev => ({ ...prev, question: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="chatbot-field-15">Resposta</Label>
                                        <Textarea id="chatbot-field-15"
                                            placeholder="Ex: O corte masculino custa R$ 50,00 e inclui..."
                                            value={newKnowledge.answer}
                                            onChange={(e) => setNewKnowledge(prev => ({ ...prev, answer: e.target.value }))}
                                            rows={3}
                                        />
                                    </div>
                                    <Button onClick={handleAddKnowledge} data-tour="chatbot-knowledge-add">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Adicionar ao Conhecimento
                                    </Button>
                                </div>

                                {/* Lista de conhecimentos */}
                                <div className="space-y-3" data-tour="chatbot-knowledge-list">
                                    {knowledgeBase.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p>Nenhum conhecimento adicionado ainda</p>
                                        </div>
                                    ) : (
                                        knowledgeBase.map((item) => (
                                            <div
                                                key={item.id}
                                                className="p-4 rounded-lg bg-card border flex items-start justify-between gap-4"
                                            >
                                                <div className="flex-1 min-w-0 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant="outline">{item.category}</Badge>
                                                        {item.keywords?.map((k, i) => (
                                                            <Badge key={i} variant="secondary" className="text-xs">
                                                                {k}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                    <p className="font-medium">{item.question}</p>
                                                    <p className="text-sm text-muted-foreground">{item.answer}</p>
                                                </div>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDeleteKnowledge(item.id)}
                                                    aria-label="Excluir conhecimento"
                                                >
                                                    <Trash2 size={16} aria-hidden />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab: Testar */}
                    <TabsContent value="test" className="space-y-6">
                        <Card className="h-[600px] flex flex-col" data-tour="chatbot-test-panel">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Play className="w-5 h-5 text-primary" />
                                    Testar Chatbot
                                </CardTitle>
                                <CardDescription>
                                    Simule uma conversa para testar as respostas da IA
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col">
                                {/* Área de mensagens */}
                                <div className="flex-1 overflow-y-auto space-y-4 p-4 rounded-lg bg-secondary/20 mb-4">
                                    {testMessages.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p>Envie uma mensagem para testar o chatbot</p>
                                        </div>
                                    ) : (
                                        testMessages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={cn(
                                                    "flex",
                                                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                                                )}
                                            >
                                                <div
                                                    className={cn(
                                                        "max-w-[80%] p-3 rounded-2xl",
                                                        msg.role === 'user'
                                                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                                                            : 'bg-card border rounded-bl-sm'
                                                    )}
                                                >
                                                    <p className="text-sm">{msg.content}</p>
                                                    <p className="text-xs opacity-70 mt-1">
                                                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {isTesting && (
                                        <div className="flex justify-start">
                                            <div className="bg-card border p-3 rounded-2xl rounded-bl-sm">
                                                <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
                                                <span className="sr-only">Gerando resposta…</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Input de mensagem */}
                                <div className="flex gap-2">
                                    <Input
                                        aria-label="Mensagem de teste"
                                        data-tour="chatbot-test-input"
                                        placeholder="Digite uma mensagem para testar..."
                                        value={testInput}
                                        onChange={(e) => setTestInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleTestMessage()}
                                        disabled={isTesting}
                                    />
                                    <Button
                                        onClick={handleTestMessage}
                                        data-tour="chatbot-test-send"
                                        aria-label="Enviar mensagem de teste"
                                        disabled={isTesting || !testInput.trim()}
                                    >
                                        <Send size={16} aria-hidden />
                                    </Button>
                                </div>

                                <p className="text-xs text-muted-foreground mt-2">Teste usa a configuração salva e o provedor real, mas não envia WhatsApp nem cria agendamento. Credenciais são guardadas somente no servidor.</p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Tab: Histórico */}
                    <TabsContent value="history" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <History className="w-5 h-5 text-primary" />
                                            Histórico de Conversas
                                        </CardTitle>
                                        <CardDescription>
                                            Todas as conversas processadas pelo chatbot
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2 w-full md:w-auto">
                                        <div className="relative flex-1 md:flex-none">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
                                            <Input
                                                aria-label="Buscar no histórico"
                                                data-tour="chatbot-history-search"
                                                placeholder="Buscar..."
                                                className="pl-9 w-full md:w-64"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <Button variant="outline" size="icon" onClick={() => loadConversations()} data-tour="chatbot-history-refresh" aria-label="Atualizar histórico">
                                            <RefreshCw size={16} aria-hidden />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent data-tour="chatbot-history-list">
                                {conversations.length === 0 ? (
                                    <EmptyState icon={History} title="Nenhuma conversa registrada ainda" description="As conversas processadas pelo chatbot aparecerão aqui." className="border-0 bg-transparent" />
                                ) : (
                                    <div className="space-y-2">
                                        {conversations.map((conv) => (
                                            <div
                                                key={conv.id}
                                                className={cn(
                                                    "p-3 rounded-lg flex items-start gap-3",
                                                    conv.direction === 'incoming' ? 'surface-2 border border-border' : 'bg-primary/10'
                                                )}
                                            >
                                                {/* Ícone indica quem falou; o texto ao lado (telefone ou nome do bot) também identifica */}
                                                <div className={cn(
                                                    "w-8 h-8 shrink-0 rounded-full flex items-center justify-center",
                                                    conv.direction === 'incoming' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                                                )} aria-hidden>
                                                    {conv.direction === 'incoming' ? <User size={16} /> : <Bot size={16} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                                                        <span className="font-medium text-sm">
                                                            {conv.direction === 'incoming' ? conv.client_phone : settings.bot_name}
                                                        </span>
                                                        {conv.ai_response && (
                                                            <Badge variant="secondary" className="text-xs">IA</Badge>
                                                        )}
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(conv.created_at).toLocaleString('pt-BR')}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground truncate">{conv.content}</p>
                                                    {conv.direction === 'incoming' && <div className="flex gap-2 mt-2">
                                                        <Button size="sm" variant="outline" onClick={async () => {
                                                            if (!salonId) return;
                                                            const { error } = await supabase.rpc('whatsapp_conversation_takeover', { p_salon_id: salonId, p_phone: conv.client_phone, p_pause: true });
                                                            toast({ title: error ? 'Não foi possível pausar.' : 'Conversa pausada para atendimento humano.' });
                                                        }}>Assumir conversa</Button>
                                                        <Button size="sm" variant="ghost" onClick={async () => {
                                                            if (!salonId || !window.confirm('Retomar o assistente automático nesta conversa?')) return;
                                                            const { error } = await supabase.rpc('whatsapp_conversation_takeover', { p_salon_id: salonId, p_phone: conv.client_phone, p_pause: false });
                                                            toast({ title: error ? 'Não foi possível retomar.' : 'Assistente retomado.' });
                                                        }}>Retomar assistente</Button>
                                                    </div>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AdminLayout>
    );
};

export default ChatbotIA;
