const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gtxzmkmwjclwppnkiifi.supabase.co',
  'sb_publishable_v_ZfK2QvTQmliN5WlD9_NA_nER5um_T'
);

async function checkSub() {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*, profiles:profile_id(full_name)')
    .eq('profile_id', 'be8c5b32-aa03-42fe-81d3-361490ee76ac') // Merliz
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}
checkSub();
