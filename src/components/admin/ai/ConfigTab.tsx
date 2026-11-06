import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, ListRestart, Loader2, PlugZap, Sparkles } from "lucide-react";
import { aiAdmin, optionalNumber, type AIAdminState, type AIConfig, type ModelInfo } from "./api";

interface Props {
  state: AIAdminState;
  draft: AIConfig;
  setDraft: (fn: (c: AIConfig) => AIConfig) => void;
  onKeySaved: () => void;
}

export const ConfigTab = ({ state, draft, setDraft, onKeySaved }: Props) => {
  const { toast } = useToast();
  const [newKey, setNewKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [latest, setLatest] = useState<{ flash: string | null; pro: string | null } | null>(null);
  const [listing, setListing] = useState(false);
  const keyHint = state.keys.find(k => k.provider === "gemini");
  const usesEnv = !keyHint && state.envFallback.gemini;
  const hasKey = !!keyHint || usesEnv;
  const set = <K extends keyof AIConfig>(k: K, v: AIConfig[K]) => setDraft(c => ({ ...c, [k]: v }));
  const auto = draft.model_mode === "auto";
  const shownModel = auto ? (latest?.[draft.model_family] ?? (state.config.model_family === draft.model_family ? state.effectiveModel : null)) : draft.model;

  const saveKey = async () => {
    setSavingKey(true);
    try {
      const r = await aiAdmin<{ last4: string }>("save_key", { key: newKey.trim() });
      setNewKey("");
      toast({ title: "Chave salva", description: `Guardada só no servidor (final ${r.last4}).` });
      onKeySaved();
    } catch (e) {
      toast({ title: "Não foi possível salvar a chave", description: (e as Error).message, variant: "destructive" });
    } finally { setSavingKey(false); }
  };
  const listModels = async () => {
    setListing(true);
    try {
      const r = await aiAdmin<{ models: ModelInfo[]; latest: { flash: string | null; pro: string | null } }>("list_models");
      setModels(r.models); setLatest(r.latest);
    } catch (e) {
      toast({ title: "Não foi possível listar os modelos", description: (e as Error).message, variant: "destructive" });
    } finally { setListing(false); }
  };
  const test = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await aiAdmin<{ text: string; latencyMs: number; tokens: number; model: string }>("test", { config: draft });
      setTestResult(`Funcionando com ${r.model}: "${r.text.trim().slice(0, 60)}" em ${r.latencyMs} ms (${r.tokens} tokens).`);
    } catch (e) {
      setTestResult(`Falhou: ${(e as Error).message}`);
    } finally { setTesting(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Sparkles className="w-5 h-5" aria-hidden />Google Gemini</CardTitle>
            <CardDescription>A plataforma usa somente o Gemini. Vale para todos os salões: chatbot do WhatsApp, "Melhorar com IA" e legendas. Os donos de salão não escolhem provedor nem chave.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div className="min-w-0">
                <Label htmlFor="ai-enabled" className="font-medium">IA ativa na plataforma</Label>
                <p className="text-xs text-muted-foreground">Desligada: o chatbot usa a resposta padrão e os botões de IA avisam que está indisponível. Teste e simulação continuam funcionando.</p>
              </div>
              <Switch id="ai-enabled" checked={draft.enabled} onCheckedChange={v => set("enabled", v)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-model-mode">Modelo</Label>
              <Select value={auto ? `auto-${draft.model_family}` : "fixed"} onValueChange={v => setDraft(c => v === "fixed" ? { ...c, model_mode: "fixed" } : { ...c, model_mode: "auto", model_family: v === "auto-pro" ? "pro" : "flash" })}>
                <SelectTrigger id="ai-model-mode" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto-flash">Automático: Flash mais recente (recomendado)</SelectItem>
                  <SelectItem value="auto-pro">Automático: o mais avançado (mais caro)</SelectItem>
                  <SelectItem value="fixed">Escolher um modelo fixo</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {auto ? "O servidor consulta a lista oficial do Google uma vez por dia e usa a versão estável mais nova da família. Prévias e modelos experimentais ficam de fora." : "O modelo não muda sozinho. Quando o Google descontinuar a versão, você precisará trocar aqui."}
              </p>
            </div>

            {!auto && (
              <div className="space-y-2">
                <Label htmlFor="ai-model">Modelo fixo</Label>
                {models?.length ? (
                  <Select value={draft.model} onValueChange={v => set("model", v)}>
                    <SelectTrigger id="ai-model" className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>{models.map(m => <SelectItem key={m.id} value={m.id}>{m.displayName} ({m.id})</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input id="ai-model" className="h-11" value={draft.model} maxLength={120} onChange={e => set("model", e.target.value.trim())} />
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm min-w-0 break-words" aria-live="polite">Em uso agora: <strong>{shownModel ?? "será definido no primeiro uso"}</strong></p>
              <Button type="button" variant="outline" className="h-11 shrink-0" onClick={listModels} disabled={listing || !hasKey}>
                {listing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden /> : <ListRestart className="w-4 h-4 mr-2" aria-hidden />}Atualizar lista do Google
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ai-thinking">Raciocínio</Label>
                <Select value={draft.thinking_level} onValueChange={v => set("thinking_level", v as AIConfig["thinking_level"])}>
                  <SelectTrigger id="ai-thinking" className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baixo (rápido e barato)</SelectItem>
                    <SelectItem value="MEDIUM">Médio</SelectItem>
                    <SelectItem value="HIGH">Alto (mais assertivo, mais caro)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Tokens de raciocínio são cobrados como saída.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-max">Máximo de tokens por resposta</Label>
                <Input id="ai-max" className="h-11" type="number" inputMode="numeric" min={50} max={8192} value={draft.max_tokens} onChange={e => set("max_tokens", Number(e.target.value))} />
                <p className="text-xs text-muted-foreground">Inclui o raciocínio. 1024 é suficiente para WhatsApp.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><KeyRound className="w-5 h-5" aria-hidden />Chave do Gemini</CardTitle>
            <CardDescription>Crie em aistudio.google.com (API keys). Fica guardada só no servidor; depois de salva, aparecem apenas os 4 últimos caracteres.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm" aria-live="polite">
              {keyHint ? <Badge variant="secondary">Chave salva: ••••{keyHint.last4}</Badge>
                : usesEnv ? <Badge variant="outline">Usando o segredo GEMINI_API_KEY do servidor</Badge>
                : <Badge variant="destructive">Nenhuma chave cadastrada</Badge>}
            </div>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={e => { e.preventDefault(); if (newKey.trim().length >= 8) saveKey(); }}>
              <div className="flex-1 min-w-0">
                <Label htmlFor="ai-new-key" className="sr-only">Nova chave do Gemini</Label>
                <Input id="ai-new-key" className="h-11" type="password" autoComplete="off" spellCheck={false} placeholder={keyHint ? "Colar nova chave para substituir" : "Colar a chave do Gemini"} value={newKey} onChange={e => setNewKey(e.target.value)} />
              </div>
              <Button type="submit" className="h-11" disabled={savingKey || newKey.trim().length < 8}>
                {savingKey && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}Salvar chave
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><PlugZap className="w-5 h-5" aria-hidden />Testar conexão</CardTitle>
            <CardDescription>Faz uma chamada real e curta com a configuração acima, mesmo antes de salvar. Conta no consumo como "Teste do painel".</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="h-11" onClick={test} disabled={testing || !hasKey}>
              {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}Testar agora
            </Button>
            {testResult && <p className="text-sm break-words" role="status">{testResult}</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-lg">Gastos e limites</CardTitle>
          <CardDescription>
            Antes de cada chamada o servidor reserva o custo máximo estimado. Ao atingir o orçamento do mês ou o limite do salão, a IA não é chamada até o mês seguinte.
            Os valores são estimativas: a cobrança real vem do Google e pode diferir um pouco.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-budget">Orçamento mensal (US$)</Label>
              <Input id="ai-budget" className="h-11" inputMode="decimal" placeholder="Sem limite" value={draft.monthly_budget_usd ?? ""} onChange={e => set("monthly_budget_usd", optionalNumber(e.target.value))} />
              <p className="text-xs text-muted-foreground">Custo estimado de todos os salões somados.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-fx">Cotação do dólar (R$)</Label>
              <Input id="ai-fx" className="h-11" inputMode="decimal" value={draft.usd_brl} onChange={e => set("usd_brl", optionalNumber(e.target.value) ?? 0)} />
              <p className="text-xs text-muted-foreground">Só para exibir valores em reais.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-salon-req">Requisições por salão/mês</Label>
              <Input id="ai-salon-req" className="h-11" inputMode="numeric" placeholder="Sem limite" value={draft.default_salon_monthly_requests ?? ""} onChange={e => set("default_salon_monthly_requests", optionalNumber(e.target.value))} />
              <p className="text-xs text-muted-foreground">Uma mensagem do chatbot pode usar mais de uma requisição (consultar agenda, depois responder).</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-salon-tok">Tokens por salão/mês</Label>
              <Input id="ai-salon-tok" className="h-11" inputMode="numeric" placeholder="Sem limite" value={draft.default_salon_monthly_tokens ?? ""} onChange={e => set("default_salon_monthly_tokens", optionalNumber(e.target.value))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Esses são os limites padrão. Exceções por salão ficam na aba "Limites por salão".</p>
          <div className="space-y-2">
            <Label htmlFor="ai-on-limit">Quando o limite for atingido, no chatbot</Label>
            <Select value={draft.on_limit} onValueChange={v => set("on_limit", v as AIConfig["on_limit"])}>
              <SelectTrigger id="ai-on-limit" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fallback">Enviar a resposta padrão</SelectItem>
                <SelectItem value="handoff">Enviar a resposta padrão e passar a conversa para a equipe</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-fallback">Resposta padrão</Label>
            <Textarea id="ai-fallback" rows={2} maxLength={500} value={draft.fallback_message} onChange={e => set("fallback_message", e.target.value)} />
          </div>
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium min-h-[44px] flex items-center">Preço do modelo (opcional)</summary>
            <p className="text-xs text-muted-foreground mb-3">O custo usa a tabela oficial de preços do Gemini conferida em 06/11/2026. Se o Google mudar o preço, ou para um modelo novo, informe aqui o valor em US$ por 1 milhão de tokens.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ai-pin">Entrada</Label>
                <Input id="ai-pin" className="h-11" inputMode="decimal" placeholder="Automático" value={draft.price_in_per_mtok ?? ""} onChange={e => set("price_in_per_mtok", optionalNumber(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-pout">Saída e raciocínio</Label>
                <Input id="ai-pout" className="h-11" inputMode="decimal" placeholder="Automático" value={draft.price_out_per_mtok ?? ""} onChange={e => set("price_out_per_mtok", optionalNumber(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-pcache">Cache</Label>
                <Input id="ai-pcache" className="h-11" inputMode="decimal" placeholder="Automático" value={draft.price_cache_per_mtok ?? ""} onChange={e => set("price_cache_per_mtok", optionalNumber(e.target.value))} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Entrada e saída precisam ser preenchidas juntas para valer.</p>
          </details>
        </CardContent>
      </Card>
    </div>
  );
};
