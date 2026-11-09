// Nome do arquivo mantido por compatibilidade de imports; implementação é Web Push padrão (VAPID), sem Firebase.
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { currentWebPush, ensureWebPush, forgetLegacyFcm, legacyFcmToken, webPushAvailable, type WebPushKeys } from '@/lib/webPush';
import { toast } from 'sonner';

export type PushSupport = 'supported' | 'ios-needs-install' | 'unsupported';
export type SubscribeResult = 'ok' | 'denied' | 'unsupported' | 'error';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export function pushSupport(): PushSupport {
  if (import.meta.env.MODE === 'demo') return 'unsupported';
  // iOS/iPadOS 16.4+: Web Push só existe no app adicionado à Tela de Início.
  if (isIOS() && !isStandalone()) return 'ios-needs-install';
  return webPushAvailable() ? 'supported' : 'unsupported';
}

type Rpc = (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
const rpc: Rpc = (name, args) => (supabase as unknown as { rpc: Rpc }).rpc(name, args);

const browser = () => { const ua = navigator.userAgent; return /Edg\//.test(ua) ? 'edge' : /Firefox\//.test(ua) ? 'firefox' : /Chrome\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : 'other'; };
const device = () => ({ platform: isIOS() ? 'ios' : /Android/i.test(navigator.userAgent) ? 'android' : 'desktop', standalone: String(isStandalone()), browser: browser(), source: 'web' });
const register = (slug: string, k: WebPushKeys) =>
  rpc('register_web_push', { p_salon_slug: slug, p_endpoint: k.endpoint, p_p256dh: k.p256dh, p_auth: k.auth, p_device: device() });

export interface PushSendResult { ok: boolean; sent: number; code?: string; message: string }
export const PUSH_NOT_CONFIGURED_MESSAGE = 'As notificações ainda não foram ativadas pela plataforma.';

/** "Enviar teste para meu celular" (send-push-fcm). O JWT do dono vai automaticamente; o servidor confere o salão. */
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

/** Vincula este aparelho (se inscrito no salão) ao agendamento: prova de posse = cancellation_token. Silencioso. */
export async function linkPushToAppointment(cancellationToken: string | null | undefined): Promise<boolean> {
  if (!cancellationToken || pushSupport() !== 'supported') return false;
  try {
    const k = await currentWebPush();
    if (!k) return false;
    const { data } = await rpc('link_web_push_appointment', { p_endpoint: k.endpoint, p_cancellation_token: cancellationToken });
    return data === true;
  } catch { return false; }
}

const safePath = (u: unknown) => (typeof u === 'string' && /^\/(?![/\\])/.test(u) ? u : null);
let foregroundBound = false;
let migration: Promise<void> | null = null;

/**
 * Migração automática (uma vez por abertura): permissão já concedida + token FCM antigo neste aparelho
 * → reinscreve via Web Push nos mesmos salões, sem novo pedido de permissão.
 */
function migrateLegacy(): Promise<void> {
  migration ??= (async () => {
    if (pushSupport() !== 'supported' || Notification.permission !== 'granted') return;
    const fcm = await legacyFcmToken();
    if (!fcm) return;
    const { data } = await rpc('push_legacy_salons', { p_fcm_token: fcm });
    const slugs = Array.isArray(data) ? data.filter((s): s is string => typeof s === 'string') : [];
    const k = slugs.length ? await ensureWebPush() : null;
    if (k) for (const slug of slugs) await register(slug, k);
    if (!slugs.length || k) forgetLegacyFcm();
  })().catch(() => undefined);
  return migration;
}

/**
 * Inscrição de push de UM salão (por slug). Registro/remoção só via RPC (a tabela não aceita escrita direta).
 * Sem slug: usa o salão do dono logado (inscrição fica com user_id do dono e recebe os avisos do salão).
 */
export const usePushNotificationsFCM = (providedSlug?: string) => {
  const [support] = useState<PushSupport>(() => pushSupport());
  const [permission, setPermission] = useState<NotificationPermission>(() => (support === 'supported' ? Notification.permission : 'default'));
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [marketing, setMarketing] = useState(true);
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

  // Abertura com permissão concedida: migra token antigo, confere a inscrição deste aparelho e re-registra se o
  // navegador trocou o endpoint/chaves (renovação). Nunca abre pedido de permissão.
  const refresh = useCallback(async () => {
    if (support !== 'supported' || !slug || Notification.permission !== 'granted') return;
    await migrateLegacy();
    const k = await currentWebPush();
    if (!k) { setIsSubscribed(false); return; }
    const { data } = await rpc('web_push_status', { p_salon_slug: slug, p_endpoint: k.endpoint });
    const st = (data ?? {}) as { subscribed?: boolean; marketing?: boolean };
    if (st.subscribed) await register(slug, k); // renova chaves/updated_at; idempotente
    setIsSubscribed(!!st.subscribed);
    setMarketing(st.marketing !== false);
  }, [support, slug]);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);

  // SW avisa: inscrição trocada (pushsubscriptionchange) → re-registra; push com app em foco → o SW NÃO mostrou
  // notificação do sistema e manda a mensagem para cá, que vira um toast (um único aviso).
  useEffect(() => {
    if (support !== 'supported' || !('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'af365-push-resubscribe' && slug && Notification.permission === 'granted') {
        ensureWebPush().then(k => k && register(slug, k)).catch(() => undefined);
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    if (!foregroundBound) {
      foregroundBound = true;
      navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
        if (e.data?.type !== 'af365-push') return;
        const p = e.data.payload ?? {};
        const url = safePath(p.url);
        toast.info(String(p.title || 'Nova notificação'), {
          id: `push:${p.kind}:${p.url}`, description: String(p.body || ''), duration: 8000,
          action: url ? { label: 'Ver', onClick: () => { window.location.href = url; } } : undefined,
        });
      });
    }
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [support, slug]);

  /** Só por gesto do usuário (botão): pede permissão, cria a inscrição e registra no salão. */
  const subscribe = useCallback(async (): Promise<SubscribeResult> => {
    if (support !== 'supported' || !slug) return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return 'denied';
      const k = await ensureWebPush();
      if (!k) return 'error';
      const { error } = await register(slug, k);
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
      const k = await currentWebPush();
      // Só sai deste salão: o mesmo aparelho pode estar inscrito em outros salões (mesma inscrição do navegador).
      if (k) await rpc('unregister_web_push', { p_salon_slug: slug, p_endpoint: k.endpoint });
      setIsSubscribed(false);
      return true;
    } catch {
      return false;
    }
  }, [slug]);

  /** Opt-out de campanhas do salão (lembretes do próprio horário continuam). */
  const setMarketingEnabled = useCallback(async (enabled: boolean): Promise<boolean> => {
    if (!slug) return false;
    const k = await currentWebPush();
    if (!k) return false;
    const { data, error } = await rpc('web_push_set_marketing', { p_salon_slug: slug, p_endpoint: k.endpoint, p_enabled: enabled });
    if (error || data !== true) return false;
    setMarketing(enabled);
    return true;
  }, [slug]);

  return { support, isSupported: support === 'supported', permission, isSubscribed, marketing, slug, subscribe, unsubscribe, setMarketingEnabled };
};
