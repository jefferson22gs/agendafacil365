// Firebase Messaging Service Worker
// Este arquivo DEVE estar na pasta public e se chamar firebase-messaging-sw.js

// Importado pelo /sw.js (Workbox) em produção. Se o gstatic falhar (rede/bloqueador), NÃO pode lançar:
// um erro aqui derrubaria a instalação do worker inteiro (precache/offline). Sem Firebase, só o push fica indisponível.
let firebaseReady = false;
try {
    importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
    firebaseReady = typeof firebase !== 'undefined';
} catch (e) {
    console.warn('Firebase Messaging indisponível neste worker:', e);
}

if (firebaseReady) {
// Firebase config
firebase.initializeApp({
    apiKey: "AIzaSyBigBQRToUU6VCdouRynVx9kPJ65-uROEw",
    authDomain: "belezatech-infinite.firebaseapp.com",
    projectId: "belezatech-infinite",
    storageBucket: "belezatech-infinite.firebasestorage.app",
    messagingSenderId: "133324833961",
    appId: "1:133324833961:web:2d0792f0e4d72b127495b8"
});

const messaging = firebase.messaging();

// Listener para mensagens em background
messaging.onBackgroundMessage((payload) => {
    console.log('📱 Mensagem recebida em background:', payload);
    // Payload com 'notification' já é exibido pelo próprio SDK; exibir de novo duplicava a notificação.
    if (payload.notification) return;

    const notificationTitle = payload.notification?.title || payload.data?.title || 'Agenda Fácil 365';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'Você tem uma nova notificação!',
        icon: payload.notification?.icon || '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        vibrate: [200, 100, 200],
        data: {
            ...payload.data,
            // Garantir que URL está disponível para o clique
            url: payload.data?.url || payload.fcmOptions?.link || '/admin/marketing',
            title: notificationTitle,
            body: payload.notification?.body || payload.data?.body
        },
        actions: [
            { action: 'open', title: '🔔 Abrir' },
            { action: 'close', title: '❌ Fechar' }
        ],
        tag: 'syshair-fcm-' + Date.now(),
        renotify: true,
        requireInteraction: true
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});
} // fim do bloco firebaseReady

// Listener para clique na notificação (independe do Firebase)
self.addEventListener('notificationclick', (event) => {
    console.log('🖱️ Notificação FCM clicada:', event);
    console.log('   Action:', event.action);
    console.log('   Data:', event.notification.data);

    event.notification.close();

    if (event.action === 'close') return;

    // URL para abrir - padrão para admin/marketing para notificações de marketing
    let urlToOpen = '/admin/marketing';

    if (event.notification.data) {
        if (event.notification.data.url) {
            urlToOpen = event.notification.data.url;
        } else if (event.notification.data.appointment_id) {
            urlToOpen = '/avaliar/' + event.notification.data.appointment_id;
        } else if (event.notification.data.type === 'marketing') {
            urlToOpen = '/admin/marketing';
        }
    }

    const fullUrl = new URL(urlToOpen, self.location.origin).href;
    console.log('   Abrindo URL:', fullUrl);

    // Tentar focar em janela existente antes de abrir uma nova
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                // Procurar janela existente com a mesma origem
                for (let client of windowClients) {
                    if (client.url.startsWith(self.location.origin) && 'focus' in client) {
                        console.log('   Focando janela existente:', client.url);
                        return client.focus().then((focusedClient) => {
                            // Navegar para a URL se a janela foi focada
                            if (focusedClient && 'navigate' in focusedClient) {
                                return focusedClient.navigate(fullUrl);
                            }
                        });
                    }
                }
                // Se não encontrou janela existente, abrir nova
                console.log('   Abrindo nova janela');
                return clients.openWindow(fullUrl);
            })
            .catch(err => {
                console.error('Erro ao abrir/focar janela:', err);
                // Fallback: abrir nova janela
                return clients.openWindow(fullUrl);
            })
    );
});

// (removido) listener "push" manual: duplicava o onBackgroundMessage do SDK para payloads só-data.

console.log('✅ Firebase Messaging Service Worker carregado');
