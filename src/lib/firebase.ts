// Firebase Configuration for Push Notifications
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { registerAppServiceWorker } from "./serviceWorker";

// Firebase config from console
const firebaseConfig = {
    apiKey: "AIzaSyBigBQRToUU6VCdouRynVx9kPJ65-uROEw",
    authDomain: "belezatech-infinite.firebaseapp.com",
    projectId: "belezatech-infinite",
    storageBucket: "belezatech-infinite.firebasestorage.app",
    messagingSenderId: "133324833961",
    appId: "1:133324833961:web:2d0792f0e4d72b127495b8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// VAPID Key from Firebase Console -> Cloud Messaging -> Web Push certificates
// Este é o par de chaves que você gerou
const VAPID_KEY = "BDLsAZE5PmmKqGBPR2nV19ODc-dl59rerNCMKqc06CVxt9vdH564mXyWKe7lHAoMOC9kw_8gBu_x1ueOPLfxUmY";

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

// Get messaging instance (only in browser that supports it)
export const getMessagingInstance = async () => {
    if (messagingInstance) return messagingInstance;

    const supported = await isSupported();
    if (!supported) {
        console.log("Firebase Messaging não é suportado neste navegador");
        return null;
    }

    messagingInstance = getMessaging(app);
    return messagingInstance;
};

async function pushRegistration(): Promise<ServiceWorkerRegistration | undefined> {
    try {
        // Produção: worker único /sw.js (já importa os handlers FCM). Dev: worker do Firebase.
        return (await registerAppServiceWorker('/firebase-messaging-sw.js')) ?? undefined;
    } catch {
        return undefined;
    }
}

/** Token FCM deste aparelho. A permissão já deve ter sido concedida (o hook pede antes, no clique). */
export const requestFCMToken = async (): Promise<string | null> => {
    try {
        if (!('Notification' in window) || Notification.permission !== 'granted') return null;
        const messaging = await getMessagingInstance();
        if (!messaging) return null;
        return (await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: await pushRegistration() })) || null;
    } catch (error) {
        console.warn('Não foi possível obter o token de notificação');
        return null;
    }
};

/** Mesmo token, sem nunca abrir o pedido de permissão. */
export const currentFCMToken = requestFCMToken;

// Listen for foreground messages
export const onForegroundMessage = (callback: (payload: any) => void) => {
    getMessagingInstance().then(messaging => {
        if (messaging) {
            onMessage(messaging, (payload) => {
                console.log("Mensagem recebida em foreground:", payload);
                callback(payload);
            });
        }
    });
};

export { app };
