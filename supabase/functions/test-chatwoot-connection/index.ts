import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHATWOOT_FETCH_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHATWOOT_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baseUrl, accountId, apiKey } = await req.json();

    if (!baseUrl || !accountId || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedBaseUrl = String(baseUrl).trim().replace(/\/$/, '');
    const normalizedAccountId = String(accountId).trim();
    const normalizedApiKey = String(apiKey).trim();

    // Test connection by fetching agents
    const agentsUrl = `${normalizedBaseUrl}/api/v1/accounts/${normalizedAccountId}/agents`;
    console.log(`Testing Chatwoot connection: ${agentsUrl}`);

    const response = await fetchWithTimeout(agentsUrl, {
      method: 'GET',
      headers: {
        'api_access_token': normalizedApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Chatwoot API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Chatwoot API returned ${response.status}`,
          details: errorText 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const agents = await response.json();
    console.log(`Found ${agents.length} agents`);

    // Also fetch inboxes to get available channels
    const inboxesUrl = `${normalizedBaseUrl}/api/v1/accounts/${normalizedAccountId}/inboxes`;
    const labelsUrl = `${normalizedBaseUrl}/api/v1/accounts/${normalizedAccountId}/labels`;

    const commonInit: RequestInit = {
      method: 'GET',
      headers: {
        'api_access_token': normalizedApiKey,
        'Content-Type': 'application/json',
      },
    };

    const [inboxesResult, labelsResult] = await Promise.allSettled([
      fetchWithTimeout(inboxesUrl, commonInit),
      fetchWithTimeout(labelsUrl, commonInit),
    ]);

    let inboxes: any[] = [];
    if (inboxesResult.status === 'fulfilled') {
      const inboxesResponse = inboxesResult.value;
      if (inboxesResponse.ok) {
        const inboxesData = await inboxesResponse.json();
        inboxes = inboxesData.payload || inboxesData || [];
        console.log(`Found ${inboxes.length} inboxes`);
      } else {
        await inboxesResponse.text(); // consume body
      }
    }

    let labels: any[] = [];
    if (labelsResult.status === 'fulfilled') {
      const labelsResponse = labelsResult.value;
      if (labelsResponse.ok) {
        const labelsData = await labelsResponse.json();
        labels = labelsData.payload || labelsData || [];
        console.log(`Found ${labels.length} labels`);
      } else {
        await labelsResponse.text(); // consume body
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        agents: agents.map((a: any) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          role: a.role,
          availability_status: a.availability_status,
        })),
        inboxes: inboxes.map((i: any) => ({
          id: i.id,
          name: i.name,
          channel_type: i.channel_type,
        })),
        labels: labels.map((l: any) => ({
          id: l.id,
          title: l.title,
          color: l.color,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error testing Chatwoot connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // AbortError is a network/timeout symptom; return a clearer message
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ success: false, error: 'Timeout ao conectar com Chatwoot. Tente novamente.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
