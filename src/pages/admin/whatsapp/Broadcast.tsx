import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Temporal } from "@js-temporal/polyfill";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mapCsv, parseVcf, readCsv, MAX_FILE_BYTES } from "@/features/whatsapp/contacts/parse";
import { whatsappDb as db, whatsappCall, useWhatsAppSalon } from "./api";
import { buildAudience, campaignBatches, estimatedMinutes, previewText, REJECT_LABEL, templateError, type AudienceInput, type AudienceSource, type Rejected } from "./audience";

const SOURCE_LABEL: Record<AudienceSource, string> = { clientes: "Cliente", whatsapp: "WhatsApp", arquivo: "Arquivo", manual: "Manual" };
const STATUS_LABEL: Record<string, string> = { pending: "Pendente", scheduled: "Agendado", processing: "Enviando", completed: "Concluído", stopped: "Parado", failed: "Falhou", uncertain: "Verificar", sent: "Enviada", delivered: "Entregue", read: "Lida", cancelled: "Cancelada" };
interface Campaign { id: string; message: string; status: string; total_recipients: number; sent_count: number | null; failed_count: number | null; created_at: string; scheduled_for: string | null; error_message: string | null }
interface Item { id: string; recipient_phone: string; recipient_name: string | null; status: string; error_message: string | null; sent_at: string | null }

export default function Broadcast() {
  const salon = useWhatsAppSalon();
  const salonId = salon.data?.id;
  const cache = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [inputs, setInputs] = useState<AudienceInput[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [consent, setConsent] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [details, setDetails] = useState<Campaign | null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const submission = useRef<{ key: string; ids: string[]; done: number } | null>(null);

  const instance = useQuery({ queryKey: ["wa-instance", salonId], enabled: !!salonId, queryFn: async () => {
    const { data, error } = await db.from("whatsapp_instances").select("status").eq("salon_id", salonId!).maybeSingle();
    if (error) throw error;
    return data as { status: string } | null;
  }});
  const suppressed = useQuery({ queryKey: ["wa-suppressed", salonId], enabled: !!salonId, queryFn: async () => {
    const [s, c] = await Promise.all([
      db.from("whatsapp_marketing_suppression").select("phone").eq("salon_id", salonId!).limit(10000),
      db.from("clients").select("phone_normalized").eq("salon_id", salonId!).eq("marketing_opt_out", true).limit(10000),
    ]);
    if (s.error || c.error) throw s.error ?? c.error;
    return [...(s.data ?? []).map(r => r.phone as string), ...(c.data ?? []).map(r => r.phone_normalized as string)].filter(Boolean);
  }});
  const campaigns = useQuery({ queryKey: ["wa-campaigns", salonId], enabled: !!salonId, refetchInterval: q => (q.state.data as Campaign[] | undefined)?.some(c => ["processing", "scheduled", "pending"].includes(c.status)) ? 5000 : false, queryFn: async () => {
    const { data, error } = await db.from("broadcasts").select("id,message,status,total_recipients,sent_count,failed_count,created_at,scheduled_for,error_message").eq("salon_id", salonId!).order("created_at", { ascending: false }).limit(10);
    if (error) throw error;
    return data as Campaign[];
  }});
  const templates = useQuery({ queryKey: ["wa-templates", salonId], enabled: !!salonId, queryFn: async () => {
    const { data, error } = await db.from("broadcast_templates").select("id,name,content").eq("salon_id", salonId!).order("created_at", { ascending: false });
    if (error) throw error;
    return data as { id: string; name: string; content: string }[];
  }});
  const items = useQuery({ queryKey: ["wa-campaign-items", details?.id], enabled: !!details, refetchInterval: 5000, queryFn: async () => {
    const { data, error } = await db.from("broadcast_messages").select("id,recipient_phone,recipient_name,status,error_message,sent_at").eq("broadcast_id", details!.id).eq("salon_id", salonId!).order("created_at").limit(1000);
    if (error) throw error;
    return data as Item[];
  }});

  const audience = useMemo(() => buildAudience(inputs, suppressed.data ?? []), [inputs, suppressed.data]);
  const visible = audience.recipients.filter(r => `${r.name} ${r.phone}`.toLowerCase().includes(search.toLowerCase()));
  const chosen = audience.recipients.filter(r => selected.has(r.phone));
  const connected = instance.data?.status === "connected";
  const problem = templateError(message);
  const add = (list: AudienceInput[], select = true) => {
    const before = new Set(audience.recipients.map(r => r.phone));
    const next = buildAudience([...inputs, ...list], suppressed.data ?? []);
    setInputs(prev => [...prev, ...list]);
    if (select) setSelected(prev => { const s = new Set(prev); next.recipients.forEach(r => { if (!before.has(r.phone)) s.add(r.phone); }); return s; });
    submission.current = null;
    toast.success(`${next.recipients.length - before.size} contatos adicionados; ${next.rejected.length - audience.rejected.length} ignorados.`);
  };

  async function loadClients() {
    if (!salonId) return;
    setBusy("clientes");
    try {
      const rows: AudienceInput[] = [];
      for (let offset = 0; offset < 50_000; offset += 1000) {
        const { data, error } = await db.from("clients").select("name,phone,phone_normalized").eq("salon_id", salonId).not("phone", "is", null).order("id").range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data ?? []).map(c => ({ name: c.name as string, phone: (c.phone_normalized || c.phone) as string, source: "clientes" as const })));
        if (!data || data.length < 1000) break;
      }
      add(rows, false);
    } catch { toast.error("Não foi possível carregar os clientes."); }
    finally { setBusy(null); }
  }
  async function loadEvolution() {
    if (!salonId) return;
    setBusy("whatsapp");
    try {
      const data = await whatsappCall("whatsapp-instances", { action: "contacts", salonId });
      add((data.contacts as { name: string; phone: string }[]).map(c => ({ ...c, source: "whatsapp" as const })), false);
      const x = data.excluded ?? {};
      if ((x.group ?? 0) + (x.broadcast ?? 0) + (x.lid ?? 0)) toast.info(`Ignorados do WhatsApp: ${x.group ?? 0} grupos, ${x.broadcast ?? 0} listas/canais, ${x.lid ?? 0} contatos sem número.`);
      if (data.truncated) toast.warning("A conexão retornou mais de 10.000 itens; a lista foi limitada.");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível buscar contatos do WhatsApp."); }
    finally { setBusy(null); }
  }
  async function loadFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error("Envie arquivo de até 5 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { text = new TextDecoder("windows-1252").decode(bytes); }
      let raw;
      if (/\.vcf$/i.test(file.name)) raw = parseVcf(text);
      else if (/\.csv$/i.test(file.name)) { const csv = readCsv(text); if (!csv.detected.phone) throw new Error("O CSV precisa de uma coluna Telefone, Celular ou WhatsApp."); raw = mapCsv(csv, csv.detected); }
      else throw new Error("Formatos aceitos: VCF e CSV.");
      add(raw.flatMap(c => (c.error ? [""] : c.phones.length ? c.phones : [""]).map(phone => ({ name: c.name, phone, source: "arquivo" as const }))));
    } catch (err) { toast.error(err instanceof Error ? err.message : "Arquivo inválido."); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  }
  async function saveTemplate() {
    const name = window.prompt("Nome do modelo:")?.trim();
    if (!name || !salonId || problem) return;
    const { error } = await db.from("broadcast_templates").insert({ salon_id: salonId, name: name.slice(0, 80), content: message });
    if (error) toast.error("Não foi possível salvar o modelo."); else { toast.success("Modelo salvo."); void templates.refetch(); }
  }
  async function send() {
    if (!salonId || !chosen.length || problem || !consent || busy) return;
    let scheduledFor: string | undefined;
    try { scheduledFor = scheduledLocal ? Temporal.PlainDateTime.from(scheduledLocal).toZonedDateTime(salon.data?.timezone || "America/Sao_Paulo", { disambiguation: "reject" }).toInstant().toString() : undefined; }
    catch { toast.error("Data e hora inválidas no fuso do salão."); return; }
    if (scheduledFor && new Date(scheduledFor).getTime() < Date.now()) { toast.error("Escolha um horário futuro."); return; }
    const key = JSON.stringify([message, scheduledFor, chosen.map(r => r.phone)]);
    if (submission.current?.key !== key) submission.current = { key, ids: [], done: 0 };
    const batches = campaignBatches(chosen, submission.current.ids);
    submission.current.ids = batches.map(b => b.submissionId);
    setBusy("send");
    try {
      for (let i = submission.current.done; i < batches.length; i++) {
        await whatsappCall("broadcast-messages-v2", { action: "create_broadcast", salonId, message: message.trim(), recipients: batches[i].recipients, scheduledFor, submissionId: batches[i].submissionId, confirmed: true, consentAcknowledged: true });
        submission.current.done = i + 1;
      }
      toast.success(`${batches.length > 1 ? `${batches.length} lotes registrados` : "Campanha registrada"} na fila. Acompanhe o histórico.`);
      submission.current = null; setConfirm(false); setConsent(false); setScheduledLocal(""); setSelected(new Set()); setMessage("");
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : "Falha ao registrar."} ${submission.current?.done ? `${submission.current.done} de ${batches.length} lotes já registrados; confirme de novo para continuar sem duplicar.` : "Pode confirmar de novo: o envio não será duplicado."}`);
    } finally { setBusy(null); void cache.invalidateQueries({ queryKey: ["wa-campaigns", salonId] }); }
  }
  async function stop(id: string) {
    if (!salonId || !window.confirm("Interromper os envios pendentes? Mensagens já aceitas não podem ser recolhidas.")) return;
    try { await whatsappCall("broadcast-messages-v2", { action: "stop_broadcast", salonId, broadcastId: id }); toast.success("Envios pendentes interrompidos."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível interromper."); }
    void campaigns.refetch();
  }

  if (instance.isLoading || salon.isLoading) return <p role="status">Carregando disparador…</p>;
  if (!connected) return <div data-tour="broadcast-header" className="rounded-xl border border-warning/40 bg-warning/10 p-4"><h2 className="font-semibold">WhatsApp desconectado</h2><p className="text-sm">O disparo fica bloqueado até o WhatsApp do salão estar conectado. Conecte na aba Conexão; campanhas já registradas continuam na fila e retomam após reconectar.</p></div>;
  return <section className="min-w-0 space-y-4">
    <div data-tour="broadcast-header"><h2 className="text-xl font-semibold">Disparador</h2><p className="text-sm text-muted-foreground">Envie só para quem autorizou. Envio na fila, 1 mensagem a cada {3} s; quem pediu para sair é ignorado automaticamente.</p></div>
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0 space-y-3 rounded-xl border p-3">
        <div className="flex flex-wrap gap-2">
          <Button data-tour="broadcast-load-contacts" variant="outline" disabled={!!busy} onClick={() => void loadClients()}>{busy === "clientes" ? "Carregando…" : "Clientes do sistema"}</Button>
          <Button data-tour="broadcast-evolution" variant="outline" disabled={!!busy} onClick={() => void loadEvolution()}>{busy === "whatsapp" ? "Buscando…" : "Contatos do WhatsApp"}</Button>
          <input ref={fileRef} type="file" accept=".csv,.vcf" className="sr-only" aria-label="Arquivo CSV ou VCF" onChange={e => void loadFile(e.target.files?.[0])} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>Arquivo CSV/VCF</Button>
        </div>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={e => { e.preventDefault(); add(manual.split(/[\n,;]/).filter(s => s.trim()).map(phone => ({ name: "", phone, source: "manual" as const }))); setManual(""); }}>
          <label htmlFor="wa-manual" className="sr-only">Números manuais</label>
          <Input id="wa-manual" value={manual} onChange={e => setManual(e.target.value)} placeholder="Números com DDD ou +DDI, separados por vírgula" />
          <Button type="submit" variant="outline" disabled={!manual.trim()}>Adicionar</Button>
        </form>
        <Input data-tour="broadcast-search" aria-label="Buscar destinatário" placeholder="Buscar nome ou telefone" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2 text-sm"><span>{chosen.length} de {audience.recipients.length} selecionados</span><Button variant="ghost" onClick={() => setSelected(new Set([...selected, ...visible.map(r => r.phone)]))}>Marcar visíveis</Button><Button variant="ghost" onClick={() => setSelected(new Set())}>Nenhum</Button>{audience.rejected.length > 0 && <Button variant="ghost" onClick={() => setShowRejected(true)}>{audience.rejected.length} ignorados</Button>}</div>
        <ul data-tour="broadcast-contact-list" className="max-h-80 overflow-y-auto space-y-1">
          {!audience.recipients.length && <li className="p-3 text-sm text-muted-foreground">Nenhum contato. Carregue clientes, contatos do WhatsApp, um arquivo ou números manuais.</li>}
          {visible.slice(0, 500).map(r => <li key={r.phone}><label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-muted"><Checkbox checked={selected.has(r.phone)} onCheckedChange={v => setSelected(prev => { const s = new Set(prev); if (v === true) s.add(r.phone); else s.delete(r.phone); return s; })} /><span className="min-w-0 flex-1"><span className="block truncate">{r.name || "Sem nome"}</span><span className="block text-xs text-muted-foreground">{r.phone}</span></span><Badge variant="outline">{SOURCE_LABEL[r.source]}</Badge></label></li>)}
          {visible.length > 500 && <li className="p-2 text-xs">Mostrando 500 de {visible.length}. Use a busca; "Marcar visíveis" inclui todos os filtrados.</li>}
        </ul>
      </div>
      <div className="min-w-0 space-y-3 rounded-xl border p-3">
        <label htmlFor="wa-template" className="text-sm font-medium">Modelo</label>
        <select id="wa-template" className="min-h-11 w-full rounded-md border bg-background px-2" value="" onChange={e => { const t = templates.data?.find(x => x.id === e.target.value); if (t) setMessage(t.content); }}><option value="">Usar um modelo salvo…</option>{templates.data?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <label htmlFor="wa-message" className="text-sm font-medium">Mensagem</label>
        <Textarea id="wa-message" data-tour="broadcast-message" rows={6} maxLength={4096} value={message} onChange={e => setMessage(e.target.value)} placeholder="Olá {nome}! …" />
        <p className="text-xs text-muted-foreground">{message.length}/4096 · {"{nome}"} vira o primeiro nome. {problem && message ? <span className="text-destructive">{problem}</span> : null}</p>
        {chosen[0] && !problem && <p className="rounded-md bg-muted p-2 text-sm whitespace-pre-wrap break-words">Prévia: {previewText(message, chosen[0].name)}</p>}
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!!problem} onClick={() => void saveTemplate()}>Salvar modelo</Button><Button data-tour="broadcast-send" disabled={!chosen.length || !!problem || !!busy} onClick={() => setConfirm(true)}>Revisar envio ({chosen.length})</Button></div>
        {chosen.length > 0 && <p className="text-xs text-muted-foreground">Estimativa: cerca de {estimatedMinutes(chosen.length)} min{chosen.length > 1000 ? `, em ${Math.ceil(chosen.length / 1000)} lotes` : ""}.</p>}
      </div>
    </div>
    <div data-tour="broadcast-history" className="rounded-xl border p-3 space-y-2">
      <h3 className="font-semibold">Histórico</h3>
      {!campaigns.data?.length && <p className="text-sm text-muted-foreground">Nenhuma campanha.</p>}
      {campaigns.data?.map(c => <div key={c.id} className="rounded-lg bg-muted/50 p-3"><div className="flex flex-wrap items-center gap-2"><Badge>{STATUS_LABEL[c.status] ?? c.status}</Badge><span className="text-xs">{new Date(c.scheduled_for ?? c.created_at).toLocaleString("pt-BR")}</span></div><p className="line-clamp-2 break-words text-sm">{c.message}</p><p className="text-xs">Enviadas {c.sent_count ?? 0} · Falhas {c.failed_count ?? 0} · Total {c.total_recipients}{c.error_message ? ` · ${c.error_message}` : ""}</p><div className="flex flex-wrap gap-2"><Button data-tour="broadcast-details-button" variant="ghost" onClick={() => setDetails(c)}>Ver destinatários</Button>{["processing", "scheduled", "pending"].includes(c.status) && <Button variant="outline" onClick={() => void stop(c.id)}>Parar pendentes</Button>}</div></div>)}
    </div>
    <Dialog open={confirm} onOpenChange={v => !busy && setConfirm(v)}><DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg"><DialogHeader><DialogTitle>Conferir campanha</DialogTitle><DialogDescription>{chosen.length} destinatários. Revise antes de confirmar.</DialogDescription></DialogHeader>
      <p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-sm">{message}</p>
      <div data-tour="broadcast-schedule" className="space-y-1"><label htmlFor="wa-schedule" className="text-sm font-medium">Agendar no fuso do salão (vazio = agora)</label><Input id="wa-schedule" type="datetime-local" value={scheduledLocal} onChange={e => setScheduledLocal(e.target.value)} /></div>
      <label className="flex items-start gap-2 text-sm"><Checkbox checked={consent} onCheckedChange={v => setConsent(v === true)} /><span>Estes contatos autorizaram receber mensagens do salão.</span></label>
      <DialogFooter><Button variant="outline" disabled={!!busy} onClick={() => setConfirm(false)}>Voltar</Button><Button disabled={!consent || !!busy} onClick={() => void send()}>{busy === "send" ? "Registrando…" : scheduledLocal ? "Confirmar agendamento" : "Confirmar envio"}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={!!details} onOpenChange={v => !v && setDetails(null)}><DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl"><DialogHeader><DialogTitle>Destinatários</DialogTitle><DialogDescription>Status por pessoa. "Verificar" = resultado incerto; não reenvie sem conferir.</DialogDescription></DialogHeader>
      <ul className="max-h-[60vh] overflow-y-auto space-y-1">{items.data?.map(i => <li key={i.id} className="flex flex-wrap justify-between gap-2 rounded bg-muted/50 p-2 text-sm"><span className="min-w-0 break-words">{i.recipient_name || "Sem nome"} · {i.recipient_phone}</span><span>{STATUS_LABEL[i.status] ?? i.status}{i.error_message ? ` (${i.error_message})` : ""}</span></li>)}</ul>
    </DialogContent></Dialog>
    <Dialog open={showRejected} onOpenChange={setShowRejected}><DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg"><DialogHeader><DialogTitle>Contatos ignorados</DialogTitle><DialogDescription>Não entram na campanha.</DialogDescription></DialogHeader>
      <ul className="max-h-[60vh] overflow-y-auto space-y-1">{audience.rejected.slice(0, 1000).map((r: Rejected, i) => <li key={i} className="break-words text-sm">{r.name || "Sem nome"} · {r.raw || "sem número"} — {REJECT_LABEL[r.reason]}</li>)}</ul>
    </DialogContent></Dialog>
  </section>;
}
