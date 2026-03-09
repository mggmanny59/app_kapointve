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

        // 4. Suscribir al usuario con la llave pública VAPID
        // CRITICO: Debe coincidir EXACTAMENTE con VAPID_PUBLIC_KEY en Supabase Secrets
        const publicVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
            || 'BC7FEWmQBL4JBDPtoiNZQbo7RPR1FmeckBJCO-qlFM4zbmyDrxd_1a3MbkjDpoZz0dV2Rj_PLUU_ylf-uTj588s';

        if (!publicVapidKey) {
            throw new Error('Falta VITE_VAPID_PUBLIC_KEY en las variables de entorno de Vercel.');
        }

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        });

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
