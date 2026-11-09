import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Health {
  configured: boolean | null; last_run_at: string | null; last_success_at: string | null; last_error: string | null;
  sent_24h: number; failed_24h: number; pending: number; expired_24h: number; removed_24h: number;
  active_subscriptions: number; legacy_inactive: number;
}
const when = (v: string | null) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/** Saúde do Web Push da plataforma (RPC push_health: só super admin). Sem endpoint, chave ou conteúdo. */
export function PushHealthCard() {
  const [h, setH] = useState<Health | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    (supabase as any).rpc('push_health').then(({ data, error: e }: { data: Health | null; error: unknown }) => { if (e) setError(true); else setH(data); });
  }, []);
  if (error) return null;
  const total = (h?.sent_24h ?? 0) + (h?.failed_24h ?? 0);
  const rate = total ? Math.round(((h?.failed_24h ?? 0) / total) * 100) : 0;
  const ok = h?.configured === true && !h?.last_error && rate < 20;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Bell size={18} aria-hidden /> Notificações push</CardTitle>
        <CardDescription role="status">
          {!h ? 'Carregando…' : h.configured === null ? 'Ainda sem execução do worker.' : h.configured ? (ok ? 'Funcionando.' : `Atenção: ${h.last_error ?? 'taxa de falha alta'}.`) : 'Chaves VAPID ausentes no servidor.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          {([
            ['Último envio ok', when(h?.last_success_at ?? null)], ['Enviados 24 h', h?.sent_24h ?? '—'],
            ['Falha 24 h', total ? `${rate}%` : '—'], ['Na fila', h?.pending ?? '—'],
            ['Expirados 24 h', h?.expired_24h ?? '—'], ['Inválidos removidos 24 h', h?.removed_24h ?? '—'],
            ['Inscrições ativas', h?.active_subscriptions ?? '—'], ['Antigas (FCM) a renovar', h?.legacy_inactive ?? '—'],
          ] as const).map(([label, value]) => (
            <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium text-foreground">{value}</dd></div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
