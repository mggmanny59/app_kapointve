// send-to-merliz.cjs - Envía notificación push directa a Merliz
const { createClient } = require('@supabase/supabase-js');
const webpush = require('web-push');

const SERVICE_ROLE_KEY = process.argv[2];
if (!SERVICE_ROLE_KEY) { console.error('Uso: node scratch/send-to-merliz.cjs <service_role_key>'); process.exit(1); }

const supabase = createClient('https://gtxzmkmwjclwppnkiifi.supabase.co', SERVICE_ROLE_KEY);

const MERLIZ_PROFILE_ID = 'be8c5b32-aa03-42fe-81d3-361490ee76ac';
const PUBLIC_VAPID_KEY  = 'BNjZVD5xzxwgxiZ4jzMRSglRAJLzwT4pL16fhd4_0S81jFvBi4rwhIyxqPBj9__XhIeJwTHNc8w8VWLIYsTE7hw';
const PRIVATE_VAPID_KEY = '0PKQBWTWFnRDkxGMKLhId2foB34_t0Hk7gxfXDD20K8';

webpush.setVapidDetails('mailto:soporte@kpoint.com', PUBLIC_VAPID_KEY, PRIVATE_VAPID_KEY);

async function send() {
    // Obtener todas las suscripciones de Merliz
    const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('id, subscription')
        .eq('profile_id', MERLIZ_PROFILE_ID)
        .order('updated_at', { ascending: false });

    if (error || !subs?.length) {
        console.log('❌ No se encontraron suscripciones para Merliz.');
        return;
    }

    console.log(`\n📡 Enviando a ${subs.length} dispositivo(s) de Merliz...\n`);

    const payload = JSON.stringify({
        title: '✅ KPoint - Prueba Directa',
        body: '¡Merliz, esta notificación llegó correctamente!',
        message: '¡Merliz, esta notificación llegó correctamente!',
        url: '/my-points',
        icon: '/pwa-192x192.png'
    });

    // Intentar con cada suscripción (la más reciente primero)
    for (const sub of subs) {
        try {
            const result = await webpush.sendNotification(sub.subscription, payload, { TTL: 86400, urgency: 'high' });
            console.log(`✅ ENVIADO - Status: ${result.statusCode} - Sub ID: ${sub.id}`);
        } catch (err) {
            console.log(`❌ FALLÓ - Status: ${err.statusCode} - Sub ID: ${sub.id}`);
            console.log(`   Error: ${err.message}`);
            if (err.statusCode === 410) {
                console.log('   → Suscripción expirada. Borrando de la BD...');
                await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            } else if (err.statusCode === 401) {
                console.log('   → Las llaves VAPID no coinciden con esta suscripción.');
            }
        }
    }
    console.log('\nListo. Verifica el teléfono de Merliz ahora.\n');
}

send().catch(console.error);
