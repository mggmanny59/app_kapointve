
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gtxzmkmwjclwppnkiifi.supabase.co',
  'sb_publishable_v_ZfK2QvTQmliN5WlD9_NA_nER5um_T' // Anon Key
);

async function listRecent() {
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('id, full_name, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (pError) {
    console.error('Error fetching profiles:', pError);
    return;
  }

  console.log('Últimos 10 perfiles registrados:');
  profiles.forEach(p => console.log(` - ${p.full_name} (${p.created_at})`));
}

listRecent();
