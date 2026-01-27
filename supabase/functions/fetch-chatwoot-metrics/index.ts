import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface MetricsRequest {
  baseUrl: string;
  accountId: string;
  apiKey: string;
  dateFrom: string;
  dateTo: string;
  inboxId?: number;
  agentId?: number;
}

interface ConversationSummary {
  open: number;
  unattended: number;
  pending: number;
  resolved: number;
}

interface AgentMetric {
  id: number;
  name: string;
  email: string;
  thumbnail?: string;
  conversations_count: number;
  resolved_count?: number;
  avg_first_response_time?: number;
  avg_resolution_time?: number;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.log(`[Retry ${i + 1}/${retries + 1}] Failed: ${lastError.message}`);
      if (i < retries) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: MetricsRequest = await req.json();
    const { baseUrl, accountId, apiKey, dateFrom, dateTo, inboxId, agentId } = body;

    console.log('[Chatwoot Metrics] Starting fetch...', { 
      baseUrl, 
      accountId, 
      dateFrom, 
      dateTo,
      inboxId,
      agentId 
    });

    // Normalize inputs
    const normalizedBaseUrl = baseUrl?.trim().replace(/\/$/, '');
    const normalizedAccountId = accountId?.trim();
    const normalizedApiKey = apiKey?.trim();

    if (!normalizedBaseUrl || !normalizedAccountId || !normalizedApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Credenciais Chatwoot não configuradas' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const headers = {
      'api_access_token': normalizedApiKey,
      'Accept': 'application/json',
      'User-Agent': 'LovableCRM/1.0 (Chatwoot Metrics)',
    };

    // Convert dates to Unix timestamps (Chatwoot API uses seconds)
    const since = Math.floor(new Date(dateFrom).getTime() / 1000);
    const until = Math.floor(new Date(dateTo).getTime() / 1000);

    // Build query params
    const baseParams = new URLSearchParams({
      since: since.toString(),
      until: until.toString(),
    });
    
    if (inboxId) baseParams.append('inbox_id', inboxId.toString());

    // Fetch multiple endpoints in parallel
    const [
      summaryResponse,
      agentsResponse,
      conversationsResponse,
      inboxesResponse,
    ] = await Promise.allSettled([
      // 1. Conversation summary (open, resolved, pending)
      fetchWithRetry(
        `${normalizedBaseUrl}/api/v1/accounts/${normalizedAccountId}/reports/summary?type=conversations&${baseParams}`,
        { headers }
      ),
      // 2. Agent metrics
      fetchWithRetry(
        `${normalizedBaseUrl}/api/v1/accounts/${normalizedAccountId}/reports/agents?${baseParams}`,
        { headers }
      ),
      // 3. Conversations list (for IA vs Human calculation)
      fetchWithRetry(
        `${normalizedBaseUrl}/api/v1/accounts/${normalizedAccountId}/conversations?status=all`,
        { headers }
      ),
      // 4. Inboxes (for channel breakdown)
      fetchWithRetry(
        `${normalizedBaseUrl}/api/v1/accounts/${normalizedAccountId}/inboxes`,
        { headers }
      ),
    ]);

    // Parse responses
    let summary: ConversationSummary = { open: 0, unattended: 0, pending: 0, resolved: 0 };
    let agents: AgentMetric[] = [];
    let conversations: any[] = [];
    let inboxes: any[] = [];

    // Process summary
    if (summaryResponse.status === 'fulfilled' && summaryResponse.value.ok) {
      try {
        const data = await summaryResponse.value.json();
        summary = {
          open: data.open || 0,
          unattended: data.unattended || 0,
          pending: data.pending || 0,
          resolved: data.resolved_count || data.resolved || 0,
        };
        console.log('[Chatwoot Metrics] Summary:', summary);
      } catch (e) {
        console.error('[Chatwoot Metrics] Failed to parse summary:', e);
      }
    }

    // Process agents
    if (agentsResponse.status === 'fulfilled' && agentsResponse.value.ok) {
      try {
        const data = await agentsResponse.value.json();
        agents = Array.isArray(data) ? data : (data.payload || []);
        console.log('[Chatwoot Metrics] Agents count:', agents.length);
      } catch (e) {
        console.error('[Chatwoot Metrics] Failed to parse agents:', e);
      }
    }

    // Process conversations (for IA vs Human)
    if (conversationsResponse.status === 'fulfilled' && conversationsResponse.value.ok) {
      try {
        const data = await conversationsResponse.value.json();
        conversations = data.data?.payload || data.payload || [];
        console.log('[Chatwoot Metrics] Conversations count:', conversations.length);
      } catch (e) {
        console.error('[Chatwoot Metrics] Failed to parse conversations:', e);
      }
    }

    // Process inboxes
    if (inboxesResponse.status === 'fulfilled' && inboxesResponse.value.ok) {
      try {
        const data = await inboxesResponse.value.json();
        inboxes = data.payload || [];
        console.log('[Chatwoot Metrics] Inboxes count:', inboxes.length);
      } catch (e) {
        console.error('[Chatwoot Metrics] Failed to parse inboxes:', e);
      }
    }

    // Calculate IA vs Human percentages
    let botConversations = 0;
    let humanConversations = 0;
    
    for (const conv of conversations) {
      // Check if assigned to bot or has bot interactions
      if (conv.meta?.assignee?.type === 'AgentBot' || conv.agent_bot_id) {
        botConversations++;
      } else if (conv.meta?.assignee?.id) {
        humanConversations++;
      }
    }
    
    const totalAssigned = botConversations + humanConversations;
    const percentualIA = totalAssigned > 0 ? Math.round((botConversations / totalAssigned) * 100) : 0;
    const percentualHumano = totalAssigned > 0 ? 100 - percentualIA : 0;

    // Calculate conversations by channel/inbox
    const conversasPorCanal = inboxes.map((inbox: any) => {
      const inboxConversations = conversations.filter(
        (c: any) => c.inbox_id === inbox.id
      ).length;
      
      let mappedChannel = 'webchat';
      if (inbox.channel_type?.includes('Whatsapp')) mappedChannel = 'whatsapp';
      else if (inbox.channel_type?.includes('Instagram') || inbox.channel_type?.includes('Facebook')) mappedChannel = 'instagram';
      
      return {
        inboxId: inbox.id,
        canal: mappedChannel,
        inboxName: inbox.name,
        totalConversas: inboxConversations,
      };
    });

    // Calculate hourly peak (from conversations)
    const hourlyCount: Record<number, number> = {};
    for (let h = 0; h <= 23; h++) hourlyCount[h] = 0;
    
    for (const conv of conversations) {
      const createdAt = new Date(conv.created_at);
      const hour = createdAt.getHours();
      hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
    }
    
    const picoPorHora = Object.entries(hourlyCount)
      .filter(([hora]) => Number(hora) >= 7 && Number(hora) <= 21) // Business hours
      .map(([hora, total]) => ({
        hora: Number(hora),
        totalConversas: total,
      }));

    // Calculate backlog (conversations without response)
    const now = Date.now();
    const backlog = { ate15min: 0, de15a60min: 0, acima60min: 0 };
    
    for (const conv of conversations) {
      if (conv.status === 'open' && !conv.waiting_since) continue;
      
      const waitingSince = conv.waiting_since 
        ? new Date(conv.waiting_since * 1000).getTime()
        : new Date(conv.last_activity_at || conv.created_at).getTime();
      
      const waitingMinutes = (now - waitingSince) / 60000;
      
      if (waitingMinutes <= 15) backlog.ate15min++;
      else if (waitingMinutes <= 60) backlog.de15a60min++;
      else backlog.acima60min++;
    }

    // Calculate average response times from agents
    let totalFirstResponseTime = 0;
    let totalResolutionTime = 0;
    let agentsWithMetrics = 0;
    
    for (const agent of agents) {
      if (agent.avg_first_response_time) {
        totalFirstResponseTime += agent.avg_first_response_time;
        agentsWithMetrics++;
      }
      if (agent.avg_resolution_time) {
        totalResolutionTime += agent.avg_resolution_time;
      }
    }
    
    const avgFirstResponseSeconds = agentsWithMetrics > 0 
      ? Math.round(totalFirstResponseTime / agentsWithMetrics)
      : 0;
    const avgResolutionSeconds = agentsWithMetrics > 0
      ? Math.round(totalResolutionTime / agentsWithMetrics)
      : 0;

    // Format time strings
    const formatTime = (seconds: number): string => {
      if (seconds < 60) return `${seconds}s`;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (mins < 60) return `${mins}m ${secs}s`;
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    };

    // Build response
    const response = {
      success: true,
      data: {
        // KPIs
        totalLeads: summary.open + summary.resolved + summary.pending,
        conversasAtivas: summary.open,
        conversasResolvidas: summary.resolved,
        conversasPendentes: summary.pending,
        conversasSemResposta: summary.unattended,
        
        // IA vs Human
        percentualIA,
        percentualHumano,
        
        // Time metrics
        tempoMedioPrimeiraResposta: formatTime(avgFirstResponseSeconds),
        tempoMedioResolucao: formatTime(avgResolutionSeconds),
        
        // Transbordo (bot to human transfers - estimate from unattended)
        taxaTransbordo: totalAssigned > 0 
          ? `${Math.round((summary.unattended / totalAssigned) * 100)}%`
          : '0%',
        
        // Channel breakdown
        conversasPorCanal,
        
        // Hourly peak
        picoPorHora,
        
        // Backlog
        backlog,
        
        // Agent performance
        agentes: agents.map(agent => ({
          agentId: agent.id,
          agentName: agent.name,
          agentEmail: agent.email,
          thumbnail: agent.thumbnail,
          atendimentosAssumidos: agent.conversations_count || 0,
          atendimentosResolvidos: agent.resolved_count || 0,
          tempoMedioResposta: formatTime(agent.avg_first_response_time || 0),
          taxaResolucao: agent.conversations_count > 0
            ? Math.round(((agent.resolved_count || 0) / agent.conversations_count) * 100)
            : 0,
        })),
        
        // Quality metrics
        qualidade: {
          conversasSemResposta: summary.unattended,
          taxaAtendimentoVenda: '0%', // Will be calculated with sales data
        },
        
        // Raw counts for debugging
        _debug: {
          totalConversations: conversations.length,
          botConversations,
          humanConversations,
          inboxesCount: inboxes.length,
          agentsCount: agents.length,
        },
      },
    };

    console.log('[Chatwoot Metrics] Response ready:', {
      totalLeads: response.data.totalLeads,
      conversasAtivas: response.data.conversasAtivas,
      agentes: response.data.agentes.length,
    });

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar métricas do Chatwoot';
    console.error('[Chatwoot Metrics] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
