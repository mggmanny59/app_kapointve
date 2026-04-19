
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gtxzmkmwjclwppnkiifi.supabase.co',
  'sb_publishable_v_ZfK2QvTQmliN5WlD9_NA_nER5um_T' // Anon Key
);

async function checkMerliz() {
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .ilike('full_name', '%MERLIZ%');

  if (pError || profiles.length === 0) {
    console.log('No se encontro a Merliz.');
    return;
  }

  const profile = profiles[0];
  console.log('Encontrada:', profile.full_name, profile.id);

  const { data: subs, error: sError } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('profile_id', profile.id);

  if (sError) {
    console.log('Error buscando subs:', sError);
    return;
  }

  if (subs.length === 0) {
    console.log('Merliz NO tiene suscripciones en Supabase.');
  } else {
    console.log('Merliz tiene', subs.length, 'suscripciones.');
    console.log(JSON.stringify(subs, null, 2));
  }
}

checkMerliz();
