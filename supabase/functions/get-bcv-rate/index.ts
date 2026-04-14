import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

    // Stable API alternative
    const API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
    const BCV_URL = 'https://www.bcv.org.ve/';

    try {
        const apiResponse = await fetch(API_URL, {
            headers: { 'Accept': 'application/json' }
        });

        if (apiResponse.ok) {
            const data = await apiResponse.json();
            if (data && data.promedio) {
                return new Response(JSON.stringify({ rate: data.promedio, source: 'DolarAPI' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // Fallback to BCV Scrape
        const bcvResponse = await fetch(BCV_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });

        if (bcvResponse.ok) {
            const html = await bcvResponse.text();
            const patterns = [
                /id="dolar"[\s\S]*?<strong>\s*([\d,.]+)\s*<\/strong>/i,
                /USD[\s\S]*?<strong>\s*([\d,.]+)\s*<\/strong>/i,
                /<strong>\s*(\d{2,3},\d{4,10})\s*<\/strong>/
            ];

            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                    const rate = parseFloat(match[1].replace(',', '.').trim());
                    if (!isNaN(rate) && rate > 0) {
                        return new Response(JSON.stringify({ rate, source: 'BCV_Scrape' }), {
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }
                }
            }
        }

        throw new Error("No se pudo obtener la tasa de ninguna fuente.");

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
})
