import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Manejo de CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { profile_id, title, message, url } = await req.json()

        if (!profile_id) throw new Error('profile_id is required')

        // Inicializar cliente Supabase con Service Role Key para saltar RLS
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Configurar llaves VAPID (Deben establecerse en Supabase Secrets)
        const publicVapidKey = Deno.env.get('VAPID_PUBLIC_KEY')
        const privateVapidKey = Deno.env.get('VAPID_PRIVATE_KEY')

        if (!publicVapidKey || !privateVapidKey) {
            throw new Error('VAPID keys are not configured in environment variables')
        }

        webpush.setVapidDetails(
            'mailto:soporte@kpoint.com',
            publicVapidKey,
            privateVapidKey
        )

        // 1. Buscar todas las suscripciones de este usuario (puede tener varios dispositivos)
        const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('id, subscription')
            .eq('profile_id', profile_id)

        if (subError) throw subError

        if (!subscriptions || subscriptions.length === 0) {
            return new Response(JSON.stringify({ success: false, message: 'El usuario no tiene dispositivos suscritos.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // 2. Preparar el contenido de la notificación
        const payload = JSON.stringify({
            title: title || 'KPoint',
            message: message || '¡Tienes una nueva actualización!',
            url: url || '/dashboard'
        })

        // 3. Enviar a cada dispositivo
        const sendPromises = subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification(sub.subscription, payload)
                return { id: sub.id, status: 'sent' }
            } catch (err) {
                // Si el error es 410 (Gone), la suscripción ya no es válida y debemos borrarla
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await supabase.from('push_subscriptions').delete().eq('id', sub.id)
                    return { id: sub.id, status: 'expired_and_deleted' }
                }
                return { id: sub.id, status: 'error', error: err.message }
            }
        })

        const results = await Promise.all(sendPromises)

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Error en Edge Function:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
