
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gtxzmkmwjclwppnkiifi.supabase.co',
  'sb_publishable_v_ZfK2QvTQmliN5WlD9_NA_nER5um_T' // Anon Key
);

async function testPush() {
  const { data: subs, error: sError } = await supabase
    .from('push_subscriptions')
    .select('id, profile_id, updated_at, subscription, profiles(full_name)')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (sError) {
    console.log('Error fetching subs:', sError);
    return;
  }

  if (subs.length === 0) {
    console.log('No subscriptions found.');
    return;
  }

  const sub = subs[0];
  console.log('Testing push for:', sub.profiles?.full_name, 'Profile ID:', sub.profile_id);

  const { data, error } = await supabase.functions.invoke('send-push', {
    body: {
      profile_id: sub.profile_id,
      title: 'Prueba Técnica',
      message: 'Prueba desde consola de desarrollo.',
      url: '/my-points'
    }
  });

  if (error) {
    console.log('Edge Function threw an error:', error);
  } else {
    console.log('Return data:', JSON.stringify(data, null, 2));
  }
}

testPush();
