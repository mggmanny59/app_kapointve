// check-profile.cjs - Identifica a quién corresponde cada suscripción push
const { createClient } = require('@supabase/supabase-js');
const SERVICE_ROLE_KEY = process.argv[2];
if (!SERVICE_ROLE_KEY) { console.error('Uso: node scratch/check-profile.cjs <service_role_key>'); process.exit(1); }

const supabase = createClient('https://gtxzmkmwjclwppnkiifi.supabase.co', SERVICE_ROLE_KEY);

async function check() {
    // Listar todas las suscripciones con el nombre del perfil que las tiene
    const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, profile_id, updated_at')
        .order('updated_at', { ascending: false });

    console.log('\n=== SUSCRIPCIONES Y SUS DUEÑOS ===\n');

    for (const sub of (subs || [])) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', sub.profile_id)
            .single();

        console.log(`📱 Sub ID: ${sub.id}`);
        console.log(`   Registrada: ${sub.updated_at}`);
        console.log(`   Profile ID: ${sub.profile_id}`);
        console.log(`   Nombre: ${profile?.full_name || '(sin nombre)'}`);
        console.log(`   Teléfono: ${profile?.phone || '(sin teléfono)'}`);
        console.log('');
    }

    // Buscar todos los perfiles que tengan "Merliz" o similares en el nombre
    console.log('\n=== BÚSQUEDA DE MERLIZ EN PERFILES ===\n');
    const { data: all } = await supabase.from('profiles').select('id, full_name, phone');
    const merliz = (all || []).filter(p => 
        (p.full_name || '').toLowerCase().includes('merliz') ||
        (p.full_name || '').toLowerCase().includes('mercedes') ||
        (p.full_name || '').toLowerCase().includes('mer')
    );
    
    if (merliz.length === 0) {
        console.log('No se encontraron perfiles con ese nombre.');
        console.log('Todos los perfiles disponibles:');
        (all || []).forEach(p => console.log(`  - "${p.full_name || '(sin nombre)'}" | ${p.phone || '(sin tel)'} | ${p.id}`));
    } else {
        merliz.forEach(p => {
            console.log(`✅ "${p.full_name}" | ${p.phone} | ${p.id}`);
        });
    }
}

check().catch(console.error);
