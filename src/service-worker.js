/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

// Precachear todos los assets generados por Vite
precacheAndRoute(self.__WB_MANIFEST);

// Limpiar caches antiguos
cleanupOutdatedCaches();

// Permitir que el SW tome control inmediatamente
self.skipWaiting();
clientsClaim();

/**
 * Escuchador para eventos Push
 */
self.addEventListener('push', (event) => {
    let title = '🎉 KPoint';
    let body = 'Tienes una nueva notificación';
    let url = '/';

    try {
        if (event.data) {
            const data = event.data.json();
            title = data.title || title;
            body = data.message || body;
            url = data.url || url;
        }
    } catch (error) {
        console.error('[SW] Error al parsear push data:', error);
        // Continúa con valores por defecto — no interrumpir la notificación
    }

    const options = {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: { url },
        vibrate: [200, 100, 200],
        requireInteraction: false,
        actions: [
            { action: 'open', title: 'Ver ahora' },
            { action: 'close', title: 'Cerrar' }
        ]
    };

    // SIEMPRE mostrar la notificación — nunca dejar que Chrome muestre el genérico
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

/**
 * Escuchador para clicks en la notificación
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'close') return;

    // Abrir la URL especificada en los datos de la notificación
    const urlToOpen = event.notification.data.url;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Si ya hay una ventana abierta, enfocarla
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // Si no hay ventana abierta, abrir una nueva
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }
        })
    );
});
