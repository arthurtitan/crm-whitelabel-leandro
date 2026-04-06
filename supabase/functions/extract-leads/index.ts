import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { account_id, nicho, localizacao } = await req.json();

    if (!account_id || !nicho || !localizacao) {
      return new Response(
        JSON.stringify({ success: false, error: 'account_id, nicho and localizacao are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the n8n webhook URL from secrets
    const n8nWebhookUrl = Deno.env.get('N8N_EXTRACT_LEADS_WEBHOOK_URL');
    if (!n8nWebhookUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'N8N webhook URL not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[extract-leads] Calling n8n webhook:', { nicho, localizacao });

    // Call n8n webhook synchronously
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nicho, localizacao }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('[extract-leads] n8n error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to extract leads from n8n' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leads = await n8nResponse.json();
    console.log('[extract-leads] Got', Array.isArray(leads) ? leads.length : 0, 'leads');

    return new Response(
      JSON.stringify({ success: true, leads: Array.isArray(leads) ? leads : [] }),
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
