import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Test connection by fetching agents
    const agentsUrl = `${baseUrl}/api/v1/accounts/${accountId}/agents`;
    console.log(`Testing Chatwoot connection: ${agentsUrl}`);

    const response = await fetch(agentsUrl, {
      method: 'GET',
      headers: {
        'api_access_token': apiKey,
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
    const inboxesUrl = `${baseUrl}/api/v1/accounts/${accountId}/inboxes`;
    const inboxesResponse = await fetch(inboxesUrl, {
      method: 'GET',
      headers: {
        'api_access_token': apiKey,
        'Content-Type': 'application/json',
      },
    });

    let inboxes = [];
    if (inboxesResponse.ok) {
      const inboxesData = await inboxesResponse.json();
      inboxes = inboxesData.payload || inboxesData || [];
      console.log(`Found ${inboxes.length} inboxes`);
    }

    // Fetch labels (tags) for Kanban sync
    const labelsUrl = `${baseUrl}/api/v1/accounts/${accountId}/labels`;
    const labelsResponse = await fetch(labelsUrl, {
      method: 'GET',
      headers: {
        'api_access_token': apiKey,
        'Content-Type': 'application/json',
      },
    });

    let labels = [];
    if (labelsResponse.ok) {
      const labelsData = await labelsResponse.json();
      labels = labelsData.payload || labelsData || [];
      console.log(`Found ${labels.length} labels`);
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
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
