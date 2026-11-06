import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { aiAdmin, int, optionalNumber, type AIAdminState } from "./api";

const empty = { salonId: "", monthlyRequests: "", monthlyTokens: "", blocked: false, note: "" };

export const LimitsTab = ({ state, reload }: { state: AIAdminState; reload: () => void }) => {
  const { toast } = useToast();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const names = new Map(state.salons.map(s => [s.id, s.name]));
  const usage = new Map((state.usage?.by_salon ?? []).map(s => [s.salon_id, s]));
  const cfg = state.config;
  const fmt = (v: number | null) => v == null ? "sem limite" : int(v);

  const save = async () => {
    setBusy(true);
    try {
      await aiAdmin("save_limit", { salonId: form.salonId, monthlyRequests: optionalNumber(form.monthlyRequests), monthlyTokens: optionalNumber(form.monthlyTokens), blocked: form.blocked, note: form.note });
      toast({ title: "Limite salvo" });
      setForm(empty); reload();
    } catch (e) {
      toast({ title: "Não foi possível salvar", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };
  const remove = async (salonId: string) => {
    setBusy(true);
    try { await aiAdmin("delete_limit", { salonId }); toast({ title: "Exceção removida", description: "O salão volta ao limite padrão." }); reload(); }
    catch (e) { toast({ title: "Não foi possível remover", description: (e as Error).message, variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Limite padrão</CardTitle>
          <CardDescription>Vale para todo salão sem exceção. Altere na aba "Configuração" e salve.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>Requisições por mês: <strong>{fmt(cfg.default_salon_monthly_requests)}</strong></p>
          <p>Tokens por mês: <strong>{fmt(cfg.default_salon_monthly_tokens)}</strong></p>
          <p className="text-xs text-muted-foreground pt-2">Os contadores zeram no dia 1º de cada mês (horário de Brasília).</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Criar ou editar exceção</CardTitle>
          <CardDescription>Para um salão que precisa de mais (ou menos) uso, ou para bloquear a IA de um salão. Campo vazio = usa o padrão.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (form.salonId) save(); }}>
            <div className="space-y-2">
              <Label htmlFor="lim-salon">Salão</Label>
              <Select value={form.salonId} onValueChange={v => {
                const cur = state.limits.find(l => l.salon_id === v);
                setForm(cur ? { salonId: v, monthlyRequests: cur.monthly_requests?.toString() ?? "", monthlyTokens: cur.monthly_tokens?.toString() ?? "", blocked: cur.blocked, note: cur.note ?? "" } : { ...empty, salonId: v });
              }}>
                <SelectTrigger id="lim-salon" className="h-11"><SelectValue placeholder="Escolha o salão" /></SelectTrigger>
                <SelectContent>{state.salons.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lim-req">Requisições/mês</Label>
                <Input id="lim-req" className="h-11" inputMode="numeric" placeholder={`Padrão: ${fmt(cfg.default_salon_monthly_requests)}`} value={form.monthlyRequests} onChange={e => setForm(f => ({ ...f, monthlyRequests: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lim-tok">Tokens/mês</Label>
                <Input id="lim-tok" className="h-11" inputMode="numeric" placeholder={`Padrão: ${fmt(cfg.default_salon_monthly_tokens)}`} value={form.monthlyTokens} onChange={e => setForm(f => ({ ...f, monthlyTokens: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <Label htmlFor="lim-block" className="min-w-0">Bloquear IA deste salão<span className="block text-xs font-normal text-muted-foreground">O chatbot passa a usar a resposta padrão.</span></Label>
              <Switch id="lim-block" checked={form.blocked} onCheckedChange={v => setForm(f => ({ ...f, blocked: v }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lim-note">Observação (opcional)</Label>
              <Input id="lim-note" className="h-11" maxLength={300} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Ex.: plano com IA ampliada" />
            </div>
            <Button type="submit" className="h-11" disabled={busy || !form.salonId}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}Salvar exceção</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-lg">Exceções ativas</CardTitle></CardHeader>
        <CardContent>
          {state.limits.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma exceção: todos os salões usam o limite padrão.</p> : (
            <ul className="divide-y">
              {state.limits.map(l => {
                const used = usage.get(l.salon_id);
                return (
                  <li key={l.salon_id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{names.get(l.salon_id) ?? l.salon_id} {l.blocked && <Badge variant="destructive" className="ml-1">Bloqueado</Badge>}</p>
                      <p className="text-xs text-muted-foreground">
                        Req.: {int(used?.requests ?? 0)} / {fmt(l.monthly_requests ?? cfg.default_salon_monthly_requests)} · Tokens: {int(used?.tokens ?? 0)} / {fmt(l.monthly_tokens ?? cfg.default_salon_monthly_tokens)}{l.note ? ` · ${l.note}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" className="h-11" onClick={() => setForm({ salonId: l.salon_id, monthlyRequests: l.monthly_requests?.toString() ?? "", monthlyTokens: l.monthly_tokens?.toString() ?? "", blocked: l.blocked, note: l.note ?? "" })}>
                        <Pencil className="w-4 h-4 mr-2" aria-hidden />Editar
                      </Button>
                      <Button variant="outline" className="h-11 text-destructive" disabled={busy} onClick={() => remove(l.salon_id)} aria-label={`Remover exceção de ${names.get(l.salon_id) ?? "salão"}`}>
                        <Trash2 className="w-4 h-4" aria-hidden />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
