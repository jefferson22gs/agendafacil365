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
import { KeyRound, Loader2, PlugZap } from "lucide-react";
import { aiAdmin, optionalNumber, PROVIDERS, type AIAdminState, type AIConfig } from "./api";

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
  const provider = PROVIDERS.find(p => p.value === draft.provider) ?? PROVIDERS[0];
  const keyHint = state.keys.find(k => k.provider === draft.provider);
  const usesEnv = !keyHint && draft.provider === "gemini" && state.envFallback.gemini;
  const set = <K extends keyof AIConfig>(k: K, v: AIConfig[K]) => setDraft(c => ({ ...c, [k]: v }));

  const saveKey = async () => {
    setSavingKey(true);
    try {
      const r = await aiAdmin<{ last4: string }>("save_key", { provider: draft.provider, key: newKey.trim() });
      setNewKey("");
      toast({ title: "Chave salva", description: `Guardada só no servidor (final ${r.last4}).` });
      onKeySaved();
    } catch (e) {
      toast({ title: "Não foi possível salvar a chave", description: (e as Error).message, variant: "destructive" });
    } finally { setSavingKey(false); }
  };
  const test = async () => {
    setTesting(true); setTestResult(null);
    try {
      const r = await aiAdmin<{ text: string; latencyMs: number; tokens: number }>("test", { config: draft });
      setTestResult(`Funcionando: "${r.text.trim().slice(0, 60)}" em ${r.latencyMs} ms (${r.tokens} tokens).`);
    } catch (e) {
      setTestResult(`Falhou: ${(e as Error).message}`);
    } finally { setTesting(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Provedor e modelo</CardTitle>
          <CardDescription>Vale para todos os salões: chatbot do WhatsApp, "Melhorar com IA" e legendas. Os donos de salão não escolhem provedor nem chave.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-md border p-3">
            <div className="min-w-0">
              <Label htmlFor="ai-enabled" className="font-medium">IA ativa na plataforma</Label>
              <p className="text-xs text-muted-foreground">Desligada: o chatbot usa a resposta padrão e os botões de IA avisam que está indisponível.</p>
            </div>
            <Switch id="ai-enabled" checked={draft.enabled} onCheckedChange={v => set("enabled", v)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-provider">Provedor</Label>
            <Select value={draft.provider} onValueChange={v => setDraft(c => ({ ...c, provider: v, model: PROVIDERS.find(p => p.value === v)?.models[0] ?? c.model }))}>
              <SelectTrigger id="ai-provider" className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{provider.help}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-model">Modelo</Label>
            <Input id="ai-model" className="h-11" list="ai-model-options" value={draft.model} maxLength={120} onChange={e => set("model", e.target.value)} />
            <datalist id="ai-model-options">{provider.models.map(m => <option key={m} value={m} />)}</datalist>
            <p className="text-xs text-muted-foreground">Nome exato do modelo no provedor. Sugestões: {provider.models.join(", ")}.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-temp">Criatividade (0 a 1)</Label>
              <Input id="ai-temp" className="h-11" type="number" inputMode="decimal" min={0} max={1} step={0.1} value={draft.temperature} onChange={e => set("temperature", Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">0,3 a 0,5 = respostas consistentes.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-max">Máximo de tokens por resposta</Label>
              <Input id="ai-max" className="h-11" type="number" inputMode="numeric" min={50} max={4000} value={draft.max_tokens} onChange={e => set("max_tokens", Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">Limita custo por mensagem. 500 é suficiente para WhatsApp.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><KeyRound className="w-5 h-5" aria-hidden />Chave da API</CardTitle>
            <CardDescription>Fica guardada só no servidor. Depois de salva, nunca é exibida de novo: aparecem apenas os 4 últimos caracteres.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm" aria-live="polite">
              {keyHint ? <Badge variant="secondary">Chave {provider.name} salva: ••••{keyHint.last4}</Badge>
                : usesEnv ? <Badge variant="outline">Usando o segredo GEMINI_API_KEY do servidor</Badge>
                : <Badge variant="destructive">Nenhuma chave {provider.name} cadastrada</Badge>}
            </div>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={e => { e.preventDefault(); if (newKey.trim().length >= 8) saveKey(); }}>
              <div className="flex-1 min-w-0">
                <Label htmlFor="ai-new-key" className="sr-only">Nova chave {provider.name}</Label>
                <Input id="ai-new-key" className="h-11" type="password" autoComplete="off" spellCheck={false} placeholder={keyHint ? "Colar nova chave para substituir" : "Colar a chave do provedor"} value={newKey} onChange={e => setNewKey(e.target.value)} />
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
            <CardDescription>Faz uma chamada real e curta (cerca de 10 tokens) com o provedor e o modelo acima, mesmo antes de salvar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="h-11" onClick={test} disabled={testing}>
              {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}Testar agora
            </Button>
            {testResult && <p className="text-sm break-words" role="status">{testResult}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gastos e limites</CardTitle>
            <CardDescription>Ao atingir o orçamento do mês ou o limite do salão, a IA para de ser chamada até o mês seguinte.</CardDescription>
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
              <p className="text-xs text-muted-foreground mb-3">O custo é estimado por uma tabela interna dos modelos mais comuns. Para outro modelo, informe o preço do provedor em US$ por 1 milhão de tokens.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-pin">Entrada (US$/1M)</Label>
                  <Input id="ai-pin" className="h-11" inputMode="decimal" placeholder="Automático" value={draft.price_in_per_mtok ?? ""} onChange={e => set("price_in_per_mtok", optionalNumber(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-pout">Saída (US$/1M)</Label>
                  <Input id="ai-pout" className="h-11" inputMode="decimal" placeholder="Automático" value={draft.price_out_per_mtok ?? ""} onChange={e => set("price_out_per_mtok", optionalNumber(e.target.value))} />
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
