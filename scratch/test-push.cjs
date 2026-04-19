const webpush = require('web-push');

const vapidKeys = {
  publicKey: 'BEsOZT9XFGkdJ1fN8xpOa-k40vjM_QowmWht0Rriw-CTodZo3NOOlqsJKolRty27kW88KHm4N2NWjWsR-u9wdNQ',
  privateKey: 'VXZ3k3z1Qxh6eZK2jwYNk2uJGrQIlmCYCf90PzMAw6E'
};

webpush.setVapidDetails(
  'mailto:soporte@kpoint.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const subscription = {"keys":{"auth":"pRFkREn5JAwN-3wlFdXelw","p256dh":"BBK6LMllAZ7eLqZy-0nKv0XBQHr9hJnI-ma8PS8l7DIUMRMx0g9hD6z26r6pC8u1Q106dLzrvVHc6doM4QUD_ko"},"endpoint":"https://fcm.googleapis.com/fcm/send/cISccuK0mqY:APA91bELf71oeV_yfVPk104XrmQak4oJi7oQdOc00dpVHyBjHv3fuui4qU8lRNJ2kBnQkRpuFbtlyeNOAfVVeLrkqVhf0BvXEqGmU5CPO7d-QoUvVTpDX2r3emTML2GGESSoPq-AHB7b","expirationTime":null};

const payload = JSON.stringify({
  title: '¡POR FIN! 🚀',
  message: 'KPoint: Sistema de notificaciones restaurado.',
  body: 'KPoint: Sistema de notificaciones restaurado.',
  url: '/my-points',
  icon: '/pwa-192x192.png'
});

console.log('Enviando notificación DE-FI-NI-TI-VA...');

webpush.sendNotification(subscription, payload)
  .then(result => console.log('¡GRAN VICTORIA! Google aceptó el envío:', result.statusCode))
  .catch(error => console.error('ERROR INESPERADO:', error));
