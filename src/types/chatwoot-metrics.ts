/**
 * TIPOS PARA MÉTRICAS DO CHATWOOT
 * 
 * Interfaces que espelham a estrutura esperada da API do Chatwoot
 * para facilitar a integração futura com o backend real.
 */

/**
 * Inbox (Canal) do Chatwoot
 * Representa um canal de atendimento configurado na conta
 * 
 * Endpoint: GET /api/v1/accounts/{id}/inboxes
 */
export interface ChatwootInbox {
  id: number;
  name: string;
  channel_type: 'Channel::Whatsapp' | 'Channel::FacebookPage' | 'Channel::WebWidget' | 'Channel::Instagram' | string;
  avatar_url?: string;
  // Mapeamento interno para nosso tipo Channel
  mappedChannel: 'whatsapp' | 'instagram' | 'webchat';
}

/**
 * Parâmetros para buscar métricas do dashboard
 */
export interface DashboardMetricsParams {
  accountId: string;
  dateRange: { from: Date; to: Date };
  inboxId?: number;        // Filtro por canal/inbox
  agentId?: number;        // Filtro por agente
}

/**
 * Resposta das métricas do dashboard
 */
export interface DashboardMetricsResponse {
  success: boolean;
  data?: {
    totalLeads: number;
    conversasAtivas: number;

    // Contagens absolutas (para UI)
    atendimentosIA?: number;
    atendimentosHumano?: number;
    atendimentosClassificados?: number;

    percentualIA: number;
    percentualHumano: number;
    tempoMedioPrimeiraResposta: string;
    tempoMedioResolucao: string;
    taxaTransbordo: string;
    conversasPorCanal: Array<{ 
      inboxId: number; 
      canal: string; 
      totalConversas: number;
    }>;
    picoPorHora: Array<{ 
      hora: number; 
      totalConversas: number;
    }>;
    backlog: { 
      ate15min: number; 
      de15a60min: number; 
      acima60min: number;
    };
  };
  error?: string;
}

/**
 * Parâmetros para buscar inboxes
 */
export interface FetchInboxesParams {
  baseUrl: string;
  accountId: string;
  apiKey: string;
}

/**
 * Resposta da busca de inboxes
 */
export interface FetchInboxesResult {
  success: boolean;
  inboxes: ChatwootInbox[];
  error?: string;
}

/**
 * Métricas de performance de agente
 * Dados retornados por: GET /api/v1/accounts/{id}/reports/agents
 */
export interface AgentPerformanceMetrics {
  agentId: number;
  agentName: string;
  atendimentosAssumidos: number;
  atendimentosResolvidos: number;
  tempoMedioResposta: string;
  taxaResolucao: number;
}

/**
 * Dados de qualidade e conversão
 */
export interface QualityMetrics {
  conversasSemResposta: number;
  taxaAtendimentoVenda: string;
}

/**
 * Mapeamento de channel_type do Chatwoot para tipo interno
 */
export const CHANNEL_TYPE_MAP: Record<string, 'whatsapp' | 'instagram' | 'webchat'> = {
  'Channel::Whatsapp': 'whatsapp',
  'Channel::Instagram': 'instagram',
  'Channel::FacebookPage': 'instagram', // Messenger/IG unificado
  'Channel::WebWidget': 'webchat',
};

/**
 * Função auxiliar para mapear channel_type
 */
export function mapChannelType(channelType: string): 'whatsapp' | 'instagram' | 'webchat' {
  return CHANNEL_TYPE_MAP[channelType] || 'webchat';
}
