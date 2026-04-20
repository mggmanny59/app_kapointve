// fix-rls.cjs
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gtxzmkmwjclwppnkiifi.supabase.co';
const SERVICE_ROLE_KEY = process.argv[2];

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function fix() {
    console.log('🛠️ Aplicando parches de RLS...');
    
    const sql = `
    -- 1. Eliminar si existen (para evitar errores)
    DROP POLICY IF EXISTS "Owners can view loyalty cards of their business" ON public.loyalty_cards;
    DROP POLICY IF EXISTS "Staff can view loyalty cards of their business" ON public.loyalty_cards;
    
    -- 2. Crear Políticas
    CREATE POLICY "Owners can view loyalty cards of their business" ON public.loyalty_cards
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.businesses 
        WHERE id = loyalty_cards.business_id 
        AND owner_id = auth.uid()
      )
    );

    CREATE POLICY "Staff can view loyalty cards of their business" ON public.loyalty_cards
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.business_members
        WHERE business_id = loyalty_cards.business_id
        AND profile_id = auth.uid()
      )
    );
    `;

    // Como no tenemos RPC exec_sql, usaremos una técnica de migración directa si es posible o simplemente informamos
    // Pero espera, puedo usar el API para ejecutar SQL si tengo el token correcto? No.
    // Usaré el comando postgrest para verificar el acceso?
    
    console.log('SQL generado. Intentando aplicar via fetch...');
    // Actually, I can use the Supabase CLI if I can just fix the connection.
}

fix();
