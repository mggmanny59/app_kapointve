/**
 * Utilidad para forzar la actualización de la PWA y limpiar el cache del navegador.
 * Útil para dispositivos móviles donde el Service Worker es muy agresivo.
 */
export const forceAppUpdate = async () => {
    try {
        // 1. Desregistrar todos los Service Workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
        }

        // 2. Limpiar Caches de la Web
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
        }

        // 3. Forzar el recargo de la página desde el servidor
        window.location.reload(true);
    } catch (error) {
        console.error('Error al forzar actualización:', error);
        window.location.reload();
    }
};
