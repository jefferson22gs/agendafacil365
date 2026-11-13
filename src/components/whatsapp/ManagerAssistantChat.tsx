import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { whatsappCall } from "@/pages/admin/whatsapp/api";

interface Attachment { mime: string; data: string; name: string }
interface ChatRequest { text: string; requestId: string; selection?: string; pendingId?: string | null; attachment?: Attachment }
interface Reply { text: string; pendingId?: string | null; expiresAt?: string | null }
interface Bubble { id: string; role: "user" | "assistant"; text: string; pendingId?: string | null; expiresAt?: string | null }
const EXAMPLES = ["Liste todas as pendências de hoje", "Quem está me devendo hoje?", "Analise a minha operação nos últimos 6 meses", "Tem alguma pendência de retorno hoje?"];
// Mesmos formatos que o servidor reconhece pelos bytes (managerAssistant.mediaMime).
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav"];

async function attachmentOf(file: File): Promise<Attachment> {
  if (!TYPES.includes(file.type) || file.size > 5 * 1024 * 1024 || !file.size) throw new Error("Envie imagem, PDF ou áudio de até 5 MB.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
  return { mime: file.type, data, name: file.name };
}

export function ManagerAssistantChat({ salonId, enabled, advanced }: { salonId: string; enabled: boolean; advanced: boolean }) {
  const [rows, setRows] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<ChatRequest | null>(null);
  const lock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const send = async (selection?: string, target?: string, previous?: ChatRequest) => {
    if (lock.current || !enabled || (!previous && !selection && !text.trim() && !file)) return;
    lock.current = true; setBusy(true); setError(null);
    let request: ChatRequest | undefined = previous;
    try {
      if (!request) {
        request = { text: selection === "mgr_confirm_yes" ? "Confirmar" : selection === "mgr_confirm_no" ? "Cancelar" : text.trim(), selection, pendingId: target ?? pendingId, requestId: crypto.randomUUID() };
        if (!selection && file) {
          if (!advanced) throw new Error("Anexos exigem o nível Avançado.");
          request.attachment = await attachmentOf(file);
        }
        setRows(r => [...r, { id: request!.requestId, role: "user", text: request!.text + (request!.attachment ? `\nAnexo: ${request!.attachment.name}` : "") }]);
        setText(""); setFile(null); if (fileInput.current) fileInput.current.value = "";
      }
      setRetry(request);
      const result = await whatsappCall("manager-assistant", { action: "chat", salonId, ...request }) as Reply;
      setPendingId(result.pendingId ?? null); setRetry(null);
      setRows(r => [...r, { id: crypto.randomUUID(), role: "assistant", text: result.text, pendingId: result.pendingId, expiresAt: result.expiresAt }]);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível consultar. Tente novamente."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section aria-labelledby="manager-chat-title" className="grid min-w-0 gap-6 xl:grid-cols-[1fr_24rem]">
    <div className="space-y-4">
      <h2 id="manager-chat-title" className="text-xl font-semibold">Faça o teste</h2>
      <p className="text-sm text-muted-foreground">Converse com o assistente usando os dados reais deste salão. Não é uma demonstração com dados fictícios.</p>
      <p className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"><strong>Atenção: confirmar executa a operação de verdade.</strong> Confira cliente, serviço, valores e datas no resumo. Cancelar não altera o registro.</p>
      <div className="flex flex-col gap-2" aria-label="Sugestões de mensagem">{EXAMPLES.map(s => <Button key={s} variant="outline" className="h-auto min-h-11 justify-start whitespace-normal py-3 text-left" disabled={busy || !enabled || !!retry || !!pendingId} onClick={() => setText(s)}>{s}</Button>)}</div>
      <p className="text-sm text-muted-foreground">Consultas: hoje, semana, mês atual, últimos 3 meses, últimos 6 meses ou ano. Para lançar uma despesa, informe descrição, valor e vencimento.</p>
      {!enabled && <p role="status" className="text-sm">Ative e salve o assistente para conversar.</p>}
    </div>
    <div className="mx-auto flex h-[42rem] max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-[2rem] border-8 border-neutral-800 bg-slate-950 text-slate-100 shadow-lg">
      <header className="border-b border-slate-700 bg-slate-900 px-4 py-4"><h3 className="font-semibold">AgendaFácil 365 Pro IA</h3><p className="text-xs text-slate-300">Assistente do gestor · dados reais</p></header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" role="log" aria-label="Conversa com o assistente" aria-live="polite" aria-busy={busy}>
        {!rows.length && <p className="rounded-lg bg-slate-800 p-3 text-sm">Escolha uma sugestão ou escreva sua pergunta. Nenhuma alteração acontece sem seu resumo e confirmação.</p>}
        {rows.map(r => <div key={r.id} className={`max-w-[95%] rounded-lg p-3 text-sm ${r.role === "user" ? "ml-auto bg-emerald-900" : "mr-auto bg-slate-800"}`}>
          <span className="sr-only">{r.role === "user" ? "Você: " : "Assistente: "}</span><p className="whitespace-pre-wrap break-words">{r.text}</p>
          {r.pendingId && <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-300">{r.expiresAt ? `Válido até ${new Date(r.expiresAt).toLocaleTimeString("pt-BR")}.` : "Confirmação válida por 10 minutos."} Alteração real no salão.</p>
            {([['mgr_confirm_yes', 'Confirmar'], ['mgr_confirm_no', 'Cancelar']] as const).map(([id, label]) => <button key={id} type="button" className="min-h-11 w-full rounded-md border border-slate-500 bg-slate-900 p-2 font-medium text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40" disabled={busy || !enabled || !!retry || r.pendingId !== pendingId || (!!r.expiresAt && Date.parse(r.expiresAt) <= Date.now())} onClick={() => void send(id, r.pendingId!)}>{label}</button>)}
          </div>}
        </div>)}
        {busy && <p role="status" className="text-sm text-slate-300">Processando…</p>}
        {error && <div role="alert" className="rounded-lg border border-red-300 p-3 text-sm text-red-200">{error}{retry && <button className="mt-2 min-h-11 w-full rounded border border-red-300 px-3" disabled={busy || !enabled} onClick={() => void send(undefined, undefined, retry)}>Repetir a mesma solicitação</button>}</div>}
      </div>
      <form className="space-y-2 border-t border-slate-700 bg-slate-900 p-3" onSubmit={e => { e.preventDefault(); void send(); }}>
        {advanced && <div><Label htmlFor="manager-attachment" className="text-xs text-slate-300">Foto, PDF ou áudio · até 5 MB</Label><input ref={fileInput} id="manager-attachment" type="file" accept={TYPES.join(",")} className="block w-full min-w-0 py-2 text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-slate-700 file:p-2 file:text-white" disabled={busy || !enabled || !!retry || !!pendingId} onChange={e => setFile(e.target.files?.[0] ?? null)} /></div>}
        <Label htmlFor="manager-message" className="sr-only">Mensagem ao assistente</Label>
        <Input id="manager-message" value={text} maxLength={4000} onChange={e => setText(e.target.value)} placeholder="Escreva sua pergunta…" className="min-h-11 border-slate-500 bg-slate-800 text-slate-100 placeholder:text-slate-400" disabled={busy || !enabled || !!retry} />
        <Button type="submit" className="min-h-11 w-full bg-emerald-800 text-white hover:bg-emerald-700" disabled={busy || !enabled || !!retry || (!text.trim() && !file)}>{busy ? "Aguarde…" : "Enviar mensagem"}</Button>
      </form>
    </div>
  </section>;
}
