import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { brl, FEATURE_LABEL, int, usd, type AIAdminState } from "./api";

const ERROR_LABEL: Record<string, string> = {
  invalid_key: "chave recusada", provider_quota: "sem crédito no provedor", rate_limited: "limite de chamadas do provedor",
  invalid_model: "modelo inválido", bad_request: "requisição recusada", timeout: "tempo esgotado", unavailable: "provedor indisponível", not_configured: "não configurada",
};

export const UsageTab = ({ state }: { state: AIAdminState }) => {
  const u = state.usage;
  const cfg = state.config;
  if (!u) return <p className="text-sm text-muted-foreground">Sem dados de consumo ainda.</p>;
  const budget = cfg.monthly_budget_usd;
  const pct = budget ? Math.min(100, (Number(u.month.cost_usd) / budget) * 100) : 0;
  const errRate = u.last_24h.requests ? (u.last_24h.errors / u.last_24h.requests) * 100 : 0;
  const days = u.by_day.map(d => ({ ...d, label: d.day.slice(8, 10) + "/" + d.day.slice(5, 7), cost_usd: Number(d.cost_usd) }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Custo estimado do mês</CardDescription><CardTitle className="text-2xl">{usd(u.month.cost_usd)}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">≈ {brl(Number(u.month.cost_usd) * cfg.usd_brl)}</p>
            {budget != null ? <>
              <Progress value={pct} aria-label={`${pct.toFixed(0)}% do orçamento usado`} />
              <p className={`text-xs ${pct >= 90 ? "text-destructive" : "text-muted-foreground"}`}>{pct.toFixed(0)}% de {usd(budget)}</p>
            </> : <p className="text-xs text-muted-foreground">Sem orçamento definido.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Requisições no mês</CardDescription><CardTitle className="text-2xl">{int(u.month.requests)}</CardTitle></CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">{int(u.month.tokens)} tokens · {int(u.month.blocked)} bloqueadas por limite</p></CardContent>
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
              {u.last_error ? `Última falha: ${new Date(u.last_error.created_at).toLocaleString("pt-BR")} · ${FEATURE_LABEL[u.last_error.feature] ?? u.last_error.feature} · ${ERROR_LABEL[u.last_error.error_code] ?? u.last_error.error_code} (${u.last_error.model})` : "Nenhuma falha registrada."}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Consumo por dia (30 dias)</CardTitle><CardDescription>Requisições por dia. Passe o dedo ou o mouse para ver o custo.</CardDescription></CardHeader>
        <CardContent>
          {days.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma chamada nos últimos 30 dias.</p> : (
            <div className="h-64 w-full" role="img" aria-label={`Gráfico de requisições por dia; total no mês: ${u.month.requests}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={days} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, n: string) => n === "requests" ? [int(v), "Requisições"] : [usd(v), "Custo"]} labelFormatter={l => `Dia ${l}`} />
                  <Bar dataKey="requests" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Por recurso (mês)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Recurso</TableHead><TableHead className="text-right">Requisições</TableHead><TableHead className="text-right">Custo</TableHead></TableRow></TableHeader>
              <TableBody>
                {u.by_feature.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground">Sem uso no mês.</TableCell></TableRow>}
                {u.by_feature.map(f => (
                  <TableRow key={f.feature}><TableCell>{FEATURE_LABEL[f.feature] ?? f.feature}</TableCell><TableCell className="text-right">{int(f.requests)}</TableCell><TableCell className="text-right whitespace-nowrap">{usd(f.cost_usd)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Salões que mais usam (mês)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Salão</TableHead><TableHead className="text-right">Req.</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Erros</TableHead></TableRow></TableHeader>
              <TableBody>
                {u.by_salon.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">Sem uso no mês.</TableCell></TableRow>}
                {u.by_salon.slice(0, 15).map(s => (
                  <TableRow key={s.salon_id}>
                    <TableCell className="max-w-[10rem] truncate" title={s.name}>{s.name}</TableCell>
                    <TableCell className="text-right">{int(s.requests)}{s.blocked > 0 && <span className="block text-xs text-amber-600">{int(s.blocked)} bloq.</span>}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{usd(s.cost_usd)}</TableCell>
                    <TableCell className="text-right">{int(s.errors)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">Custos são estimativas a partir dos tokens informados pelo provedor. O valor cobrado de verdade aparece no painel de faturamento do provedor.</p>
    </div>
  );
};
