// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const ALLOWED_ORIGINS = [
    'https://app.kpointve.com',
    'https://kpointve.com',
    'http://localhost:5173'
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
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Get the requester's JWT
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('No authorization header')

        const { data: { user: requester }, error: requesterError } = await supabaseClient.auth.getUser(
            authHeader.replace('Bearer ', '')
        )
        if (requesterError || !requester) throw new Error('Unauthorized')

        const { profile_id, new_password, business_id } = await req.json()

        // ✅ Input validation
        if (!profile_id || !new_password || !business_id) {
            throw new Error('Faltan campos requeridos.')
        }
        if (String(new_password).length < 6) {
            throw new Error('La contraseña debe tener al menos 6 caracteres.')
        }

        // 1. Verify that the requester is the owner of the business
        const { data: business, error: bizError } = await supabaseClient
            .from('businesses')
            .select('id')
            .eq('id', business_id)
            .eq('owner_id', requester.id)
            .single()

        if (bizError || !business) throw new Error('No tienes permisos para gestionar este comercio.')

        // 2. Verify that the employee belongs to this business
        const { data: member, error: memberError } = await supabaseClient
            .from('business_members')
            .select('id')
            .eq('business_id', business_id)
            .eq('profile_id', profile_id)
            .single()

        if (memberError || !member) throw new Error('El usuario no pertenece a tu equipo.')

        // 3. Reset Password
        const { error: resetError } = await supabaseClient.auth.admin.updateUserById(
            profile_id,
            { password: new_password }
        )

        if (resetError) throw resetError

        return new Response(JSON.stringify({ success: true }), {
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
