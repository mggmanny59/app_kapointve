import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import webpush from "https://esm.sh/web-push@3.6.6"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()
        const { profile_id, business_id, title, message, url, icon } = body

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') || '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        )

        // Llaves maestras (CORRECTAS)
        const publicVapidKey = 'BNjZVD5xzxwgxiZ4jzMRSglRAJLzwT4pL16fhd4_0S81jFvBi4rwhIyxqPBj9__XhIeJwTHNc8w8VWLIYsTE7hw'
        const privateVapidKey = '0PKQBWTWFnRDkxGMKLhId2foB34_t0Hk7gxfXDD20K8'
        
        webpush.setVapidDetails(
            'mailto:admin@kpointve.com',
            publicVapidKey,
            privateVapidKey
        )

        let recipients = []
        if (profile_id) {
            recipients = [profile_id]
        } else if (business_id) {
            const { data } = await supabase.from('loyalty_cards').select('profile_id').eq('business_id', business_id)
            recipients = data?.map(d => d.profile_id) || []
        }

        if (recipients.length === 0) {
            return new Response(JSON.stringify({ success: false, message: 'No hay recipientes' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

        const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('subscription')
            .in('profile_id', recipients)

        if (subError) throw subError

        const results = []
        const failures = []

        if (subscriptions) {
            for (const sub of subscriptions) {
                try {
                    const res = await webpush.sendNotification(
                        sub.subscription,
                        JSON.stringify({
                            title: title || 'KPoint',
                            body: message || '',
                            url: url || '/',
                            icon: icon || '/pwa-192x192.png'
                        }),
                        {
                            vapidDetails: {
                                subject: 'mailto:soporte@kpointve.com',
                                publicKey: publicVapidKey,
                                privateKey: privateVapidKey,
                            },
                        }
                    )
                    results.push({ success: true, status: res.statusCode })
                } catch (err) {
                    failures.push({ success: false, error: err.message })
                }
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            total: results.length,
            failures: results.filter(r => !r.success).map(f => f.error).slice(0, 3)
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })
    }
})
