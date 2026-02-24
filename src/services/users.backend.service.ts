/**
 * Users Backend Service
 * 
 * Uses Express API via apiClient instead of Supabase.
 */

import { apiClient } from '@/api/client';
import { API_ENDPOINTS } from '@/api/endpoints';
import type { Profile, CreateUserInput } from './users.cloud.service';

export const usersBackendService = {
  async list(accountId?: string): Promise<Profile[]> {
    const params = accountId ? { accountId } : undefined;
    const response = await apiClient.get<{ data: Profile[] } | Profile[]>(
      API_ENDPOINTS.USERS.LIST, 
      { params }
    );
    return Array.isArray(response) ? response : (response as any).data || response;
  },

  async getById(userId: string): Promise<Profile | null> {
    return apiClient.get<Profile>(API_ENDPOINTS.USERS.GET(userId));
  },

  async create(input: CreateUserInput): Promise<Profile> {
    return apiClient.post<Profile>(API_ENDPOINTS.USERS.CREATE, {
      email: input.email,
      password: input.password,
      nome: input.nome,
      role: input.role,
      accountId: input.account_id,
      permissions: input.permissions,
      chatwootAgentId: input.chatwoot_agent_id,
    });
  },

  async update(userId: string, input: Partial<Profile> & { role?: 'admin' | 'agent' }): Promise<Profile> {
    return apiClient.put<Profile>(API_ENDPOINTS.USERS.UPDATE(userId), {
      nome: input.nome,
      status: input.status,
      role: input.role,
      permissions: input.permissions,
      chatwootAgentId: input.chatwoot_agent_id,
    });
  },

  async delete(userId: string, _adminPassword: string): Promise<void> {
    return apiClient.delete(API_ENDPOINTS.USERS.DELETE(userId));
  },
};
