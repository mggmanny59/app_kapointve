import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // Stable API alternative
    const API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
    const BCV_URL = 'https://www.bcv.org.ve/';

    try {
        console.log("Attempting to fetch rate from DolarAPI...");
        const apiResponse = await fetch(API_URL, {
            headers: { 'Accept': 'application/json' }
        });

        if (apiResponse.ok) {
            const data = await apiResponse.json();
            if (data && data.promedio) {
                console.log("Success with DolarAPI:", data.promedio);
                return new Response(JSON.stringify({ rate: data.promedio, source: 'DolarAPI' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        console.warn("DolarAPI failed, falling back to BCV Scrape...");

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
        console.error('Exchange Rate Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
})
