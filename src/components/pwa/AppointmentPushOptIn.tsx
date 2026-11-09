import { useEffect, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { linkPushToAppointment, usePushNotificationsFCM } from '@/hooks/usePushNotificationsFCM';

interface Props { salonSlug: string; cancellationToken: string | null | undefined; salonName: string }

/**
 * Depois de agendar (ou no link do agendamento): vincula este aparelho ao horário para receber lembrete,
 * confirmação/alteração e o pedido de avaliação. Prova de posse = cancellation_token (só quem tem o link).
 * Já inscrito: vincula sozinho. Não inscrito: botão (permissão só por gesto). iOS fora do app: explica.
 */
export function AppointmentPushOptIn({ salonSlug, cancellationToken, salonName }: Props) {
  const push = usePushNotificationsFCM(salonSlug);
  const [linked, setLinked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!push.isSubscribed || !cancellationToken || linked) return;
    linkPushToAppointment(cancellationToken).then(setLinked).catch(() => undefined);
  }, [push.isSubscribed, cancellationToken, linked]);

  if (!cancellationToken || push.support === 'unsupported' || import.meta.env.MODE === 'demo') return null;

  if (push.support === 'ios-needs-install') {
    return <p className="text-sm text-muted-foreground">No iPhone, instale o app de {salonName} pela Tela de Início para receber o lembrete do horário.</p>;
  }
  if (linked) {
    return <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><BellRing size={16} aria-hidden /> Você receberá o lembrete deste horário neste aparelho.</p>;
  }
  if (push.permission === 'denied') return null;

  const enable = async () => {
    setBusy(true);
    const r = await push.subscribe();
    const ok = r === 'ok' && await linkPushToAppointment(cancellationToken);
    setBusy(false);
    if (ok) { setLinked(true); toast.success('Pronto! Vamos avisar antes do seu horário.'); }
    else if (r === 'denied') toast.error('Permissão negada pelo navegador.');
    else toast.error('Não foi possível ativar agora. Tente novamente.');
  };

  return (
    <Button type="button" variant="outline" className="h-11 w-full" onClick={enable} disabled={busy}>
      <Bell size={16} aria-hidden /> {busy ? 'Ativando…' : 'Receber lembrete neste aparelho'}
    </Button>
  );
}
