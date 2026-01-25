/**
 * INTEGRAÇÃO CHATWOOT - MÉTRICAS DE DASHBOARD
 * 
 * Este serviço prepara as funções para integração com a API do Chatwoot.
 * Atualmente retorna dados mock, mas está estruturado para receber
 * implementação real via Edge Functions.
 * 
 * ===================================================================
 * ENDPOINTS CHATWOOT NECESSÁRIOS
 * ===================================================================
 * 
 * 1. INBOXES (Canais):
 *    GET /api/v1/accounts/{id}/inboxes
 *    Headers: { api_access_token: apiKey }
 *    → Lista todos os canais configurados
 *    → Usado para popular dropdown de filtro de canal
 * 
 * 2. CONVERSATIONS SUMMARY:
 *    GET /api/v1/accounts/{id}/reports/summary
 *    Params: { type: 'conversations', since, until, inbox_id? }
 *    → Total de conversas, resolvidas, pendentes
 * 
 * 3. CONVERSATION METRICS:
 *    GET /api/v1/accounts/{id}/reports/conversations
 *    Params: { type: 'count', since, until, inbox_id?, agent_id? }
 *    → Contagem de conversas por período
 * 
 * 4. AGENT METRICS:
 *    GET /api/v1/accounts/{id}/reports/agents
 *    Params: { since, until, inbox_id? }
 *    → Performance por agente (resolvidas, tempo resposta, etc.)
 * 
 * 5. FIRST RESPONSE TIME:
 *    GET /api/v1/accounts/{id}/reports/conversations
 *    Params: { type: 'avg_first_response_time', since, until }
 *    → Tempo médio até primeira resposta
 * 
 * 6. RESOLUTION TIME:
 *    GET /api/v1/accounts/{id}/reports/conversations
 *    Params: { type: 'avg_resolution_time', since, until }
 *    → Tempo médio até resolução
 * 
 * 7. BOT METRICS (IA vs Humano):
 *    Derivar de conversations onde assignee_type = 'AgentBot'
 *    GET /api/v1/accounts/{id}/conversations
 *    Params: { status: 'all', assignee_type: 'me' | 'unassigned' }
 *    → Calcular proporção IA vs Humano
 * 
 * ===================================================================
 * EDGE FUNCTION ESPERADA: fetch-chatwoot-metrics
 * ===================================================================
 * 
 * Request:
 * POST /functions/v1/fetch-chatwoot-metrics
 * Body: {
 *   chatwoot_base_url: string,
 *   chatwoot_account_id: string,
 *   chatwoot_api_key: string,
 *   date_from: string (ISO),
 *   date_to: string (ISO),
 *   inbox_id?: number,
 *   agent_id?: number
 * }
 * 
 * Response:
 * { success: boolean, data: DashboardMetricsResponse, error?: string }
 */

import {
  ChatwootInbox,
  DashboardMetricsParams,
  DashboardMetricsResponse,
  FetchInboxesParams,
  FetchInboxesResult,
  mapChannelType,
} from '@/types/chatwoot-metrics';

// ===================================================================
// DADOS MOCK PARA DESENVOLVIMENTO
// ===================================================================

const mockInboxes: ChatwootInbox[] = [
  { id: 1, name: 'WhatsApp Business', channel_type: 'Channel::Whatsapp', mappedChannel: 'whatsapp' },
  { id: 2, name: 'Instagram DM', channel_type: 'Channel::Instagram', mappedChannel: 'instagram' },
  { id: 3, name: 'Chat do Site', channel_type: 'Channel::WebWidget', mappedChannel: 'webchat' },
];

const mockBaseMetrics = {
  totalLeads: 1248,
  conversasAtivas: 47,
  percentualIA: 68,
  percentualHumano: 32,
  tempoMedioPrimeiraResposta: '2m 14s',
  tempoMedioResolucao: '18m 40s',
  taxaTransbordo: '12.5%',
  conversasPorCanal: [
    { inboxId: 1, canal: 'whatsapp', totalConversas: 456 },
    { inboxId: 2, canal: 'instagram', totalConversas: 234 },
    { inboxId: 3, canal: 'webchat', totalConversas: 178 },
  ],
  picoPorHora: [
    { hora: 8, totalConversas: 12 },
    { hora: 9, totalConversas: 28 },
    { hora: 10, totalConversas: 45 },
    { hora: 11, totalConversas: 52 },
    { hora: 12, totalConversas: 38 },
    { hora: 13, totalConversas: 32 },
    { hora: 14, totalConversas: 48 },
    { hora: 15, totalConversas: 56 },
    { hora: 16, totalConversas: 62 },
    { hora: 17, totalConversas: 48 },
    { hora: 18, totalConversas: 35 },
    { hora: 19, totalConversas: 22 },
    { hora: 20, totalConversas: 15 },
  ],
  backlog: {
    ate15min: 28,
    de15a60min: 12,
    acima60min: 7,
  },
};

// Multiplicadores por canal para simular filtro
const CHANNEL_MULTIPLIERS: Record<string, number> = {
  whatsapp: 0.55,
  instagram: 0.28,
  webchat: 0.17,
};

// ===================================================================
// FUNÇÕES DE API (MOCK)
// ===================================================================

/**
 * Busca lista de inboxes (canais) do Chatwoot
 * 
 * TODO: Substituir por chamada real à Edge Function
 * 
 * @example
 * // Produção:
 * const response = await fetch('/functions/v1/fetch-chatwoot-inboxes', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
 *   body: JSON.stringify({ 
 *     chatwoot_base_url: baseUrl,
 *     chatwoot_account_id: accountId, 
 *     chatwoot_api_key: apiKey 
 *   })
 * });
 * return await response.json();
 */
export async function fetchInboxes(params: FetchInboxesParams): Promise<FetchInboxesResult> {
  // Simula delay de rede
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Validação mock
  if (!params.baseUrl || !params.accountId || !params.apiKey) {
    return { 
      success: false, 
      inboxes: [], 
      error: 'Credenciais Chatwoot não configuradas' 
    };
  }

  // Retorna dados mock
  return { 
    success: true, 
    inboxes: mockInboxes 
  };
}

/**
 * Busca métricas do dashboard baseadas nos filtros
 * 
 * TODO: Substituir por chamada real à Edge Function
 * 
 * @example
 * // Produção:
 * const response = await fetch('/functions/v1/fetch-chatwoot-metrics', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
 *   body: JSON.stringify({ 
 *     chatwoot_base_url: baseUrl,
 *     chatwoot_account_id: accountId, 
 *     chatwoot_api_key: apiKey,
 *     date_from: dateRange.from.toISOString(),
 *     date_to: dateRange.to.toISOString(),
 *     inbox_id: inboxId,
 *     agent_id: agentId
 *   })
 * });
 * return await response.json();
 */
export async function fetchDashboardMetrics(
  params: DashboardMetricsParams
): Promise<DashboardMetricsResponse> {
  // Simula delay de rede
  await new Promise(resolve => setTimeout(resolve, 800));

  // Aplica filtro de canal se especificado
  let filteredData = { ...mockBaseMetrics };
  
  if (params.inboxId) {
    const inbox = mockInboxes.find(i => i.id === params.inboxId);
    if (inbox) {
      const multiplier = CHANNEL_MULTIPLIERS[inbox.mappedChannel] || 1;
      filteredData = {
        ...filteredData,
        totalLeads: Math.round(mockBaseMetrics.totalLeads * multiplier),
        conversasAtivas: Math.round(mockBaseMetrics.conversasAtivas * multiplier),
        conversasPorCanal: mockBaseMetrics.conversasPorCanal.filter(
          c => c.inboxId === params.inboxId
        ),
        picoPorHora: mockBaseMetrics.picoPorHora.map(h => ({
          ...h,
          totalConversas: Math.round(h.totalConversas * multiplier),
        })),
        backlog: {
          ate15min: Math.round(mockBaseMetrics.backlog.ate15min * multiplier),
          de15a60min: Math.round(mockBaseMetrics.backlog.de15a60min * multiplier),
          acima60min: Math.round(mockBaseMetrics.backlog.acima60min * multiplier),
        },
      };
    }
  }

  return {
    success: true,
    data: filteredData,
  };
}

/**
 * Mapeia valor do filtro de canal para inbox_id
 * 
 * @param channelValue - Valor do select ('all' | 'whatsapp' | 'instagram' | 'webchat')
 * @param inboxes - Lista de inboxes disponíveis
 * @returns inbox_id ou undefined se 'all'
 */
export function getInboxIdFromChannel(
  channelValue: string, 
  inboxes: ChatwootInbox[]
): number | undefined {
  if (channelValue === 'all') return undefined;
  
  const inbox = inboxes.find(i => i.mappedChannel === channelValue);
  return inbox?.id;
}

/**
 * Valida se as credenciais Chatwoot estão configuradas na conta
 */
export function isChatwootConfigured(account: { 
  chatwoot_base_url?: string; 
  chatwoot_account_id?: string; 
  chatwoot_api_key?: string;
} | null): boolean {
  if (!account) return false;
  return Boolean(
    account.chatwoot_base_url && 
    account.chatwoot_account_id && 
    account.chatwoot_api_key
  );
}
