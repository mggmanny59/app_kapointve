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

        // ✅ SECURITY FIX C-02/A-05: Verify JWT of the requester
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('No authorization header')

        const { data: { user: requester }, error: requesterError } =
            await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
        if (requesterError || !requester) throw new Error('Unauthorized')

        const body = await req.json()

        // ✅ Input validation
        const profile_id = body.profile_id
        const business_id = body.business_id

        if (!profile_id || !business_id) {
            throw new Error('Faltan parámetros requeridos: profile_id o business_id.')
        }

        // ✅ Verify requester is the owner of the business
        const { data: business, error: businessError } = await supabaseClient
            .from('businesses')
            .select('*')
            .eq('id', business_id)
            .eq('owner_id', requester.id)
            .single()

        if (businessError || !business) {
            throw new Error('Solo el administrador del negocio puede eliminar miembros del equipo.')
        }

        // ✅ Verify the target user is actually a member of this business
        const { data: member, error: memberError } = await supabaseClient
            .from('business_members')
            .select('id, role')
            .eq('profile_id', profile_id)
            .eq('business_id', business_id)
            .single()

        if (memberError || !member) {
            throw new Error('El usuario no es miembro de este negocio.')
        }

        // Target cannot be an owner
        if (member.role === 'owner') {
            throw new Error('No puedes revocar el acceso del administrador principal.')
        }

        // ✅ IMPORTANT: Fully delete the user from auth.users.
        // In KPoint, staff accounts are dedicated accounts (username@admin.domain).
        // Deleting from auth.users cascades to public.profiles and public.business_members,
        // completely destroying their session and data instantly.
        const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(profile_id)

        if (deleteError) {
             throw new Error('Error al revocar acceso: ' + deleteError.message)
        }

        return new Response(
            JSON.stringify({ success: true, message: 'Employee access revoked completely.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        console.error('disable-employee error:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
