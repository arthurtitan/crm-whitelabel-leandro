import { ChatwootAgent } from '@/types/crm';
import { mockChatwootAgents } from '@/data/mockChatwootData';

/**
 * INTEGRAÇÃO CHATWOOT - BACKEND NECESSÁRIO
 * 
 * Endpoint esperado: Edge Function `fetch-chatwoot-agents`
 * 
 * Request:
 * POST /functions/v1/fetch-chatwoot-agents
 * Body: { 
 *   chatwoot_base_url: string,    // Ex: https://app.chatwoot.com
 *   chatwoot_account_id: string,  // Ex: 12345
 *   chatwoot_api_key: string      // Access Token do usuário/agente
 * }
 * 
 * Response:
 * { success: boolean, agents: ChatwootAgent[], error?: string }
 * 
 * A Edge Function deve:
 * 1. Receber credenciais (nunca expor API key no frontend)
 * 2. Validar formato da URL base (remover trailing slash se houver)
 * 3. Fazer request para: GET {BASE_URL}/api/v1/accounts/{ACCOUNT_ID}/agents
 * 4. Headers: { api_access_token: apiKey }
 * 5. Retornar lista de agentes ou erro
 * 
 * Exemplo de URL final:
 * https://app.chatwoot.com/api/v1/accounts/12345/agents
 */

export interface FetchAgentsParams {
  baseUrl: string;   // URL da instância Chatwoot (ex: https://app.chatwoot.com)
  accountId: string; // ID da conta no Chatwoot
  apiKey: string;    // Access Token para autenticação
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
 *   body: JSON.stringify({ 
 *     chatwoot_base_url: baseUrl,
 *     chatwoot_account_id: accountId, 
 *     chatwoot_api_key: apiKey 
 *   })
 * });
 * return await response.json();
 */
export async function fetchChatwootAgents(params: FetchAgentsParams): Promise<FetchAgentsResult> {
  // Simula delay de rede
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Validação mock (em produção seria validado pelo backend)
  if (!params.baseUrl || !params.accountId || !params.apiKey) {
    return { 
      success: false, 
      agents: [], 
      error: 'URL Base, Account ID e API Key são obrigatórios' 
    };
  }

  // Valida formato da URL
  try {
    new URL(params.baseUrl);
  } catch {
    return { 
      success: false, 
      agents: [], 
      error: 'URL Base inválida. Use o formato: https://app.chatwoot.com' 
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
