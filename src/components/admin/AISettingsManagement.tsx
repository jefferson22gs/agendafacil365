import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  RefreshCw,
  Settings,
  Brain,
  Sparkles
} from "lucide-react";

interface AIProviderKey {
  id: string;
  provider: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  usage_count?: number;
  last_used?: string;
}

interface SalonAIConfig {
  id: string;
  salon_id: string;
  provider: string;
  api_key_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const AISettingsManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiKeys, setApiKeys] = useState<AIProviderKey[]>([]);
  const [salonConfigs, setSalonConfigs] = useState<SalonAIConfig[]>([]);
  const [newApiKey, setNewApiKey] = useState({
    provider: "",
    api_key: "",
    is_active: true
  });

  const aiProviders = [
    { value: "openai", name: "OpenAI", description: "GPT-4, GPT-3.5, etc." },
    { value: "gemini", name: "Google Gemini", description: "Gemini Pro, Gemini Flash" },
    { value: "groq", name: "Groq", description: "LLaMA 3, Mixtral, etc." },
    { value: "anthropic", name: "Anthropic Claude", description: "Claude 3, Claude 2" },
    { value: "openrouter", name: "OpenRouter", description: "Multi-model platform" },
    { value: "mistral", name: "Mistral AI", description: "Mistral models" },
    { value: "cohere", name: "Cohere", description: "Command models" },
    { value: "perplexity", name: "Perplexity", description: "AI-powered search" },
    { value: "together", name: "Together AI", description: "Open source models" },
    { value: "fireworks", name: "Fireworks AI", description: "Llama models" },
    { value: "azure-openai", name: "Azure OpenAI", description: "Microsoft Azure" },
    { value: "nvidia", name: "NVIDIA", description: "NIM models" },
    { value: "grok", name: "xAI Grok", description: "Grok models" },
    { value: "zai", name: "Z.ai", description: "Zhipu AI models" },
    { value: "glm", name: "GLM", description: "Zhipu GLM models" },
    { value: "claude", name: "Claude (Anthropic)", description: "Claude 3.5 Sonnet, Opus, etc." },
  ];

  useEffect(() => {
    loadAIConfigs();
  }, []);

  const loadAIConfigs = async () => {
    setRefreshing(true);
    try {
      // Carregar chaves de API
      const { data: keysData } = await supabase
        .from("ai_provider_keys")
        .select("*")
        .order("created_at", { ascending: false });

      if (keysData) {
        setApiKeys(keysData);
      }

      // Carregar configurações de salão
      const { data: configsData } = await supabase
        .from("salon_ai_configs")
        .select("*")
        .order("created_at", { ascending: false });

      if (configsData) {
        setSalonConfigs(configsData);
      }
    } catch (error) {
      console.error("Error loading AI configs:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar configurações de IA",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddApiKey = async () => {
    if (!newApiKey.provider || !newApiKey.api_key) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("ai_provider_keys")
        .insert({
          provider: newApiKey.provider,
          api_key: newApiKey.api_key,
          is_active: newApiKey.is_active
        });

      if (error) throw error;

      toast({
        title: "✅ Chave adicionada",
        description: `Chave para ${aiProviders.find(p => p.value === newApiKey.provider)?.name} adicionada com sucesso`
      });

      setNewApiKey({ provider: "", api_key: "", is_active: true });
      loadAIConfigs();
    } catch (error: any) {
      console.error("Error adding API key:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao adicionar chave de API",
        variant: "destructive"
      });
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    try {
      const { error } = await supabase
        .from("ai_provider_keys")
        .delete()
        .eq("id", keyId);

      if (error) throw error;

      toast({
        title: "Chave removida",
        description: "Chave de API removida com sucesso"
      });

      loadAIConfigs();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const toggleApiKeyStatus = async (keyId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("ai_provider_keys")
        .update({ is_active: !currentStatus })
        .eq("id", keyId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Chave ${!currentStatus ? 'ativada' : 'desativada'} com sucesso`
      });

      loadAIConfigs();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{apiKeys.length}</p>
                <p className="text-xs text-muted-foreground">Chaves de IA</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/20">
                <Sparkles className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{apiKeys.filter(k => k.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{salonConfigs.length}</p>
                <p className="text-xs text-muted-foreground">Configurações</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add New API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Adicionar Nova Chave de API
          </CardTitle>
          <CardDescription>
            Adicione chaves de API para provedores de IA que serão usados pelos salões
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="grid gap-2">
              <Label>Provedor</Label>
              <Select
                value={newApiKey.provider}
                onValueChange={(value) => setNewApiKey({...newApiKey, provider: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o provedor" />
                </SelectTrigger>
                <SelectContent>
                  {aiProviders.map(provider => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Chave de API</Label>
              <Input
                type="password"
                placeholder="sk-..."
                value={newApiKey.api_key}
                onChange={(e) => setNewApiKey({...newApiKey, api_key: e.target.value})}
              />
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={newApiKey.is_active.toString()}
                onValueChange={(value) => setNewApiKey({...newApiKey, is_active: value === 'true'})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativa</SelectItem>
                  <SelectItem value="false">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={handleAddApiKey} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Chaves de API Cadastradas ({apiKeys.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => {
                  const providerInfo = aiProviders.find(p => p.value === key.provider);
                  return (
                    <TableRow key={key.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{providerInfo?.name || key.provider}</p>
                          <p className="text-xs text-muted-foreground">{providerInfo?.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs">
                          {key.api_key.substring(0, 6)}...{key.api_key.substring(key.api_key.length - 4)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          key.is_active
                            ? 'bg-success/10 text-success'
                            : 'bg-destructive/10 text-destructive'
                        }`}>
                          {key.is_active ? 'Ativa' : 'Inativa'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(key.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleApiKeyStatus(key.id, key.is_active)}
                          >
                            {key.is_active ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteApiKey(key.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};