import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, Download, Loader2, Timer, X } from "lucide-react";
import {
  aiAdmin, AUTOMATION_LABEL, brl, downloadCsv, FEATURE_LABEL, int, plainKindLabel, presetRange, seconds, spDate, usd,
  type AIAdminState, type PeriodPreset, type ReplyLatency, type UsageReport,
} from "./api";

const ERROR_LABEL: Record<string, string> = {
  invalid_key: "chave recusada", provider_quota: "sem crédito no Google", rate_limited: "limite de chamadas do Google",
  invalid_model: "modelo inválido", bad_request: "requisição recusada", timeout: "tempo esgotado", unavailable: "Google indisponível", not_configured: "não configurada",
};
const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoje" }, { value: "7d", label: "Últimos 7 dias" }, { value: "30d", label: "Últimos 30 dias" },
  { value: "month", label: "Mês atual" }, { value: "prev_month", label: "Mês anterior" }, { value: "custom", label: "Personalizado" },
];
const GROUPS = [{ value: "day", label: "Dia" }, { value: "week", label: "Semana" }, { value: "month", label: "Mês" }] as const;
type Group = typeof GROUPS[number]["value"];
const bucketLabel = (b: string, g: Group) => g === "month" ? `${b.slice(5, 7)}/${b.slice(0, 4)}` : `${g === "week" ? "Sem. " : ""}${b.slice(8, 10)}/${b.slice(5, 7)}`;

export const UsageTab = ({ state }: { state: AIAdminState }) => {
  const cfg = state.config, u = state.usage;
  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [custom, setCustom] = useState<[string, string]>(() => presetRange("30d"));
  const [group, setGroup] = useState<Group>("day");
  const [salonId, setSalonId] = useState<string | null>(null);
  const [report, setReport] = useState<UsageReport | null>(null);
  const [salonReport, setSalonReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const range = useMemo<[string, string]>(() => (preset === "custom" ? custom : presetRange(preset)), [preset, custom]);
  const fx = Number(cfg.usd_brl) || 0;

  const load = useCallback(async () => {
    if (!range[0] || !range[1] || range[0] > range[1]) { setError("Escolha um período válido (data inicial antes da final)."); return; }
    setLoading(true); setError(null);
    try {
      const [all, one] = await Promise.all([
        aiAdmin<{ report: UsageReport }>("usage_report", { from: range[0], to: range[1], group }),
        salonId ? aiAdmin<{ report: UsageReport }>("usage_report", { from: range[0], to: range[1], group, salonId }) : Promise.resolve(null),
      ]);
      setReport(all.report); setSalonReport(one?.report ?? null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [range, group, salonId]);
  useEffect(() => { load(); }, [load]);

  const budget = cfg.monthly_budget_usd;
  const monthCost = Number(u?.month.cost_usd ?? 0);
  const pct = budget ? Math.min(100, (monthCost / budget) * 100) : 0;
  const errRate = u?.last_24h.requests ? (u.last_24h.errors / u.last_24h.requests) * 100 : 0;
  const t = report?.totals;
  const salonName = salonId ? report?.ranking.find(r => r.salon_id === salonId)?.name ?? state.salons.find(s => s.id === salonId)?.name : null;

  const exportCsv = () => {
    if (!report) return;
    const rows: (string | number | null)[][] = [
      ["Período", `${range[0]} a ${range[1]}`, "Câmbio US$→R$", fx],
      [],
      ["Salão", "Requisições", "Tokens entrada", "Tokens saída", "Custo US$", "Custo R$", "% do custo", "Erros", "Bloqueios", "Respostas com IA", "Respostas sem IA", "Custo médio por conversa US$"],
      ...report.ranking.map(r => [r.name, r.requests, r.tokens_in, r.tokens_out, Number(r.cost_usd), Number(r.cost_usd) * fx, Number(r.pct_cost), r.errors, r.blocked, r.ai_replies, r.plain_replies, r.avg_cost_per_conversation]),
      [],
      ["Período (" + group + ")", "Requisições", "Tokens entrada", "Tokens saída", "Custo US$", "Erros"],
      ...report.series.map(s => [s.bucket, s.requests, s.tokens_in, s.tokens_out, Number(s.cost_usd), s.errors]),
      [],
      ["Recurso", "Requisições", "Tokens entrada", "Tokens saída", "Custo US$", "Erros"],
      ...report.by_feature.map(f => [FEATURE_LABEL[f.feature] ?? f.feature, f.requests, f.tokens_in, f.tokens_out, Number(f.cost_usd), f.errors]),
    ];
    downloadCsv(`consumo-ia_${range[0]}_${range[1]}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      {u && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardDescription>Custo estimado do mês</CardDescription><CardTitle className="text-2xl">{usd(monthCost)}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">≈ {brl(monthCost * fx)}</p>
              {budget != null ? <>
                <Progress value={pct} aria-label={`${pct.toFixed(0)}% do orçamento usado`} />
                <p className={`text-xs ${pct >= 90 ? "text-destructive" : "text-muted-foreground"}`}>{pct.toFixed(0)}% de {usd(budget)}</p>
              </> : <p className="text-xs text-muted-foreground">Sem orçamento definido.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Requisições no mês</CardDescription><CardTitle className="text-2xl">{int(u.month.requests)}</CardTitle></CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">{int(u.month.tokens)} tokens · {int(u.month.blocked)} bloqueadas por limite{u.month.stuck ? ` · ${int(u.month.stuck)} sem confirmação (contam pela estimativa)` : ""}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Taxa de erro (24h)</CardDescription><CardTitle className="text-2xl">{errRate.toFixed(1)}%</CardTitle></CardHeader>
            <CardContent><p className="text-xs text-muted-foreground">{int(u.last_24h.errors)} de {int(u.last_24h.requests)} chamadas</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardDescription>Status</CardDescription>
              <CardTitle className="text-base flex items-center gap-2">
                {!cfg.enabled ? <><AlertTriangle className="w-5 h-5 text-amber-500" aria-hidden />IA desativada</>
                  : errRate >= 20 ? <><AlertTriangle className="w-5 h-5 text-destructive" aria-hidden />Muitas falhas</>
                  : <><CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden />Operando</>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground break-words">
                Modelo: {state.effectiveModel}.{" "}
                {u.last_error ? `Última falha: ${new Date(u.last_error.created_at).toLocaleString("pt-BR")} · ${FEATURE_LABEL[u.last_error.feature] ?? u.last_error.feature} · ${ERROR_LABEL[u.last_error.error_code] ?? u.last_error.error_code}` : "Nenhuma falha registrada."}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <ReplyLatencyCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Relatório de consumo</CardTitle>
          <CardDescription>Horário de Brasília. Semanas começam na segunda-feira. Toque em um salão do ranking para ver o detalhe dele.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="usage-period">Período</Label>
              <Select value={preset} onValueChange={v => setPreset(v as PeriodPreset)}>
                <SelectTrigger id="usage-period" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{PRESETS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {preset === "custom" && <>
              <div className="space-y-2">
                <Label htmlFor="usage-from">De</Label>
                <Input id="usage-from" type="date" className="h-11" max={spDate(new Date())} value={custom[0]} onChange={e => setCustom(c => [e.target.value, c[1]])} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="usage-to">Até</Label>
                <Input id="usage-to" type="date" className="h-11" min={custom[0]} value={custom[1]} onChange={e => setCustom(c => [c[0], e.target.value])} />
              </div>
            </>}
            <div className="space-y-2">
              <Label htmlFor="usage-group">Agrupar por</Label>
              <Select value={group} onValueChange={v => setGroup(v as Group)}>
                <SelectTrigger id="usage-group" className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{GROUPS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11" onClick={exportCsv} disabled={!report || loading}><Download className="w-4 h-4 mr-2" aria-hidden />Exportar CSV</Button>
            {loading && <span className="flex items-center text-sm text-muted-foreground" role="status"><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />Carregando…</span>}
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          {t && (
            <dl className="grid gap-3 grid-cols-2 lg:grid-cols-5">
              {[
                ["Requisições", int(t.requests)], ["Tokens de entrada", int(t.tokens_in)], ["Tokens de saída", int(t.tokens_out)],
                ["Custo (US$)", usd(t.cost_usd)], ["Custo (R$)", brl(Number(t.cost_usd) * fx)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border p-3 min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-lg font-semibold break-words">{v}</dd></div>
              ))}
            </dl>
          )}
          {t && <p className="text-xs text-muted-foreground">Dos tokens de saída, {int(t.tokens_thoughts)} foram raciocínio; dos de entrada, {int(t.tokens_cached)} vieram do cache. {int(t.errors)} erros e {int(t.blocked)} bloqueios no período.</p>}
        </CardContent>
      </Card>

      {report && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <SeriesCard title="Consumo no tempo (todos os salões)" report={report} group={group} />
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mensagens do chatbot com e sem IA</CardTitle>
                <CardDescription>Respostas sem IA (confirmações, fora do horário, encaminhamentos) não custam nada. Automações como lembretes, aniversários e avisos de PIX nunca usam IA.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Com IA</p><p className="text-xl font-semibold">{int(report.messages.chatbot_ai)}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Sem IA</p><p className="text-xl font-semibold">{int(report.messages.chatbot_plain)}</p></div>
                </div>
                <KeyList title="Respostas sem IA, por motivo" data={report.messages.chatbot_plain_by_kind} label={plainKindLabel} />
                <KeyList title="Automações enviadas (sem IA)" data={report.messages.automations_by_category} label={k => AUTOMATION_LABEL[k] ?? k} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <FeatureCard title="Por recurso" report={report} />
            <Card>
              <CardHeader><CardTitle className="text-lg">Por modelo</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Modelo</TableHead><TableHead className="text-right">Req.</TableHead><TableHead className="text-right">Custo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {report.by_model.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">Sem uso no período.</TableCell></TableRow>}
                    {report.by_model.map(m => <TableRow key={m.model}><TableCell className="break-all">{m.model}</TableCell><TableCell className="text-right">{int(m.requests)}</TableCell><TableCell className="text-right whitespace-nowrap">{usd(m.cost_usd)}</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ranking de salões</CardTitle>
              <CardDescription>Ordenado pelo custo. "Custo médio por conversa" = custo do chatbot dividido pelas respostas geradas com IA.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Salão</TableHead><TableHead className="text-right">Req.</TableHead><TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Custo</TableHead><TableHead className="text-right">% total</TableHead><TableHead className="text-right">Erros</TableHead>
                    <TableHead className="text-right">Bloq.</TableHead><TableHead className="text-right">Por conversa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.ranking.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground">Nenhum salão usou IA no período.</TableCell></TableRow>}
                  {report.ranking.map(r => (
                    <TableRow key={r.salon_id} data-state={r.salon_id === salonId ? "selected" : undefined}>
                      <TableCell className="max-w-[12rem]">
                        <button type="button" className="min-h-[44px] text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded truncate max-w-full" onClick={() => setSalonId(r.salon_id === salonId ? null : r.salon_id)} aria-pressed={r.salon_id === salonId} title={r.name}>
                          {r.name}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">{int(r.requests)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{int(r.tokens_in + r.tokens_out)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{usd(r.cost_usd)}<span className="block text-xs text-muted-foreground">{brl(Number(r.cost_usd) * fx)}</span></TableCell>
                      <TableCell className="text-right">{Number(r.pct_cost).toLocaleString("pt-BR")}%</TableCell>
                      <TableCell className="text-right">{int(r.errors)}</TableCell>
                      <TableCell className="text-right">{int(r.blocked)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{r.avg_cost_per_conversation != null ? usd(r.avg_cost_per_conversation) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {salonId && salonReport && (
            <section aria-label={`Detalhe de ${salonName ?? "salão"}`} className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold truncate">Detalhe: {salonName}</h3>
                <Button variant="ghost" className="h-11 shrink-0" onClick={() => setSalonId(null)}><X className="w-4 h-4 mr-2" aria-hidden />Fechar</Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {int(salonReport.totals.requests)} requisições · {usd(salonReport.totals.cost_usd)} ({brl(Number(salonReport.totals.cost_usd) * fx)}) ·
                {" "}{int(salonReport.messages.chatbot_ai)} respostas com IA e {int(salonReport.messages.chatbot_plain)} sem IA.
              </p>
              <div className="grid gap-6 lg:grid-cols-2">
                <SeriesCard title="No tempo" report={salonReport} group={group} />
                <FeatureCard title="Por recurso" report={salonReport} />
              </div>
            </section>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">Custos são estimativas a partir dos tokens informados pelo Google e da tabela de preços. O valor cobrado de verdade aparece no faturamento do Google AI Studio / Cloud.</p>
    </div>
  );
};

/** Meta do atendente: p50 até 8 s e p95 até 15 s, do recebimento da mensagem ao envio da resposta. */
const TARGET_P50_MS = 8_000, TARGET_P95_MS = 15_000;
const ReplyLatencyCard = () => {
  const [data, setData] = useState<ReplyLatency | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData((await aiAdmin<{ latency: ReplyLatency }>("reply_latency")).latency); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const ok = data?.p50_ms != null && data.p95_ms != null && data.p50_ms <= TARGET_P50_MS && data.p95_ms <= TARGET_P95_MS;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2"><Timer className="w-5 h-5 shrink-0" aria-hidden />Tempo de resposta do atendente</CardTitle>
        <CardDescription>WhatsApp, últimos 7 dias, todos os salões: do recebimento da mensagem ao envio da resposta. Meta: metade em até 8 s e 95% em até 15 s.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && !data && <p className="flex items-center text-sm text-muted-foreground" role="status"><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />Carregando…</p>}
        {error && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-destructive" role="alert">{error}</p>
            <Button variant="outline" className="h-11" onClick={load}>Tentar de novo</Button>
          </div>
        )}
        {data && (data.replies === 0 ? <p className="text-sm text-muted-foreground">Nenhuma resposta enviada pelo atendente no período.</p> : <>
          <dl className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[
              ["Mediana (p50)", seconds(data.p50_ms)], ["95% até (p95)", seconds(data.p95_ms)],
              ["Mais lenta", seconds(data.max_ms)], ["Respostas", int(data.replies)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border p-3 min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-lg font-semibold break-words">{v}</dd></div>
            ))}
          </dl>
          <p className={`text-xs flex items-start gap-1.5 ${ok ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}`}>
            {ok ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden /> : <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />}
            <span>{ok ? "Dentro da meta." : "Acima da meta."} Preparo da resposta (até gravar o envio): mediana {seconds(data.processing_p50_ms)}, p95 {seconds(data.processing_p95_ms)}.{data.not_sent ? ` ${int(data.not_sent)} respostas ainda sem confirmação de envio.` : ""}</span>
          </p>
        </>)}
      </CardContent>
    </Card>
  );
};

const SeriesCard = ({ title, report, group }: { title: string; report: UsageReport; group: Group }) => {
  const data = report.series.map(s => ({ ...s, label: bucketLabel(s.bucket, group), cost_usd: Number(s.cost_usd) }));
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle><CardDescription>Requisições por {group === "day" ? "dia" : group === "week" ? "semana" : "mês"}. Toque nas barras para ver custo.</CardDescription></CardHeader>
      <CardContent>
        {data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma chamada no período.</p> : (
          <div className="h-64 w-full" role="img" aria-label={`${title}: ${report.totals.requests} requisições no período`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, _n: string, item: { payload?: { cost_usd?: number } }) => [`${int(v)} · ${usd(item?.payload?.cost_usd ?? 0)}`, "Requisições · custo"]} />
                <Bar dataKey="requests" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const FeatureCard = ({ title, report }: { title: string; report: UsageReport }) => (
  <Card>
    <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
    <CardContent className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow><TableHead>Recurso</TableHead><TableHead className="text-right">Req.</TableHead><TableHead className="text-right">Tokens</TableHead><TableHead className="text-right">Custo</TableHead></TableRow></TableHeader>
        <TableBody>
          {report.by_feature.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">Sem uso no período.</TableCell></TableRow>}
          {report.by_feature.map(f => (
            <TableRow key={f.feature}><TableCell>{FEATURE_LABEL[f.feature] ?? f.feature}</TableCell><TableCell className="text-right">{int(f.requests)}</TableCell><TableCell className="text-right whitespace-nowrap">{int(f.tokens_in + f.tokens_out)}</TableCell><TableCell className="text-right whitespace-nowrap">{usd(f.cost_usd)}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

const KeyList = ({ title, data, label }: { title: string; data: Record<string, number>; label: (k: string) => string }) => {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <p className="font-medium mb-1">{title}</p>
      {entries.length === 0 ? <p className="text-muted-foreground">Nenhuma no período.</p> : (
        <ul className="space-y-1">{entries.map(([k, n]) => <li key={k} className="flex justify-between gap-2"><span className="min-w-0 break-words">{label(k)}</span><span className="tabular-nums">{int(n)}</span></li>)}</ul>
      )}
    </div>
  );
};
