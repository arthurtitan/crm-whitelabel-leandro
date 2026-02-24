/**
 * Contacts Backend Service
 * 
 * Uses Express API via apiClient instead of Supabase.
 */

import { apiClient } from '@/api/client';
import { API_ENDPOINTS } from '@/api/endpoints';
import type { 
  CreateContactInput, 
  CreateContactWithChatwootInput, 
  CreateContactResult, 
  DeleteLeadResult 
} from './contacts.cloud.service';

export const contactsBackendService = {
  async createContact(input: CreateContactInput): Promise<CreateContactResult> {
    return apiClient.post<CreateContactResult>(API_ENDPOINTS.CONTACTS.CREATE, {
      nome: input.nome,
      telefone: input.telefone,
      email: input.email,
      origem: input.origem,
      accountId: input.account_id,
    });
  },

  async createContactWithChatwoot(input: CreateContactWithChatwootInput): Promise<CreateContactResult> {
    return apiClient.post<CreateContactResult>(API_ENDPOINTS.CONTACTS.CREATE, {
      nome: input.nome,
      telefone: input.telefone,
      email: input.email,
      origem: input.origem,
      accountId: input.account_id,
      createConversation: input.create_conversation,
      initialStageTagId: input.initial_stage_tag_id,
    });
  },

  async applyStageTagToContact(
    contactId: string,
    tagId: string,
    source: 'kanban' | 'chatwoot' | 'system' = 'kanban'
  ): Promise<{ success: boolean; error?: string }> {
    return apiClient.post<{ success: boolean; error?: string }>(
      API_ENDPOINTS.TAGS.ADD_TO_CONTACT(contactId),
      { tagId, source }
    );
  },

  async deleteLead(contactId: string): Promise<DeleteLeadResult> {
    try {
      await apiClient.delete(API_ENDPOINTS.CONTACTS.DELETE(contactId));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erro ao remover lead' };
    }
  },
};
