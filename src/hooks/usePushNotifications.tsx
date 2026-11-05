import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { registerAppServiceWorker } from '@/lib/serviceWorker';

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission | 'default';
  isSubscribed: boolean;
}

const VAPID_PUBLIC_KEY = 'BAh0lgyspDAu3SAygLbdW7adBllZsgR2YiXfQZLUSzEZ5NeJkCZtUNYiTKcso9uJ8uDm4Nk8nq-a1XZlPbDri34';

// Registrar Service Worker customizado para push
async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker não suportado');
    return null;
  }

  try {
    // Produção: reutiliza o worker único /sw.js (não substitui o precache). Dev: sw-push.js.
    const registration = await registerAppServiceWorker('/sw-push.js');
    console.log('✅ Service Worker pronto:', registration?.scope);
    return registration;
  } catch (error) {
    console.error('❌ Erro ao registrar Service Worker:', error);
    return null;
  }
}

export const usePushNotifications = (salonId?: string, clientId?: string) => {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: 'default',
    isSubscribed: false,
  });

  useEffect(() => {
    // Check if push notifications are supported
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : 'default',
    }));

    if (isSupported) {
      // Registrar SW customizado e verificar subscription
      registerPushServiceWorker().then(() => {
        checkSubscription();
      });
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setState(prev => ({ ...prev, isSubscribed: !!subscription }));
    } catch (error) {
      console.error('Error checking push subscription:', error);
    }
  };

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      console.warn('Push notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [state.isSupported]);

  // Salvar subscription existente quando salonId ficar disponível
  useEffect(() => {
    const saveExistingSubscription = async () => {
      if (!salonId || !state.isSupported) {
        console.log('Push: salonId ou isSupported não disponível', { salonId, isSupported: state.isSupported });
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        console.log('Push: Subscription encontrada?', !!subscription);

        if (subscription) {
          const subscriptionJson = subscription.toJSON();
          const keys = subscriptionJson.keys as { p256dh: string; auth: string };

          console.log('Push: Tentando salvar subscription no banco para salon:', salonId);
          console.log('Push: Endpoint:', subscription.endpoint.substring(0, 50) + '...');

          // Usar any para evitar erro de tipos
          const { data, error } = await (supabase as any).from('push_subscriptions').upsert({
            salon_id: salonId,
            client_id: clientId || null,
            endpoint: subscription.endpoint,
            p256dh: keys?.p256dh || '',
            auth: keys?.auth || '',
            device_info: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
            },
            is_active: true,
          }, {
            onConflict: 'endpoint'
          });

          if (!error) {
            console.log('✅ Push subscription salva no banco!', data);
          } else {
            console.error('❌ Erro ao salvar subscription:', error);
          }
        } else {
          console.log('Push: Nenhuma subscription ativa no navegador');
        }
      } catch (error) {
        console.error('❌ Erro geral ao salvar subscription:', error);
      }
    };

    saveExistingSubscription();
  }, [salonId, state.isSupported, clientId]);

  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    if (!state.isSupported) {
      console.warn('Push notifications not supported');
      return null;
    }

    console.log('🔔 Subscribe iniciado, salonId:', salonId);

    try {
      // Primeiro registrar o SW customizado
      await registerPushServiceWorker();

      const permission = await requestPermission();
      if (!permission) {
        console.log('❌ Permissão negada');
        return null;
      }

      console.log('✅ Permissão concedida');

      const registration = await navigator.serviceWorker.ready;
      console.log('✅ Service Worker pronto:', registration.active?.scriptURL);

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      });

      console.log('✅ Push subscription criada:', subscription.endpoint.substring(0, 50));

      // Save subscription to database for cross-device push
      if (subscription) {
        const subscriptionJson = subscription.toJSON();
        const keys = subscriptionJson.keys as { p256dh: string; auth: string };

        console.log('💾 Salvando subscription no banco...');
        console.log('   salon_id:', salonId || 'NÃO DEFINIDO');

        const { data, error } = await (supabase as any).from('push_subscriptions').upsert({
          salon_id: salonId || null,
          client_id: clientId || null,
          endpoint: subscription.endpoint,
          p256dh: keys?.p256dh || '',
          auth: keys?.auth || '',
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
          },
          is_active: true,
        }, {
          onConflict: 'endpoint'
        });

        if (error) {
          console.error('❌ Erro ao salvar subscription:', error);
        } else {
          console.log('✅ Push subscription salva no banco!', data);
        }
      }

      setState(prev => ({ ...prev, isSubscribed: true }));

      return subscription;
    } catch (error) {
      console.error('❌ Error subscribing to push:', error);
      return null;
    }
  }, [state.isSupported, requestPermission, salonId, clientId]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        setState(prev => ({ ...prev, isSubscribed: false }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      return false;
    }
  }, []);

  // Show a local notification (for testing or local reminders)
  const showNotification = useCallback(async (title: string, options?: NotificationOptions): Promise<boolean> => {
    if (!state.isSupported || state.permission !== 'granted') {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        ...options,
      });
      return true;
    } catch (error) {
      console.error('Error showing notification:', error);
      return false;
    }
  }, [state.isSupported, state.permission]);

  // Schedule a reminder notification
  const scheduleReminder = useCallback((
    title: string,
    body: string,
    scheduledTime: Date,
    data?: Record<string, any>
  ): NodeJS.Timeout | null => {
    const now = new Date();
    const delay = scheduledTime.getTime() - now.getTime();

    if (delay <= 0) {
      console.warn('Scheduled time is in the past');
      return null;
    }

    const timeoutId = setTimeout(() => {
      showNotification(title, {
        body,
        data,
        tag: `reminder-${Date.now()}`,
        requireInteraction: true,
      });
    }, delay);

    return timeoutId;
  }, [showNotification]);

  return {
    ...state,
    requestPermission,
    subscribe,
    unsubscribe,
    showNotification,
    scheduleReminder,
  };
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
