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
    let title = 'KPoint Notification';
    let body = 'Tienes un nuevo mensaje en la plataforma.';
    let urlToOpen = '/';

    if (event.data) {
        try {
            const data = event.data.json();
            title = data.title || title;
            body = data.message || body;
            urlToOpen = data.url || urlToOpen;
        } catch (err) {
            console.error('Error parseando push data', err);
        }
    }

    // Ping de diagnóstico a Supabase (para saber si el celular despertó)
    fetch('https://gtxzmkmwjclwppnkiifi.supabase.co/rest/v1/push_subscriptions?select=id&limit=1', {
        headers: {
            'apikey': 'sb_publishable_v_ZfK2QvTQmliN5WlD9_NA_nER5um_T'
        }
    }).catch(() => { });

    const options = {
        body: body + ' (' + new Date().toLocaleTimeString() + ')',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        vibrate: [500, 250, 500, 250, 500, 250, 500], // Patrón largo e imposible de ignorar
        requireInteraction: true, // Fuerza a la notificación a quedarse en pantalla y no irse al fondo
        data: { url: urlToOpen }
    };

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
