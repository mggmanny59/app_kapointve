// test-edge-function.cjs
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gtxzmkmwjclwppnkiifi.supabase.co';
const ANON_KEY = 'sb_publishable_v_ZfK2QvTQmliN5WlD9_NA_nER5um_T'; // Anon key is enough for invoke if function doesn't require auth
// Actually, Edge functions usually require the Service role or a valid user token if JWT is true.
// The index.ts doesn't seem to check auth headers for the caller, but Supabase might.

const SERVICE_ROLE_KEY = process.argv[2];
const MERLIZ_PROFILE_ID = 'be8c5b32-aa03-42fe-81d3-361490ee76ac';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function test() {
    console.log('--- TEST LLAMADA A EDGE FUNCTION ---');
    try {
        const { data, error } = await supabase.functions.invoke('send-push', {
            body: {
                profile_id: MERLIZ_PROFILE_ID,
                title: '🧪 Test via Edge Function',
                message: 'Probando el puente de la app a Merliz',
                url: '/my-points'
            }
        });

        if (error) {
            console.error('❌ Error devuelto por invoke:', error);
        } else {
            console.log('✅ Respuesta de la Edge Function:', JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error('❌ Error inesperado:', e);
    }
}

test();
