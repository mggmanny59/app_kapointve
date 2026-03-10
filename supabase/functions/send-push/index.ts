import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { profile_id, title, message, url } = await req.json()
        console.log(`[send-push] Iniciando para profile_id: ${profile_id}`)

        if (!profile_id) throw new Error('profile_id is required')

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Variables estáticas para garantizar funcionamiento bypassando supabase secrets
        const publicVapidKey = 'BIoF916LzTZ5Wb_keed4lC0-8QlIHoU9p-w5VX2fvgl4iyia8XwR_EZ1fsm6BsEzHeeeAaI8C_qwXUJ197d3gSg';
        const privateVapidKey = 'RUnPEQaMUSr3msyH9rvmGajSDmqAFa7tbJ8hbURf_F8';


        webpush.setVapidDetails(
            'mailto:soporte@kpoint.com',
            publicVapidKey,
            privateVapidKey
        )

        // Buscar suscripciones del usuario
        const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('id, subscription, user_agent')
            .eq('profile_id', profile_id)

        if (subError) {
            console.error(`[send-push] Error DB: ${subError.message}`)
            throw subError
        }

        console.log(`[send-push] Suscripciones encontradas: ${subscriptions?.length ?? 0}`)

        if (!subscriptions || subscriptions.length === 0) {
            return new Response(JSON.stringify({ success: false, message: 'Sin dispositivos suscritos.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // Preparar payload
        const payload = JSON.stringify({
            title: title || 'KPoint',
            message: message || '¡Tienes una nueva actualización!',
            url: url || '/dashboard'
        })

        console.log(`[send-push] Payload: ${payload}`)

        // Enviar a cada dispositivo con logging detallado
        const sendPromises = subscriptions.map(async (sub) => {
            try {
                const endpoint = sub.subscription?.endpoint ?? 'sin endpoint'
                console.log(`[send-push] Enviando a: ${endpoint.substring(0, 60)}...`)
                console.log(`[send-push] Subscription keys presentes: auth=${!!sub.subscription?.keys?.auth}, p256dh=${!!sub.subscription?.keys?.p256dh}`)

                await webpush.sendNotification(sub.subscription, payload)
                console.log(`[send-push] ✅ ENVIADO exitosamente a sub.id=${sub.id}`)
                return { id: sub.id, status: 'sent' }
            } catch (err) {
                console.error(`[send-push] ❌ ERROR enviando a sub.id=${sub.id}: statusCode=${err.statusCode} body=${err.body} message=${err.message}`)

                if (err.statusCode === 410 || err.statusCode === 404) {
                    await supabase.from('push_subscriptions').delete().eq('id', sub.id)
                    console.log(`[send-push] Suscripción expirada borrada: ${sub.id}`)
                    return { id: sub.id, status: 'expired_and_deleted' }
                }
                return { id: sub.id, status: 'error', error: `${err.statusCode}: ${err.message}`, body: err.body }
            }
        })

        const results = await Promise.all(sendPromises)
        console.log(`[send-push] Resultados: ${JSON.stringify(results)}`)

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error(`[send-push] Error fatal: ${error.message}`)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
