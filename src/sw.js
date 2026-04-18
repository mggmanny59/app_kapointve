import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { clientsClaim } from 'workbox-core';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

// === VERSIÓN DEL SERVICE WORKER: 1.0.9 ===
// Cambiar este número fuerza al navegador a detectar una nueva versión.
const SW_VERSION = '1.0.9';

self.skipWaiting();
clientsClaim();

// Precache de todos los assets generados por Vite
precacheAndRoute(self.__WB_MANIFEST);

cleanupOutdatedCaches();

// Default navigation route (SPA)
registerRoute(new NavigationRoute(new NetworkFirst({ cacheName: 'navigations' })));

// Cache JS/CSS
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({ cacheName: `assets-cache-${SW_VERSION}` })
);

// Cache Google Fonts (CSS)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: `google-fonts-stylesheets-${SW_VERSION}`,
  })
);

// Cache Google Fonts (Archivos .woff2)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: `google-fonts-webfonts-${SW_VERSION}`,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365,
        maxEntries: 30,
      }),
    ],
  })
);

// --------------------------------------------------------------------------------
// PUSH NOTIFICATIONS HANDLING
// --------------------------------------------------------------------------------

self.addEventListener('push', (event) => {
    console.log('[SW] Push recibido:', event);

    let data = {
        title: 'KPoint',
        body: '¡Tienes una nueva actualización!',
        url: '/',
        icon: '/pwa-192x192.png'
    };

    if (event.data) {
        try {
            const parsed = event.data.json();
            data = { ...data, ...parsed };
            // Asegurar que el cuerpo del mensaje se asigne correctamente desde cualquier formato
            data.body = parsed.message || parsed.body || data.body;
            console.log('[SW] Datos del push (JSON):', data);
        } catch (e) {
            data.body = event.data.text();
            console.log('[SW] Datos del push (Text):', data.body);
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        image: data.image || null, // Imagen grande opcional
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: [
            { action: 'open', title: 'Ver detalle' }
        ],
        tag: 'kpoint-notification',
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Click en la notificación
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notificación clickeada:', event.notification.tag);
    
    event.notification.close();
    
    const urlToOpen = event.notification.data.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Si ya hay una ventana abierta con la app, enfocarla
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(urlToOpen) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Si no hay ventana, abrir una nueva
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
