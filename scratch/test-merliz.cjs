const https = require('https');

const SUPABASE_URL = 'https://gtxzmkmwjclwppnkiifi.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0eHpta213amNsd3BwbmtpaWorldiIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NzA5NzMzNTUsImV4cCI6MjA4NjU0OTM1NX0.placeholder';

// Llamar directamente a la Edge Function con el profile_id de Merliz
const payload = JSON.stringify({
  profile_id: 'be8c5b32-aa03-42fe-81d3-361490ee76ac',
  title: '¡Hola Merliz! 🎉',
  message: 'KPoint: ¡Prueba de notificación exitosa! Las notificaciones están funcionando.',
  url: '/my-points'
});

const options = {
  hostname: 'gtxzmkmwjclwppnkiifi.supabase.co',
  path: '/functions/v1/send-push',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0eHpta213amNsd3BwbmtpaWorldiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzcwOTczMzU1LCJleHAiOjIwODY1NDkzNTV9.placeholder`
  }
};

console.log('Enviando notificación a Merliz via Edge Function...');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Respuesta HTTP:', res.statusCode);
    try {
      const result = JSON.parse(data);
      console.log('Resultado:', JSON.stringify(result, null, 2));
      if (result.success) {
        console.log('\n✅ ¡ÉXITO! Notificación enviada a todos los dispositivos de Merliz.');
      } else {
        console.log('\n⚠️  Respuesta:', result.message || result.error);
      }
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => console.error('Error de red:', e.message));
req.write(payload);
req.end();
