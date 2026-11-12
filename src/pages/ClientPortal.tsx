import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, CalendarPlus, Clock, History, LogOut, MessageCircle, RotateCcw, Scissors, Sparkles, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SalonLogo } from "@/components/pwa/SalonLogo";
import { useSalonHead } from "@/components/pwa/useSalonHead";
import { safeHexColor } from "@/config/brand";
import { accessibleBackground, textOnColor } from "../../api/_pwa";

interface Salon { id: string; name: string; slug: string; primary_color: string | null; logo_url: string | null; whatsapp: string | null; phone: string | null; address: string | null; city: string | null; updated_at?: string | null; pwa_enabled?: boolean | null }
interface Upcoming { id: string; date: string; start_time: string; end_time: string | null; status: string; service: string | null; professional: string | null; price: number | null; manage_token: string | null }
interface Past { id: string; date: string; start_time: string; status: string; service: string | null; professional: string | null; price: number | null }
interface Overview { ok: boolean; reason?: string; client?: { name: string | null; since: string | null; visits: number }; upcoming?: Upcoming[]; history?: Past[]; returns?: { procedure_name: string; alert_date: string }[] }

const TOKEN = /^[0-9a-f]{48}$/;
const storeKey = (slug: string) => `af365.portal.${slug}`;
/** Link do WhatsApp traz o acesso em #t=… (não vai a logs de servidor). Guardado só neste aparelho. */
function readToken(slug: string): string | null {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("t");
  if (fromHash && TOKEN.test(fromHash)) {
    try { localStorage.setItem(storeKey(slug), fromHash); } catch { /* navegação privada: vale só nesta aba */ }
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return fromHash;
  }
  try { const saved = localStorage.getItem(storeKey(slug)); return saved && TOKEN.test(saved) ? saved : null; } catch { return null; }
}

const brl = (v: number | null) => v == null ? null : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const day = (iso: string) => parseISO(`${iso}T12:00:00`);
const STATUS: Record<string, { label: string; tone: string }> = {
  confirmed: { label: "Confirmado", tone: "bg-success/10 text-success" },
  pending: { label: "Aguardando confirmação", tone: "bg-warning/15 text-foreground" },
  completed: { label: "Realizado", tone: "bg-success/10 text-success" },
  past: { label: "Realizado", tone: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", tone: "bg-destructive/10 text-destructive" },
  no_show: { label: "Não compareceu", tone: "bg-muted text-muted-foreground" },
};
function Status({ value }: { value: string }) {
  const s = STATUS[value] ?? { label: value, tone: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${s.tone}`}>{s.label}</span>;
}
function relative(iso: string) {
  const d = differenceInCalendarDays(day(iso), new Date());
  return d === 0 ? "Hoje" : d === 1 ? "Amanhã" : d > 1 && d < 7 ? `Em ${d} dias` : null;
}

/**
 * Área do cliente no app do salão: próximo horário em destaque, demais agendamentos, histórico e retornos.
 * Acesso só pelo link pessoal enviado no WhatsApp (o telefone sozinho nunca abre os dados).
 */
export default function ClientPortal() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "no-access" | "not-found">("loading");
  const [tab, setTab] = useState<"next" | "history">("next");
  const token = useMemo(() => readToken(slug), [slug]);
  useSalonHead(salon);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: s } = await supabase.from("salons").select("id,name,slug,primary_color,logo_url,whatsapp,phone,address,city,updated_at,pwa_enabled").eq("slug", slug).neq("is_active", false).maybeSingle();
      if (cancelled) return;
      if (!s) { setState("not-found"); return; }
      setSalon(s as Salon);
      if (!token) { setState("no-access"); return; }
      const { data: o, error } = await supabase.rpc("client_portal_overview" as never, { p_token: token } as never);
      if (cancelled) return;
      const ov = o as unknown as Overview | null;
      if (error || !ov?.ok) { try { localStorage.removeItem(storeKey(slug)); } catch { /* ignore */ } setState("no-access"); return; }
      setData(ov); setState("ready");
    })();
    return () => { cancelled = true; };
  }, [slug, token]);

  const color = accessibleBackground(safeHexColor(salon?.primary_color));
  const onColor = textOnColor(color);
  const wa = (salon?.whatsapp || salon?.phone || "").replace(/\D/g, "");
  const waLink = wa ? `https://wa.me/${wa.length <= 11 ? `55${wa}` : wa}?text=${encodeURIComponent("Oi! Quero ver meus agendamentos.")}` : null;
  const bookHref = `/s/${slug}`;

  const logout = async () => {
    if (token) await supabase.rpc("client_portal_logout" as never, { p_token: token } as never);
    try { localStorage.removeItem(storeKey(slug)); } catch { /* ignore */ }
    setData(null); setState("no-access");
  };

  if (state === "not-found") return <Shell><p className="py-24 text-center text-muted-foreground" role="alert">Estabelecimento não encontrado.</p></Shell>;

  const upcoming = data?.upcoming ?? [], history = data?.history ?? [], returns = data?.returns ?? [];
  const [next, ...later] = upcoming;
  const first = (data?.client?.name ?? "").split(" ")[0];

  return (
    <Shell>
      {/* Cabeçalho na cor do salão */}
      <header className="relative overflow-hidden" style={{ backgroundColor: color, color: onColor }}>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-20" style={{ backgroundColor: onColor }} />
        <div className="relative mx-auto flex max-w-2xl items-center gap-3 px-4 pb-16 pt-6">
          {salon ? <SalonLogo salon={salon} className="h-12 w-12 rounded-2xl text-base ring-2 ring-white/40" /> : <span className="h-12 w-12 rounded-2xl bg-white/20" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm opacity-85">{salon?.name ?? " "}</p>
            <h1 className="truncate text-xl font-bold leading-tight">{state === "ready" ? (first ? `Olá, ${first}` : "Seus agendamentos") : "Meus agendamentos"}</h1>
          </div>
          {state === "ready" && (
            <button type="button" onClick={() => void logout()} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium opacity-90 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label="Sair deste aparelho">
              <LogOut size={16} aria-hidden /><span className="hidden sm:inline">Sair</span>
            </button>
          )}
        </div>
      </header>

      <main className="relative mx-auto -mt-10 max-w-2xl space-y-5 px-4 pb-28">
        {state === "loading" && <div className="space-y-3" role="status" aria-label="Carregando">{[0, 1].map(i => <div key={i} className="h-28 animate-pulse rounded-3xl bg-card shadow-sm" />)}</div>}

        {state === "no-access" && (
          <section className="rounded-3xl border border-border bg-card p-6 text-center shadow-lg">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}1A`, color: "var(--tenant-text, currentColor)" }}><MessageCircle aria-hidden /></span>
            <h2 className="text-lg font-semibold">Acesse pelo WhatsApp</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Por segurança, seus agendamentos abrem pelo link pessoal que enviamos no WhatsApp. Peça o seu em um toque:</p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {waLink && <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ backgroundColor: color, color: onColor }}><MessageCircle size={18} aria-hidden />Pedir meu link no WhatsApp</a>}
              <Button asChild variant="outline" className="min-h-12 rounded-2xl"><Link to={bookHref}>Agendar um horário</Link></Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">No WhatsApp, toque em “Meus horários” para receber o link.</p>
          </section>
        )}

        {state === "ready" && (
          <>
            {/* Próximo horário em destaque */}
            {next ? (
              <section aria-labelledby="next-title" className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
                <div className="flex items-center justify-between gap-2 px-5 pt-5">
                  <h2 id="next-title" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Próximo horário</h2>
                  <Status value={next.status} />
                </div>
                <div className="flex items-start gap-4 p-5">
                  <div className="flex w-16 shrink-0 flex-col items-center rounded-2xl py-2" style={{ backgroundColor: color, color: onColor }}>
                    <span className="text-xs font-semibold uppercase">{format(day(next.date), "MMM", { locale: ptBR }).replace(".", "")}</span>
                    <span className="text-2xl font-bold leading-none">{format(day(next.date), "dd")}</span>
                    <span className="text-[11px] font-medium capitalize">{format(day(next.date), "EEE", { locale: ptBR }).replace(".", "")}</span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-lg font-semibold leading-snug">{next.service ?? "Atendimento"}</p>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Clock size={15} aria-hidden />{relative(next.date) ? `${relative(next.date)} · ` : ""}{next.start_time}{next.end_time ? ` – ${next.end_time}` : ""}</p>
                    {next.professional && <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><User size={15} aria-hidden />com {next.professional}</p>}
                    {brl(next.price) && <p className="text-sm font-medium">{brl(next.price)}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row">
                  {next.manage_token
                    ? <Button asChild variant="outline" className="min-h-11 flex-1 rounded-2xl"><Link to={`/appointment/${next.manage_token}`}><RotateCcw size={16} className="mr-2" aria-hidden />Remarcar ou cancelar</Link></Button>
                    : <p className="flex-1 self-center text-center text-xs text-muted-foreground">Alterações com menos de 24 h: fale com o salão.</p>}
                  {waLink && <Button asChild variant="ghost" className="min-h-11 flex-1 rounded-2xl"><a href={waLink} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} className="mr-2" aria-hidden />Falar com o salão</a></Button>}
                </div>
              </section>
            ) : (
              <section className="rounded-3xl border border-border bg-card p-6 text-center shadow-lg">
                <CalendarPlus className="mx-auto mb-3" style={{ color: "var(--tenant-text, currentColor)" }} aria-hidden />
                <h2 className="text-lg font-semibold">Nenhum horário marcado</h2>
                <p className="mt-1 text-sm text-muted-foreground">Que tal reservar o próximo?</p>
              </section>
            )}

            {/* Retorno recomendado (procedimentos com prazo) */}
            {returns.length > 0 && (
              <section className="flex items-center gap-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}1A`, color: "var(--tenant-text, currentColor)" }}><Sparkles size={20} aria-hidden /></span>
                <p className="min-w-0 flex-1 text-sm"><span className="font-semibold">Retorno recomendado:</span> {returns[0].procedure_name} a partir de {format(day(returns[0].alert_date), "dd/MM")}.</p>
              </section>
            )}

            {/* Abas: próximos / histórico */}
            <div role="tablist" aria-label="Seus agendamentos" className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
              {([["next", `Próximos${upcoming.length ? ` (${upcoming.length})` : ""}`, CalendarCheck], ["history", `Histórico${history.length ? ` (${history.length})` : ""}`, History]] as const).map(([id, label, Icon]) => (
                <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  <Icon size={16} aria-hidden />{label}
                </button>
              ))}
            </div>

            <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-2">
              {tab === "next" && (later.length ? later.map(a => <Row key={a.id} date={a.date} time={a.start_time} service={a.service} professional={a.professional} price={a.price} status={a.status} manage={a.manage_token} />)
                : <p className="py-6 text-center text-sm text-muted-foreground">{next ? "Nenhum outro horário marcado." : "Seus próximos horários aparecem aqui."}</p>)}
              {tab === "history" && (history.length ? history.map(a => <Row key={a.id} date={a.date} time={a.start_time} service={a.service} professional={a.professional} price={a.price} status={a.status} />)
                : <p className="py-6 text-center text-sm text-muted-foreground">Seu histórico aparece aqui depois do primeiro atendimento.</p>)}
            </section>

            {data?.client?.visits ? (
              <p className="text-center text-xs text-muted-foreground">{data.client.visits} {data.client.visits === 1 ? "atendimento realizado" : "atendimentos realizados"}{data.client.since ? ` · cliente desde ${format(day(data.client.since), "MMMM 'de' yyyy", { locale: ptBR })}` : ""}</p>
            ) : null}
          </>
        )}
      </main>

      {/* Ação principal fixa no rodapé */}
      {(
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 p-3 backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-2xl">
            <Link to={bookHref} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold shadow-md transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" style={{ backgroundColor: color, color: onColor }}>
              <CalendarPlus size={18} aria-hidden />Agendar novo horário
            </Link>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}

function Row({ date, time, service, professional, price, status, manage }: { date: string; time: string; service: string | null; professional: string | null; price: number | null; status: string; manage?: string | null }) {
  const content = (
    <>
      <div className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-muted py-1.5">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">{format(day(date), "MMM", { locale: ptBR }).replace(".", "")}</span>
        <span className="text-lg font-bold leading-none">{format(day(date), "dd")}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{service ?? "Atendimento"}</p>
        <p className="truncate text-xs text-muted-foreground"><Scissors size={12} className="mr-1 inline" aria-hidden />{time}{professional ? ` · ${professional}` : ""}{brl(price) ? ` · ${brl(price)}` : ""}</p>
      </div>
      <Status value={status} />
    </>
  );
  const cls = "flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm";
  return manage
    ? <Link to={`/appointment/${manage}`} className={`${cls} transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`} aria-label={`${service ?? "Atendimento"} em ${format(day(date), "dd/MM")} às ${time}. Remarcar ou cancelar`}>{content}</Link>
    : <div className={cls}>{content}</div>;
}
