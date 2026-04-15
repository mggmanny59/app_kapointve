const supabaseUrl = 'https://gtxzmkmwjclwppnkiifi.supabase.co';
const supabaseKey = 'sb_publishable_v_ZfK2QvTQmliN5WlD9_NA_nER5um_T';

async function testPush() {
    console.log('Testing send-push for Merliz...');
    try {
        const response = await fetch(supabaseUrl + '/functions/v1/send-push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
                profile_id: 'be8c5b32-aa03-42fe-81d3-361490ee76ac',
                title: 'Test Antigravity',
                message: 'Verificando sistema de notificaciones...'
            })
        });

        const data = await response.json();
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

testPush();
