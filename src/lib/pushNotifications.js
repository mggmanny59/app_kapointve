import { supabase } from './supabase';

/**
 * Convierte una llave VAPID de base64 a un array de bytes (Uint8Array)
 * Requerido por el Service Worker para la suscripción.
 */
function urlBase64ToUint8Array(base64String) {
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

/**
 * Solicita permiso y suscribe al usuario a las notificaciones Push
 */
export async function subscribeUserToPush() {
    try {
        // 1. Verificar si Service Worker y Push están disponibles
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Las notificaciones Push no están soportadas en este navegador.');
            return null;
        }

        // 2. Obtener el registro del Service Worker
        const registration = await navigator.serviceWorker.ready;

        // 3. Solicitar permiso al usuario
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('El usuario denegó el permiso para notificaciones.');
            return null;
        }

        // 4. Suscribir al usuario con la llave pública VAPID
        const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });

        // 5. Guardar la suscripción en Supabase
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const subscriptionJSON = subscription.toJSON();

            // Buscar si ya existe la suscripción (usando el unique endpoint url o al menos evitando duplicados tontos)
            // Ya que no podemos hacer upsert fácilmente con JSONB en Supabase desde el cliente sin RPC
            const { data: existing } = await supabase
                .from('push_subscriptions')
                .select('id')
                .eq('profile_id', user.id)
                .eq('user_agent', navigator.userAgent)
                .limit(1);

            if (!existing || existing.length === 0) {
                const { error } = await supabase
                    .from('push_subscriptions')
                    .insert({
                        profile_id: user.id,
                        subscription: subscriptionJSON,
                        user_agent: navigator.userAgent
                    });

                if (error) {
                    console.error('Error saving push subscription to Supabase:', error);
                } else {
                    console.log('Suscripción Push guardada correctamente en Supabase.');
                }
            } else {
                // Ya existe al menos una suscripción para este dispositivo/navegador, la actualizamos para estar seguros
                const { error } = await supabase
                    .from('push_subscriptions')
                    .update({
                        subscription: subscriptionJSON
                    })
                    .eq('id', existing[0].id);

                if (error) {
                    console.error('Error updating push subscription in Supabase:', error);
                } else {
                    console.log('Suscripción Push actualizada correctamente en Supabase.');
                }
            }
            return subscription;
        }

        return null;
    } catch (error) {
        console.error('Error al suscribir a notificaciones Push:', error);
        return null;
    }
}

/**
 * Llama a la Edge Function para enviar una notificación push a un perfil específico
 */
export async function sendPushToProfile({ profileId, title, message, url = '/dashboard' }) {
    try {
        const { data, error } = await supabase.functions.invoke('send-push', {
            body: {
                profile_id: profileId,
                title,
                message,
                url
            }
        });

        if (error) throw error;

        if (data && data.success === false) {
            return { success: false, error: data.message || 'Error desconocido' };
        }

        return data;
    } catch (error) {
        console.error('Error enviando notificación push:', error);
        return { success: false, error: error.message };
    }
}
