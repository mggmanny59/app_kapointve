import { supabase } from './supabase';

const PUBLIC_VAPID_KEY = 'BNjZVD5xzxwgxiZ4jzMRSglRAJLzwT4pL16fhd4_0S81jFvBi4rwhIyxqPBj9__XhIeJwTHNc8w8VWLIYsTE7hw';

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
 * Auto-Heal: Verifica silenciosamente si la suscripción actual coincide con la llave VAPID
 * y la renueva automáticamente en segundo plano.
 */
export async function verifyAndRepairPushSubscription() {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return true; // Ignorar si no soporta Push
        if (Notification.permission !== 'granted') return false; // Si no hay permiso, devolvemos false para mostrar el banner

        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.getSubscription();
        
        if (!sub) {
            console.warn('[Push Auto-Heal] Permiso concedido pero sin suscripción activa tras limpieza de datos. Restaurando silenciomente...');
            await subscribeUserToPush();
            return true;
        }
        
        // Comprobar si es legacy (Google FCM viejo)
        const isLegacy = sub.endpoint.includes('fcm.googleapis.com/fcm/send/');
        
        // Comprobar si las llaves VAPID coinciden comparando buffers (muy complejo en JS),
        // Alternativa práctica: forzar la renovación si NO sabemos si tienen la llave actual
        // Lo que haremos es simplemente comparar si la suscripción está registrada correctamente y 
        // si falla renovamos todo silenciósamente.
        
        // Dado que ayer cambiamos la llave, renovaremos a los que tengan cualquier inconsistencia.
        // Simulando revisión de llave mediante re-suscripción segura:
        let isCorrectKey = true;
        try {
            const options = sub.options;
            if (options && options.applicationServerKey) {
                const currentKeyArray = new Uint8Array(options.applicationServerKey);
                const targetKeyArray = urlBase64ToUint8Array(PUBLIC_VAPID_KEY);
                // Comparación simple de los primeros bytes
                if (currentKeyArray.length !== targetKeyArray.length || currentKeyArray[0] !== targetKeyArray[0] || currentKeyArray[currentKeyArray.length - 1] !== targetKeyArray[targetKeyArray.length - 1]) {
                    isCorrectKey = false;
                }
            } else {
                isCorrectKey = false;
            }
        } catch(e) { isCorrectKey = false; }

        if (isLegacy || !isCorrectKey) {
            console.warn('[Push Auto-Heal] Suscripción antigua/desactualizada detectada. Reparando silenciosamente...');
            await subscribeUserToPush(); // Esto desuscribe y suscribe con la nueva llave
            return true;
        }

        return true; // Suscripción moderna y correcta activa
    } catch (e) {
        console.error('[Push Auto-Heal] Error durante la reparación:', e);
        return false;
    }
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

        // 4. Suscribir al usuario con la llave pública VAPID (HARDCODED PARA ESTA VERSIÓN)
        const publicVapidKey = 'BNjZVD5xzxwgxiZ4jzMRSglRAJLzwT4pL16fhd4_0S81jFvBi4rwhIyxqPBj9__XhIeJwTHNc8w8VWLIYsTE7hw';
        
        console.log('[Push] Usando llave pública para suscripción:', publicVapidKey);

        let subscription;
        try {
            const existingSub = await registration.pushManager.getSubscription();

            if (existingSub) {
                console.warn('[Push] Suscripción existente detectada. Forzando renovación para asegurar sincronización con nueva llave...');
                await existingSub.unsubscribe();
            }
            
            console.log('[Push] Creando nueva suscripción definitiva...');
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
            });
            console.log('[Push] Suscripción generada con éxito:', subscription.endpoint);
        } catch (subError) {
            console.error('[Push] Error en pushManager.subscribe:', subError);
            throw subError;
        }

        // 5. Guardar/Sincronizar la suscripción en Supabase usando el endpoint como clave única
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const subscriptionJSON = subscription.toJSON();
            console.log('[Push] Guardando llave en DB para:', user.id);

            // Intentar insertar la nueva llave. Si ya existe, Supabase simplemente 
            // dará un error que manejaremos suavemente.
            const { error } = await supabase
                .from('push_subscriptions')
                .insert({
                    profile_id: user.id,
                    subscription: subscriptionJSON,
                    user_agent: navigator.userAgent
                });

            if (error) {
                // Si el error es por duplicado, intentamos actualizar la existente
                if (error.code === '23505') {
                   await supabase
                        .from('push_subscriptions')
                        .update({ 
                            subscription: subscriptionJSON,
                            updated_at: new Date().toISOString()
                        })
                        .eq('profile_id', user.id)
                        .eq('user_agent', navigator.userAgent);
                } else {
                    console.error('[Push] Error en guardado:', error.message);
                    throw error;
                }
            }

            console.log('[Push] ¡Suscripción sincronizada!');
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
export async function sendPushToProfile({ profileId, title, message, url = '/dashboard', icon = null, image = null }) {
    try {
        const { data, error } = await supabase.functions.invoke('send-push', {
            body: {
                profile_id: profileId,
                title,
                message,
                url,
                icon,
                image
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
