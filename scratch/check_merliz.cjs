
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gtxzmkmwjclwppnkiifi.supabase.co',
  'sb_publishable_v_ZfK2QvTQmliN5WlD9_NA_nER5um_T' // Anon Key
);

async function checkUser(name) {
  // First find the profile
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('full_name', `%${name}%`);

  if (pError) {
    console.error('Error fetching profiles:', pError);
    return;
  }

  if (profiles.length === 0) {
    console.log(`No se encontró ningún perfil con el nombre "${name}".`);
    return;
  }

  for (const profile of profiles) {
    console.log(`\nRevisando perfil: ${profile.full_name} (ID: ${profile.id})`);
    
    // Check subscriptions
    const { data: subs, error: sError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('profile_id', profile.id);

    if (sError) {
      console.error(`Error fetching subscriptions for ${profile.id}:`, sError);
      continue;
    }

    if (subs.length === 0) {
      console.log(' - NO tiene suscripciones Push registradas.');
    } else {
      console.log(` - ${subs.length} suscripción(es) encontrada(s):`);
      subs.forEach(s => {
        const subData = s.subscription;
        const endpoint = subData.endpoint || '';
        const isLegacy = endpoint.includes('fcm.googleapis.com');
        console.log(`   * Navegador: ${s.user_agent.substring(0, 50)}...`);
        console.log(`   * Actualizado: ${s.updated_at}`);
        console.log(`   * Tipo: ${isLegacy ? 'LEGACY (Requiere renovar)' : 'MODERNO (OK)'}`);
      });
    }
  }
}

checkUser('MERLIZ');
