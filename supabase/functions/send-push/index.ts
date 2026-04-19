import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const ALLOWED_ORIGINS = [
    'https://app.kpointve.com',
    'https://kpointve.com',
    'http://localhost:5173',
    'http://localhost:5174'
];

function getCorsHeaders(req: Request) {
    const origin = req.headers.get('Origin') || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
}

serve(async (req) => {
    const corsHeaders = getCorsHeaders(req);

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { profile_id, title, message, url, icon, image, badge } = await req.json()

        if (!profile_id) throw new Error('profile_id is required')

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // NEW VAPID KEYS - Version 19 (synchronized with client)
        const publicVapidKey = 'BNjZVD5xzxwgxiZ4jzMRSglRAJLzwT4pL16fhd4_0S81jFvBi4rwhIyxqPBj9__XhIeJwTHNc8w8VWLIYsTE7hw';
        const privateVapidKey = '0PKQBWTWFnRDkxGMKLhId2foB34_t0Hk7gxfXDD20K8';

        if (!publicVapidKey || !privateVapidKey) {
            throw new Error('VAPID keys not configured correctly');
        }

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
            throw subError
        }

        if (!subscriptions || subscriptions.length === 0) {
            return new Response(JSON.stringify({ success: false, message: 'Sin dispositivos suscritos.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // Preparar payload con máxima compatibilidad (body y message)
        const payload = JSON.stringify({
            title: title || 'KPoint',
            message: message || '¡Tienes una nueva actualización!',
            body: message || '¡Tienes una nueva actualización!', // Para compatibilidad con versiones anteriores
            url: url || '/dashboard',
            icon: icon || '/pwa-192x192.png',
            image: image || null,
            badge: badge || '/pwa-192x192.png'
        })

        // Enviar a cada dispositivo
        const sendPromises = subscriptions.map(async (sub) => {
            try {
                await webpush.sendNotification(sub.subscription, payload, {
                    TTL: 86400, // 24 hours
                    urgency: 'high'
                })
                return { id: sub.id, status: 'sent' }
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await supabase.from('push_subscriptions').delete().eq('id', sub.id)
                    return { id: sub.id, status: 'expired_and_deleted' }
                }
                return { id: sub.id, status: 'error', error: `${err.statusCode}: ${err.message}` }
            }
        })

        const results = await Promise.all(sendPromises)

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
