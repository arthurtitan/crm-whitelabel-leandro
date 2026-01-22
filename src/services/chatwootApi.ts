import { ChatwootAgent } from '@/types/crm';
import { mockChatwootAgents } from '@/data/mockChatwootData';

/**
 * INTEGRAÇÃO CHATWOOT - BACKEND NECESSÁRIO
 * 
 * Endpoint esperado: Edge Function `fetch-chatwoot-agents`
 * 
 * Request:
 * POST /functions/v1/fetch-chatwoot-agents
 * Body: { chatwoot_account_id: string, chatwoot_api_key: string }
 * 
 * Response:
 * { success: boolean, agents: ChatwootAgent[], error?: string }
 * 
 * A Edge Function deve:
 * 1. Receber credenciais (nunca expor API key no frontend)
 * 2. Fazer request para: GET https://{CHATWOOT_URL}/api/v1/accounts/{id}/agents
 * 3. Headers: { api_access_token: apiKey }
 * 4. Retornar lista de agentes ou erro
 */

export interface FetchAgentsParams {
  accountId: string;
  apiKey: string;
}

export interface FetchAgentsResult {
  success: boolean;
  agents: ChatwootAgent[];
  error?: string;
}

/**
 * Busca agentes do Chatwoot
 * 
 * TODO: Substituir por chamada real à Edge Function em produção
 * 
 * @example
 * // Produção:
 * const response = await fetch('/functions/v1/fetch-chatwoot-agents', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ chatwoot_account_id: accountId, chatwoot_api_key: apiKey })
 * });
 * return await response.json();
 */
export async function fetchChatwootAgents(params: FetchAgentsParams): Promise<FetchAgentsResult> {
  // Simula delay de rede
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Validação mock (em produção seria validado pelo backend)
  if (!params.accountId || !params.apiKey) {
    return { 
      success: false, 
      agents: [], 
      error: 'Account ID e API Key são obrigatórios' 
    };
  }
  
  // Simula validação de credenciais inválidas
  if (params.apiKey.length < 5) {
    return { 
      success: false, 
      agents: [], 
      error: 'API Key inválida. Verifique as credenciais.' 
    };
  }
  
  // Retorna dados mock simulando sucesso
  return { 
    success: true, 
    agents: mockChatwootAgents 
  };
}

/**
 * Valida conexão com Chatwoot sem buscar agentes
 * 
 * TODO: Implementar endpoint separado se necessário
 */
export async function testChatwootConnection(params: FetchAgentsParams): Promise<{ success: boolean; error?: string }> {
  const result = await fetchChatwootAgents(params);
  return { 
    success: result.success, 
    error: result.error 
  };
}
