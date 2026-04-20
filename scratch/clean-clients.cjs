// clean-clients.cjs - Elimina todos los usuarios CLIENTES y sus datos asociados
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gtxzmkmwjclwppnkiifi.supabase.co';
const SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
    console.error('Uso: node scratch/clean-clients.cjs <service_role_key>');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function clean() {
    console.log('\n🧹 INICIANDO LIMPIEZA DE CLIENTES (CASCADE)...\n');

    // 1. Obtener IDs de usuarios que son STAFF (dueños, managers, cashiers) para PROTEGERLOS
    const { data: staffMembers } = await supabase
        .from('business_members')
        .select('profile_id');
    
    const staffIds = new Set(staffMembers?.map(m => m.profile_id) || []);
    
    // 2. Obtener todos los usuarios de Auth
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
        console.error('❌ Error al listar usuarios:', authError.message);
        return;
    }

    console.log(`🔍 Usuarios totales encontrados: ${users.length}`);

    let deletedCount = 0;
    
    for (const user of users) {
        const isStaff = staffIds.has(user.id);
        const isApalacios = user.email === 'apalacios@gmail.com';

        // Solo borrar si NO es staff y NO es el admin principal
        if (!isStaff && !isApalacios) {
            console.log(`🗑️ Eliminando CLIENTE: ${user.email || '(sin email)'} [ID: ${user.id}]`);
            
            const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
            
            if (deleteError) {
                console.error(`  ❌ Error al eliminar ${user.id}:`, deleteError.message);
            } else {
                deletedCount++;
            }
        } else {
            console.log(`🛡️ PROTEGIENDO STAFF/ADMIN: ${user.email} [ID: ${user.id}]`);
        }
    }

    console.log(`\n✅ LIMPIEZA COMPLETADA.`);
    console.log(`📊 Clientes eliminados: ${deletedCount}`);
    console.log(`⚠️ Nota: El borrado en Auth dispara el CASCADE en la DB para perfiles, puntos, mensajes y suscripciones push.\n`);
}

clean().catch(console.error);
