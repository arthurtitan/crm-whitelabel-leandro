import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keep total runtime comfortably below typical serverless request limits.
// If a Chatwoot instance is unreachable/blocked, we prefer failing fast with a clear message
// instead of the client seeing a generic "Failed to send a request...".
const CHATWOOT_FETCH_TIMEOUT_MS = 25000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// Secondary metadata (inboxes/labels) should not delay the primary validation.
const CHATWOOT_SECONDARY_TIMEOUT_MS = 6000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = CHATWOOT_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(url: string, init: RequestInit, context: string): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const startTime = Date.now();
    console.log(`[${context}] Attempt ${attempt}/${MAX_RETRIES} - Starting request to: ${url}`);
    
    try {
      const response = await fetchWithTimeout(url, init);
      const elapsed = Date.now() - startTime;
      console.log(`[${context}] Attempt ${attempt} succeeded in ${elapsed}ms - Status: ${response.status}`);
      return response;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      lastError = error instanceof Error ? error : new Error(String(error));
      
      console.error(`[${context}] Attempt ${attempt} failed after ${elapsed}ms: ${lastError.message}`);
      
      // If we timed out, retrying rarely helps and can exceed request time limits.
      if (lastError.name === 'AbortError') {
        break;
      }

      if (attempt < MAX_RETRIES) {
        console.log(`[${context}] Waiting ${RETRY_DELAY_MS}ms before retry...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  
  throw lastError;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStartTime = Date.now();
  console.log(`[Chatwoot Test] Request started at ${new Date().toISOString()}`);

  try {
    const { baseUrl, accountId, apiKey } = await req.json();

     if (!baseUrl || !accountId || !apiKey) {
       return new Response(
         JSON.stringify({ success: false, error: 'Missing required parameters' }),
         { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }

    const normalizedBaseUrl = String(baseUrl).trim().replace(/\/$/, '');
    const normalizedAccountId = String(accountId).trim();
    const normalizedApiKey = String(apiKey).trim();

    // Test connection by fetching agents (primary test)
    const agentsUrl = `${normalizedBaseUrl}/api/v1/accounts/${normalizedAccountId}/agents`;
    const hostname = new URL(normalizedBaseUrl).hostname;
    console.log(`[Chatwoot Test] Testing connection to: ${normalizedBaseUrl} (host: ${hostname})`);

    const commonInit: RequestInit = {
      method: 'GET',
      headers: {
        'api_access_token': normalizedApiKey,
        'Accept': 'application/json',
        'User-Agent': 'LovableCRM/1.0 (Chatwoot Integration)',
      },
      redirect: 'follow',
    };

    let agents: any[] = [];
    
    try {
      const response = await fetchWithRetry(agentsUrl, commonInit, 'Agents');

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Chatwoot Test] API error: ${response.status} - ${errorText}`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Chatwoot API returned ${response.status}`,
            details: errorText 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      agents = await response.json();
      console.log(`[Chatwoot Test] Found ${agents.length} agents`);
    } catch (error) {
      const elapsed = Date.now() - requestStartTime;
      console.error(`[Chatwoot Test] Failed to fetch agents after ${elapsed}ms:`, error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Timeout ao conectar com Chatwoot após ${Math.round(elapsed / 1000)}s. Verifique se o servidor está acessível e se não há bloqueio de firewall para IPs externos.`,
            details: `URL testada: ${agentsUrl}`
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw error;
    }

    // Fetch inboxes and labels in parallel (non-blocking)
    const inboxesUrl = `${normalizedBaseUrl}/api/v1/accounts/${normalizedAccountId}/inboxes`;
    const labelsUrl = `${normalizedBaseUrl}/api/v1/accounts/${normalizedAccountId}/labels`;

    console.log(`[Chatwoot Test] Fetching inboxes and labels in parallel...`);

    const [inboxesResult, labelsResult] = await Promise.allSettled([
      fetchWithTimeout(inboxesUrl, commonInit, CHATWOOT_SECONDARY_TIMEOUT_MS).catch((e) => {
        console.warn(`[Inboxes] Failed: ${e?.message || String(e)}`);
        return null;
      }),
      fetchWithTimeout(labelsUrl, commonInit, CHATWOOT_SECONDARY_TIMEOUT_MS).catch((e) => {
        console.warn(`[Labels] Failed: ${e?.message || String(e)}`);
        return null;
      }),
    ]);

    let inboxes: any[] = [];
    if (inboxesResult.status === 'fulfilled' && inboxesResult.value) {
      const inboxesResponse = inboxesResult.value;
      if (inboxesResponse.ok) {
        const inboxesData = await inboxesResponse.json();
        inboxes = inboxesData.payload || inboxesData || [];
        console.log(`[Chatwoot Test] Found ${inboxes.length} inboxes`);
      } else {
        await inboxesResponse.text(); // consume body
        console.warn(`[Chatwoot Test] Inboxes request failed with status ${inboxesResponse.status}`);
      }
    }

    let labels: any[] = [];
    if (labelsResult.status === 'fulfilled' && labelsResult.value) {
      const labelsResponse = labelsResult.value;
      if (labelsResponse.ok) {
        const labelsData = await labelsResponse.json();
        labels = labelsData.payload || labelsData || [];
        console.log(`[Chatwoot Test] Found ${labels.length} labels`);
      } else {
        await labelsResponse.text(); // consume body
        console.warn(`[Chatwoot Test] Labels request failed with status ${labelsResponse.status}`);
      }
    }

    const totalElapsed = Date.now() - requestStartTime;
    console.log(`[Chatwoot Test] Request completed successfully in ${totalElapsed}ms`);

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
        timing: {
          totalMs: totalElapsed,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const elapsed = Date.now() - requestStartTime;
    console.error(`[Chatwoot Test] Error after ${elapsed}ms:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // AbortError is a network/timeout symptom; return a clearer message
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Timeout ao conectar com Chatwoot após ${Math.round(elapsed / 1000)}s. Possíveis causas: servidor lento, firewall bloqueando requisições externas, ou instância indisponível.`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Always reply with 200 + { success: false } so the UI can surface a friendly message.
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
