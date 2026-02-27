/**
 * CHATWOOT METRICS SERVICE
 * 
 * Port of the Edge Function logic to Express backend.
 * Fetches raw data from Chatwoot API (conversations, agents, inboxes)
 * and computes DashboardMetrics locally — never calls /reports/summary.
 * Also queries resolution_logs via Prisma for persistent resolution data.
 */

import { prisma } from '../config/database';
import { logger } from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

interface ChatwootAccountConfig {
  baseUrl: string;
  accountId: string;
  apiKey: string;
}

interface MetricsParams {
  dateFrom: string;
  dateTo: string;
  inboxId?: number;
  agentId?: number;
}

interface ResolverResult {
  type: 'ai' | 'human' | 'unclassified';
  method: 'explicit' | 'bot_native' | 'inferred' | 'fallback' | 'none';
}

// ============================================================================
// CLASSIFICATION HELPERS
// ============================================================================

function classifyCurrentHandler(conv: any): 'ai' | 'human' | 'none' {
  const custom = conv.custom_attributes || {};
  const additional = conv.additional_attributes || {};
  const aiResponded = custom.ai_responded === true || additional.ai_responded === true;
  const hasHumanAssignee = !!(conv.meta?.assignee?.id || conv.assignee_id);

  if (aiResponded) return 'ai';
  if (hasHumanAssignee) return 'human';
  return 'none';
}

function classifyResolver(conv: any): ResolverResult {
  if (conv.status !== 'resolved') {
    return { type: 'unclassified', method: 'none' };
  }

  const custom = conv.custom_attributes || {};
  const additional = conv.additional_attributes || {};
  const resolvedBy = custom.resolved_by || additional.resolved_by;

  if (resolvedBy === 'ai') return { type: 'ai', method: 'explicit' };
  if (resolvedBy === 'human') return { type: 'human', method: 'explicit' };

  const hasBotAssignee = conv.meta?.assignee?.type === 'AgentBot' || !!conv.agent_bot_id;
  const hasHumanAssignee = !!(conv.meta?.assignee?.id || conv.assignee_id) && !hasBotAssignee;

  if (hasBotAssignee || !!conv.agent_bot_id) return { type: 'ai', method: 'bot_native' };

  const aiResponded = custom.ai_responded === true || additional.ai_responded === true;
  if (aiResponded) {
    return hasHumanAssignee
      ? { type: 'human', method: 'inferred' }
      : { type: 'ai', method: 'inferred' };
  }

  if (hasHumanAssignee) return { type: 'human', method: 'fallback' };
  return { type: 'unclassified', method: 'none' };
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

// ============================================================================
// CHATWOOT API FETCHERS
// ============================================================================

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 2): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(`[Chatwoot] Retry ${i + 1}/${retries + 1} failed: ${lastError.message}`);
      if (i < retries) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }

  throw lastError;
}

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

  while (hasMore && page <= 10) {
    try {
      const url = `${baseUrl}/api/v1/accounts/${accountId}/conversations?status=${status}&page=${page}&per_page=${perPage}`;
      const response = await fetchWithRetry(url, headers);

      if (!response.ok) {
        logger.error(`[Chatwoot] Conversations fetch failed: ${response.status}`);
        break;
      }

      const data = await response.json() as any;
      const conversations = data.data?.payload || data.payload || [];

      if (conversations.length === 0) {
        hasMore = false;
      } else {
        allConversations.push(...conversations);
        page++;
        if (conversations.length < perPage) hasMore = false;
      }
    } catch (err) {
      logger.error(`[Chatwoot] Error fetching page ${page}:`, err);
      break;
    }
  }

  return allConversations;
}

async function fetchAgents(
  baseUrl: string,
  accountId: string,
  headers: Record<string, string>
): Promise<any[]> {
  try {
    const url = `${baseUrl}/api/v1/accounts/${accountId}/agents`;
    const response = await fetchWithRetry(url, headers);

    if (response.ok) {
      const data = await response.json() as any;
      return Array.isArray(data) ? data : (data.payload || []);
    }

    logger.error(`[Chatwoot] Agents fetch failed: ${response.status}`);
    return [];
  } catch (err) {
    logger.error('[Chatwoot] Error fetching agents:', err);
    return [];
  }
}

async function fetchInboxes(
  baseUrl: string,
  accountId: string,
  headers: Record<string, string>
): Promise<any[]> {
  try {
    const url = `${baseUrl}/api/v1/accounts/${accountId}/inboxes`;
    const response = await fetchWithRetry(url, headers);

    if (response.ok) {
      const data = await response.json() as any;
      return data.payload || [];
    }

    logger.error(`[Chatwoot] Inboxes fetch failed: ${response.status}`);
    return [];
  } catch (err) {
    logger.error('[Chatwoot] Error fetching inboxes:', err);
    return [];
  }
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

class ChatwootMetricsService {
  /**
   * Compute full DashboardMetrics from raw Chatwoot data + resolution_logs.
   * This is the port of the Edge Function logic.
   */
  async computeMetrics(dbAccountId: string, params: MetricsParams) {
    // 1. Get Chatwoot config from DB
    const account = await prisma.account.findUnique({
      where: { id: dbAccountId },
      select: {
        chatwootBaseUrl: true,
        chatwootAccountId: true,
        chatwootApiKey: true,
      },
    });

    if (!account?.chatwootBaseUrl || !account?.chatwootAccountId || !account?.chatwootApiKey) {
      throw new Error('Configuração do Chatwoot incompleta.');
    }

    const baseUrl = account.chatwootBaseUrl.replace(/\/$/, '');
    const chatwootAccountId = account.chatwootAccountId;
    const headers: Record<string, string> = {
      'api_access_token': account.chatwootApiKey,
      'Accept': 'application/json',
      'User-Agent': 'GLEPS-CRM/1.0',
    };

    const dateFromParsed = new Date(params.dateFrom);
    const dateToParsed = new Date(params.dateTo);

    // 2. Fetch raw data in parallel
    const [allConversations, agents, inboxes] = await Promise.all([
      fetchAllConversations(baseUrl, chatwootAccountId, headers, 'all'),
      fetchAgents(baseUrl, chatwootAccountId, headers),
      fetchInboxes(baseUrl, chatwootAccountId, headers),
    ]);

    logger.info('[Metrics] Raw data fetched', {
      conversations: allConversations.length,
      agents: agents.length,
      inboxes: inboxes.length,
    });

    // ========================================================================
    // CAMADA 1: Atendimento ao Vivo — APENAS CONVERSAS ABERTAS (SEM FILTRO DE DATA)
    // ========================================================================
    const liveConversations = allConversations.filter((c: any) => c.status === 'open');
    const filteredLiveConversations = params.inboxId
      ? liveConversations.filter((c: any) => c.inbox_id === params.inboxId)
      : liveConversations;

    // ========================================================================
    // CAMADA 2: Resolução & Histórico — FILTRADO POR DATA
    // ========================================================================
    const historyConversations = allConversations.filter((conv: any) => {
      const rawCreatedAt = conv.created_at;
      const createdAtMs = typeof rawCreatedAt === 'number' ? rawCreatedAt * 1000 : new Date(rawCreatedAt).getTime();
      const createdAt = new Date(createdAtMs);

      const rawActivityAt = conv.last_activity_at;
      const activityAtMs = rawActivityAt
        ? (typeof rawActivityAt === 'number' ? rawActivityAt * 1000 : new Date(rawActivityAt).getTime())
        : createdAtMs;
      const activityDate = new Date(activityAtMs);

      return (createdAt >= dateFromParsed && createdAt <= dateToParsed) ||
             (activityDate >= dateFromParsed && activityDate <= dateToParsed);
    });

    const filteredHistoryConversations = params.inboxId
      ? historyConversations.filter((c: any) => c.inbox_id === params.inboxId)
      : historyConversations;

    const finalConversations = params.agentId
      ? filteredHistoryConversations.filter((c: any) =>
          c.meta?.assignee?.id === params.agentId || c.assignee_id === params.agentId
        )
      : filteredHistoryConversations;

    // ========================================================================
    // COUNTERS
    // ========================================================================
    let openCount = 0;
    let resolvedCount = 0;
    let pendingCount = 0;
    let unattendedCount = 0;
    let leadsInPeriod = 0;

    const atendimento = { total: 0, ia: 0, humano: 0, semAssignee: 0 };
    const now = Date.now();
    const backlog = { ate15min: 0, de15a60min: 0, acima60min: 0 };

    // Agent stats
    const agentStats: Record<number, {
      name: string; email: string; thumbnail?: string;
      conversations: number; resolved: number;
      totalResponseTime: number; responseCount: number;
    }> = {};

    for (const agent of agents) {
      agentStats[agent.id] = {
        name: agent.name || agent.email,
        email: agent.email,
        thumbnail: agent.thumbnail,
        conversations: 0, resolved: 0,
        totalResponseTime: 0, responseCount: 0,
      };
    }

    // Hourly distribution
    const hourlyCount: Record<number, number> = {};
    for (let h = 0; h <= 23; h++) hourlyCount[h] = 0;

    // ============================================================
    // PROCESSO 1: ATENDIMENTO AO VIVO
    // ============================================================
    for (const conv of filteredLiveConversations) {
      atendimento.total++;
      const handler = classifyCurrentHandler(conv);

      if (handler === 'ai') atendimento.ia++;
      else if (handler === 'human') atendimento.humano++;
      else atendimento.semAssignee++;

      // Backlog (only human-assigned)
      const hasBotAssignee = conv.meta?.assignee?.type === 'AgentBot' || !!conv.agent_bot_id;
      const hasHumanAssignee = !!(conv.meta?.assignee?.id || conv.assignee_id) && !hasBotAssignee;
      if (hasHumanAssignee) {
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

    // ============================================================
    // PROCESSO 2: HISTÓRICO & RESOLUÇÃO
    // ============================================================
    for (const conv of finalConversations) {
      switch (conv.status) {
        case 'open': openCount++; break;
        case 'resolved': resolvedCount++; break;
        case 'pending': pendingCount++; break;
      }

      if (conv.agent_last_seen_at === null && conv.status === 'open') {
        unattendedCount++;
      }

      // Agent stats
      const hasBotAssignee = conv.meta?.assignee?.type === 'AgentBot' || !!conv.agent_bot_id;
      const hasHumanAssignee = !!(conv.meta?.assignee?.id || conv.assignee_id) && !hasBotAssignee;
      if (hasHumanAssignee) {
        const agentIdVal = conv.meta?.assignee?.id || conv.assignee_id;
        if (agentStats[agentIdVal]) {
          agentStats[agentIdVal].conversations++;
          if (conv.status === 'resolved') agentStats[agentIdVal].resolved++;

          if (conv.first_reply_created_at && conv.created_at) {
            const createdAtMs = typeof conv.created_at === 'number'
              ? conv.created_at * 1000 : new Date(conv.created_at).getTime();
            const firstReplyMs = typeof conv.first_reply_created_at === 'number'
              ? conv.first_reply_created_at * 1000 : new Date(conv.first_reply_created_at).getTime();
            const responseTime = firstReplyMs - createdAtMs;
            if (responseTime > 0) {
              agentStats[agentIdVal].totalResponseTime += responseTime;
              agentStats[agentIdVal].responseCount++;
            }
          }
        }
      }

      // Hourly distribution (only conversations created in range)
      const rawCreatedAt = conv.created_at;
      const createdAtMs = typeof rawCreatedAt === 'number' ? rawCreatedAt * 1000 : new Date(rawCreatedAt).getTime();
      const createdAt = new Date(createdAtMs);
      if (createdAt >= dateFromParsed && createdAt <= dateToParsed) {
        leadsInPeriod++;
        const hourLocal = parseInt(
          new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' })
            .format(createdAt),
          10
        );
        hourlyCount[hourLocal]++;
      }
    }

    // ========================================================================
    // RESOLUTION LOGS: Sync + Query via Prisma
    // ========================================================================
    let historicoResolucoes = { totalIA: 0, totalHumano: 0, transbordoCount: 0, percentualIA: 0, percentualHumano: 0 };
    let novosLeads = 0;

    try {
      // Sync: insert human resolutions that are not yet in DB
      const resolvedConversations = finalConversations.filter((c: any) => c.status === 'resolved');

      for (const conv of resolvedConversations) {
        const custom = conv.custom_attributes || {};
        const additional = conv.additional_attributes || {};
        const resolvedByAttr = custom.resolved_by || additional.resolved_by;

        // IA resolutions are already logged by n8n — skip
        if (resolvedByAttr === 'ai') continue;

        const lastActivityAt = conv.last_activity_at;
        if (!lastActivityAt) continue;

        const resolvedAt = typeof lastActivityAt === 'number'
          ? new Date(lastActivityAt * 1000)
          : new Date(lastActivityAt);

        try {
          // Use raw query for upsert-like behavior (skip on unique conflict)
          await prisma.$executeRaw`
            INSERT INTO resolution_logs (account_id, conversation_id, resolved_by, resolution_type, ai_participated, resolved_at)
            VALUES (${dbAccountId}::uuid, ${conv.id}, 'human', 'inferred', true, ${resolvedAt})
            ON CONFLICT DO NOTHING
          `;
        } catch (insertErr) {
          // Non-fatal — skip duplicates silently
        }
      }

      // Count new leads (contacts with first_resolved_at in range or null)
      try {
        const contactIdsInPeriod = [...new Set(
          finalConversations
            .map((c: any) => c.meta?.sender?.id)
            .filter(Boolean)
        )] as number[];

        if (contactIdsInPeriod.length > 0) {
          const contacts = await prisma.contact.findMany({
            where: {
              accountId: dbAccountId,
              chatwootContactId: { in: contactIdsInPeriod },
            },
            select: { id: true, firstResolvedAt: true },
          });

          novosLeads = contacts.filter(c => {
            if (!c.firstResolvedAt) return true;
            const frd = new Date(c.firstResolvedAt);
            return frd >= dateFromParsed && frd <= dateToParsed;
          }).length;
        }
      } catch (_) {
        // Non-fatal
      }

      // Query resolution totals from DB
      const resolutionLogs = await prisma.$queryRaw<Array<{ resolved_by: string; ai_participated: boolean | null }>>`
        SELECT resolved_by, ai_participated FROM resolution_logs
        WHERE account_id = ${dbAccountId}::uuid
          AND resolved_at >= ${dateFromParsed}
          AND resolved_at <= ${dateToParsed}
      `;

      if (resolutionLogs.length > 0) {
        const aiCount = resolutionLogs.filter(r => r.resolved_by === 'ai').length;
        const humanCount = resolutionLogs.filter(r => r.resolved_by === 'human').length;
        const transbordoCount = resolutionLogs.filter(
          r => r.resolved_by === 'human' && r.ai_participated === true
        ).length;
        const total = aiCount + humanCount;

        historicoResolucoes = {
          totalIA: aiCount,
          totalHumano: humanCount,
          transbordoCount,
          percentualIA: total > 0 ? Math.round((aiCount / total) * 100) : 0,
          percentualHumano: total > 0 ? Math.round((humanCount / total) * 100) : 0,
        };
      }
    } catch (dbErr) {
      logger.error('[Metrics] DB error (non-fatal):', dbErr);
    }

    // ========================================================================
    // BUILD RESOLUCAO FROM PERSISTENT DATA
    // ========================================================================
    const resolucao = {
      total: historicoResolucoes.totalIA + historicoResolucoes.totalHumano,
      ia: { total: historicoResolucoes.totalIA, explicito: historicoResolucoes.totalIA, botNativo: 0, inferido: 0 },
      humano: { total: historicoResolucoes.totalHumano, explicito: historicoResolucoes.totalHumano, inferido: 0 },
      naoClassificado: 0,
      transbordoFinalizado: historicoResolucoes.transbordoCount,
    };

    const totalResolvidosClassificados = resolucao.ia.total + resolucao.humano.total;
    const taxaResolucaoIA = totalResolvidosClassificados > 0
      ? Math.round((resolucao.ia.total / totalResolvidosClassificados) * 100) : 0;
    const taxaResolucaoHumano = totalResolvidosClassificados > 0
      ? 100 - taxaResolucaoIA : 0;
    const iniciadasPorIACount = resolucao.ia.total + resolucao.transbordoFinalizado;
    const taxaTransbordo = iniciadasPorIACount > 0
      ? Math.round((resolucao.transbordoFinalizado / iniciadasPorIACount) * 100) : 0;
    const eficienciaIA = resolucao.total > 0
      ? Math.round((resolucao.ia.total / resolucao.total) * 100) : 0;

    const taxas = {
      resolucaoIA: `${taxaResolucaoIA}%`,
      resolucaoHumano: `${taxaResolucaoHumano}%`,
      transbordo: `${taxaTransbordo}%`,
      eficienciaIA: `${eficienciaIA}%`,
    };

    // Average response time
    let totalResponseTime = 0;
    let totalResponseCount = 0;
    for (const stats of Object.values(agentStats)) {
      totalResponseTime += stats.totalResponseTime;
      totalResponseCount += stats.responseCount;
    }
    const avgFirstResponseMs = totalResponseCount > 0 ? totalResponseTime / totalResponseCount : 0;

    // Agent performance array
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
          ? formatTime(stats.totalResponseTime / stats.responseCount) : '0s',
        taxaResolucao: stats.conversations > 0
          ? Math.round((stats.resolved / stats.conversations) * 100) : 0,
      }));

    // Conversations by channel
    const conversasPorCanal = inboxes.map((inbox: any) => {
      const count = finalConversations.filter((c: any) => c.inbox_id === inbox.id).length;
      let mappedChannel = 'webchat';
      const channelType = inbox.channel_type || '';
      if (channelType.includes('Whatsapp')) mappedChannel = 'whatsapp';
      else if (channelType.includes('Instagram') || channelType.includes('Facebook')) mappedChannel = 'instagram';

      return { inboxId: inbox.id, canal: mappedChannel, inboxName: inbox.name, totalConversas: count };
    });

    // Hourly peak
    const picoPorHora = Object.entries(hourlyCount)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([hora, total]) => ({ hora: Number(hora), totalConversas: total }));

    // ========================================================================
    // RESPONSE (exact same shape as Edge Function)
    // ========================================================================
    return {
      totalLeads: finalConversations.length,
      conversasAtivas: novosLeads,
      retornosNoPeriodo: Math.max(0, finalConversations.length - novosLeads),
      conversasResolvidas: resolvedCount,
      conversasPendentes: pendingCount,
      conversasSemResposta: unattendedCount,

      atendimento,
      resolucao,
      taxas,

      atendimentosIA: resolucao.ia.total,
      atendimentosHumano: resolucao.humano.total,
      atendimentosClassificados: totalResolvidosClassificados,
      percentualIA: taxaResolucaoIA,
      percentualHumano: taxaResolucaoHumano,
      taxaTransbordo: taxas.transbordo,

      transbordo: {
        total: resolucao.transbordoFinalizado,
        iniciadasPorIA: iniciadasPorIACount,
        taxa: taxas.transbordo,
      },

      tempoMedioPrimeiraResposta: formatTime(avgFirstResponseMs),
      tempoMedioResolucao: '0s',

      conversasPorCanal,
      picoPorHora,
      backlog,

      agentes: agentPerformance,

      qualidade: {
        conversasSemResposta: unattendedCount,
        taxaAtendimentoVenda: '0%',
      },

      _debug: {
        totalConversationsRaw: allConversations.length,
        totalConversationsFiltered: finalConversations.length,
        atendimento,
        resolucao,
        inboxesCount: inboxes.length,
        agentsCount: agents.length,
        dateRange: { from: params.dateFrom, to: params.dateTo },
      },
    };
  }
}

export const chatwootMetricsService = new ChatwootMetricsService();
