import { useState, useEffect, useRef } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { Temporal } from "@js-temporal/polyfill";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Send,
  Users,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  RefreshCw,
  Upload,
  FileText,
  Copy,
  Sparkles,
  Eye,
  StopCircle
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Contact {
  id?: string;
  phone: string;
  name: string;
  source: 'database' | 'whatsapp' | 'manual' | 'upload';
  selected?: boolean;
}

interface Broadcast {
  id: string;
  message: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  status: 'pending' | 'scheduled' | 'processing' | 'completed' | 'stopped' | 'failed' | 'uncertain';
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

interface BroadcastMessage {
  id: string;
  broadcast_id: string;
  recipient_phone: string;
  recipient_name?: string;
  status: 'pending' | 'sent' | 'failed';
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

interface BroadcastTemplate {
  id: string;
  name: string;
  content: string;
  created_at: string;
}

export const BroadcastMessagesComponent = () => {
  const { toast } = useToast();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Estados de contatos
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);

  // Estados do disparo
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showSendConfirmation, setShowSendConfirmation] = useState(false);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const submission = useRef<string | null>(null);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
  const [activeBroadcastId, setActiveBroadcastId] = useState<string | null>(null);

  // Estados de modais
  const [showAddManual, setShowAddManual] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [broadcastMessages, setBroadcastMessages] = useState<BroadcastMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [manualNumbers, setManualNumbers] = useState("");

  // Template management
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Estados de estatísticas
  const [todayStats, setTodayStats] = useState({ sent: 0, limit: 5000, remaining: 5000 });
  const [isImproving, setIsImproving] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    if (salonId) {
      loadBroadcasts();
      loadTemplates();
      loadTodayStats();
      checkActiveBroadcast();
    }
  }, [salonId]);

  // Polling para atualizar status de broadcasts ativos
  useEffect(() => {
    if (!activeBroadcastId) return;

    const interval = setInterval(() => {
      loadBroadcasts();
      loadTodayStats();
    }, 5000); // Atualiza a cada 5 segundos

    return () => clearInterval(interval);
  }, [activeBroadcastId]);

  useEffect(() => {
    // Filtrar contatos
    const filtered = contacts.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
    );
    setFilteredContacts(filtered);
  }, [searchTerm, contacts]);

  useEffect(() => {
    // Contar selecionados
    const count = contacts.filter(c => c.selected).length;
    setSelectedCount(count);
  }, [contacts]);

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: salon } = await supabase
      .from("salons")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (salon) {
      setSalonId(salon.id);

      // Verificar instância conectada
      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("instance_name, status")
        .eq("salon_id", salon.id)
        .single();

      if (instance) {
        setInstanceName(instance.instance_name);
        setIsConnected(instance.status === "connected");
      }
    }
  };

  const loadContacts = async () => {
    if (!salonId) return;

    setLoadingContacts(true);
    try {
      // Buscar contatos diretamente do banco de dados
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('name, phone')
        .eq('salon_id', salonId)
        .not('phone', 'is', null)
        .neq('phone', '');

      if (clientsError) throw clientsError;

      const contactsWithSelection = (clientsData || []).map((c: any) => ({
        name: c.name,
        phone: c.phone,
        selected: false
      }));

      setContacts(contactsWithSelection);
      setFilteredContacts(contactsWithSelection);

      toast({
        title: "Contatos carregados",
        description: `${contactsWithSelection.length} contatos encontrados`,
      });
    } catch (error: any) {
      console.error("Error loading contacts:", error);
      toast({
        title: "Erro ao carregar contatos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingContacts(false);
    }
  };

  const loadBroadcasts = async () => {
    if (!salonId) return;

    const { data } = await supabase
      .from("broadcasts")
      .select("*")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) {
      setBroadcasts(data);

      // Verificar se há broadcast ativo
      const active = data.find(b => b.status === 'processing');
      setActiveBroadcastId(active?.id || null);
    }
  };

  const checkActiveBroadcast = async () => {
    if (!salonId) return;

    const { data } = await supabase
      .from("broadcasts")
      .select("id")
      .eq("salon_id", salonId)
      .eq("status", "processing")
      .maybeSingle();

    setActiveBroadcastId(data?.id || null);
  };

  const loadBroadcastMessages = async (broadcastId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("broadcast_messages")
        .select("*")
        .eq("broadcast_id", broadcastId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBroadcastMessages(data || []);
    } catch (error) {
      console.error("Error loading broadcast messages:", error);
      toast({
        title: "Erro ao carregar mensagens",
        description: "Não foi possível carregar os detalhes do disparo",
        variant: "destructive",
      });
    } finally {
      setLoadingMessages(false);
    }
  };

  const stopBroadcast = async (broadcastId: string) => {
    try {
      if (!window.confirm("Interromper os itens ainda pendentes? Mensagens já aceitas não podem ser recolhidas.")) return;
      const { data, error } = await supabase.functions.invoke("broadcast-messages-v2", {
        body: { action: "stop_broadcast", salonId, broadcastId },
      });
      if (error || !data?.success) throw new Error("Não foi possível interromper a campanha.");

      toast({
        title: "Disparo interrompido",
        description: "O disparo foi parado com sucesso",
      });

      setActiveBroadcastId(null);
      loadBroadcasts();
    } catch (error: any) {
      console.error("Error stopping broadcast:", error);
      toast({
        title: "Erro ao parar disparo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const viewBroadcastDetails = async (broadcast: Broadcast) => {
    setSelectedBroadcast(broadcast);
    setShowHistoryModal(true);
    await loadBroadcastMessages(broadcast.id);
  };

  const loadTemplates = async () => {
    if (!salonId) return;

    const { data } = await supabase
      .from("broadcast_templates")
      .select("*")
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false });

    if (data) {
      setTemplates(data);
    }
  };

  const loadTodayStats = async () => {
    if (!salonId) return;

    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from("broadcast_messages")
      .select("id")
      .eq("salon_id", salonId)
      .gte("created_at", `${today}T00:00:00`)
      .eq("status", "sent");

    const sent = data?.length || 0;
    const limit = 5000;

    setTodayStats({
      sent,
      limit,
      remaining: Math.max(0, limit - sent)
    });
  };

  const toggleContact = (phone: string) => {
    setContacts(prev => prev.map(c =>
      c.phone === phone ? { ...c, selected: !c.selected } : c
    ));
  };

  const toggleAll = (selected: boolean) => {
    setContacts(prev => prev.map(c => ({ ...c, selected })));
  };

  const selectBatch = (size: number) => {
    const newContacts = [...contacts];
    // Desmarcar todos primeiro
    newContacts.forEach(c => c.selected = false);

    // Selecionar os primeiros 'size' contatos da lista atual (filtrada se houver busca, mas aqui aplicamos na lista completa por enquanto)
    // Se quiser respeitar o filtro visual:
    const targets = filteredContacts.slice(0, size);
    const targetIds = new Set(targets.map(c => c.phone));

    setContacts(prev => prev.map(c => ({
      ...c,
      selected: targetIds.has(c.phone)
    })));

    toast({
      title: "Seleção em Lote",
      description: `${Math.min(size, targets.length)} contatos selecionados.`,
    });
  };

  const addManualContacts = () => {
    const numbers = manualNumbers
      .split(/[\n,;]/)
      .map(n => n.trim().replace(/\D/g, ""))
      .filter(n => n.length >= 10);

    const existingPhones = new Set(contacts.map(c => c.phone));
    const newContacts: Contact[] = [];

    for (const phone of numbers) {
      if (!existingPhones.has(phone)) {
        newContacts.push({
          phone,
          name: `Contato ${phone}`,
          source: 'manual',
          selected: true
        });
        existingPhones.add(phone);
      }
    }

    if (newContacts.length > 0) {
      setContacts(prev => [...prev, ...newContacts]);
      toast({
        title: "Contatos adicionados",
        description: `${newContacts.length} números adicionados`,
      });
    }

    setManualNumbers("");
    setShowAddManual(false);
  };

  const saveTemplate = async () => {
    if (!templateName.trim() || !message.trim()) {
      toast({
        title: "Campos incompletos",
        description: "Preencha o nome e a mensagem do template.",
        variant: "destructive",
      });
      return;
    }

    if (!salonId) return;

    try {
      const { data, error } = await supabase
        .from("broadcast_templates")
        .insert({
          salon_id: salonId,
          name: templateName,
          content: message
        })
        .select()
        .single();

      if (error) throw error;

      setTemplates(prev => [data, ...prev]);
      setTemplateName("");
      setShowTemplateModal(false);

      toast({
        title: "Template salvo",
        description: "Modelo de mensagem salvo com sucesso!",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const improveWithAI = async () => {
    if (!message.trim() || !salonId) return;

    setIsImproving(true);
    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Você precisa estar autenticado para usar a IA");
      }

      const { data, error } = await supabase.functions.invoke('generate-text-content', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          text: message,
          instruction: "Melhore este texto para uma mensagem de transmissão whatsapp. Mantenha curto, persuasivo e use emojis. Mantenha a variável {nome}.",
          salonId: salonId
        }
      });

      if (error) throw error;

      if (data?.text) {
        setMessage(data.text);
        toast({
          title: "Texto melhorado!",
          description: "A IA aprimorou sua mensagem.",
        });
      } else {
        throw new Error("Nenhum texto foi gerado pela IA");
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      toast({
        title: "Erro na IA",
        description: error.message || "Falha ao gerar texto. Verifique se a IA está configurada no Super Admin.",
        variant: "destructive"
      });
    } finally {
      setIsImproving(false);
    }
  };

  const loadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template && template.content) {
      setMessage(template.content);
      setSelectedTemplate(templateId);
      toast({
        title: "Template carregado",
        description: "Mensagem do template carregada.",
      });
    } else {
      toast({
        title: "Erro ao carregar template",
        description: "Template não encontrado ou sem conteúdo.",
        variant: "destructive",
      });
    }
  };

  const sendBroadcast = async () => {
    const selectedContacts = contacts.filter(c => c.selected);

    if (selectedContacts.length === 0) {
      toast({
        title: "Nenhum contato selecionado",
        description: "Selecione pelo menos um contato para enviar.",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Mensagem vazia",
        description: "Digite uma mensagem para enviar.",
        variant: "destructive",
      });
      return;
    }

    if (selectedContacts.length > todayStats.remaining) {
      toast({
        title: "Limite diário excedido",
        description: `Você pode enviar mais ${todayStats.remaining} mensagens hoje.`,
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      if (!consentAcknowledged) throw new Error("Confirme que os contatos autorizaram receber a campanha.");
      const recipients = selectedContacts.map(c => {
        const explicit = c.phone.startsWith("+") ? c.phone : c.phone.replace(/\D/g, "").length > 11 ? `+${c.phone.replace(/\D/g, "")}` : c.phone;
        const phone = parsePhoneNumberFromString(explicit, "BR");
        if (!phone?.isValid()) throw new Error("Há telefone inválido na seleção. Confira os contatos.");
        return { phone: phone.number, name: c.name };
      });
      const scheduledFor = scheduledLocal ? Temporal.PlainDateTime.from(scheduledLocal).toZonedDateTime(timezone, { disambiguation: "reject" }).toInstant().toString() : undefined;
      submission.current ??= crypto.randomUUID();

      const response = await supabase.functions.invoke('broadcast-messages-v2', {
        body: {
          action: 'create_broadcast',
          salonId,
          message: message.trim(),
          recipients,
          scheduledFor,
          submissionId: submission.current,
          confirmed: true,
          consentAcknowledged: true,
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro desconhecido na função');
      }

      if (!response.data) {
        throw new Error("Nenhuma resposta recebida do servidor");
      }

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      if (response.data?.success) {
        toast({
          title: "🚀 Disparo iniciado!",
          description: `${response.data.message}. Tempo estimado: ${response.data.estimatedTime}`,
          duration: 10000,
        });

        submission.current = null;
        setShowSendConfirmation(false);
        setScheduledLocal("");
        setConsentAcknowledged(false);
        // Limpar seleção
        setContacts(prev => prev.map(c => ({ ...c, selected: false })));
        setMessage("");

        // Recarregar histórico
        setTimeout(() => {
          loadBroadcasts();
          loadTodayStats();
        }, 2000);
      }
    } catch (error: any) {
      console.error("Error sending broadcast:", error);
      let errorMsg = error.message || "Erro desconhecido";

      if (error.message.includes("fetch") || error.message.includes("network")) {
        errorMsg = "Falha na conexão com o servidor. Verifique sua internet.";
      } else if (error.message.includes("404")) {
        errorMsg = "Função de disparo não encontrada. Contate o suporte.";
      } else if (error.message.includes("500")) {
        errorMsg = "Erro interno do servidor. Tente novamente mais tarde.";
      }

      toast({
        title: "Erro ao enviar",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success"><CheckCircle size={12} className="mr-1" /> Concluído</Badge>;
      case 'processing':
        return <Badge variant="info"><Loader2 size={12} className="mr-1 animate-spin" /> Enviando</Badge>;
      case 'stopped':
        return <Badge variant="warning"><AlertTriangle size={12} className="mr-1" /> Parado</Badge>;
      case 'failed':
        return <Badge variant="danger"><XCircle size={12} className="mr-1" /> Falhou</Badge>;
      case 'scheduled':
        return <Badge variant="info"><Clock size={12} className="mr-1" /> Agendado</Badge>;
      case 'uncertain':
        return <Badge variant="warning"><AlertTriangle size={12} className="mr-1" /> Verificar</Badge>;
      default:
        return <Badge variant="secondary"><Clock size={12} className="mr-1" /> Pendente</Badge>;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'database':
        return <Badge variant="outline" className="text-xs">Cliente</Badge>;
      case 'whatsapp':
        return <Badge variant="outline" className="text-xs text-success border-success/40">WhatsApp</Badge>;
      case 'manual':
        return <Badge variant="outline" className="text-xs text-primary border-primary/40">Manual</Badge>;
      default:
        return null;
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="bg-warning/10 border-warning/30" data-tour="broadcast-disconnected">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="text-warning" aria-hidden />
              WhatsApp desconectado
            </CardTitle>
            <CardDescription>
              Conecte seu WhatsApp primeiro para usar o disparador de mensagens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/admin/whatsapp'}>
              Conectar WhatsApp
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4" data-tour="broadcast-header">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <Send className="text-primary" />
            Disparador de Mensagens
          </h1>
          <p className="text-muted-foreground mt-1">
            Envie mensagens para seus clientes de forma segura e automática
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Limite diário</p>
            <p className="text-lg font-semibold">
              <span className="text-primary">{todayStats.remaining}</span>
              <span className="text-muted-foreground">/{todayStats.limit}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna de contatos */}
        <div className="lg:col-span-2 space-y-4" data-tour="broadcast-contacts">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Users size={20} />
                  Contatos ({contacts.length})
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddManual(true)}
                  >
                    <Plus size={16} className="mr-1" />
                    Adicionar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-tour="broadcast-load-contacts"
                    aria-label="Carregar contatos"
                    onClick={loadContacts}
                    disabled={loadingContacts}
                  >
                    {loadingContacts ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                  </Button>
                </div>
              </div>
              <CardDescription>
                {selectedCount > 0 ? (
                  <span className="text-primary font-medium">{selectedCount} selecionados</span>
                ) : (
                  "Selecione os contatos que receberão a mensagem"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Busca e ações */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    data-tour="broadcast-search"
                    placeholder="Buscar por nome ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAll(true)}
                >
                  Todos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAll(false)}
                >
                  Nenhum
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => selectBatch(500)}
                  title="Selecionar os primeiros 500 da lista"
                >
                  Lote 500
                </Button>
              </div>

              {/* Lista de contatos */}
              {contacts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-tour="broadcast-contacts-empty">
                  <Users size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Nenhum contato carregado</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={loadContacts}
                    disabled={loadingContacts}
                  >
                    {loadingContacts ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={16} className="mr-2" />
                        Carregar Contatos
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto space-y-1" data-tour="broadcast-contact-list">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.phone}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${contact.selected
                        ? 'bg-primary/20 border border-primary/30'
                        : 'bg-surface-1 hover:bg-surface-2'
                        }`}
                      onClick={() => toggleContact(contact.phone)}
                    >
                      <Checkbox
                        checked={contact.selected}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleContact(contact.phone)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{contact.name}</p>
                        <p className="text-sm text-muted-foreground">{contact.phone}</p>
                      </div>
                      {getSourceBadge(contact.source)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna de mensagem */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare size={20} />
                Mensagem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Template</Label>
                <div className="flex gap-2">
                  <select
                    data-tour="broadcast-template"
                    value={selectedTemplate || ""}
                    onChange={(e) => loadTemplate(e.target.value)}
                    className="flex-1 border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Selecione um template</option>
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowTemplateModal(true)}
                  >
                    <FileText size={16} />
                  </Button>
                </div>
              </div>

              <div className="flex justify-end mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={improveWithAI}
                  disabled={isImproving || !message.trim()}
                  className="text-primary hover:bg-primary/10"
                >
                  {isImproving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Sparkles size={14} className="mr-2" />}
                  Melhorar com IA
                </Button>
              </div>

              <Textarea
                data-tour="broadcast-message"
                placeholder="Digite sua mensagem aqui... (Use {nome} para personalizar)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="resize-none"
              />
              <div className="text-sm text-muted-foreground">
                {message.length} caracteres
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => { submission.current = null; setShowSendConfirmation(true); }}
                data-tour="broadcast-send"
                disabled={isSending || selectedCount === 0 || !message.trim()}
              >
                {isSending ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send size={18} className="mr-2" />
                    Enviar para {selectedCount} contatos
                  </>
                )}
              </Button>

              {selectedCount > 0 && (
                <p className="text-xs text-center text-muted-foreground">
                  Tempo estimado: ~{Math.ceil((selectedCount * 5) / 60)} minutos
                </p>
              )}
            </CardContent>
          </Card>

          {/* Histórico */}
          <Card data-tour="broadcast-history">
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Disparos</CardTitle>
            </CardHeader>
            <CardContent>
              {broadcasts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum disparo realizado
                </p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {broadcasts.slice(0, 5).map((broadcast) => (
                    <div
                      key={broadcast.id}
                      className="p-3 bg-surface-1 rounded-lg"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(broadcast.status)}
                          {(broadcast.status === 'processing' || broadcast.status === 'scheduled') && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => stopBroadcast(broadcast.id)}
                              className="h-6 px-2 text-xs"
                            >
                              <StopCircle size={12} className="mr-1" />
                              Parar
                            </Button>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(broadcast.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm line-clamp-2 mb-2">{broadcast.message}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="text-success">Enviadas: {broadcast.sent_count || 0}</span>
                        <span className="text-destructive">Falhas: {broadcast.failed_count || 0}</span>
                        <span>Total: {broadcast.total_recipients}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => viewBroadcastDetails(broadcast)}
                        data-tour="broadcast-details-button"
                        className="w-full mt-2 h-7 text-xs"
                      >
                        <Eye size={12} className="mr-1" />
                        Ver Detalhes
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showSendConfirmation} onOpenChange={(open) => { if (!isSending) setShowSendConfirmation(open); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conferir campanha</DialogTitle></DialogHeader>
          <p className="text-sm">Você está prestes a enviar para <strong>{selectedCount} contatos</strong>. Confira a mensagem e os destinatários antes de confirmar.</p>
          <p className="text-sm rounded-lg bg-muted p-3 whitespace-pre-wrap">{message}</p>
          <Label htmlFor="campaign-schedule">Agendar (deixe vazio para enviar agora)</Label>
          <Input id="campaign-schedule" type="datetime-local" value={scheduledLocal} onChange={(e) => { setScheduledLocal(e.target.value); submission.current = null; }} />
          <Label htmlFor="campaign-timezone">Fuso do envio</Label>
          <select id="campaign-timezone" className="border rounded-md p-2 bg-background" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {["America/Sao_Paulo", "America/Manaus", "America/Rio_Branco", "America/Noronha"].map((zone) => <option key={zone}>{zone}</option>)}
          </select>
          <label className="flex gap-2 items-start text-sm"><Checkbox checked={consentAcknowledged} onCheckedChange={(checked) => setConsentAcknowledged(checked === true)} /><span>Estes contatos autorizaram receber mensagens do salão. Não enviarei comunicação não solicitada.</span></label>
          <DialogFooter><Button variant="outline" disabled={isSending} onClick={() => setShowSendConfirmation(false)}>Voltar</Button><Button disabled={isSending || !consentAcknowledged} onClick={sendBroadcast}>{isSending ? "Registrando…" : scheduledLocal ? "Confirmar agendamento" : "Confirmar envio"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal adicionar números */}
      <Dialog open={showAddManual} onOpenChange={setShowAddManual}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Números Manualmente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Números de telefone</Label>
              <Textarea
                placeholder="Cole os números aqui (um por linha ou separados por vírgula)&#10;&#10;Exemplo:&#10;5511999999999&#10;5521888888888"
                value={manualNumbers}
                onChange={(e) => setManualNumbers(e.target.value)}
                rows={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use o formato com código do país (ex: 5511999999999)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddManual(false)}>
              Cancelar
            </Button>
            <Button onClick={addManualContacts}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal salvar template */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Template</Label>
              <Input
                placeholder="Ex: Mensagem de Promoção"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div>
              <Label>Conteúdo da Mensagem</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={saveTemplate}>
              Salvar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes do Histórico */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-tour="broadcast-details-dialog">
          <DialogHeader>
            <DialogTitle>Detalhes do Disparo</DialogTitle>
          </DialogHeader>

          {selectedBroadcast && (
            <div className="space-y-4">
              {/* Resumo */}
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      {getStatusBadge(selectedBroadcast.status)}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-lg font-bold">{selectedBroadcast.total_recipients}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Enviados</p>
                      <p className="text-lg font-bold text-success">{selectedBroadcast.sent_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Falhas</p>
                      <p className="text-lg font-bold text-destructive">{selectedBroadcast.failed_count || 0}</p>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-1">Mensagem:</p>
                    <p className="text-sm">{selectedBroadcast.message}</p>
                  </div>

                  <div className="mt-2 text-xs text-muted-foreground">
                    Criado em: {new Date(selectedBroadcast.created_at).toLocaleString('pt-BR')}
                    {selectedBroadcast.completed_at && (
                      <> • Concluído em: {new Date(selectedBroadcast.completed_at).toLocaleString('pt-BR')}</>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Lista de Mensagens */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Mensagens Individuais</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadBroadcastMessages(selectedBroadcast.id)}
                    disabled={loadingMessages}
                  >
                    {loadingMessages ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                  </Button>
                </div>

                {loadingMessages ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={32} className="animate-spin text-primary" />
                  </div>
                ) : broadcastMessages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma mensagem encontrada
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {broadcastMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-lg border ${
                          msg.status === 'sent'
                            ? 'bg-success/10 border-success/30'
                            : msg.status === 'failed'
                            ? 'bg-destructive/10 border-destructive/30'
                            : 'bg-muted border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {msg.status === 'sent' ? (
                                <CheckCircle size={16} className="text-success" aria-hidden />
                              ) : msg.status === 'failed' ? (
                                <XCircle size={16} className="text-destructive" aria-hidden />
                              ) : (
                                <Clock size={16} className="text-muted-foreground" aria-hidden />
                              )}
                              <span className="font-medium">{msg.recipient_name || 'Sem nome'}</span>
                              <span className="sr-only">{msg.status === 'sent' ? '(enviada)' : msg.status === 'failed' ? '(falhou)' : '(pendente)'}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{msg.recipient_phone}</p>
                            {msg.error_message && (
                              <p className="text-xs text-destructive mt-1">
                                Erro: {msg.error_message}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            {msg.sent_at ? (
                              <span>{new Date(msg.sent_at).toLocaleTimeString('pt-BR')}</span>
                            ) : (
                              <span>Pendente</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};