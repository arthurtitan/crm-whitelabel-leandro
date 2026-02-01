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

// ============================================================================
// CAMADA 1: ATENDIMENTO EM TEMPO REAL
// Quem ESTÁ atendendo agora? (baseado no assignee atual)
// ============================================================================
function classifyCurrentHandler(conv: any): 'ai' | 'human' | 'none' {
  const hasBotAssignee = conv.meta?.assignee?.type === 'AgentBot' || !!conv.agent_bot_id;
  const hasHumanAssignee = !!(conv.meta?.assignee?.id || conv.assignee_id) && !hasBotAssignee;

  // 1) Bot nativo sempre conta como IA
  if (hasBotAssignee) return 'ai';

  // 2) ASSIGNEE MANDA: se há humano atribuído, é atendimento humano
  //    (mesmo que ai_responded exista - o humano "assumiu" a conversa)
  if (hasHumanAssignee) return 'human';

  // 3) Se não há assignee humano mas a IA respondeu, conta como IA
  const custom = conv.custom_attributes || {};
  const additional = conv.additional_attributes || {};
  const aiResponded = custom.ai_responded === true || additional.ai_responded === true;
  
  if (aiResponded) return 'ai';

  return 'none';
}

// ============================================================================
// CAMADA 2: RESOLUÇÃO (HISTÓRICO)
// Quem RESOLVEU o problema? (baseado em resolved_by explícito do n8n)
// ============================================================================
interface ResolverResult {
  type: 'ai' | 'human' | 'unclassified';
  method: 'explicit' | 'bot_native' | 'inferred' | 'fallback' | 'none';
}

function classifyResolver(conv: any): ResolverResult {
  // Só classificamos conversas resolvidas na Camada 2
  if (conv.status !== 'resolved') {
    return { type: 'unclassified', method: 'none' };
  }
  
  const custom = conv.custom_attributes || {};
  const additional = conv.additional_attributes || {};
  
  // PRIORIDADE 1: Campo explícito resolved_by (gravado pelo n8n)
  const resolvedBy = custom.resolved_by || additional.resolved_by;
  
  if (resolvedBy === 'ai') {
    return { type: 'ai', method: 'explicit' };
  }
  if (resolvedBy === 'human') {
    return { type: 'human', method: 'explicit' };
  }
  
  // PRIORIDADE 2: Bot nativo do Chatwoot
  const hasBotAssignee = conv.meta?.assignee?.type === 'AgentBot';
  const hasAgentBotId = !!conv.agent_bot_id;
  
  if (hasBotAssignee || hasAgentBotId) {
    return { type: 'ai', method: 'bot_native' };
  }
  
  // PRIORIDADE 3: Inferência baseada em ai_responded + assignee
  const aiResponded = custom.ai_responded === true || additional.ai_responded === true;
  const hasHumanAssignee = !!(conv.meta?.assignee?.id || conv.assignee_id) && !hasBotAssignee;
  
  if (aiResponded) {
    // IA respondeu mas temos assignee humano = humano encerrou (transbordo)
    if (hasHumanAssignee) {
      return { type: 'human', method: 'inferred' };
    }
    // IA respondeu sem assignee humano = IA resolveu
    return { type: 'ai', method: 'inferred' };
  }
  
  // PRIORIDADE 4: Fallback - Assignee humano encerrou
  if (hasHumanAssignee) {
    return { type: 'human', method: 'fallback' };
  }
  
  return { type: 'unclassified', method: 'none' };
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

    // ========================================================================
    // CONTADORES
    // ========================================================================
    let openCount = 0;
    let resolvedCount = 0;
    let pendingCount = 0;
    let unattendedCount = 0;

    // CAMADA 1: Atendimento em tempo real (conversas abertas)
    const atendimento = {
      total: 0,
      ia: 0,
      humano: 0,
      semAssignee: 0,
    };

    // CAMADA 2: Resolução (conversas resolvidas)
    const resolucao = {
      total: 0,
      ia: { total: 0, explicito: 0, botNativo: 0, inferido: 0 },
      humano: { total: 0, explicito: 0, inferido: 0 },
      naoClassificado: 0,
      transbordoFinalizado: 0,
    };

    // Classificação audit
    const classificacao = {
      metodologiaExplicita: 0,
      metodologiaInferida: 0,
      metodologiaFallback: 0,
      metodologiaBotNativo: 0,
    };

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

      const custom = conv.custom_attributes || {};
      const additional = conv.additional_attributes || {};
      const aiResponded = custom.ai_responded === true || additional.ai_responded === true;
      const handoffMarked = custom.handoff_to_human === true || additional.handoff_to_human === true;
      const hasBotAssignee = conv.meta?.assignee?.type === 'AgentBot' || !!conv.agent_bot_id;
      const hasHumanAssignee = !!(conv.meta?.assignee?.id || conv.assignee_id) && !hasBotAssignee;

      // ======================================================================
      // CAMADA 1: Atendimento (todas as conversas abertas)
      // ======================================================================
      if (conv.status === 'open') {
        atendimento.total++;
        const handler = classifyCurrentHandler(conv);
        
        if (handler === 'ai') {
          atendimento.ia++;
        } else if (handler === 'human') {
          atendimento.humano++;
        } else {
          atendimento.semAssignee++;
        }
        // Transbordo só é contabilizado em conversas RESOLVIDAS (Camada 2)
      }

      // ======================================================================
      // CAMADA 2: Resolução (apenas conversas resolvidas)
      // ======================================================================
      if (conv.status === 'resolved') {
        resolucao.total++;
        const resolver = classifyResolver(conv);
        
        if (resolver.type === 'ai') {
          resolucao.ia.total++;
          if (resolver.method === 'explicit') {
            resolucao.ia.explicito++;
            classificacao.metodologiaExplicita++;
          } else if (resolver.method === 'bot_native') {
            resolucao.ia.botNativo++;
            classificacao.metodologiaBotNativo++;
          } else if (resolver.method === 'inferred') {
            resolucao.ia.inferido++;
            classificacao.metodologiaInferida++;
          }
        } else if (resolver.type === 'human') {
          resolucao.humano.total++;
          if (resolver.method === 'explicit') {
            resolucao.humano.explicito++;
            classificacao.metodologiaExplicita++;
          } else if (resolver.method === 'inferred') {
            resolucao.humano.inferido++;
            classificacao.metodologiaInferida++;
          } else if (resolver.method === 'fallback') {
            classificacao.metodologiaFallback++;
          }
        } else {
          resolucao.naoClassificado++;
        }
        
        // Transbordo finalizado: IA iniciou (ou marcou handoff) + humano fechou
        if ((aiResponded || handoffMarked) && resolver.type === 'human') {
          resolucao.transbordoFinalizado++;
        }
      }

      // Track agent stats (human agents only)
      if (hasHumanAssignee) {
        const agentIdVal = conv.meta?.assignee?.id || conv.assignee_id;
        if (agentStats[agentIdVal]) {
          agentStats[agentIdVal].conversations++;
          if (conv.status === 'resolved') {
            agentStats[agentIdVal].resolved++;
          }
          
          // Calculate response time if available
          if (conv.first_reply_created_at && conv.created_at) {
            const createdAtMs = typeof conv.created_at === 'number'
              ? conv.created_at * 1000
              : new Date(conv.created_at).getTime();
            const firstReplyMs = typeof conv.first_reply_created_at === 'number'
              ? conv.first_reply_created_at * 1000
              : new Date(conv.first_reply_created_at).getTime();
            const responseTime = firstReplyMs - createdAtMs;
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
          waitingMs = now - (conv.waiting_since * 1000);
        } else {
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

    // Debug log
    console.log('[Chatwoot Metrics] Classification results:', {
      atendimento,
      resolucao,
      classificacao,
    });

    // ========================================================================
    // TAXAS CALCULADAS
    // ========================================================================
    const totalResolvidosClassificados = resolucao.ia.total + resolucao.humano.total;
    
    // Taxa de resolução IA (% das resolvidas classificadas)
    const taxaResolucaoIA = totalResolvidosClassificados > 0 
      ? Math.round((resolucao.ia.total / totalResolvidosClassificados) * 100) 
      : 0;
    const taxaResolucaoHumano = totalResolvidosClassificados > 0 
      ? 100 - taxaResolucaoIA 
      : 0;
    
    // Taxa de transbordo (% das iniciadas por IA que terminaram com humano)
    const iniciadasPorIACount = resolucao.ia.total + resolucao.transbordoFinalizado;
    const taxaTransbordo = iniciadasPorIACount > 0
      ? Math.round((resolucao.transbordoFinalizado / iniciadasPorIACount) * 100)
      : 0;
    
    // Eficiência da IA (% de conversas que IA resolveu sozinha do total resolvido)
    const eficienciaIA = resolucao.total > 0
      ? Math.round((resolucao.ia.total / resolucao.total) * 100)
      : 0;

    const taxas = {
      resolucaoIA: `${taxaResolucaoIA}%`,
      resolucaoHumano: `${taxaResolucaoHumano}%`,
      transbordo: `${taxaTransbordo}%`,
      eficienciaIA: `${eficienciaIA}%`,
    };

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
        // KPIs básicos
        totalLeads: finalConversations.length,
        conversasAtivas: openCount,
        conversasResolvidas: resolvedCount,
        conversasPendentes: pendingCount,
        conversasSemResposta: unattendedCount,

        // CAMADA 1: Atendimento em tempo real
        atendimento,
        
        // CAMADA 2: Resolução (histórico)
        resolucao,
        
        // Taxas calculadas
        taxas,
        
        // Retrocompatibilidade (campos antigos)
        atendimentosIA: resolucao.ia.total,
        atendimentosHumano: resolucao.humano.total,
        atendimentosClassificados: totalResolvidosClassificados,
        percentualIA: taxaResolucaoIA,
        percentualHumano: taxaResolucaoHumano,
        taxaTransbordo: taxas.transbordo,
        
        // Transbordo detalhado (só em resoluções)
        transbordo: {
          total: resolucao.transbordoFinalizado,
          iniciadasPorIA: iniciadasPorIACount,
          taxa: taxas.transbordo,
        },
        
        // Time metrics
        tempoMedioPrimeiraResposta: formatTime(avgFirstResponseMs),
        tempoMedioResolucao: '0s', // Would need message-level data
        
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
        
        // Debug/Auditoria
        _debug: {
          totalConversationsRaw: allConversations.length,
          totalConversationsFiltered: finalConversations.length,
          atendimento,
          resolucao,
          classificacao,
          inboxesCount: inboxes.length,
          agentsCount: agents.length,
          dateRange: { from: dateFrom, to: dateTo },
        },
      },
    };

    console.log('[Chatwoot Metrics] Response ready:', {
      totalLeads: response.data.totalLeads,
      conversasAtivas: response.data.conversasAtivas,
      atendimento: response.data.atendimento,
      resolucao: response.data.resolucao,
      taxas: response.data.taxas,
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
