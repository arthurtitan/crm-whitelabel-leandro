/**
 * Accounts Backend Service
 * 
 * Uses Express API via apiClient instead of Supabase.
 * Maps camelCase backend responses to snake_case UI format.
 */

import { apiClient } from '@/api/client';
import { API_ENDPOINTS } from '@/api/endpoints';
import type { Account, CreateAccountInput, UpdateAccountInput } from './accounts.cloud.service';

/**
 * Maps a camelCase backend account object to the snake_case Account shape expected by the UI.
 */
function mapAccount(raw: any): Account {
  return {
    id: raw.id,
    nome: raw.nome,
    status: raw.status || 'active',
    timezone: raw.timezone || 'America/Sao_Paulo',
    plano: raw.plano ?? null,
    limite_usuarios: raw.limiteUsuarios ?? raw.limite_usuarios ?? 10,
    chatwoot_base_url: raw.chatwootBaseUrl ?? raw.chatwoot_base_url ?? null,
    chatwoot_account_id: raw.chatwootAccountId ?? raw.chatwoot_account_id ?? null,
    chatwoot_api_key: raw.chatwootApiKey ?? raw.chatwoot_api_key ?? null,
    created_at: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updatedAt ?? raw.updated_at ?? new Date().toISOString(),
    users_count: raw.usersCount ?? raw.users_count ?? 0,
  };
}

export const accountsBackendService = {
  async list(): Promise<Account[]> {
    const response = await apiClient.get<any>(API_ENDPOINTS.ACCOUNTS.LIST);
    // Backend returns { data: [...], meta: {...} } or just an array
    const items = Array.isArray(response) ? response : (response?.data || response);
    return (Array.isArray(items) ? items : []).map(mapAccount);
  },

  async getById(id: string): Promise<Account | null> {
    const response = await apiClient.get<any>(API_ENDPOINTS.ACCOUNTS.GET(id));
    const raw = response?.data ?? response;
    return raw ? mapAccount(raw) : null;
  },

  async create(input: CreateAccountInput): Promise<Account> {
    const response = await apiClient.post<any>(API_ENDPOINTS.ACCOUNTS.CREATE, {
      nome: input.nome,
      plano: input.plano,
      chatwootBaseUrl: input.chatwoot_base_url,
      chatwootAccountId: input.chatwoot_account_id,
      chatwootApiKey: input.chatwoot_api_key,
    });
    const raw = response?.data ?? response;
    return mapAccount(raw);
  },

  async update(id: string, input: UpdateAccountInput): Promise<Account> {
    const response = await apiClient.put<any>(API_ENDPOINTS.ACCOUNTS.UPDATE(id), {
      nome: input.nome,
      status: input.status,
      plano: input.plano,
      chatwootBaseUrl: input.chatwoot_base_url,
      chatwootAccountId: input.chatwoot_account_id,
      chatwootApiKey: input.chatwoot_api_key,
    });
    const raw = response?.data ?? response;
    return mapAccount(raw);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.ACCOUNTS.DELETE(id));
  },

  async getUsers(accountId: string) {
    return apiClient.get<any[]>(API_ENDPOINTS.USERS.BY_ACCOUNT(accountId));
  },

  async testChatwootConnection(
    baseUrl: string,
    accountId: string,
    apiKey: string
  ): Promise<{ success: boolean; message: string; agents?: any[]; inboxes?: any[]; labels?: any[] }> {
    return apiClient.post<any>('/api/chatwoot/test-connection', {
      baseUrl,
      accountId,
      apiKey,
    });
  },

  async fetchChatwootAgents(baseUrl: string, accountId: string, apiKey: string) {
    const result = await this.testChatwootConnection(baseUrl, accountId, apiKey);
    return result.agents || [];
  },
};
