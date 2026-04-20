// check-business.cjs - Verifica la relación entre admin, Merliz y la Edge Function
const { createClient } = require('@supabase/supabase-js');

const SERVICE_ROLE_KEY = process.argv[2];
if (!SERVICE_ROLE_KEY) { console.error('Uso: node scratch/check-business.cjs <service_role_key>'); process.exit(1); }

const supabase = createClient('https://gtxzmkmwjclwppnkiifi.supabase.co', SERVICE_ROLE_KEY);

const MERLIZ_PROFILE_ID = 'be8c5b32-aa03-42fe-81d3-361490ee76ac';
const ADMIN_EMAIL        = 'apalacios@gmail.com';

async function check() {
    console.log('\n=== DIAGNÓSTICO DEL FLUJO DE ENVÍO DESDE LA APP ===\n');

    // 1. Encontrar el perfil del admin
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    const adminUser = users?.find(u => u.email === ADMIN_EMAIL);
    
    if (!adminUser) {
        console.log(`❌ No se encontró el usuario con email: ${ADMIN_EMAIL}`);
        return;
    }
    console.log(`✅ Admin encontrado: ${adminUser.id} (${ADMIN_EMAIL})`);

    // 2. Buscar negocios donde el admin es dueño o miembro
    const { data: memberships } = await supabase
        .from('business_members')
        .select('business_id, role, businesses(id, name)')
        .eq('profile_id', adminUser.id);

    if (!memberships?.length) {
        console.log('❌ El admin no tiene negocios asociados en business_members.');
        return;
    }

    console.log(`\n✅ Negocios del admin:`);
    memberships.forEach(m => {
        console.log(`  - ${m.businesses?.name} (${m.role}) | ID: ${m.business_id}`);
    });

    const businessId = memberships[0].business_id;

    // 3. Verificar si Merliz tiene loyalty_card en ese negocio
    const { data: merlizCard } = await supabase
        .from('loyalty_cards')
        .select('id, current_points, profile_id')
        .eq('business_id', businessId)
        .eq('profile_id', MERLIZ_PROFILE_ID)
        .single();

    if (!merlizCard) {
        console.log(`\n❌ PROBLEMA ENCONTRADO: Merliz NO tiene loyalty_card en el negocio "${memberships[0].businesses?.name}".`);
        console.log('   Esto significa que NO aparece en la lista de clientes del admin.');
        console.log('   La app no puede enviarle notificaciones seleccionándola directamente.');
    } else {
        console.log(`\n✅ Merliz SÍ tiene loyalty_card en el negocio: ${merlizCard.current_points} pts`);
    }

    // 4. Simular el mismo llamado que hace la Edge Function
    console.log(`\n=== SIMULANDO LLAMADA DE LA EDGE FUNCTION ===`);
    console.log(`Buscando suscripciones push para Merliz (${MERLIZ_PROFILE_ID})...`);
    
    const { data: subs, error: subError } = await supabase
        .from('push_subscriptions')
        .select('id, subscription, user_agent')
        .eq('profile_id', MERLIZ_PROFILE_ID);

    if (subError) {
        console.log(`❌ Error al consultar suscripciones: ${subError.message}`);
    } else if (!subs?.length) {
        console.log(`❌ La Edge Function no encontraría suscripciones para Merliz ahora mismo.`);
    } else {
        console.log(`✅ La Edge Function encontraría ${subs.length} suscripción(es) para Merliz.`);
        subs.forEach(s => console.log(`   Sub ID: ${s.id}`));
    }

    // 5. Verificar la suscripción del admin mismo
    console.log(`\n=== SUSCRIPCIÓN PUSH DEL ADMIN (${ADMIN_EMAIL}) ===`);
    const { data: adminSubs } = await supabase
        .from('push_subscriptions')
        .select('id, updated_at')
        .eq('profile_id', adminUser.id);
    
    if (!adminSubs?.length) {
        console.log(`⚠️  El admin NO tiene suscripción push registrada. No recibirá notificaciones.`);
    } else {
        console.log(`✅ El admin tiene ${adminSubs.length} suscripción(es).`);
    }
}

check().catch(console.error);
