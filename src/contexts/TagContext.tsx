import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Tag, LeadTag, TagHistory, ActorType } from '@/types/crm';
import { mockTags, mockLeadTags, mockTagHistory, mockFunnelStages } from '@/data/mockData';
import { useFinance } from './FinanceContext';

// ============= TYPES =============

interface AddTagData {
  contactId: string;
  tagId: string;
  source: 'kanban' | 'chatwoot' | 'system';
  actorType: ActorType;
  actorId: string | null;
}

interface RemoveTagData {
  contactId: string;
  tagId: string;
  source: 'kanban' | 'chatwoot' | 'system';
  actorType: ActorType;
  actorId: string | null;
  reason?: string;
}

interface ApplyStageTagData {
  contactId: string;
  stageId: string;
  source: 'kanban' | 'chatwoot' | 'system';
  actorType: ActorType;
  actorId: string | null;
}

interface TagContextType {
  // State
  tags: Tag[];
  leadTags: LeadTag[];
  tagHistory: TagHistory[];

  // Queries
  getTagById: (tagId: string) => Tag | undefined;
  getTagBySlug: (slug: string) => Tag | undefined;
  getStageTag: (stageId: string) => Tag | undefined;
  getLeadTags: (contactId: string) => Tag[];
  getLeadStageTags: (contactId: string) => Tag[];
  getLeadOperationalTags: (contactId: string) => Tag[];
  getAvailableOperationalTags: () => Tag[];
  getContactTagHistory: (contactId: string) => TagHistory[];
  hasTag: (contactId: string, tagId: string) => boolean;

  // Actions
  addTag: (data: AddTagData) => { success: boolean; error?: string };
  removeTag: (data: RemoveTagData) => { success: boolean; error?: string };
  toggleOperationalTag: (data: AddTagData) => { success: boolean; added: boolean; error?: string };
  applyStageTag: (data: ApplyStageTagData) => { success: boolean; error?: string; autoCreatedStage?: boolean };
  
  // Chatwoot sync simulation
  simulateChatwootTagApplied: (contactId: string, tagSlug: string) => void;
}

// ============= CONTEXT =============

const TagContext = createContext<TagContextType | undefined>(undefined);

export const useTagContext = () => {
  const context = useContext(TagContext);
  if (!context) {
    throw new Error('useTagContext must be used within a TagProvider');
  }
  return context;
};

// ============= PROVIDER =============

interface TagProviderProps {
  children: React.ReactNode;
  accountId: string;
}

export const TagProvider: React.FC<TagProviderProps> = ({ children, accountId }) => {
  const { updateLeadStage } = useFinance();
  
  // State filtered by account
  const [tags, setTags] = useState<Tag[]>(
    mockTags.filter((t) => t.account_id === accountId && t.ativo)
  );
  const [leadTags, setLeadTags] = useState<LeadTag[]>(mockLeadTags);
  const [tagHistory, setTagHistory] = useState<TagHistory[]>(mockTagHistory);

  // ============= QUERIES =============

  const getTagById = useCallback((tagId: string): Tag | undefined => {
    return tags.find((t) => t.id === tagId);
  }, [tags]);

  const getTagBySlug = useCallback((slug: string): Tag | undefined => {
    return tags.find((t) => t.slug === slug.toLowerCase());
  }, [tags]);

  const getStageTag = useCallback((stageId: string): Tag | undefined => {
    return tags.find((t) => t.type === 'stage' && t.linked_stage_id === stageId);
  }, [tags]);

  const getLeadTags = useCallback((contactId: string): Tag[] => {
    const contactTagIds = leadTags
      .filter((lt) => lt.contact_id === contactId)
      .map((lt) => lt.tag_id);
    return tags.filter((t) => contactTagIds.includes(t.id));
  }, [leadTags, tags]);

  const getLeadStageTags = useCallback((contactId: string): Tag[] => {
    return getLeadTags(contactId).filter((t) => t.type === 'stage');
  }, [getLeadTags]);

  const getLeadOperationalTags = useCallback((contactId: string): Tag[] => {
    return getLeadTags(contactId).filter((t) => t.type === 'operational');
  }, [getLeadTags]);

  const getAvailableOperationalTags = useCallback((): Tag[] => {
    return tags.filter((t) => t.type === 'operational');
  }, [tags]);

  const getContactTagHistory = useCallback((contactId: string): TagHistory[] => {
    return tagHistory
      .filter((th) => th.contact_id === contactId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [tagHistory]);

  const hasTag = useCallback((contactId: string, tagId: string): boolean => {
    return leadTags.some((lt) => lt.contact_id === contactId && lt.tag_id === tagId);
  }, [leadTags]);

  // ============= ACTIONS =============

  const addHistoryEntry = useCallback((
    contactId: string,
    tagId: string,
    action: 'added' | 'removed' | 'stage_created',
    actorType: ActorType,
    actorId: string | null,
    source: 'kanban' | 'chatwoot' | 'system',
    reason: string | null
  ) => {
    const newEntry: TagHistory = {
      id: `th-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      contact_id: contactId,
      tag_id: tagId,
      action,
      actor_type: actorType,
      actor_id: actorId,
      source,
      reason,
      created_at: new Date().toISOString(),
    };
    setTagHistory((prev) => [newEntry, ...prev]);
  }, []);

  const addTag = useCallback((data: AddTagData): { success: boolean; error?: string } => {
    const { contactId, tagId, source, actorType, actorId } = data;

    // Validate tag exists
    const tag = getTagById(tagId);
    if (!tag) {
      return { success: false, error: 'Tag não encontrada' };
    }

    // Check if already has this tag
    if (hasTag(contactId, tagId)) {
      return { success: false, error: 'Lead já possui esta tag' };
    }

    // If stage tag, need to remove other stage tags first
    if (tag.type === 'stage') {
      const currentStageTags = getLeadStageTags(contactId);
      currentStageTags.forEach((stageTag) => {
        // Remove the current stage tag
        setLeadTags((prev) => prev.filter((lt) => !(lt.contact_id === contactId && lt.tag_id === stageTag.id)));
        addHistoryEntry(contactId, stageTag.id, 'removed', actorType, actorId, source, `Substituída por ${tag.name}`);
      });
    }

    // Add the new tag
    const newLeadTag: LeadTag = {
      id: `lt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      contact_id: contactId,
      tag_id: tagId,
      applied_by_type: actorType,
      applied_by_id: actorId,
      source,
      created_at: new Date().toISOString(),
    };

    setLeadTags((prev) => [...prev, newLeadTag]);
    addHistoryEntry(contactId, tagId, 'added', actorType, actorId, source, null);

    return { success: true };
  }, [getTagById, hasTag, getLeadStageTags, addHistoryEntry]);

  const removeTag = useCallback((data: RemoveTagData): { success: boolean; error?: string } => {
    const { contactId, tagId, source, actorType, actorId, reason } = data;

    if (!hasTag(contactId, tagId)) {
      return { success: false, error: 'Lead não possui esta tag' };
    }

    setLeadTags((prev) => prev.filter((lt) => !(lt.contact_id === contactId && lt.tag_id === tagId)));
    addHistoryEntry(contactId, tagId, 'removed', actorType, actorId, source, reason || null);

    return { success: true };
  }, [hasTag, addHistoryEntry]);

  const toggleOperationalTag = useCallback((data: AddTagData): { success: boolean; added: boolean; error?: string } => {
    const tag = getTagById(data.tagId);
    if (!tag || tag.type !== 'operational') {
      return { success: false, added: false, error: 'Tag operacional não encontrada' };
    }

    if (hasTag(data.contactId, data.tagId)) {
      const result = removeTag({
        ...data,
        reason: 'Toggle desativado',
      });
      return { ...result, added: false };
    } else {
      const result = addTag(data);
      return { ...result, added: true };
    }
  }, [getTagById, hasTag, addTag, removeTag]);

  const applyStageTag = useCallback((data: ApplyStageTagData): { success: boolean; error?: string; autoCreatedStage?: boolean } => {
    const { contactId, stageId, source, actorType, actorId } = data;

    // Find the tag linked to this stage
    let stageTag = getStageTag(stageId);
    let autoCreatedStage = false;

    // If no tag exists for this stage, auto-create one
    if (!stageTag) {
      const stage = mockFunnelStages.find((s) => s.id === stageId);
      if (!stage) {
        return { success: false, error: 'Etapa não encontrada' };
      }

      // Auto-create the tag
      const newTag: Tag = {
        id: `tag-auto-${Date.now()}`,
        account_id: accountId,
        name: stage.nome,
        slug: stage.nome.toLowerCase().replace(/\s+/g, '-'),
        type: 'stage',
        color: stage.cor || '#0EA5E9',
        linked_stage_id: stageId,
        ativo: true,
        created_at: new Date().toISOString(),
      };

      setTags((prev) => [...prev, newTag]);
      stageTag = newTag;
      autoCreatedStage = true;
      addHistoryEntry(contactId, newTag.id, 'stage_created', 'system', null, source, `Etapa "${stage.nome}" criada automaticamente via tag`);
    }

    // Remove current stage tags
    const currentStageTags = getLeadStageTags(contactId);
    currentStageTags.forEach((tag) => {
      setLeadTags((prev) => prev.filter((lt) => !(lt.contact_id === contactId && lt.tag_id === tag.id)));
      addHistoryEntry(contactId, tag.id, 'removed', actorType, actorId, source, `Lead movido para ${stageTag!.name}`);
    });

    // Add new stage tag
    const newLeadTag: LeadTag = {
      id: `lt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      contact_id: contactId,
      tag_id: stageTag.id,
      applied_by_type: actorType,
      applied_by_id: actorId,
      source,
      created_at: new Date().toISOString(),
    };

    setLeadTags((prev) => [...prev, newLeadTag]);
    addHistoryEntry(contactId, stageTag.id, 'added', actorType, actorId, source, null);

    // Also update the lead's stage in FinanceContext for Kanban sync
    if (stageTag.linked_stage_id) {
      updateLeadStage(contactId, stageTag.linked_stage_id);
    }

    return { success: true, autoCreatedStage };
  }, [accountId, getStageTag, getLeadStageTags, addHistoryEntry, updateLeadStage]);

  // ============= CHATWOOT SIMULATION =============

  const simulateChatwootTagApplied = useCallback((contactId: string, tagSlug: string) => {
    // Simulates a tag being applied from Chatwoot
    const tag = getTagBySlug(tagSlug);
    
    if (tag) {
      if (tag.type === 'stage') {
        // Stage tag: move lead in Kanban
        if (tag.linked_stage_id) {
          applyStageTag({
            contactId,
            stageId: tag.linked_stage_id,
            source: 'chatwoot',
            actorType: 'external',
            actorId: null,
          });
        }
      } else {
        // Operational tag: just add/toggle
        toggleOperationalTag({
          contactId,
          tagId: tag.id,
          source: 'chatwoot',
          actorType: 'external',
          actorId: null,
        });
      }
    } else {
      // Tag doesn't exist - if it looks like a stage tag, auto-create stage
      console.log(`Tag "${tagSlug}" não encontrada. Em produção, seria criada automaticamente.`);
    }
  }, [getTagBySlug, applyStageTag, toggleOperationalTag]);

  // ============= CONTEXT VALUE =============

  const value = useMemo<TagContextType>(() => ({
    tags,
    leadTags,
    tagHistory,
    getTagById,
    getTagBySlug,
    getStageTag,
    getLeadTags,
    getLeadStageTags,
    getLeadOperationalTags,
    getAvailableOperationalTags,
    getContactTagHistory,
    hasTag,
    addTag,
    removeTag,
    toggleOperationalTag,
    applyStageTag,
    simulateChatwootTagApplied,
  }), [
    tags,
    leadTags,
    tagHistory,
    getTagById,
    getTagBySlug,
    getStageTag,
    getLeadTags,
    getLeadStageTags,
    getLeadOperationalTags,
    getAvailableOperationalTags,
    getContactTagHistory,
    hasTag,
    addTag,
    removeTag,
    toggleOperationalTag,
    applyStageTag,
    simulateChatwootTagApplied,
  ]);

  return <TagContext.Provider value={value}>{children}</TagContext.Provider>;
};
