// Handlers de push do worker único. Em produção é importado pelo /sw.js (VitePWA/Workbox, importScripts);
// em desenvolvimento é registrado direto (ver src/lib/serviceWorker.ts).

// Se o gstatic falhar (rede/bloqueador), NÃO pode lançar: um erro aqui derrubaria a instalação do worker inteiro
// (precache/offline). Sem Firebase, só o push fica indisponível.
let firebaseReady = false;
try {
    importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
    firebaseReady = typeof firebase !== 'undefined';
} catch (e) {
    console.warn('Firebase Messaging indisponível neste worker');
}

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

if (firebaseReady) {
    firebase.initializeApp({
        apiKey: "AIzaSyBigBQRToUU6VCdouRynVx9kPJ65-uROEw",
        authDomain: "belezatech-infinite.firebaseapp.com",
        projectId: "belezatech-infinite",
        storageBucket: "belezatech-infinite.firebasestorage.app",
        messagingSenderId: "133324833961",
        appId: "1:133324833961:web:2d0792f0e4d72b127495b8"
    });

    // O servidor envia mensagens só com `data`: a notificação é montada aqui, com título/ícone do salão.
    firebase.messaging().onBackgroundMessage((payload) => {
        if (payload.notification) return; // mensagens antigas com `notification` já são exibidas pelo SDK
        const data = payload.data || {};
        const salonHome = data.salon && /^[a-z0-9-]{1,200}$/i.test(data.salon) ? '/s/' + data.salon : '/';
        const title = (data.title || 'Agenda Fácil 365').slice(0, 100);
        return self.registration.showNotification(title, {
            body: (data.body || '').slice(0, 300),
            icon: safeIcon(data.icon),
            badge: DEFAULT_ICON,
            tag: (data.type || 'push') + ':' + (data.salon || ''),
            renotify: true,
            data: { url: safePath(data.url, salonHome) },
        });
    });
}

// Clique: abre/foca a janela no caminho relativo validado (dentro do scope do app do salão quando for /s/:slug;
// /avaliar e /admin abrem no navegador/app da plataforma, sem sair do mesmo site).
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const path = safePath(event.notification.data && event.notification.data.url, '/');
    const target = new URL(path, self.location.origin).href;
    event.waitUntil((async () => {
        const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        // Prefere uma janela já aberta no mesmo app (mesmo prefixo /s/:slug), senão qualquer janela do site.
        const prefix = path.match(/^\/s\/[^/?#]+/)?.[0];
        const same = windows.find((c) => prefix && new URL(c.url).pathname.startsWith(prefix)) || windows.find((c) => c.url.startsWith(self.location.origin));
        if (same && 'navigate' in same) {
            const focused = await same.focus();
            return (focused || same).navigate(target).catch(() => clients.openWindow(target));
        }
        return clients.openWindow(target);
    })());
});
