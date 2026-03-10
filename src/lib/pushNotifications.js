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
        if (!('serviceWorker' in navigator)) {
            throw new Error('Navegador: Service Worker no soportado.');
        }
        if (!('PushManager' in window)) {
            throw new Error('Navegador: PushManager no soportado.');
        }

        // 2. Obtener el registro del Service Worker
        const registration = await navigator.serviceWorker.ready;
        if (!registration) {
            throw new Error('Service Worker: No está listo para registro.');
        }

        // 3. Solicitar permiso al usuario
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Permiso denegado por el usuario.');
        }

        // 4. Suscribir al usuario con la nueva llave pública VAPID fija
        const publicVapidKey = 'BIoF916LzTZ5Wb_keed4lC0-8QlIHoU9p-w5VX2fvgl4iyia8XwR_EZ1fsm6BsEzHeeeAaI8C_qwXUJ197d3gSg';


        let subscription;
        try {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });
        } catch (subError) {
            console.warn('Error al suscribir. Posible cambio de VAPID key. Intentando renovar...', subError);
            const existingSub = await registration.pushManager.getSubscription();
            if (existingSub) {
                await existingSub.unsubscribe();
            }
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });
        }

        // 5. Guardar la suscripción en Supabase
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const subscriptionJSON = subscription.toJSON();

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

                if (error) throw new Error(`DB Error: ${error.message}`);
                console.log('Suscripción Push guardada correctamente.');
            } else {
                const { error } = await supabase
                    .from('push_subscriptions')
                    .update({ subscription: subscriptionJSON })
                    .eq('id', existing[0].id);

                if (error) throw new Error(`DB Update Error: ${error.message}`);
                console.log('Suscripción Push actualizada correctamente.');
            }
            return subscription;
        }

        return null;
    } catch (error) {
        console.error('Error detallado de suscripción:', error);
        throw error; // Lanzar para que Home.jsx o MyPoints.jsx atrapen el mensaje
    }
}

/**
 * Desuscribe al usuario de las notificaciones Push
 */
export async function unsubscribeUserFromPush() {
    try {
        if (!('serviceWorker' in navigator)) return false;

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();

            // Borrar de supabase
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('profile_id', user.id)
                    .eq('user_agent', navigator.userAgent);
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error al desuscribir:', error);
        return false;
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
