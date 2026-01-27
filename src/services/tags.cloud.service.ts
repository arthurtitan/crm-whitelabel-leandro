/**
 * Tags Cloud Service
 * 
 * Handles all tag/stage operations using Supabase Cloud.
 * Includes sync with Chatwoot labels.
 */

import { supabase } from '@/integrations/supabase/client';

export interface Tag {
  id: string;
  account_id: string;
  funnel_id: string;
  name: string;
  slug: string;
  type: 'stage' | 'operational';
  color: string;
  ordem: number;
  ativo: boolean;
  chatwoot_label_id: number | null;
  created_at: string;
}

export interface LeadTag {
  id: string;
  contact_id: string;
  tag_id: string;
  applied_by_id: string | null;
  source: string;
  created_at: string;
}

export interface ChatwootLabel {
  id: number;
  title: string;
  color: string;
  description: string | null;
}

export interface ImportLabelsResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  labels: Array<{
    name: string;
    action: 'imported' | 'updated' | 'skipped';
    reason?: string;
  }>;
  error?: string;
}

export const tagsCloudService = {
  /**
   * List all stage tags for an account (Kanban columns)
   */
  async listStageTags(accountId: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('account_id', accountId)
      .eq('type', 'stage')
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (error) {
      console.error('Error fetching stage tags:', error);
      throw new Error(error.message);
    }

    return (data || []) as Tag[];
  },

  /**
   * List all tags for an account
   */
  async listAllTags(accountId: string): Promise<Tag[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('account_id', accountId)
      .eq('ativo', true)
      .order('ordem', { ascending: true });

    if (error) {
      console.error('Error fetching tags:', error);
      throw new Error(error.message);
    }

    return (data || []) as Tag[];
  },

  /**
   * Create a new stage tag (Kanban column)
   */
  async createStageTag(input: {
    accountId: string;
    funnelId: string;
    name: string;
    color: string;
    ordem?: number;
  }): Promise<Tag> {
    const slug = input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Get max ordem if not provided
    let ordem = input.ordem;
    if (ordem === undefined) {
      const { data: existing } = await supabase
        .from('tags')
        .select('ordem')
        .eq('account_id', input.accountId)
        .eq('type', 'stage')
        .order('ordem', { ascending: false })
        .limit(1);
      
      ordem = (existing?.[0]?.ordem ?? -1) + 1;
    }

    const { data, error } = await supabase
      .from('tags')
      .insert({
        account_id: input.accountId,
        funnel_id: input.funnelId,
        name: input.name,
        slug,
        type: 'stage',
        color: input.color,
        ordem,
        ativo: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating stage tag:', error);
      throw new Error(error.message);
    }

    return data as Tag;
  },

  /**
   * Update a tag
   */
  async updateTag(tagId: string, input: Partial<Pick<Tag, 'name' | 'color' | 'ordem' | 'ativo'>>): Promise<Tag> {
    const updateData: Record<string, any> = {};
    
    if (input.name !== undefined) {
      updateData.name = input.name;
      updateData.slug = input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    if (input.color !== undefined) updateData.color = input.color;
    if (input.ordem !== undefined) updateData.ordem = input.ordem;
    if (input.ativo !== undefined) updateData.ativo = input.ativo;

    const { data, error } = await supabase
      .from('tags')
      .update(updateData)
      .eq('id', tagId)
      .select()
      .single();

    if (error) {
      console.error('Error updating tag:', error);
      throw new Error(error.message);
    }

    return data as Tag;
  },

  /**
   * Delete a tag (soft delete by setting ativo=false)
   */
  async deleteTag(tagId: string): Promise<void> {
    // Check if there are leads with this tag
    const { data: leadTags, error: checkError } = await supabase
      .from('lead_tags')
      .select('id')
      .eq('tag_id', tagId)
      .limit(1);

    if (checkError) {
      throw new Error(checkError.message);
    }

    if (leadTags && leadTags.length > 0) {
      throw new Error('Não é possível excluir: existem leads nesta etapa');
    }

    const { error } = await supabase
      .from('tags')
      .update({ ativo: false })
      .eq('id', tagId);

    if (error) {
      console.error('Error deleting tag:', error);
      throw new Error(error.message);
    }
  },

  /**
   * Reorder tags (swap ordem values)
   */
  async swapTagOrder(tagId1: string, tagId2: string): Promise<void> {
    // Get both tags
    const { data: tags, error: fetchError } = await supabase
      .from('tags')
      .select('id, ordem')
      .in('id', [tagId1, tagId2]);

    if (fetchError || !tags || tags.length !== 2) {
      throw new Error('Failed to fetch tags for reorder');
    }

    const tag1 = tags.find(t => t.id === tagId1)!;
    const tag2 = tags.find(t => t.id === tagId2)!;

    // Swap ordem values with two updates
    await supabase.from('tags').update({ ordem: tag2.ordem }).eq('id', tagId1);
    await supabase.from('tags').update({ ordem: tag1.ordem }).eq('id', tagId2);
  },

  /**
   * Get lead tags for a contact
   */
  async getLeadTags(contactId: string): Promise<LeadTag[]> {
    const { data, error } = await supabase
      .from('lead_tags')
      .select('*')
      .eq('contact_id', contactId);

    if (error) {
      console.error('Error fetching lead tags:', error);
      return [];
    }

    return (data || []) as LeadTag[];
  },

  /**
   * Apply a stage tag to a contact (removes other stage tags)
   */
  async applyStageTag(contactId: string, tagId: string, source: string = 'kanban'): Promise<void> {
    // Get the tag to verify it's a stage tag
    const { data: tag, error: tagError } = await supabase
      .from('tags')
      .select('id, type, account_id')
      .eq('id', tagId)
      .single();

    if (tagError || !tag || tag.type !== 'stage') {
      throw new Error('Tag de etapa não encontrada');
    }

    // Get all stage tags for this account
    const { data: stageTags } = await supabase
      .from('tags')
      .select('id')
      .eq('account_id', tag.account_id)
      .eq('type', 'stage');

    const stageTagIds = (stageTags || []).map(t => t.id);

    // Remove existing stage tags from contact
    if (stageTagIds.length > 0) {
      await supabase
        .from('lead_tags')
        .delete()
        .eq('contact_id', contactId)
        .in('tag_id', stageTagIds);
    }

    // Add the new stage tag
    const { error: insertError } = await supabase
      .from('lead_tags')
      .insert({
        contact_id: contactId,
        tag_id: tagId,
        source,
      });

    if (insertError) {
      console.error('Error applying stage tag:', insertError);
      throw new Error(insertError.message);
    }
  },

  /**
   * Fetch Chatwoot labels for an account (without importing)
   */
  async fetchChatwootLabels(accountId: string): Promise<ChatwootLabel[]> {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      throw new Error('Não autenticado');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-chatwoot-labels`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          account_id: accountId,
          action: 'list',
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error || 'Erro ao buscar labels do Chatwoot');
    }

    return result.labels || [];
  },

  /**
   * Import Chatwoot labels as stage tags
   */
  async importChatwootLabels(accountId: string): Promise<ImportLabelsResult> {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      throw new Error('Não autenticado');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-chatwoot-labels`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          account_id: accountId,
          action: 'import',
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        labels: [],
        error: result.error || 'Erro ao importar labels',
      };
    }

    return {
      success: true,
      imported: result.imported || 0,
      updated: result.updated || 0,
      skipped: result.skipped || 0,
      labels: result.labels || [],
    };
  },

  /**
   * Get the default funnel for an account
   */
  async getDefaultFunnel(accountId: string): Promise<{ id: string; name: string } | null> {
    const { data, error } = await supabase
      .from('funnels')
      .select('id, name')
      .eq('account_id', accountId)
      .eq('is_default', true)
      .single();

    if (error) {
      return null;
    }

    return data;
  },
};

export default tagsCloudService;
