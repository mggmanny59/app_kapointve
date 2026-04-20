// diagnose-push.cjs
// Usa service_role para bypassear RLS y ver la verdad completa

const { createClient } = require('@supabase/supabase-js');

// IMPORTANTE: Necesitamos SERVICE_ROLE key, no anon key
// Puedes encontrarla en: https://supabase.com/dashboard/project/gtxzmkmwjclwppnkiifi/settings/api
const SUPABASE_URL = 'https://gtxzmkmwjclwppnkiifi.supabase.co';
const SERVICE_ROLE_KEY = process.argv[2]; // Pásala como argumento: node diagnose-push.cjs <tu_service_role_key>

if (!SERVICE_ROLE_KEY) {
    console.error('\n❌ FALTA LA SERVICE ROLE KEY');
    console.error('Uso: node scratch/diagnose-push.cjs <service_role_key>');
    console.error('Encuéntrala en: https://supabase.com/dashboard/project/gtxzmkmwjclwppnkiifi/settings/api\n');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function diagnose() {
    console.log('\n==================================================');
    console.log('   DIAGNÓSTICO COMPLETO DE PUSH NOTIFICATIONS');
    console.log('==================================================\n');

    // 1. Contar perfiles
    const { count: profileCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    console.log(`📋 Total perfiles en BD: ${profileCount}`);

    // 2. Listar perfiles
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone').order('created_at', { ascending: false }).limit(10);
    console.log('\n📋 Últimos 10 perfiles:');
    if (profiles?.length) {
        profiles.forEach(p => console.log(`  - ${p.full_name || '(sin nombre)'} | ${p.phone || '(sin tel)'} | ${p.id}`));
    } else {
        console.log('  (ninguno)');
    }

    // 3. Contar suscripciones push
    const { count: subCount } = await supabase.from('push_subscriptions').select('*', { count: 'exact', head: true });
    console.log(`\n📡 Total suscripciones Push en BD: ${subCount}`);

    // 4. Listar suscripciones
    const { data: subs, error: subError } = await supabase
        .from('push_subscriptions')
        .select('id, profile_id, user_agent, updated_at, subscription')
        .order('updated_at', { ascending: false })
        .limit(5);

    if (subError) {
        console.log('\n❌ Error al leer suscripciones:', subError.message);
    } else if (subs?.length) {
        console.log('\n📡 Últimas 5 suscripciones:');
        subs.forEach(s => {
            const endpoint = s.subscription?.endpoint || '(no endpoint)';
            const endpointShort = endpoint.substring(0, 80) + '...';
            console.log(`\n  ID: ${s.id}`);
            console.log(`  Profile: ${s.profile_id}`);
            console.log(`  UserAgent: ${(s.user_agent || '').substring(0, 60)}...`);
            console.log(`  Updated: ${s.updated_at}`);
            console.log(`  Endpoint: ${endpointShort}`);

            // Verificar si el endpoint corresponde a las nuevas llaves o viejas
            if (endpoint.includes('fcm.googleapis.com/fcm/send/')) {
                console.log('  ⚠️  LEGACY FCM ENDPOINT - ESTO FALLARÁ');
            } else if (endpoint.includes('fcm.googleapis.com')) {
                console.log('  ✅ Endpoint moderno de Google FCM');
            } else if (endpoint.includes('mozilla.com') || endpoint.includes('mozilla.org')) {
                console.log('  ✅ Endpoint de Firefox/Mozilla');
            } else {
                console.log('  🔍 Endpoint desconocido');
            }
        });

        // 5. Intentar enviar a la primera suscripción activa
        const targetSub = subs[0];
        console.log(`\n\n🚀 PRUEBA DE ENVÍO a perfil: ${targetSub.profile_id}`);
        
        const webpush = require('web-push');
        const publicVapidKey = 'BNjZVD5xzxwgxiZ4jzMRSglRAJLzwT4pL16fhd4_0S81jFvBi4rwhIyxqPBj9__XhIeJwTHNc8w8VWLIYsTE7hw';
        const privateVapidKey = '0PKQBWTWFnRDkxGMKLhId2foB34_t0Hk7gxfXDD20K8';
        webpush.setVapidDetails('mailto:soporte@kpoint.com', publicVapidKey, privateVapidKey);

        const payload = JSON.stringify({
            title: '🔧 Prueba de Diagnóstico',
            body: '¡Si ves esto, los Push funcionan!',
            message: '¡Si ves esto, los Push funcionan!',
            url: '/my-points'
        });

        try {
            const result = await webpush.sendNotification(targetSub.subscription, payload, { TTL: 86400, urgency: 'high' });
            console.log(`✅ ENVIADO CON ÉXITO - Status: ${result.statusCode}`);
        } catch (err) {
            console.log(`❌ ERROR al enviar: Status ${err.statusCode} - ${err.message}`);
            if (err.statusCode === 401) {
                console.log('   → Las llaves VAPID no coinciden con la suscripción almacenada.');
            } else if (err.statusCode === 410) {
                console.log('   → La suscripción está expirada/invalidada (necesita re-registro).');
            } else if (err.statusCode === 404) {
                console.log('   → La suscripción no existe en el servidor de Google.');
            }
        }
    } else {
        console.log('\n(ninguna suscripción almacenada)\n');
        console.log('⚠️ DIAGNÓSTICO: No hay suscripciones en la base de datos.');
        console.log('   Esto significa que la app NO está guardando las suscripciones correctamente.');
        console.log('   Verifica que Merliz haya abierto la app en la versión 1.2.0 y el permiso esté concedido.');
    }

    console.log('\n==================================================\n');
}

diagnose().catch(console.error);
