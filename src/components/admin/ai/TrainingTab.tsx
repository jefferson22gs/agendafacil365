import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Send, Trash2, RotateCcw } from "lucide-react";
import { aiAdmin, type AIConfig } from "./api";

interface Props { draft: AIConfig; setDraft: (fn: (c: AIConfig) => AIConfig) => void }
type Msg = { role: "user" | "assistant"; content: string };

const Counter = ({ value, max }: { value: string; max: number }) => (
  <span className={`text-xs ${value.length > max ? "text-destructive" : "text-muted-foreground"}`}>{value.length}/{max}</span>
);

export const TrainingTab = ({ draft, setDraft }: Props) => {
  const [chat, setChat] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const set = <K extends keyof AIConfig>(k: K, v: AIConfig[K]) => setDraft(c => ({ ...c, [k]: v }));
  const setExample = (i: number, k: "q" | "a", v: string) => setDraft(c => ({ ...c, examples: c.examples.map((e, j) => j === i ? { ...e, [k]: v } : e) }));

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    const next: Msg[] = [...chat, { role: "user", content: text }];
    setChat(next); setInput(""); setSending(true); setChatError(null);
    try {
      const r = await aiAdmin<{ text: string }>("simulate", { config: draft, messages: next });
      setChat([...next, { role: "assistant", content: r.text }]);
    } catch (e) {
      setChatError((e as Error).message);
    } finally { setSending(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Instruções da plataforma</CardTitle>
            <CardDescription>
              Entram antes das instruções de cada salão, em todas as conversas do chatbot. O salão continua com o próprio nome, serviços e base de conhecimento; aqui ficam as regras que valem para todos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between gap-2"><Label htmlFor="ai-base">Instruções gerais</Label><Counter value={draft.base_prompt} max={4000} /></div>
              <Textarea id="ai-base" rows={5} value={draft.base_prompt} onChange={e => set("base_prompt", e.target.value)} placeholder="Ex.: Você atende clientes de salões de beleza pelo WhatsApp. Seja breve: no máximo 3 frases por resposta." />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between gap-2"><Label htmlFor="ai-tone">Tom de voz</Label><Counter value={draft.tone} max={500} /></div>
              <Input id="ai-tone" className="h-11" value={draft.tone} onChange={e => set("tone", e.target.value)} placeholder="Ex.: acolhedor, profissional, poucos emojis" />
              <p className="text-xs text-muted-foreground">Também é usado em "Melhorar com IA" e nas legendas.</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between gap-2"><Label htmlFor="ai-rules">Regras obrigatórias</Label><Counter value={draft.rules} max={4000} /></div>
              <Textarea id="ai-rules" rows={4} value={draft.rules} onChange={e => set("rules", e.target.value)} placeholder={"Ex.:\n- Nunca prometa descontos.\n- Não fale de assuntos fora do salão."} />
              <p className="text-xs text-muted-foreground">Valem para todos os recursos de IA. As regras de segurança do sistema (não inventar preços, não revelar dados de clientes) continuam ativas sempre.</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between gap-2"><Label htmlFor="ai-knowledge">Base de conhecimento da plataforma</Label><Counter value={draft.knowledge} max={8000} /></div>
              <Textarea id="ai-knowledge" rows={5} value={draft.knowledge} onChange={e => set("knowledge", e.target.value)} placeholder="Ex.: Como funciona o agendamento online, política de cancelamento padrão (24h), link de agendamento..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Exemplos de perguntas e respostas</CardTitle>
            <CardDescription>Mostram à IA o estilo esperado. Use respostas genéricas: preços e horários reais vêm do cadastro de cada salão.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {draft.examples.map((ex, i) => (
              <fieldset key={i} className="space-y-2 rounded-md border p-3">
                <legend className="px-1 text-sm font-medium">Exemplo {i + 1}</legend>
                <Label htmlFor={`ai-q-${i}`} className="sr-only">Pergunta {i + 1}</Label>
                <Input id={`ai-q-${i}`} className="h-11" maxLength={500} placeholder="Pergunta do cliente" value={ex.q} onChange={e => setExample(i, "q", e.target.value)} />
                <Label htmlFor={`ai-a-${i}`} className="sr-only">Resposta {i + 1}</Label>
                <Textarea id={`ai-a-${i}`} rows={2} maxLength={1000} placeholder="Resposta ideal" value={ex.a} onChange={e => setExample(i, "a", e.target.value)} />
                <Button type="button" variant="ghost" className="h-11 text-destructive" onClick={() => setDraft(c => ({ ...c, examples: c.examples.filter((_, j) => j !== i) }))}>
                  <Trash2 className="w-4 h-4 mr-2" aria-hidden />Remover exemplo {i + 1}
                </Button>
              </fieldset>
            ))}
            <Button type="button" variant="outline" className="h-11" disabled={draft.examples.length >= 20} onClick={() => setDraft(c => ({ ...c, examples: [...c.examples, { q: "", a: "" }] }))}>
              <Plus className="w-4 h-4 mr-2" aria-hidden />Adicionar exemplo
            </Button>
            {draft.examples.length >= 20 && <p className="text-xs text-muted-foreground">Máximo de 20 exemplos.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-4 h-fit">
        <CardHeader>
          <CardTitle className="text-lg">Conversa simulada</CardTitle>
          <CardDescription>Teste o treinamento acima (mesmo sem salvar) com um salão fictício. Usa a IA de verdade e conta no consumo como "Simulação". Não acessa agenda nem dados reais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-80 overflow-y-auto rounded-md border bg-muted/30 p-3 space-y-2" aria-live="polite" aria-label="Mensagens da simulação">
            {chat.length === 0 && <p className="text-sm text-muted-foreground">Escreva como se fosse um cliente, por exemplo: "Quanto custa um corte?"</p>}
            {chat.map((m, i) => (
              <div key={i} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-background border"}`}>
                <span className="sr-only">{m.role === "user" ? "Cliente: " : "Assistente: "}</span>{m.content}
              </div>
            ))}
            {sending && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden />Gerando resposta…</p>}
          </div>
          {chatError && <p className="text-sm text-destructive" role="alert">{chatError}</p>}
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); send(); }}>
            <Label htmlFor="ai-sim-input" className="sr-only">Mensagem do cliente</Label>
            <Input id="ai-sim-input" className="h-11 min-w-0" maxLength={2000} value={input} onChange={e => setInput(e.target.value)} placeholder="Mensagem do cliente" disabled={sending} />
            <Button type="submit" className="h-11 w-11 shrink-0 p-0" disabled={sending || !input.trim()} aria-label="Enviar mensagem"><Send className="w-4 h-4" aria-hidden /></Button>
            <Button type="button" variant="outline" className="h-11 w-11 shrink-0 p-0" onClick={() => { setChat([]); setChatError(null); }} aria-label="Limpar conversa"><RotateCcw className="w-4 h-4" aria-hidden /></Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
