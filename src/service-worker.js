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
    if (!event.data) {
        console.log('Evento push recibido sin datos.');
        return;
    }

    try {
        const data = event.data.json();
        const title = data.title || 'KPoint';
        const options = {
            body: data.message || 'Tienes una nueva notificación',
            icon: '/pwa-192x192.png',
            badge: '/vite.svg', // Icono pequeño para la barra de estado
            data: {
                url: data.url || '/'
            },
            vibrate: [100, 50, 100],
            actions: [
                { action: 'open', title: 'Ver ahora' },
                { action: 'close', title: 'Cerrar' }
            ]
        };

        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    } catch (error) {
        console.error('Error al procesar notificación push:', error);
    }
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
