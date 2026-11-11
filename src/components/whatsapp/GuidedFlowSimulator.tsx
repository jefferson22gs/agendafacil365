import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

/** Resposta de whatsapp-chatbot (action=test): mensagens com payload interativo e a sessão do fluxo guiado. */
interface Row { id: string; title: string; description?: string }
interface Payload { op?: string; options?: { id: string; title: string }[]; body?: { title?: string; description?: string; name?: string; footer?: string; footerText?: string; buttons?: { displayText: string; id: string }[]; sections?: { rows: Row[] }[]; buttonText?: string } }
interface OutMessage { type: string; text: string; payload?: Payload }
interface Bubble { id: string; role: "user" | "bot"; text: string; options?: { id: string; label: string; description?: string }[]; title?: string; footer?: string; list?: boolean }

const optionsOf = (m: OutMessage) => {
  const b = m.payload?.body;
  if (!b) return undefined;
  // Enquete: opções clicáveis (id ↔ texto) vêm em payload.options.
  if (m.payload?.op === "poll" && m.payload.options?.length) return m.payload.options.map(o => ({ id: o.id, label: o.title }));
  if (b.buttons?.length) return b.buttons.map(x => ({ id: x.id, label: x.displayText }));
  const rows = b.sections?.flatMap(s => s.rows) ?? [];
  return rows.length ? rows.map(r => ({ id: r.id, label: r.title, description: r.description?.trim() || undefined })) : undefined;
};

/**
 * Celular WhatsApp no painel: o dono clica nos botões/listas (ou digita 1, 2, V, 0…) e percorre toda a árvore do bot
 * com os serviços reais do salão. Nada é persistido nem reservado: a sessão vai e volta no corpo (preview).
 */
export function GuidedFlowSimulator({ salonId, enabled, dirty }: { salonId: string; enabled: boolean; dirty: boolean }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [session, setSession] = useState<unknown>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [bubbles]);

  const send = async (text: string, selection?: string, label?: string) => {
    const shown = (label ?? text).trim();
    if (!shown || busy) return;
    setBubbles(b => [...b, { id: crypto.randomUUID(), role: "user", text: shown }]);
    setInput(""); setBusy(true); setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("whatsapp-chatbot", { body: { action: "test", salonId, text: shown, selection, session } });
      if (err || !data?.success) throw new Error("Simulador indisponível. Salve o fluxo e tente novamente.");
      setSession(data.session ?? null);
      const msgs: OutMessage[] = Array.isArray(data.messages) && data.messages.length ? data.messages : [{ type: "text", text: String(data.text ?? "") }];
      setBubbles(b => [...b, ...msgs.filter(m => m.text).map(m => {
        const body = m.payload?.body;
        const options = optionsOf(m);
        const poll = m.payload?.op === "poll";
        return { id: crypto.randomUUID(), role: "bot" as const, text: options ? (poll ? body?.name ?? m.text : body?.description ?? m.text) : m.text, options, title: options && !poll ? body?.title : undefined, footer: poll ? undefined : body?.footer || body?.footerText || undefined, list: !!body?.sections || poll };
      })]);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro no simulador."); }
    finally { setBusy(false); }
  };
  const reset = () => { setBubbles([]); setSession(null); setError(null); };

  return (
    <section aria-label="Simulador do WhatsApp" data-tour="guided-flow-simulator" className="mx-auto w-full max-w-[22rem]">
      <div className="rounded-[2.25rem] border border-border bg-card p-2 shadow-xl">
        <div className="flex h-[36rem] flex-col overflow-hidden rounded-[1.75rem] bg-[#efe7dd] dark:bg-[#0b141a]">
          <header className="flex items-center justify-between bg-[#075e54] px-4 py-3 text-white">
            <div className="min-w-0"><p className="truncate text-sm font-semibold">Simulador · seu WhatsApp</p><p className="text-[11px] text-white/80">{enabled ? "Fluxo guiado ligado" : "Ative e salve o fluxo para simular"}</p></div>
            <Button type="button" size="sm" variant="ghost" className="min-h-11 text-white hover:bg-white/15 hover:text-white" onClick={reset} aria-label="Reiniciar conversa"><RotateCcw size={16} aria-hidden /></Button>
          </header>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3" role="log" aria-live="polite" aria-busy={busy}>
            {!bubbles.length && <p className="mx-auto max-w-[16rem] rounded-lg bg-[#fff5c4] px-3 py-2 text-center text-xs text-[#54656f] dark:bg-[#1f2c34] dark:text-[#aebac1]">Envie "oi" para abrir o menu. Clique nos botões ou digite os números. Nada é agendado de verdade.</p>}
            {bubbles.map(b => (
              <div key={b.id} className={`flex ${b.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-lg px-3 py-2 text-sm shadow-sm ${b.role === "user" ? "bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-white" : "bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]"}`}>
                  {b.title && <p className="mb-1 font-semibold">{b.title}</p>}
                  <p className="whitespace-pre-wrap break-words">{b.text}</p>
                  {b.footer && <p className="mt-1 text-[11px] text-[#667781] dark:text-[#8696a0]">{b.footer}</p>}
                  {b.options && (
                    <div className="mt-2 flex flex-col gap-1 border-t border-black/10 pt-2 dark:border-white/10" role="group" aria-label={b.list ? "Opções da lista" : "Botões"}>
                      {b.options.map((o, i) => (
                        <button key={o.id} type="button" disabled={busy} onClick={() => void send(String(i + 1), o.id, o.label)}
                          className="min-h-11 rounded-md bg-[#f0f2f5] px-2 py-1.5 text-left text-[13px] font-medium text-[#027eb5] hover:bg-[#e4e7ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:bg-[#2a3942] dark:text-[#53bdeb]">
                          {o.label}{o.description && <span className="block text-[11px] font-normal text-[#667781] dark:text-[#8696a0]">{o.description}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <p className="text-xs text-[#667781]" role="status"><Loader2 className="mr-1 inline animate-spin" size={12} aria-hidden />digitando…</p>}
            {error && <p role="alert" className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">{error}</p>}
            <div ref={bottom} />
          </div>
          <form className="flex items-center gap-2 bg-[#f0f2f5] p-2 dark:bg-[#1f2c34]" onSubmit={e => { e.preventDefault(); void send(input); }}>
            <Input aria-label="Mensagem" placeholder={enabled ? "Digite oi, 1, V, 0, #agendar…" : "Ative e salve o fluxo"} value={input} onChange={e => setInput(e.target.value)} disabled={busy || !enabled} className="min-h-11 rounded-full bg-white dark:bg-[#2a3942]" maxLength={500} />
            <Button type="submit" size="icon" variant="brand" className="h-11 w-11 shrink-0 rounded-full" disabled={busy || !enabled || !input.trim()} aria-label="Enviar"><Send size={18} aria-hidden /></Button>
          </form>
        </div>
      </div>
      {dirty && <p className="mt-2 text-center text-xs text-muted-foreground">Salve o fluxo para o simulador usar as novas opções.</p>}
    </section>
  );
}
