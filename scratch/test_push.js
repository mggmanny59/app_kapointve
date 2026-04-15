import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testPush() {
    console.log('Invocando send-push para Merliz...');
    const { data, error } = await supabase.functions.invoke('send-push', {
        body: {
            profile_id: 'be8c5b32-aa03-42fe-81d3-361490ee76ac',
            title: 'Test Antigravity',
            message: '¿Recibes esto?'
        }
    })

    if (error) {
        console.error('Error de invocación:', error)
    } else {
        console.log('Respuesta:', JSON.stringify(data, null, 2))
    }
}

testPush()
