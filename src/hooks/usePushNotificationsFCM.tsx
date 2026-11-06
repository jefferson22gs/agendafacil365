import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { requestFCMToken, currentFCMToken, onForegroundMessage } from '@/lib/firebase';
import { toast } from 'sonner';

export type PushSupport = 'supported' | 'ios-needs-install' | 'unsupported';
export type SubscribeResult = 'ok' | 'denied' | 'unsupported' | 'error';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export function pushSupport(): PushSupport {
  if (import.meta.env.MODE === 'demo') return 'unsupported';
  const api = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  // iOS/iPadOS 16.4+: Web Push só existe no app adicionado à Tela de Início.
  if (isIOS() && !isStandalone()) return 'ios-needs-install';
  return api ? 'supported' : 'unsupported';
}

const rpc = (name: string, args: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }).rpc(name, args);

const device = () => ({ platform: isIOS() ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'desktop', standalone: String(isStandalone()), source: 'web' });

export interface PushSendResult { ok: boolean; sent: number; code?: string; message: string }
export const PUSH_NOT_CONFIGURED_MESSAGE = 'As notificações ainda não foram ativadas pela plataforma.';

/**
 * Envio pelo painel (send-push-fcm). O JWT do dono vai automaticamente; o servidor confere o salão.
 * body: { salon_id, title, body, audience?: 'owner'|'clients'|'subscribers', client_ids?, type?, appointment_id? }
 */
export async function sendPush(body: Record<string, unknown>): Promise<PushSendResult> {
  const { data, error } = await supabase.functions.invoke('send-push-fcm', { body });
  if (!error && data?.success) {
    const sent = Number(data.sent) || 0;
    return { ok: true, sent, message: sent ? `${sent} notificação(ões) enviada(s).` : 'Nenhum dispositivo inscrito para receber.' };
  }
  let payload: { code?: string; error?: string } = data ?? {};
  try {
    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx && typeof ctx.json === 'function') payload = await ctx.json();
  } catch { /* corpo ilegível: mensagem genérica */ }
  const code = payload.code;
  const message = code === 'push_not_configured' ? PUSH_NOT_CONFIGURED_MESSAGE
    : code === 'demo_unavailable' || payload.error === 'demo_unavailable' ? 'Indisponível na demonstração.'
    : payload.error || 'Não foi possível enviar a notificação.';
  return { ok: false, sent: 0, code, message };
}

let foregroundBound = false;
const safePath = (u: unknown) => (typeof u === 'string' && /^\/(?![/\\])/.test(u) ? u : null);

/**
 * Inscrição de push de UM salão (por slug). Registro/remoção só via RPC (a tabela não aceita escrita direta).
 * Sem slug: usa o salão do dono logado (inscrição fica com user_id do dono e recebe os avisos de novo agendamento).
 */
export const usePushNotificationsFCM = (providedSlug?: string) => {
  const [support] = useState<PushSupport>(() => pushSupport());
  const [permission, setPermission] = useState<NotificationPermission>(() => (support === 'supported' ? Notification.permission : 'default'));
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [ownerSlug, setOwnerSlug] = useState<string | null>(null);
  const slug = providedSlug || ownerSlug;

  useEffect(() => {
    if (providedSlug) return;
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('salons').select('slug').eq('owner_id', user.id).maybeSingle();
      if (alive && data?.slug) setOwnerSlug(data.slug);
    })().catch(() => undefined);
    return () => { alive = false; };
  }, [providedSlug]);

  // Já permitido: confere (sem pedir nada) se este aparelho está inscrito neste salão.
  useEffect(() => {
    if (support !== 'supported' || !slug || Notification.permission !== 'granted') return;
    let alive = true;
    currentFCMToken().then(async (token) => {
      if (!token) return;
      const { data } = await rpc('push_subscription_status', { p_salon_slug: slug, p_fcm_token: token });
      if (alive) setIsSubscribed(data === true);
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [support, slug]);

  useEffect(() => {
    if (support !== 'supported' || foregroundBound) return;
    foregroundBound = true;
    onForegroundMessage((payload) => {
      const title = payload?.data?.title || payload?.notification?.title || 'Nova notificação';
      const url = safePath(payload?.data?.url);
      toast.info(title, {
        description: payload?.data?.body || payload?.notification?.body || '',
        duration: 10000,
        action: url ? { label: 'Ver', onClick: () => { window.location.href = url; } } : undefined,
      });
    });
  }, [support]);

  const subscribe = useCallback(async (): Promise<SubscribeResult> => {
    if (support !== 'supported' || !slug) return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return 'denied';
      const token = await requestFCMToken();
      if (!token) return 'error';
      const { error } = await rpc('register_push_subscription', { p_salon_slug: slug, p_fcm_token: token, p_device: device() });
      if (error) return 'error';
      setIsSubscribed(true);
      return 'ok';
    } catch {
      return 'error';
    }
  }, [support, slug]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!slug) return false;
    try {
      const token = await currentFCMToken();
      if (token) await rpc('unregister_push_subscription', { p_salon_slug: slug, p_fcm_token: token });
      setIsSubscribed(false);
      return true;
    } catch {
      return false;
    }
  }, [slug]);

  return { support, isSupported: support === 'supported', permission, isSubscribed, slug, subscribe, unsubscribe };
};
