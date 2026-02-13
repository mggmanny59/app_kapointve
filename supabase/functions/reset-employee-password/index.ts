// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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
