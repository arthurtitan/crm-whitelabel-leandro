/**
 * Accounts Backend Service
 * 
 * Uses Express API via apiClient instead of Supabase.
 */

import { apiClient } from '@/api/client';
import { API_ENDPOINTS } from '@/api/endpoints';
import type { Account, CreateAccountInput, UpdateAccountInput } from './accounts.cloud.service';

export const accountsBackendService = {
  async list(): Promise<Account[]> {
    const response = await apiClient.get<{ data: Account[] } | Account[]>(API_ENDPOINTS.ACCOUNTS.LIST);
    return Array.isArray(response) ? response : (response as any).data || response;
  },

  async getById(id: string): Promise<Account | null> {
    return apiClient.get<Account>(API_ENDPOINTS.ACCOUNTS.GET(id));
  },

  async create(input: CreateAccountInput): Promise<Account> {
    return apiClient.post<Account>(API_ENDPOINTS.ACCOUNTS.CREATE, {
      nome: input.nome,
      plano: input.plano,
      chatwootBaseUrl: input.chatwoot_base_url,
      chatwootAccountId: input.chatwoot_account_id,
      chatwootApiKey: input.chatwoot_api_key,
    });
  },

  async update(id: string, input: UpdateAccountInput): Promise<Account> {
    return apiClient.put<Account>(API_ENDPOINTS.ACCOUNTS.UPDATE(id), {
      nome: input.nome,
      status: input.status,
      plano: input.plano,
      chatwootBaseUrl: input.chatwoot_base_url,
      chatwootAccountId: input.chatwoot_account_id,
      chatwootApiKey: input.chatwoot_api_key,
    });
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete(API_ENDPOINTS.ACCOUNTS.DELETE(id));
  },

  async getUsers(accountId: string) {
    return apiClient.get<any[]>(API_ENDPOINTS.USERS.BY_ACCOUNT(accountId));
  },

  async testChatwootConnection(
    baseUrl: string,
    accountId: string,
    apiKey: string
  ): Promise<{ success: boolean; message: string; agents?: any[]; inboxes?: any[]; labels?: any[] }> {
    return apiClient.post<any>(API_ENDPOINTS.CHATWOOT.METRICS, {
      action: 'test-connection',
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
