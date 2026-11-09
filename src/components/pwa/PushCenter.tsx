import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, History, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

/** Tipos de aviso com liga/desliga por salão (colunas de public.push_preferences). */
export const OWNER_PREFS = [
  ['new_appointment', 'Novo agendamento'],
  ['appointment_cancelled', 'Cancelamento pelo cliente'],
  ['appointment_rescheduled', 'Remarcação pelo cliente'],
  ['whatsapp_human', 'Mensagem no WhatsApp em atendimento humano'],
  ['payment_proof', 'Comprovante PIX recebido'],
  ['new_review', 'Nova avaliação'],
] as const;
export const CLIENT_PREFS = [
  ['client_reminder', 'Lembrete antes do horário'],
  ['client_status', 'Confirmação, remarcação ou cancelamento pelo salão'],
  ['client_review_request', 'Pedido de avaliação após o atendimento'],
] as const;
type PrefKey = typeof OWNER_PREFS[number][0] | typeof CLIENT_PREFS[number][0];
type Prefs = Partial<Record<PrefKey, boolean>> & { reminder_minutes?: number };
interface HistoryRow { kind: string; audience: string; title: string; status: string; sent_count: number; failed_count: number; last_error: string | null; created_at: string }
export interface PushOverview {
  configured: boolean | null; my_devices: number; team_devices: number; client_devices: number; marketing_devices: number;
  legacy_devices: number; campaigns_today: number; history: HistoryRow[];
}

export const KIND_LABEL: Record<string, string> = {
  new_appointment: 'Novo agendamento', appointment_cancelled: 'Cancelamento', appointment_rescheduled: 'Remarcação',
  whatsapp_human: 'WhatsApp', whatsapp_handoff: 'WhatsApp (assistente)', payment_proof: 'Comprovante PIX', new_review: 'Avaliação',
  client_reminder: 'Lembrete ao cliente', client_confirmed: 'Confirmação ao cliente', client_cancelled: 'Cancelamento ao cliente',
  client_rescheduled: 'Remarcação ao cliente', review_request: 'Pedido de avaliação', marketing: 'Campanha', test: 'Teste',
};
export const STATUS_LABEL: Record<string, string> = { sent: 'Enviado', failed: 'Falhou', expired: 'Expirou', pending: 'Na fila', processing: 'Enviando' };
const REMINDERS = [[60, '1 hora antes'], [120, '2 horas antes'], [240, '4 horas antes'], [1440, '1 dia antes']] as const;

type Rpc = (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
const rpc: Rpc = (n, a) => (supabase as unknown as { rpc: Rpc }).rpc(n, a);

/** Preferências por tipo, aparelhos (equipe x clientes), estado da plataforma e últimos envios do salão. */
export function PushCenter({ salonId }: { salonId: string }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [overview, setOverview] = useState<PushOverview | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, o] = await Promise.all([rpc('push_get_preferences', { p_salon_id: salonId }), rpc('push_overview', { p_salon_id: salonId })]);
    if (!p.error && p.data) setPrefs(p.data as Prefs);
    if (!o.error && o.data) setOverview(o.data as PushOverview);
  }, [salonId]);
  useEffect(() => { load().catch(() => undefined); }, [load]);

  const save = async (patch: Prefs, key: string) => {
    const previous = prefs;
    setPrefs(prev => ({ ...prev, ...patch }));
    setSaving(key);
    const { data, error } = await rpc('push_set_preferences', { p_salon_id: salonId, p_prefs: patch });
    setSaving(null);
    if (error) { setPrefs(previous); toast.error('Não foi possível salvar a preferência.'); return; }
    setPrefs(data as Prefs);
  };

  const toggle = (key: PrefKey, label: string) => (
    <div key={key} className="flex min-h-11 items-center justify-between gap-3">
      <Label htmlFor={`push-pref-${key}`} className="min-w-0 font-normal">{label}</Label>
      <Switch id={`push-pref-${key}`} checked={prefs?.[key] !== false} disabled={!prefs || saving === key}
        onCheckedChange={(v) => save({ [key]: v }, key)} />
    </div>
  );

  return (
    <div className="space-y-6 border-t border-border pt-4">
      <div role="status" data-tour="settings-notifications-status"
        className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${overview?.configured === false ? 'border-warning/30 bg-warning/10' : 'border-border bg-secondary/40'}`}>
        {overview?.configured === false
          ? <><CircleAlert size={16} className="mt-0.5 shrink-0 text-warning" aria-hidden /> Envio da plataforma indisponível no momento. As inscrições ficam salvas.</>
          : <><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" aria-hidden /> Envio de notificações ativo na plataforma.</>}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-tour="settings-notifications-devices">
        {[['Seus aparelhos', overview?.my_devices], ['Equipe (dono e admins)', overview?.team_devices], ['Clientes', overview?.client_devices]].map(([label, value]) => (
          <div key={String(label)} className="min-w-0 rounded-lg border border-border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold text-foreground">{value ?? '—'}</dd>
          </div>
        ))}
      </dl>
      {!!overview?.legacy_devices && (
        <p className="text-xs text-muted-foreground">
          {overview.legacy_devices} inscrição(ões) do sistema antigo serão renovadas sozinhas quando o aparelho abrir o app ou o link do salão.
        </p>
      )}

      <fieldset className="space-y-1" data-tour="settings-notifications-prefs">
        <legend className="mb-2 text-sm font-medium text-foreground">Avisos para você e a equipe</legend>
        {OWNER_PREFS.map(([k, l]) => toggle(k, l))}
      </fieldset>

      <fieldset className="space-y-1" data-tour="settings-notifications-client-prefs">
        <legend className="mb-1 text-sm font-medium text-foreground">Avisos para clientes</legend>
        <p className="mb-2 text-xs text-muted-foreground">Chegam no aparelho em que o cliente ativou as notificações do salão e pediu o lembrete do horário.</p>
        {CLIENT_PREFS.map(([k, l]) => toggle(k, l))}
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
          <Label htmlFor="push-reminder-minutes" className="font-normal">Quando enviar o lembrete</Label>
          <select id="push-reminder-minutes" className="h-11 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={prefs?.reminder_minutes ?? 120} disabled={!prefs || prefs.client_reminder === false || saving === 'reminder'}
            onChange={(e) => save({ reminder_minutes: Number(e.target.value) }, 'reminder')}>
            {REMINDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </fieldset>

      <section aria-labelledby="push-history-title" data-tour="settings-notifications-history" className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 id="push-history-title" className="flex items-center gap-2 text-sm font-medium text-foreground"><History size={16} aria-hidden /> Últimos envios</h3>
          <Button type="button" variant="ghost" className="h-11" onClick={() => load()} aria-label="Atualizar histórico"><RefreshCw size={16} aria-hidden /></Button>
        </div>
        {!overview?.history?.length ? <p className="text-sm text-muted-foreground">Nenhum envio ainda.</p> : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {overview.history.map((h, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 p-3 text-sm">
                <span className="min-w-0 break-words"><strong className="font-medium">{KIND_LABEL[h.kind] ?? h.kind}</strong> · {new Date(h.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                <span className={h.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}>
                  {STATUS_LABEL[h.status] ?? h.status}{h.status === 'sent' || h.failed_count ? ` (${h.sent_count} ok${h.failed_count ? `, ${h.failed_count} falha` : ''})` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
