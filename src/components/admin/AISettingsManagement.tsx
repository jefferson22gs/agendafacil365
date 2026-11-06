import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Brain, Info, Loader2, RefreshCw, Save } from "lucide-react";
import { aiAdmin, type AIAdminState, type AIConfig } from "./ai/api";
import { ConfigTab } from "./ai/ConfigTab";
import { TrainingTab } from "./ai/TrainingTab";
import { UsageTab } from "./ai/UsageTab";
import { LimitsTab } from "./ai/LimitsTab";

/**
 * IA central da plataforma: só o super admin escolhe provedor, modelo, chave, treinamento e limites.
 * Tudo passa pela Edge Function ai-admin; a chave nunca volta para o navegador.
 */
export const AISettingsManagement = () => {
  const { toast } = useToast();
  const [state, setState] = useState<AIAdminState | null>(null);
  const [draft, setDraftState] = useState<AIConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (keepDraft = false) => {
    setLoading(true); setLoadError(null);
    try {
      const s = await aiAdmin<AIAdminState>("get");
      setState(s);
      if (!keepDraft) { setDraftState(s.config); setDirty(false); }
    } catch (e) {
      setLoadError((e as Error).message);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const setDraft = (fn: (c: AIConfig) => AIConfig) => { setDraftState(c => (c ? fn(c) : c)); setDirty(true); };
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await aiAdmin("save_config", { config: draft });
      toast({ title: "Configuração salva", description: "Vale imediatamente para todos os salões." });
      await load();
    } catch (e) {
      toast({ title: "Não foi possível salvar", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading && !state) return <div className="flex justify-center py-12" role="status"><Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden /><span className="sr-only">Carregando configurações de IA</span></div>;
  if (!state || !draft) return (
    <Alert variant="destructive">
      <AlertTitle>Não foi possível carregar a IA</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{loadError ?? "Erro desconhecido."} Confirme que a migração de IA central foi aplicada e a função ai-admin publicada.</p>
        <Button variant="outline" className="h-11" onClick={() => load()}>Tentar de novo</Button>
      </AlertDescription>
    </Alert>
  );

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold flex items-center gap-2"><Brain className="w-6 h-6 text-primary shrink-0" aria-hidden />IA da plataforma</h2>
          <p className="text-muted-foreground text-sm">Uma única chave e um único treinamento para todos os salões, com controle de gastos.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" className="h-11" onClick={() => load(dirty)} disabled={loading} aria-label="Atualizar dados">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          </Button>
          <Button className="h-11" onClick={save} disabled={saving || (!dirty && state.configured)}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden /> : <Save className="w-4 h-4 mr-2" aria-hidden />}
            {state.configured ? "Salvar alterações" : "Ativar configuração central"}
          </Button>
        </div>
      </div>

      {!state.configured && (
        <Alert>
          <Info className="h-4 w-4" aria-hidden />
          <AlertTitle>Configuração central ainda não ativada</AlertTitle>
          <AlertDescription>
            Enquanto não for salva, cada recurso continua no modo antigo (chaves legadas e o segredo GEMINI_API_KEY do servidor), sem limites de gasto.
            Cadastre a chave, teste e clique em "Ativar configuração central".
          </AlertDescription>
        </Alert>
      )}
      {dirty && state.configured && <p className="text-sm text-amber-600" role="status">Há alterações não salvas.</p>}

      <Tabs defaultValue="config" className="w-full">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex w-max min-w-full sm:min-w-0">
            <TabsTrigger value="config" className="min-h-[44px]">Configuração</TabsTrigger>
            <TabsTrigger value="training" className="min-h-[44px]">Treinamento</TabsTrigger>
            <TabsTrigger value="usage" className="min-h-[44px]">Consumo</TabsTrigger>
            <TabsTrigger value="limits" className="min-h-[44px]">Limites por salão</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="config" className="mt-6"><ConfigTab state={state} draft={draft} setDraft={setDraft} onKeySaved={() => load(true)} /></TabsContent>
        <TabsContent value="training" className="mt-6"><TrainingTab draft={draft} setDraft={setDraft} /></TabsContent>
        <TabsContent value="usage" className="mt-6"><UsageTab state={state} /></TabsContent>
        <TabsContent value="limits" className="mt-6"><LimitsTab state={state} reload={() => load(true)} /></TabsContent>
      </Tabs>
    </div>
  );
};
