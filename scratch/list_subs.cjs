
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gtxzmkmwjclwppnkiifi.supabase.co',
  'sb_publishable_v_ZfK2QvTQmliN5WlD9_NA_nER5um_T' // Anon Key
);

async function listSubs() {
  const { data: subs, error: sError } = await supabase
    .from('push_subscriptions')
    .select('*, profiles(full_name)')
    .order('updated_at', { ascending: false })
    .limit(10);

  if (sError) {
    console.error('Error fetching subs:', sError);
    return;
  }

  console.log('Últimas 10 suscripciones:');
  subs.forEach(s => console.log(` - Usuario: ${s.profiles?.full_name || 'Desconocido'} | Updated: ${s.updated_at} | UA: ${s.user_agent.substring(0, 30)}`));
}

listSubs();
