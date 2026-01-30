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

async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      
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

// Fetch all conversations with pagination
async function fetchAllConversations(
  baseUrl: string, 
  accountId: string, 
  headers: Record<string, string>,
  status: string = 'all'
): Promise<any[]> {
  const allConversations: any[] = [];
  let page = 1;
  const perPage = 50;
  let hasMore = true;

  while (hasMore && page <= 10) { // Max 10 pages (500 conversations)
    try {
      const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations?status=${status}&page=${page}&per_page=${perPage}`;
      console.log(`[Chatwoot] Fetching conversations page ${page}...`);
      
      const response = await fetchWithRetry(url, { headers });
      
      if (!response.ok) {
        console.error(`[Chatwoot] Conversations fetch failed: ${response.status}`);
        break;
      }

      const data = await response.json();
      const conversations = data.data?.payload || data.payload || [];
      
      if (conversations.length === 0) {
        hasMore = false;
      } else {
        allConversations.push(...conversations);
        page++;
        
        // Check if we got less than requested (last page)
        if (conversations.length < perPage) {
          hasMore = false;
        }
      }
    } catch (err) {
      console.error(`[Chatwoot] Error fetching page ${page}:`, err);
      break;
    }
  }

  return allConversations;
}

// Fetch team members (agents)
async function fetchAgents(
  baseUrl: string,
  accountId: string,
  headers: Record<string, string>
): Promise<any[]> {
  try {
    // Try the agents endpoint first
    const agentsUrl = `${baseUrl}/api/v1/accounts/${accountId}/agents`;
    console.log('[Chatwoot] Fetching agents...');
    
    const response = await fetchWithRetry(agentsUrl, { headers });
    
    if (response.ok) {
      const data = await response.json();
      const agents = Array.isArray(data) ? data : (data.payload || []);
      console.log(`[Chatwoot] Found ${agents.length} agents`);
      return agents;
    }
    
    console.error(`[Chatwoot] Agents fetch failed: ${response.status}`);
    return [];
  } catch (err) {
    console.error('[Chatwoot] Error fetching agents:', err);
    return [];
  }
}

serve(async (req) => {
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

    // Parse date range
    const dateFromParsed = new Date(dateFrom);
    const dateToParsed = new Date(dateTo);

    // Fetch data in parallel
    const [allConversations, agents, inboxesResponse] = await Promise.all([
      fetchAllConversations(normalizedBaseUrl, normalizedAccountId, headers, 'all'),
      fetchAgents(normalizedBaseUrl, normalizedAccountId, headers),
      fetchWithRetry(
        `${normalizedBaseUrl}/api/v1/accounts/${normalizedAccountId}/inboxes`,
        { headers }
      ),
    ]);

    // Parse inboxes
    let inboxes: any[] = [];
    if (inboxesResponse.ok) {
      const data = await inboxesResponse.json();
      inboxes = data.payload || [];
    }

    console.log('[Chatwoot Metrics] Raw data:', {
      totalConversations: allConversations.length,
      agents: agents.length,
      inboxes: inboxes.length,
    });

    // Filter conversations by date range (using last_activity_at OR created_at for better coverage)
    const conversations = allConversations.filter((conv: any) => {
      // Use last_activity_at if available, otherwise fall back to created_at
      const activityDate = conv.last_activity_at 
        ? new Date(conv.last_activity_at * 1000) // Unix timestamp in seconds
        : new Date(conv.created_at);
      const createdAt = new Date(conv.created_at);
      
      // Include if created in range OR had activity in range
      const createdInRange = createdAt >= dateFromParsed && createdAt <= dateToParsed;
      const activeInRange = activityDate >= dateFromParsed && activityDate <= dateToParsed;
      
      return createdInRange || activeInRange;
    });

    // Apply inbox filter if provided
    const filteredConversations = inboxId 
      ? conversations.filter((c: any) => c.inbox_id === inboxId)
      : conversations;

    // Apply agent filter if provided
    const finalConversations = agentId
      ? filteredConversations.filter((c: any) => 
          c.meta?.assignee?.id === agentId || c.assignee_id === agentId
        )
      : filteredConversations;

    console.log('[Chatwoot Metrics] Filtered conversations:', {
      afterDateFilter: conversations.length,
      afterInboxFilter: filteredConversations.length,
      afterAgentFilter: finalConversations.length,
    });

    // Calculate metrics from conversations
    let openCount = 0;
    let resolvedCount = 0;
    let pendingCount = 0;
    let unattendedCount = 0;
    let botConversations = 0;
    let humanConversations = 0;
    let mixedConversations = 0; // Conversas com IA + Humano

    // Agent performance tracking
    const agentStats: Record<number, {
      name: string;
      email: string;
      thumbnail?: string;
      conversations: number;
      resolved: number;
      totalResponseTime: number;
      responseCount: number;
    }> = {};

    // Initialize agent stats
    for (const agent of agents) {
      agentStats[agent.id] = {
        name: agent.name || agent.email,
        email: agent.email,
        thumbnail: agent.thumbnail,
        conversations: 0,
        resolved: 0,
        totalResponseTime: 0,
        responseCount: 0,
      };
    }

    // Hourly distribution
    const hourlyCount: Record<number, number> = {};
    for (let h = 0; h <= 23; h++) hourlyCount[h] = 0;

    // Backlog calculation
    const now = Date.now();
    const backlog = { ate15min: 0, de15a60min: 0, acima60min: 0 };

    for (const conv of finalConversations) {
      // Count by status
      switch (conv.status) {
        case 'open':
          openCount++;
          break;
        case 'resolved':
          resolvedCount++;
          break;
        case 'pending':
          pendingCount++;
          break;
      }

      // Unattended check
      if (conv.agent_last_seen_at === null && conv.status === 'open') {
        unattendedCount++;
      }

      // Bot vs Human detection - IMPROVED LOGIC
      // Check multiple indicators for bot involvement
      const assignee = conv.meta?.assignee;
      const hasBotAssignee = assignee?.type === 'AgentBot';
      const hasAgentBotId = !!conv.agent_bot_id;
      const hasHumanAssignee = !!(assignee?.id || conv.assignee_id) && !hasBotAssignee;
      
      // Check additional_attributes for bot/automation info (some Chatwoot configs use this)
      const additionalAttrs = conv.additional_attributes || {};
      const hasBotActivity = additionalAttrs.bot_handled === true || 
                             additionalAttrs.automation_id != null ||
                             additionalAttrs.initiated_by === 'bot' ||
                             additionalAttrs.source === 'automation';
      
      // Check if first reply was from bot (common pattern)
      const firstReplyByBot = conv.first_reply_created_at && !hasHumanAssignee && !conv.agent_last_seen_at;
      
      // Determine conversation type
      const isBotConversation = hasBotAssignee || hasAgentBotId || hasBotActivity;
      const isHumanConversation = hasHumanAssignee;
      
      if (isBotConversation && isHumanConversation) {
        // Mixed: both bot and human involved (transbordo)
        mixedConversations++;
        humanConversations++; // Count as human since human took over
      } else if (isBotConversation) {
        botConversations++;
      } else if (isHumanConversation) {
        humanConversations++;
      }
      // Note: conversations without any assignee are not counted in either category
      
      // Track agent stats (human agents only)
      if (hasHumanAssignee) {
        const agentIdVal = assignee?.id || conv.assignee_id;
        if (agentStats[agentIdVal]) {
          agentStats[agentIdVal].conversations++;
          if (conv.status === 'resolved') {
            agentStats[agentIdVal].resolved++;
          }
          
          // Calculate response time if available
          if (conv.first_reply_created_at && conv.created_at) {
            const responseTime = new Date(conv.first_reply_created_at).getTime() - 
                                 new Date(conv.created_at).getTime();
            if (responseTime > 0) {
              agentStats[agentIdVal].totalResponseTime += responseTime;
              agentStats[agentIdVal].responseCount++;
            }
          }
        }
      }

      // Hourly distribution
      const createdAt = new Date(conv.created_at);
      const hour = createdAt.getHours();
      hourlyCount[hour]++;

      // Backlog (open conversations waiting for response)
      if (conv.status === 'open') {
        let waitingMs: number;
        
        if (conv.waiting_since) {
          // Usar waiting_since se disponível (timestamp Unix em segundos)
          waitingMs = now - (conv.waiting_since * 1000);
        } else {
          // Fallback: usar last_activity_at ou created_at
          const lastActivity = conv.last_activity_at 
            ? conv.last_activity_at * 1000 
            : new Date(conv.created_at).getTime();
          waitingMs = now - lastActivity;
        }
        
        const waitingMinutes = waitingMs / 60000;
        
        if (waitingMinutes <= 15) backlog.ate15min++;
        else if (waitingMinutes <= 60) backlog.de15a60min++;
        else backlog.acima60min++;
      }
    }

    // Debug log para backlog e IA detection
    console.log('[Chatwoot Metrics] Bot detection results:', {
      botConversations,
      humanConversations,
      mixedConversations,
      openConversations: finalConversations.filter((c: any) => c.status === 'open').length,
      withWaitingSince: finalConversations.filter((c: any) => c.waiting_since).length,
      backlog,
    });

    // Log sample conversation for debugging IA detection
    if (finalConversations.length > 0) {
      const sampleConv = finalConversations[0];
      console.log('[Chatwoot Metrics] Sample conversation structure:', {
        id: sampleConv.id,
        status: sampleConv.status,
        assignee: sampleConv.meta?.assignee,
        agent_bot_id: sampleConv.agent_bot_id,
        assignee_id: sampleConv.assignee_id,
        additional_attributes: sampleConv.additional_attributes,
        first_reply_created_at: sampleConv.first_reply_created_at,
        agent_last_seen_at: sampleConv.agent_last_seen_at,
      });
    }

    // Calculate percentages
    const totalAssigned = botConversations + humanConversations;
    const percentualIA = totalAssigned > 0 ? Math.round((botConversations / totalAssigned) * 100) : 0;
    const percentualHumano = totalAssigned > 0 ? 100 - percentualIA : 0;

    // Format time helper
    const formatTime = (ms: number): string => {
      const seconds = Math.floor(ms / 1000);
      if (seconds < 60) return `${seconds}s`;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      if (mins < 60) return `${mins}m ${secs}s`;
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    };

    // Calculate average response time
    let totalResponseTime = 0;
    let totalResponseCount = 0;
    for (const stats of Object.values(agentStats)) {
      totalResponseTime += stats.totalResponseTime;
      totalResponseCount += stats.responseCount;
    }
    const avgFirstResponseMs = totalResponseCount > 0 
      ? totalResponseTime / totalResponseCount 
      : 0;

    // Build agent performance array
    const agentPerformance = Object.entries(agentStats)
      .filter(([_, stats]) => stats.conversations > 0)
      .map(([id, stats]) => ({
        agentId: parseInt(id),
        agentName: stats.name,
        agentEmail: stats.email,
        thumbnail: stats.thumbnail,
        atendimentosAssumidos: stats.conversations,
        atendimentosResolvidos: stats.resolved,
        tempoMedioResposta: stats.responseCount > 0 
          ? formatTime(stats.totalResponseTime / stats.responseCount)
          : '0s',
        taxaResolucao: stats.conversations > 0
          ? Math.round((stats.resolved / stats.conversations) * 100)
          : 0,
      }));

    // Conversations by channel
    const conversasPorCanal = inboxes.map((inbox: any) => {
      const inboxConversations = finalConversations.filter(
        (c: any) => c.inbox_id === inbox.id
      ).length;
      
      let mappedChannel = 'webchat';
      const channelType = inbox.channel_type || '';
      if (channelType.includes('Whatsapp')) mappedChannel = 'whatsapp';
      else if (channelType.includes('Instagram') || channelType.includes('Facebook')) mappedChannel = 'instagram';
      
      return {
        inboxId: inbox.id,
        canal: mappedChannel,
        inboxName: inbox.name,
        totalConversas: inboxConversations,
      };
    });

    // Hourly peak (business hours only)
    const picoPorHora = Object.entries(hourlyCount)
      .filter(([hora]) => Number(hora) >= 7 && Number(hora) <= 21)
      .map(([hora, total]) => ({
        hora: Number(hora),
        totalConversas: total,
      }));

    const response = {
      success: true,
      data: {
        // KPIs
        totalLeads: finalConversations.length,
        conversasAtivas: openCount,
        conversasResolvidas: resolvedCount,
        conversasPendentes: pendingCount,
        conversasSemResposta: unattendedCount,
        
        // IA vs Human
        percentualIA,
        percentualHumano,
        
        // Time metrics
        tempoMedioPrimeiraResposta: formatTime(avgFirstResponseMs),
        tempoMedioResolucao: '0s', // Would need message-level data
        
        // Transbordo rate
        taxaTransbordo: totalAssigned > 0 
          ? `${Math.round((unattendedCount / totalAssigned) * 100)}%`
          : '0%',
        
        // Channel breakdown
        conversasPorCanal,
        
        // Hourly peak
        picoPorHora,
        
        // Backlog
        backlog,
        
        // Agent performance
        agentes: agentPerformance,
        
        // Quality metrics
        qualidade: {
          conversasSemResposta: unattendedCount,
          taxaAtendimentoVenda: '0%',
        },
        
        // Debug info
        _debug: {
          totalConversationsRaw: allConversations.length,
          totalConversationsFiltered: finalConversations.length,
          botConversations,
          humanConversations,
          inboxesCount: inboxes.length,
          agentsCount: agents.length,
          dateRange: { from: dateFrom, to: dateTo },
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
