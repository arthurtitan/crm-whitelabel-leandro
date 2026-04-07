import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RAPIDAPI_HOST = 'maps-data.p.rapidapi.com';

interface GeocodingResponse {
  status: string;
  data?: { lat: number; lng: number };
}

interface NearbyPlace {
  name?: string;
  full_address?: string;
  city?: string;
  phone_number?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  photo?: string;
  business_status?: string;
  place_id?: string;
  google_maps_url?: string;
}

interface NearbyResponse {
  status: string;
  data?: NearbyPlace[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { account_id, nicho, localizacao } = await req.json();

    if (!account_id || !nicho || !localizacao) {
      return new Response(
        JSON.stringify({ success: false, error: 'account_id, nicho e localizacao são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!rapidApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'RAPIDAPI_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for usage tracking
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check monthly quota
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { data: usageData } = await supabase
      .from('api_usage_logs')
      .select('requests_count')
      .eq('account_id', account_id)
      .eq('month', currentMonth);

    const totalUsed = (usageData || []).reduce((sum: number, r: any) => sum + (r.requests_count || 0), 0);

    // Get account limit
    const { data: accountData } = await supabase
      .from('accounts')
      .select('monthly_extraction_limit')
      .eq('id', account_id)
      .single();

    const limit = accountData?.monthly_extraction_limit ?? 500;

    if (totalUsed >= limit) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Limite mensal atingido (${totalUsed}/${limit} requisições). Contate o administrador.`,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[extract-leads] Step 1: Geocoding location:', localizacao);

    // Step 1: Geocoding
    const geocodeUrl = `https://${RAPIDAPI_HOST}/geocoding.php?query=${encodeURIComponent(localizacao)}&country=br&lang=pt`;
    const geocodeRes = await fetch(geocodeUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': rapidApiKey,
      },
    });

    if (!geocodeRes.ok) {
      const errText = await geocodeRes.text();
      console.error('[extract-leads] Geocoding error:', errText);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro no geocoding. Verifique a localização.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geocodeData: GeocodingResponse = await geocodeRes.json();
    if (!geocodeData.data?.lat || !geocodeData.data?.lng) {
      return new Response(
        JSON.stringify({ success: false, error: 'Localização não encontrada. Tente outro endereço.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { lat, lng } = geocodeData.data;
    console.log('[extract-leads] Step 2: Nearby search for:', nicho, 'at', lat, lng);

    // Step 2: Nearby search
    const nearbyUrl = `https://${RAPIDAPI_HOST}/nearby.php?query=${encodeURIComponent(nicho)}&lat=${lat}&lng=${lng}&lang=pt&country=br`;
    const nearbyRes = await fetch(nearbyUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': rapidApiKey,
      },
    });

    if (!nearbyRes.ok) {
      const errText = await nearbyRes.text();
      console.error('[extract-leads] Nearby error:', errText);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro na busca por estabelecimentos.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nearbyData: NearbyResponse = await nearbyRes.json();
    const places = nearbyData.data || [];

    // Log usage (2 API calls: geocoding + nearby)
    await supabase.from('api_usage_logs').insert({
      account_id,
      endpoint: 'maps-data',
      requests_count: 2,
      month: currentMonth,
    });

    // Map to leads format
    const leads = places.map((p: NearbyPlace) => ({
      nome: p.name || '',
      cidade: p.city || '',
      endereco: p.full_address || '',
      telefone: p.phone_number || '',
      site: p.website || '',
      avaliacao: p.rating || null,
      total_avaliacoes: p.reviews || null,
      foto: p.photo || '',
      status_negocio: p.business_status || '',
      place_id: p.place_id || '',
      google_maps_url: p.google_maps_url || '',
    }));

    console.log('[extract-leads] Found', leads.length, 'leads. Usage:', totalUsed + 2, '/', limit);

    return new Response(
      JSON.stringify({
        success: true,
        leads,
        usage: { used: totalUsed + 2, limit },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[extract-leads] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
