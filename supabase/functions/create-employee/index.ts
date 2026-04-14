// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

serve(async (req: Request) => {
    const corsHeaders = getCorsHeaders(req);

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey)

        // ✅ SECURITY FIX C-02: Verify JWT of the requester
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('No authorization header')

        const { data: { user: requester }, error: requesterError } =
            await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
        if (requesterError || !requester) throw new Error('Unauthorized')

        const body = await req.json()

        // ✅ SECURITY FIX A-04: Input validation and sanitization
        const username = String(body.username || '')
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, '')
            .slice(0, 30)

        if (!username || username.length < 3) {
            throw new Error('Username debe tener al menos 3 caracteres alfanuméricos.')
        }

        const password = String(body.password || '')
        if (password.length < 6) {
            throw new Error('La contraseña debe tener al menos 6 caracteres.')
        }

        const full_name = String(body.full_name || '').trim().slice(0, 100)
        if (full_name.length < 2) {
            throw new Error('Nombre debe tener al menos 2 caracteres.')
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const business_id = String(body.business_id || '')
        if (!uuidRegex.test(business_id)) {
            throw new Error('business_id inválido.')
        }

        // Validate permissions (whitelist only allowed keys)
        const allowedPerms = ['can_earn', 'can_redeem', 'can_view_clients']
        const permissions: Record<string, boolean> = {}
        for (const perm of allowedPerms) {
            permissions[perm] = !!body.permissions?.[perm]
        }

        // ✅ SECURITY FIX C-02: Verify the requester is the owner of the business
        const { data: business, error: bizError } = await supabaseClient
            .from('businesses')
            .select('id')
            .eq('id', business_id)
            .eq('owner_id', requester.id)
            .single()

        if (bizError || !business) {
            throw new Error('No tienes permisos para crear empleados en este comercio.')
        }

        const email = `${username}@kpoint.staff`

        // 1. Create Auth User
        const { data: userData, error: authError } = await supabaseClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name, business_id, role: 'cashier' }
        })

        if (authError) throw authError

        const profile_id = userData.user.id

        // 2. Update Profile Full Name
        await supabaseClient
            .from('profiles')
            .update({ full_name, email })
            .eq('id', profile_id)

        // 3. Create Business Member entry
        const { error: memberError } = await supabaseClient
            .from('business_members')
            .insert({
                business_id,
                profile_id,
                role: 'cashier',
                permissions
            })

        if (memberError) throw memberError

        return new Response(
            JSON.stringify({ success: true, user_id: profile_id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
