// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey)

        const { username, password, full_name, business_id, permissions } = await req.json()

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
