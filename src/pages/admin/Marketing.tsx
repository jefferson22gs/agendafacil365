import { normalizePhone } from "@/features/whatsapp/contacts/phone";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Send, MessageCircle, Bell, Users, Gift, Megaphone, Clock, CheckCircle, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, Save, Sparkles, Wand2, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

interface Client {
    id: string;
    name: string;
    phone: string | null;
    loyalty_points?: number;
    total_visits?: number;
}

const Marketing = () => {
    const { user } = useAuth();
    const { isSupported: pushSupported, permission: pushPermission, showNotification, requestPermission } = usePushNotifications();
    const [salon, setSalon] = useState<{ id: string; name: string; whatsapp: string | null } | null>(null);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [pushSubscriptionsCount, setPushSubscriptionsCount] = useState(0);

    // Form state
    const [messageType, setMessageType] = useState<'promotional' | 'informative' | 'coupon'>('promotional');
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [selectedClients, setSelectedClients] = useState<string[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    const [sendVia, setSendVia] = useState<{ whatsapp: boolean; push: boolean }>({ whatsapp: true, push: false });

    // Templates & AI
    const [dbTemplates, setDbTemplates] = useState<{ id: string; name: string; content: string }[]>([]);
    const [showSaveTemplate, setShowSaveTemplate] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState("");
    const [isImproving, setIsImproving] = useState(false);

    useEffect(() => {
        if (salon?.id) {
            loadTemplates();
        }
    }, [salon?.id]);

    const loadTemplates = async () => {
        if (!salon?.id) return;
        const { data } = await supabase
            .from('broadcast_templates')
            .select('*')
            .eq('salon_id', salon.id)
            .order('name');
        if (data) setDbTemplates(data);
    };

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim() || !message.trim() || !salon?.id) return;

        try {
            const { error } = await supabase
                .from('broadcast_templates')
                .insert({
                    salon_id: salon.id,
                    name: newTemplateName,
                    content: message
                });

            if (error) throw error;

            toast.success("Template salvo com sucesso!");
            setShowSaveTemplate(false);
            setNewTemplateName("");
            loadTemplates();
        } catch (error: any) {
            toast.error("Erro ao salvar template: " + error.message);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        try {
            const { error } = await supabase
                .from('broadcast_templates')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success("Template removido");
            loadTemplates();
        } catch (error: any) {
            toast.error("Erro ao remover template");
        }
    };

    const improveWithAI = async () => {
        if (!message.trim() || !salon?.id) return;

        setIsImproving(true);
        try {
            const { data, error } = await supabase.functions.invoke('generate-text-content', {
                body: {
                    text: message,
                    instruction: "Melhore este texto de marketing para ficar mais persuasivo, curto e com emojis. Mantenha a variável {nome}.",
                    salonId: salon.id
                }
            });

            if (error) throw error;

            if (data?.text) {
                setMessage(data.text);
                toast.success("Texto melhorado com IA! ✨");
            }
        } catch (error: any) {
            console.error("AI Error:", error);
            toast.error("Erro ao gerar texto com IA. Verifique se há uma chave configurada.");
        } finally {
            setIsImproving(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        try {
            // Get salon
            const { data: salonData, error: salonError } = await supabase
                .from('salons')
                .select('id, name, whatsapp')
                .eq('owner_id', user?.id)
                .single();

            if (salonError) throw salonError;
            setSalon(salonData);

            // Get clients
            const { data: clientsData, error: clientsError } = await supabase
                .from('clients')
                .select('id, name, phone, total_visits')
                .eq('salon_id', salonData.id)
                .order('name')
                .limit(5000);

            if (clientsError) throw clientsError;
            setClients(clientsData || []);

            // Get push subscriptions count
            const { count, error: pushError } = await (supabase as any)
                .from('push_subscriptions')
                .select('*', { count: 'exact', head: true })
                .eq('salon_id', salonData.id)
                .eq('is_active', true);

            if (!pushError) {
                setPushSubscriptionsCount(count || 0);
            }

        } catch (error: any) {
            console.error("Error:", error);
            toast.error("Erro ao carregar dados");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = (checked: boolean) => {
        setSelectAll(checked);
        if (checked) {
            setSelectedClients(clients.filter(c => c.phone).map(c => c.id));
        } else {
            setSelectedClients([]);
        }
    };

    const handleSelectClient = (clientId: string, checked: boolean) => {
        if (checked) {
            setSelectedClients([...selectedClients, clientId]);
        } else {
            setSelectedClients(selectedClients.filter(id => id !== clientId));
            setSelectAll(false);
        }
    };

    const handleSendNotification = async () => {
        if (!message.trim()) {
            toast.error("Digite uma mensagem");
            return;
        }
        if (selectedClients.length === 0) {
            toast.error("Selecione pelo menos um cliente");
            return;
        }
        if (!sendVia.whatsapp && !sendVia.push) {
            toast.error("Selecione pelo menos um canal de envio");
            return;
        }

        if (!window.confirm(`Confirmar envio para ${selectedClients.length} clientes selecionados? Envie marketing somente a quem autorizou.`)) return;
        setSending(true);

        try {
            const selectedClientData = clients.filter(c => selectedClients.includes(c.id));

            if (sendVia.whatsapp) {
                const recipients = selectedClientData.filter(c => c.phone).map(c => {
                    const phone = normalizePhone(c.phone!);
                    if (!phone) throw new Error('Há telefone inválido na seleção. Confira antes de enviar.');
                    return { phone, name: c.name };
                });
                const { data, error } = await supabase.functions.invoke('broadcast-messages-v2', { body: {
                    action: 'create_broadcast', salonId: salon?.id, message,
                    recipients, submissionId: crypto.randomUUID(), confirmed: true, consentAcknowledged: true,
                }});
                if (error || !data?.success) throw new Error('Não foi possível registrar a campanha. Confira a conexão WhatsApp.');
                toast.success('Campanha registrada na fila.', { description: 'Acompanhe os envios no Disparador. Isso não confirma entrega.' });
            }

            if (sendVia.push) {
                // Send push notifications via Firebase Cloud Messaging
                try {
                    // Get anon key or session token for authentication
                    const session = (await supabase.auth.getSession()).data.session;
                    const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

                    if (!authToken) {
                        throw new Error('Não autenticado. Faça login novamente.');
                    }

                    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-fcm`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`,
                            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                        },
                        body: JSON.stringify({
                            salon_id: salon?.id,
                            client_ids: selectedClients,
                            title: title || salon?.name || 'Nova mensagem',
                            body: message.replace('{nome}', 'Cliente'),
                        }),
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error || `HTTP ${response.status}`);
                    }

                    if (data?.sent > 0) {
                        toast.success(`${data.sent} notificações push enviadas!`, {
                            description: `Para dispositivos que permitiram notificações.`
                        });
                    } else {
                        toast.info("Nenhum dispositivo encontrado para push", {
                            description: "Os clientes precisam instalar o app e permitir notificações."
                        });
                    }
                } catch (pushError: any) {
                    console.error('Push error:', pushError);
                    toast.error("Erro ao enviar push: " + (pushError.message || pushError));
                }
            }

        } catch (error: any) {
            console.error("Error:", error);
            toast.error(error.message || "Erro ao enviar notificações");
        } finally {
            setSending(false);
        }
    };

    const messageTemplates = {
        promotional: [
            { title: "Promoção Especial", message: "Olá {nome}! 🎉 Temos uma promoção especial para você! Venha nos visitar e aproveite descontos incríveis. Agende já!" },
            { title: "Desconto de Fim de Semana", message: "Oi {nome}! Este fim de semana temos 20% de desconto em todos os serviços. Não perca! 💇‍♀️" },
        ],
        informative: [
            { title: "Novo Horário", message: "Olá {nome}! Informamos que a partir de agora estamos atendendo em novo horário. Confira no nosso site!" },
            { title: "Novidade no Salão", message: "Oi {nome}! Temos novidades no salão! Venha conhecer nossos novos serviços. 🌟" },
        ],
        coupon: [
            { title: "Cupom Exclusivo", message: "Olá {nome}! 🎁 Use o cupom CLIENTE10 e ganhe 10% de desconto na sua próxima visita!" },
            { title: "Presente de Aniversário", message: "Oi {nome}! 🎂 No mês do seu aniversário, você ganha um presente especial! Venha retirar." },
        ],
    };

    const applyTemplate = (template: { title: string; message: string }) => {
        setTitle(template.title);
        setMessage(template.message);
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-3" role="status">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden />
                    <p className="text-sm text-muted-foreground">Carregando marketing…</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
        <div className="space-y-6">
            <div data-tour="marketing-header">
                <PageHeader className="mb-0" title="Marketing & Notificações" description="Envie mensagens para seus clientes por WhatsApp ou notificação push." />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Left: Message Composer */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Message Type Tabs */}
                    <Card data-tour="marketing-composer">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Megaphone size={20} className="text-primary" aria-hidden />
                                Compor Mensagem
                            </CardTitle>
                            <CardDescription>
                                Escolha o tipo e escreva sua mensagem
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs value={messageType} onValueChange={(v) => setMessageType(v as any)}>
                                <TabsList className="grid w-full grid-cols-3 mb-4" data-tour="marketing-type-tabs">
                                    <TabsTrigger value="promotional" className="flex items-center gap-2" data-tour="marketing-promotional-tab">
                                        <Gift size={16} />
                                        Promoção
                                    </TabsTrigger>
                                    <TabsTrigger value="informative" className="flex items-center gap-2" data-tour="marketing-informative-tab">
                                        <Bell size={16} />
                                        Informativo
                                    </TabsTrigger>
                                    <TabsTrigger value="coupon" className="flex items-center gap-2" data-tour="marketing-coupon-tab">
                                        <Gift size={16} />
                                        Cupom
                                    </TabsTrigger>
                                </TabsList>

                                <div className="space-y-4">
                                    {/* Templates */}
                                    <div data-tour="marketing-quick-templates">
                                        <Label className="text-sm text-muted-foreground mb-2 block">Templates Rápidos</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {messageTemplates[messageType].map((template, index) => (
                                                <Button
                                                    key={index}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => applyTemplate(template)}
                                                >
                                                    {template.title}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Meus Templates (Banco de Dados) */}
                                    {dbTemplates.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-border" data-tour="marketing-saved-templates">
                                            <Label className="text-sm text-muted-foreground mb-2 block">Meus Templates Salvos</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {dbTemplates.map((template) => (
                                                    <div key={template.id} className="flex items-center gap-1 surface-2 border border-border rounded-md pr-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 px-3 hover:bg-secondary/50"
                                                            onClick={() => {
                                                                setTitle(template.name);
                                                                setMessage(template.content);
                                                            }}
                                                        >
                                                            {template.name}
                                                        </Button>
                                                        <button
                                                            onClick={() => handleDeleteTemplate(template.id)}
                                                            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-destructive transition-colors"
                                                            title="Excluir template"
                                                            aria-label={`Excluir template ${template.name}`}
                                                        >
                                                            <Trash2 size={14} aria-hidden />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Title */}
                                    <div className="space-y-2">
                                        <Label htmlFor="title">Título (opcional)</Label>
                                        <Input
                                            id="title"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Ex: Promoção de Natal"
                                        />
                                    </div>

                                    {/* Message */}
                                    <div className="space-y-2" data-tour="marketing-message">
                                        <Label htmlFor="message">Mensagem *</Label>
                                        <textarea
                                            id="message"
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Digite sua mensagem aqui... Use {nome} para personalizar com o nome do cliente."
                                            className="w-full min-h-[150px] p-3 rounded-[10px] bg-background border border-input text-foreground placeholder:text-muted-foreground resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            maxLength={1000}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Dica: use <code className="bg-secondary px-1 rounded">{'{nome}'}</code> para personalizar com o nome do cliente
                                        </p>
                                    </div>

                                    {/* AI Tools & Save Template */}
                                    <div className="flex flex-wrap gap-2 justify-end">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={improveWithAI}
                                            data-tour="marketing-ai-improve"
                                            disabled={isImproving || !message.trim()}
                                            className="text-primary border-primary/20 hover:bg-primary/5"
                                        >
                                            {isImproving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                                            Melhorar com IA
                                        </Button>

                                        <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" size="sm" disabled={!message.trim()} data-tour="marketing-save-template">
                                                    <Save className="w-4 h-4 mr-2" />
                                                    Salvar Template
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent data-tour="marketing-template-dialog">
                                                <DialogHeader>
                                                    <DialogTitle>Salvar Template</DialogTitle>
                                                    <DialogDescription>
                                                        Dê um nome para este modelo de mensagem para usar depois.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="marketing-template-name">Nome do Template</Label>
                                                        <Input
                                                            id="marketing-template-name"
                                                            data-tour="marketing-template-name"
                                                            value={newTemplateName}
                                                            onChange={(e) => setNewTemplateName(e.target.value)}
                                                            placeholder="Ex: Lembrete de Agendamento"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Conteúdo</Label>
                                                        <div className="p-3 bg-secondary/50 rounded-md text-sm text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
                                                            {message}
                                                        </div>
                                                    </div>
                                                </div>
                                                <DialogFooter>
                                                    <Button variant="ghost" onClick={() => setShowSaveTemplate(false)}>Cancelar</Button>
                                                    <Button data-tour="marketing-template-save" onClick={handleSaveTemplate} disabled={!newTemplateName.trim()}>Salvar</Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </div>

                                    {/* Send Via */}
                                    <div className="space-y-2" data-tour="marketing-channels">
                                        <Label>Enviar via</Label>
                                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                                            <label className="flex min-h-[44px] items-center gap-2 cursor-pointer">
                                                <Checkbox
                                                    checked={sendVia.whatsapp}
                                                    onCheckedChange={(checked) => setSendVia({ ...sendVia, whatsapp: !!checked })}
                                                />
                                                <MessageCircle size={16} className="text-primary" aria-hidden />
                                                <span>WhatsApp</span>
                                            </label>
                                            <label className="flex min-h-[44px] items-center gap-2 cursor-pointer">
                                                <Checkbox
                                                    checked={sendVia.push}
                                                    onCheckedChange={(checked) => setSendVia({ ...sendVia, push: !!checked })}
                                                    disabled={!pushSupported || pushSubscriptionsCount === 0}
                                                />
                                                <Bell size={16} className="text-primary" aria-hidden />
                                                <span>Push {pushSubscriptionsCount > 0 ? `(${pushSubscriptionsCount} dispositivos)` : '(0 dispositivos)'}</span>
                                            </label>
                                        </div>
                                        {pushSubscriptionsCount === 0 && (
                                            <p className="flex items-start gap-2 text-xs text-foreground border border-warning/30 bg-warning/10 p-2 rounded-lg">
                                                <Info size={14} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                                                Nenhum cliente permitiu notificações push ainda.Os clientes precisam acessar a página de agendamento ({salon?.name && <span className="text-primary">/s/{salon.name.toLowerCase().replace(/\s+/g, '')}</span>}) e clicar em "Ativar notificações".
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </Tabs>
                        </CardContent>
                    </Card>

                    {/* Send Button */}
                    <Button
                        variant="brand"
                        onClick={handleSendNotification}
                        data-tour="marketing-send"
                        disabled={sending || selectedClients.length === 0 || !message.trim()}
                        className="w-full py-6 text-lg"
                        size="lg"
                    >
                        {sending ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Send size={20} className="mr-2" />
                                Enviar para {selectedClients.length} cliente(s)
                            </>
                        )}
                    </Button>
                </div>

                {/* Right: Client Selection */}
                <div>
                    <Card className="h-fit" data-tour="marketing-clients">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users size={20} className="text-primary" aria-hidden />
                                Selecionar Clientes
                            </CardTitle>
                            <CardDescription>
                                {clients.length} clientes cadastrados
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Select All */}
                            <label className="flex items-center gap-2 p-3 surface-2 border border-border rounded-lg cursor-pointer hover:bg-secondary transition-colors" data-tour="marketing-select-all">
                                <Checkbox
                                    checked={selectAll}
                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                />
                                <span className="font-medium">Selecionar todos com telefone</span>
                            </label>

                            {/* Client List */}
                            <div className="max-h-[400px] overflow-y-auto space-y-2">
                                {clients.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        Nenhum cliente cadastrado ainda
                                    </p>
                                ) : (
                                    clients.map((client) => (
                                        <label
                                            key={client.id}
                                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedClients.includes(client.id)
                                                ? 'bg-primary/10 border border-primary/30'
                                                : 'border border-transparent hover:bg-secondary/60'
                                                } ${!client.phone ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <Checkbox
                                                checked={selectedClients.includes(client.id)}
                                                onCheckedChange={(checked) => handleSelectClient(client.id, !!checked)}
                                                disabled={!client.phone}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-foreground truncate">{client.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {client.phone || 'Sem telefone'}
                                                    {client.total_visits ? ` • ${client.total_visits} visitas` : ''}
                                                </p>
                                            </div>
                                            {selectedClients.includes(client.id) && (
                                                <CheckCircle size={16} className="text-primary flex-shrink-0" aria-hidden />
                                            )}
                                        </label>
                                    ))
                                )}
                            </div>

                            {/* Stats */}
                            <div className="pt-4 border-t border-border">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Selecionados:</span>
                                    <span className="font-bold text-primary">{selectedClients.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Com telefone:</span>
                                    <span className="font-medium">{clients.filter(c => c.phone).length}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
        </AdminLayout>
    );
};

export default Marketing;
