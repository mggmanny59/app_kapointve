/**
 * Utilidad para forzar la actualización de la PWA SIN destruir la suscripción push.
 * IMPORTANTE: NO desregistrar el service worker — eso elimina la suscripción push.
 */
export const forceAppUpdate = async () => {
    try {
        // 1. Pedir al SW activo que se actualice (sin desregistrar)
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.update(); // Busca nueva versión sin destruir la suscripción

            // Enviar mensaje al SW para activar la nueva versión inmediatamente
            if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        }

        // 2. Limpiar solo caches de contenido (NO el de precache del SW)
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames
                    .filter(name => !name.includes('workbox') && !name.includes('precache'))
                    .map(cacheName => caches.delete(cacheName))
            );
        }

        // 3. Recargar para aplicar cambios
        window.location.reload();
    } catch (error) {
        console.error('Error al forzar actualización:', error);
        window.location.reload();
    }
};
