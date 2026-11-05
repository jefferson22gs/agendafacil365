import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { requestFCMToken, onForegroundMessage } from '@/lib/firebase';
import { toast } from 'sonner';

interface PushNotificationState {
    isSupported: boolean;
    permission: NotificationPermission | 'default';
    isSubscribed: boolean;
    fcmToken: string | null;
}

export const usePushNotificationsFCM = (providedSalonId?: string, clientId?: string) => {
    const [state, setState] = useState<PushNotificationState>({
        isSupported: false,
        permission: 'default',
        isSubscribed: false,
        fcmToken: null,
    });
    const [autoSalonId, setAutoSalonId] = useState<string | null>(null);

    // Use provided salonId, or auto-detected one
    const salonId = providedSalonId || autoSalonId;

    // Auto-detect salonId from logged-in user's salon
    useEffect(() => {
        const fetchUserSalon = async () => {
            if (providedSalonId) return; // Already have salonId

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    console.log('🔔 FCM: No user logged in, skipping auto-salon detection');
                    return;
                }

                // Try to get salon owned by user
                const { data: salon } = await supabase
                    .from('salons')
                    .select('id')
                    .eq('owner_id', user.id)
                    .maybeSingle();

                if (salon) {
                    console.log('🔔 FCM: Auto-detected salon:', salon.id);
                    setAutoSalonId(salon.id);
                } else {
                    console.log('🔔 FCM: User has no salon');
                }
            } catch (err) {
                console.error('🔔 FCM: Error fetching user salon:', err);
            }
        };

        fetchUserSalon();
    }, [providedSalonId]);

    useEffect(() => {
        // Check if push notifications are supported
        const isSupported = import.meta.env.MODE !== 'demo' && 'Notification' in window && 'serviceWorker' in navigator;

        setState(prev => ({
            ...prev,
            isSupported,
            permission: isSupported ? Notification.permission : 'default',
        }));

        // Configurar listener para mensagens em foreground
        if (isSupported) {
            onForegroundMessage((payload) => {
                console.log('📱 Mensagem FCM em foreground:', payload);

                const title = payload.notification?.title || payload.data?.title || 'Nova notificação';
                const body = payload.notification?.body || payload.data?.body || '';

                // Mostrar toast
                toast.info(title, {
                    description: body,
                    duration: 10000, // 10 segundos
                    action: {
                        label: 'Ver',
                        onClick: () => {
                            const url = payload.data?.url || payload.fcmOptions?.link || '/admin/marketing';
                            window.location.href = url;
                        }
                    }
                });

                // Também mostrar notificação nativa do sistema (se permitido)
                if (Notification.permission === 'granted') {
                    const notification = new Notification(title, {
                        body: body,
                        icon: '/pwa-192x192.png',
                        badge: '/pwa-192x192.png',
                        tag: 'syshair-foreground-' + Date.now(),
                        requireInteraction: true,
                        data: payload.data
                    });

                    notification.onclick = () => {
                        notification.close();
                        window.focus();
                        const url = payload.data?.url || '/admin/marketing';
                        window.location.href = url;
                    };
                }
            });
        }
    }, []);

    // Salvar FCM token quando salonId ficar disponível
    useEffect(() => {
        const checkExistingToken = async () => {
            if (!salonId || !state.isSupported) return;

            // Verificar se já tem permissão e token salvo
            if (Notification.permission === 'granted') {
                try {
                    const token = await requestFCMToken();
                    if (token) {
                        setState(prev => ({ ...prev, fcmToken: token, isSubscribed: true }));
                        await saveTokenToDatabase(token);
                    }
                } catch (err) {
                    console.error('Erro ao obter FCM token:', err);
                }
            }
        };

        checkExistingToken();
    }, [salonId, state.isSupported]);

    const saveTokenToDatabase = async (token: string) => {
        if (!salonId || !token) return;

        try {
            // Verificar se já existe uma subscription com este token
            const { data: existing } = await supabase
                .from('push_subscriptions')
                .select('id')
                .eq('fcm_token', token)
                .eq('salon_id', salonId)
                .maybeSingle();

            if (existing) {
                // Atualizar existente
                await supabase
                    .from('push_subscriptions')
                    .update({
                        is_active: true,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);
                console.log('✅ FCM token atualizado no banco');
            } else {
                // Criar nova subscription
                await supabase
                    .from('push_subscriptions')
                    .insert({
                        salon_id: salonId,
                        client_id: clientId || null,
                        endpoint: `fcm:${token.substring(0, 50)}`, // Usar prefixo fcm: para identificar
                        fcm_token: token,
                        p256dh: null,
                        auth: null,
                        is_active: true,
                    });
                console.log('✅ FCM token salvo no banco');
            }
        } catch (error) {
            console.error('❌ Erro ao salvar FCM token:', error);
        }
    };

    const subscribe = useCallback(async (): Promise<boolean> => {
        if (!state.isSupported) {
            console.warn('Push notifications not supported');
            return false;
        }

        try {
            // Solicitar permissão
            const permission = await Notification.requestPermission();
            setState(prev => ({ ...prev, permission }));

            if (permission !== 'granted') {
                console.log('Permissão negada');
                return false;
            }

            // Obter FCM token
            const token = await requestFCMToken();
            if (!token) {
                console.error('Falha ao obter FCM token');
                return false;
            }

            setState(prev => ({ ...prev, fcmToken: token, isSubscribed: true }));

            // Salvar no banco
            if (salonId) {
                await saveTokenToDatabase(token);
            }

            console.log('✅ Push notification FCM habilitada!');
            return true;
        } catch (error) {
            console.error('Error subscribing to push:', error);
            return false;
        }
    }, [state.isSupported, salonId, clientId]);

    const unsubscribe = useCallback(async (): Promise<boolean> => {
        try {
            if (state.fcmToken && salonId) {
                // Desativar no banco
                await supabase
                    .from('push_subscriptions')
                    .update({ is_active: false })
                    .eq('fcm_token', state.fcmToken)
                    .eq('salon_id', salonId);
            }

            setState(prev => ({ ...prev, isSubscribed: false, fcmToken: null }));
            return true;
        } catch (error) {
            console.error('Error unsubscribing:', error);
            return false;
        }
    }, [state.fcmToken, salonId]);

    return {
        ...state,
        subscribe,
        unsubscribe,
        requestPermission: subscribe, // Alias para compatibilidade
    };
};
