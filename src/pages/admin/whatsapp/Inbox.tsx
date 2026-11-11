import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { whatsappDb as db, whatsappCall, useWhatsAppSalon } from "./api";

interface Conversation { phone: string; contact_name: string | null; last_body: string; last_kind: string; last_type: string; last_at: string; unread: number; human_takeover: boolean }
interface Message { id: string; direction: string; author: string; body: string; kind: string; message_type: string; media_url: string | null; payload: Record<string, unknown> | null; status: string; error_code?: string | null; created_at: string }
const authors: Record<string, string> = { contact: "Cliente", ai: "IA", human: "Equipe", system: "Sistema" };
const statuses: Record<string, string> = { received: "Recebida", queued: "Na fila", sending: "Na fila", sent: "Enviada ao WhatsApp", delivered: "Entregue", read: "Lida", failed: "Falhou", uncertain: "Envio incerto" };
const media: Record<string, string> = { image: "Imagem", video: "Vídeo", audio: "Áudio", document: "Documento", sticker: "Figurinha", location: "Localização", contact: "Contato", poll: "Enquete", list: "Lista de opções", buttons: "Botões", interactive: "Mensagem interativa", list_reply: "Opção escolhida", buttons_reply: "Botão escolhido", interactive_reply: "Opção escolhida", pix: "PIX" };
const typeLabel = (kind: string, type: string) => media[type] ?? (kind === "interactive" ? "Mensagem interativa" : kind === "media" ? "Mídia" : "");
/** Opções de lista/botões gravadas em payload.options (strings ou { title }). */
const options = (p: Record<string, unknown> | null) => (Array.isArray(p?.options) ? p!.options : []).map(o => typeof o === "string" ? o : String((o as { title?: unknown })?.title ?? "")).filter(Boolean).slice(0, 20);
/** Texto de mensagem com opções: o corpo traz o fallback numerado ("1. …", "Responda…"); as opções já aparecem na lista. */
const bodyWithoutOptions = (body: string, hasOptions: boolean) => hasOptions
  ? body.split("\n").filter(l => !/^\s*(\d{1,2}[.)]\s|\[\d{1,2}]\s|Responda (com o número|\d)|Digite \*V\*)/.test(l)).join("\n").replace(/\n{3,}/g, "\n\n").trim()
  : body;
const safeLink = (url: string | null) => { try { return url && new URL(url).protocol === "https:" ? url : null; } catch { return null; } };

export default function Inbox() {
  const salon = useWhatsAppSalon();
  const salonId = salon.data?.id;
  const cache = useQueryClient();
  const [phone, setPhone] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(100);
  const submission = useRef<{ text: string; phone: string; id: string } | null>(null);
  const threads = useQuery({ queryKey: ["wa-threads", salonId], enabled: !!salonId, refetchInterval: 15000, queryFn: async () => {
    const { data, error } = await db.rpc("whatsapp_inbox_conversations", { p_salon_id: salonId, p_limit: 500 });
    if (error) throw error;
    return data as Conversation[];
  }});
  const messages = useQuery({ queryKey: ["wa-messages", salonId, phone, limit], enabled: !!salonId && !!phone, refetchInterval: 10000, queryFn: async () => {
    const { data, error } = await db.from("whatsapp_messages").select("id,direction,author,body,kind,message_type,media_url,payload,status,error_code,created_at").eq("salon_id", salonId!).eq("phone", phone!).order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data as Message[]).reverse();
  }});
  const current = threads.data?.find(c => c.phone === phone);
  const refresh = () => { void cache.invalidateQueries({ queryKey: ["wa-threads", salonId] }); void cache.invalidateQueries({ queryKey: ["wa-messages", salonId] }); };
  useEffect(() => {
    if (!salonId) return;
    const channel = db.channel(`wa-inbox-${salonId}`).on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_messages", filter: `salon_id=eq.${salonId}` }, refresh).on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversation_state", filter: `salon_id=eq.${salonId}` }, refresh).subscribe();
    return () => { void db.removeChannel(channel); };
  }, [salonId]);
  useEffect(() => {
    if (!salonId || !phone || !messages.data || document.hidden) return;
    void db.rpc("whatsapp_mark_conversation_read", { p_salon_id: salonId, p_phone: phone }).then(({ error }) => {
      if (!error) void cache.invalidateQueries({ queryKey: ["wa-threads", salonId] });
    });
  }, [salonId, phone, messages.dataUpdatedAt]);
  async function retry(messageId: string) {
    if (!salonId || busy) return;
    setBusy(true);
    try {
      const res = await whatsappCall("whatsapp-instances", { action: "retry_message", salonId, messageId });
      if (res.requeued) toast.success("Mensagem recolocada na fila para envio.");
      else toast.info("Esta mensagem já foi enviada ou está em processamento.");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível reenviar.");
      refresh();
    } finally { setBusy(false); }
  }

  async function action(action: string) {
    if (!salonId || !phone || busy) return;
    if (action === "release" && !window.confirm("Devolver esta conversa para a IA? Ela responderá às próximas mensagens conforme as configurações do salão.")) return;
    setBusy(true);
    try {
      if (action === "send") {
        if (!text.trim()) return;
        if (!submission.current || submission.current.text !== text || submission.current.phone !== phone) submission.current = { text, phone, id: crypto.randomUUID() };
      }
      const result = await whatsappCall("whatsapp-reply", { action, salonId, phone, text, clientRef: submission.current?.id });
      if (action === "send") {
        if (["sent", "delivered", "read"].includes(result.status)) { setText(""); submission.current = null; toast.success("Resposta enviada. Atendimento assumido pela equipe."); }
        else toast.warning("Envio não confirmado. Confira o histórico e o celular antes de tentar novamente.");
      } else toast.success(action === "sync" ? `${result.imported} mensagens recentes verificadas.` : action === "release" ? "Conversa devolvida para a IA." : "Conversa assumida. IA pausada.");
      refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível concluir."); refresh(); }
    finally { setBusy(false); }
  }
  const filtered = (threads.data ?? []).filter(c => `${c.contact_name ?? ""} ${c.phone}`.toLowerCase().includes(search.toLowerCase()) && (filter === "all" || c.human_takeover === (filter === "human")));
  return <section className="min-w-0 space-y-4">
    <div data-tour="inbox-header"><h2 className="text-xl font-semibold">Conversas</h2><p className="text-sm text-muted-foreground">Atendimento do WhatsApp do salão. IA disponível não significa bot ligado: confira a aba Chatbot.</p></div>
    {(salon.error || threads.error || messages.error) && <p role="alert" className="text-destructive">Não foi possível carregar as conversas. Confira sua sessão e a instalação da central. <Button variant="outline" onClick={refresh}>Tentar novamente</Button></p>}
    <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
      <div className={`${phone ? "hidden md:block" : "block"} min-w-0 rounded-xl border p-3 space-y-3`}>
        <Input data-tour="inbox-search" aria-label="Buscar conversa" placeholder="Nome ou telefone" value={search} onChange={e => setSearch(e.target.value)} />
        <select data-tour="inbox-filter" aria-label="Filtrar atendimento" value={filter} onChange={e => setFilter(e.target.value)} className="min-h-11 w-full rounded-md border bg-background px-2"><option value="all">Todos os atendimentos</option><option value="ai">IA respondendo / disponível</option><option value="human">Humano</option></select>
        <div data-tour="inbox-list" className="max-h-[65vh] overflow-y-auto space-y-1">
          {threads.isLoading && <p role="status">Carregando conversas…</p>}
          {!threads.isLoading && !filtered.length && <p className="p-3 text-sm text-muted-foreground">Nenhuma conversa encontrada. Novas mensagens aparecem aqui após configurar o webhook. O histórico do chatbot também é importado pela migração.</p>}
          {filtered.map(c => <button key={c.phone} type="button" className={`w-full min-h-11 rounded-lg p-3 text-left focus-visible:ring-2 focus-visible:ring-primary ${phone === c.phone ? "bg-primary/10" : "hover:bg-muted"}`} onClick={() => { if (text && !window.confirm("Trocar de conversa e descartar a resposta não enviada?")) return; setPhone(c.phone); setText(""); setLimit(100); submission.current = null; }}>
            <span className="block truncate font-medium">{c.contact_name || c.phone}</span><span className="block text-xs">{c.human_takeover ? "Humano · IA pausada" : "IA disponível"}{c.unread > 0 && ` · ${c.unread} não lidas`}</span><span className="block truncate text-sm text-muted-foreground">{typeLabel(c.last_kind, c.last_type) ? `[${typeLabel(c.last_kind, c.last_type)}] ` : ""}{c.last_body}</span><time className="text-xs text-muted-foreground">{new Date(c.last_at).toLocaleString("pt-BR")}</time>
          </button>)}
        </div>
        {(threads.data?.length ?? 0) >= 500 && <p className="text-xs">Exibindo as 500 conversas mais recentes.</p>}
      </div>
      <div data-tour="inbox-thread" className={`${phone ? "flex" : "hidden md:flex"} min-w-0 flex-col rounded-xl border p-3 gap-3`}>
        {!phone ? <p className="m-auto text-sm text-muted-foreground">Selecione uma conversa para ver o histórico.</p> : <>
          <div className="flex flex-wrap items-center gap-2"><Button className="md:hidden" variant="outline" onClick={() => setPhone(null)}>Voltar</Button><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{current?.contact_name || phone}</h3><p className="text-xs">{phone} · {current?.human_takeover ? "IA pausada" : "IA disponível"}</p></div></div>
          <div className="flex flex-wrap gap-2"><Button data-tour="inbox-takeover" variant="outline" disabled={busy} onClick={() => void action(current?.human_takeover ? "release" : "takeover")}>{current?.human_takeover ? "Devolver para IA" : "Assumir atendimento"}</Button><Button data-tour="inbox-sync" variant="outline" disabled={busy} onClick={() => void action("sync")}>Sincronizar histórico</Button></div>
          <div className="h-[45vh] min-h-48 overflow-y-auto space-y-3" role="log" aria-label="Histórico da conversa" aria-live="polite">
            {(messages.data?.length ?? 0) >= limit && <Button variant="ghost" onClick={() => setLimit(l => l + 100)}>Carregar anteriores</Button>}
            {messages.isLoading && <p role="status">Carregando histórico…</p>}
            {messages.data?.map(m => (
              <article key={m.id} className={`max-w-[95%] w-fit rounded-lg p-3 ${m.direction === "out" ? "ml-auto bg-primary/10" : "bg-muted"}`}>
                <p className="text-xs font-medium">{authors[m.author] || m.author}</p>
                {m.kind !== "text" && <p className="text-sm font-medium">{typeLabel(m.kind, m.message_type)}</p>}
                <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm">{bodyWithoutOptions(m.body, options(m.payload).length > 0)}</p>
                {options(m.payload).length > 0 && <ol className="mt-1 list-decimal pl-5 text-sm">{options(m.payload).map((o, i) => <li key={i} className="break-words">{o}</li>)}</ol>}
                {safeLink(m.media_url) && <a className="inline-flex min-h-11 items-center underline" href={safeLink(m.media_url)!} target="_blank" rel="noopener noreferrer">Abrir mídia</a>}
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <time>{new Date(m.created_at).toLocaleString("pt-BR")}</time>
                  <span>·</span>
                  {m.direction === "in" ? <span>Recebida</span> : m.status === "queued" || m.status === "sending" ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground" title="Aguardando envio na fila">⏳ Na fila</span>
                  ) : m.status === "sent" ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground" title="Aceito pela Evolution / a caminho do celular">✓ Enviada ao WhatsApp</span>
                  ) : m.status === "delivered" ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground font-medium" title="Entregue no celular">✓✓ Entregue</span>
                  ) : m.status === "read" ? (
                    <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium" title="Mensagem lida">✓✓ Lida</span>
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-1 text-destructive font-medium">
                      <span>⚠ {statuses[m.status] || m.status}{m.error_code ? ` (${m.error_code})` : ""}</span>
                      {/* Resposta manual não passa pelo outbox: reenviar = escrever de novo (após conferir no celular). */}
                      {m.author !== "human" && <Button type="button" size="sm" variant="ghost" className="min-h-11 px-2 text-xs text-primary underline" disabled={busy} onClick={() => void retry(m.id)}>
                        Tentar de novo
                      </Button>}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
          <form data-tour="inbox-reply" className="space-y-2" onSubmit={e => { e.preventDefault(); void action("send"); }}><label htmlFor="wa-reply" className="text-sm font-medium">Responder pelo WhatsApp</label><Textarea id="wa-reply" value={text} onChange={e => setText(e.target.value)} maxLength={4096} disabled={busy} placeholder="Digite sua resposta…" /><p className="text-xs text-muted-foreground">Ao responder, você assume o atendimento e pausa a IA neste contato.</p><Button type="submit" disabled={busy || !text.trim()}>{busy ? "Aguarde…" : "Enviar resposta"}</Button></form>
        </>}
      </div>
    </div>
  </section>;
}
