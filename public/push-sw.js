// Handlers de Web Push do worker único (sem Firebase). Em produção é importado pelo /sw.js (VitePWA/Workbox,
// importScripts); em desenvolvimento é registrado direto (ver src/lib/serviceWorker.ts).
// O servidor envia JSON cifrado (RFC 8291): { title, body, url, icon, tag, kind, salon }.

const DEFAULT_ICON = '/pwa-192x192.png';
const STORAGE_PREFIX = 'https://ocbwsaydgkiseeardjga.supabase.co/storage/v1/object/public/';

// Só caminho relativo do próprio site ("/x"; nunca "//", "\\", esquema ou "..").
function safePath(value, fallback) {
  if (typeof value !== 'string' || value.length > 500 || !/^\/(?![/\\])[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/.test(value)) return fallback;
  if (value.split(/[?#]/)[0].split('/').some((s) => s === '..' || s === '.')) return fallback;
  return value;
}
function safeIcon(value) {
  return typeof value === 'string' && value.startsWith(STORAGE_PREFIX) && /\.(png|jpe?g|webp)$/i.test(value.split('?')[0]) ? value : DEFAULT_ICON;
}
const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? text(event.data.text(), 300) : '' }; }
  const salon = typeof data.salon === 'string' && /^[a-z0-9-]{1,200}$/.test(data.salon) ? data.salon : '';
  const url = safePath(data.url, salon ? '/s/' + salon : '/');
  const payload = { title: text(data.title, 100) || 'Agenda Fácil 365', body: text(data.body, 300), url, kind: text(data.kind, 40) };

  // App aberto e em foco (fora do Safari): só o aviso dentro do app (toast), sem notificação do sistema duplicada.
  // Safari/iOS exigem notificação visível a cada push (senão revogam a inscrição): lá sempre mostra e o app não faz toast.
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const focused = windows.find((c) => c.focused && c.visibilityState === 'visible');
    const sub = await self.registration.pushManager.getSubscription().catch(() => null);
    const apple = !!(sub && /\.apple\.com$/.test(new URL(sub.endpoint).hostname));
    if (focused && !apple) {
      focused.postMessage({ type: 'af365-push', payload });
      return;
    }
    await self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: safeIcon(data.icon),
      badge: DEFAULT_ICON,
      tag: text(data.tag, 80) || (payload.kind || 'push') + ':' + salon,
      renotify: true,
      data: { url },
    });
  })());
});

// Clique: abre/foca a janela no caminho relativo validado. Prefere uma janela do mesmo app do salão (/s/:slug)
// ou do painel (/admin) já aberta; senão abre uma nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = safePath(event.notification.data && event.notification.data.url, '/');
  const target = new URL(path, self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const prefix = (path.match(/^\/(s\/[^/?#]+|admin)/) || [])[0];
    const same = windows.find((c) => prefix && new URL(c.url).pathname.startsWith(prefix)) || windows.find((c) => c.url.startsWith(self.location.origin));
    if (same && 'navigate' in same) {
      const focused = await same.focus();
      return (focused || same).navigate(target).catch(() => self.clients.openWindow(target));
    }
    return self.clients.openWindow(target);
  })());
});

// Navegador trocou a inscrição (expiração/rotação): avisa as janelas abertas para re-registrar no servidor.
// Sem janela aberta, o app re-registra na próxima abertura (usePushNotifications confere a inscrição ao montar).
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((windows) => windows.forEach((c) => c.postMessage({ type: 'af365-push-resubscribe' }))));
});
