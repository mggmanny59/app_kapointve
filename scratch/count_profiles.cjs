
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gtxzmkmwjclwppnkiifi.supabase.co',
  'sb_publishable_v_ZfK2QvTQmliN5WlD9_NA_nER5um_T' // Anon Key
);

async function countProfiles() {
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
    
  console.log('Total profiles in this DB:', count);
  console.log('Error if any:', error);
}

countProfiles();
