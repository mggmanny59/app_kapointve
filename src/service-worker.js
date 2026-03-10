/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

// Precachear todos los assets generados por Vite
precacheAndRoute(self.__WB_MANIFEST);

// Limpiar caches antiguos
cleanupOutdatedCaches();

// Tomar control INMEDIATAMENTE — sin esperar recarga
self.skipWaiting();
clientsClaim();

// Permitir al cliente forzar activación del SW nuevo
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

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

    // Simplificamos radicalmente las opciones para que no haya crash de memoria o red
    // al intentar descargar iconos, lo cual hace que Chrome genere la alerta genérica
    const options = {
        body: body,
        data: { url: url }
    };

    // Promise.resolve explícito y try/catch manual
    event.waitUntil(
        self.registration.showNotification(title, options)
            .catch(err => {
                console.error('Error forced fallback showing notification:', err);
                return self.registration.showNotification('Alerta', { body: 'Mensaje' });
            })
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
