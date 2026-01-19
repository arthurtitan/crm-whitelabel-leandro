import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Tag, LeadTag, TagHistory, ActorType } from '@/types/crm';
import { mockTags, mockLeadTags, mockTagHistory, mockFunnels } from '@/data/mockData';

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
  tagId: string; // ID da tag de stage
  source: 'kanban' | 'chatwoot' | 'system';
  actorType: ActorType;
  actorId: string | null;
}

interface CreateStageTagData {
  name: string;
  slug: string;
  color: string;
  source: 'kanban' | 'chatwoot' | 'system';
}

interface TagContextType {
  // State
  tags: Tag[];
  stageTags: Tag[]; // Apenas tags de etapa (colunas do Kanban)
  operationalTags: Tag[]; // Apenas tags operacionais
  leadTags: LeadTag[];
  tagHistory: TagHistory[];

  // Queries
  getTagById: (tagId: string) => Tag | undefined;
  getTagBySlug: (slug: string) => Tag | undefined;
  getLeadTags: (contactId: string) => Tag[];
  getLeadStageTag: (contactId: string) => Tag | undefined; // Retorna A tag de etapa do lead
  getLeadOperationalTags: (contactId: string) => Tag[];
  getContactTagHistory: (contactId: string) => TagHistory[];
  hasTag: (contactId: string, tagId: string) => boolean;

  // Actions
  addTag: (data: AddTagData) => { success: boolean; error?: string };
  removeTag: (data: RemoveTagData) => { success: boolean; error?: string };
  toggleOperationalTag: (data: AddTagData) => { success: boolean; added: boolean; error?: string };
  applyStageTag: (data: ApplyStageTagData) => { success: boolean; error?: string };
  createStageTag: (data: CreateStageTagData) => { success: boolean; tagId?: string; error?: string };
  
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
  // State filtered by account
  const [tags, setTags] = useState<Tag[]>(
    mockTags.filter((t) => t.account_id === accountId && t.ativo)
  );
  const [leadTags, setLeadTags] = useState<LeadTag[]>(mockLeadTags);
  const [tagHistory, setTagHistory] = useState<TagHistory[]>(mockTagHistory);

  // ============= DERIVED STATE =============
  
  // Tags de etapa = colunas do Kanban
  const stageTags = useMemo(() => 
    tags.filter((t) => t.type === 'stage').sort((a, b) => a.ordem - b.ordem),
    [tags]
  );

  // Tags operacionais = complementares
  const operationalTags = useMemo(() => 
    tags.filter((t) => t.type === 'operational'),
    [tags]
  );

  // ============= QUERIES =============

  const getTagById = useCallback((tagId: string): Tag | undefined => {
    return tags.find((t) => t.id === tagId);
  }, [tags]);

  const getTagBySlug = useCallback((slug: string): Tag | undefined => {
    return tags.find((t) => t.slug === slug.toLowerCase());
  }, [tags]);

  const getLeadTags = useCallback((contactId: string): Tag[] => {
    const contactTagIds = leadTags
      .filter((lt) => lt.contact_id === contactId)
      .map((lt) => lt.tag_id);
    return tags.filter((t) => contactTagIds.includes(t.id));
  }, [leadTags, tags]);

  const getLeadStageTag = useCallback((contactId: string): Tag | undefined => {
    const contactTagIds = leadTags
      .filter((lt) => lt.contact_id === contactId)
      .map((lt) => lt.tag_id);
    return tags.find((t) => contactTagIds.includes(t.id) && t.type === 'stage');
  }, [leadTags, tags]);

  const getLeadOperationalTags = useCallback((contactId: string): Tag[] => {
    return getLeadTags(contactId).filter((t) => t.type === 'operational');
  }, [getLeadTags]);

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
    action: 'added' | 'removed' | 'tag_created',
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

    // If stage tag, need to remove other stage tags first (exclusiva)
    if (tag.type === 'stage') {
      const currentStageTag = getLeadStageTag(contactId);
      if (currentStageTag) {
        // Remove the current stage tag
        setLeadTags((prev) => prev.filter((lt) => !(lt.contact_id === contactId && lt.tag_id === currentStageTag.id)));
        addHistoryEntry(contactId, currentStageTag.id, 'removed', actorType, actorId, source, `Substituída por ${tag.name}`);
      }
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
  }, [getTagById, hasTag, getLeadStageTag, addHistoryEntry]);

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

  const applyStageTag = useCallback((data: ApplyStageTagData): { success: boolean; error?: string } => {
    const { contactId, tagId, source, actorType, actorId } = data;

    // Find the stage tag
    const stageTag = getTagById(tagId);
    if (!stageTag || stageTag.type !== 'stage') {
      return { success: false, error: 'Tag de etapa não encontrada' };
    }

    // Remove current stage tag if exists
    const currentStageTag = getLeadStageTag(contactId);
    if (currentStageTag && currentStageTag.id !== tagId) {
      setLeadTags((prev) => prev.filter((lt) => !(lt.contact_id === contactId && lt.tag_id === currentStageTag.id)));
      addHistoryEntry(contactId, currentStageTag.id, 'removed', actorType, actorId, source, `Lead movido para ${stageTag.name}`);
    }

    // If already has this tag, no-op
    if (hasTag(contactId, tagId)) {
      return { success: true };
    }

    // Add new stage tag
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
  }, [getTagById, getLeadStageTag, hasTag, addHistoryEntry]);

  // Criar nova tag de etapa (também cria coluna no Kanban)
  const createStageTag = useCallback((data: CreateStageTagData): { success: boolean; tagId?: string; error?: string } => {
    const { name, slug, color, source } = data;

    // Check if slug already exists
    if (getTagBySlug(slug)) {
      return { success: false, error: `Tag "${slug}" já existe` };
    }

    // Get funnel for this account
    const funnel = mockFunnels.find((f) => f.account_id === accountId && f.ativo);
    if (!funnel) {
      return { success: false, error: 'Funil não encontrado' };
    }

    // Calculate next ordem
    const maxOrdem = Math.max(...stageTags.map((t) => t.ordem), 0);

    const newTag: Tag = {
      id: `tag-${Date.now()}`,
      account_id: accountId,
      funnel_id: funnel.id,
      name,
      slug: slug.toLowerCase().replace(/\s+/g, '-'),
      type: 'stage',
      color,
      ordem: maxOrdem + 1,
      ativo: true,
      created_at: new Date().toISOString(),
    };

    setTags((prev) => [...prev, newTag]);
    
    // Add history entry for tag creation
    const historyEntry: TagHistory = {
      id: `th-${Date.now()}`,
      contact_id: '', // No contact, this is a tag creation
      tag_id: newTag.id,
      action: 'tag_created',
      actor_type: 'system',
      actor_id: null,
      source,
      reason: `Etapa "${name}" criada`,
      created_at: new Date().toISOString(),
    };
    setTagHistory((prev) => [historyEntry, ...prev]);

    return { success: true, tagId: newTag.id };
  }, [accountId, getTagBySlug, stageTags]);

  // ============= CHATWOOT SIMULATION =============

  const simulateChatwootTagApplied = useCallback((contactId: string, tagSlug: string) => {
    // Simulates a tag being applied from Chatwoot
    let tag = getTagBySlug(tagSlug);
    
    if (tag) {
      if (tag.type === 'stage') {
        // Stage tag: move lead in Kanban
        applyStageTag({
          contactId,
          tagId: tag.id,
          source: 'chatwoot',
          actorType: 'external',
          actorId: null,
        });
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
      // Tag doesn't exist - auto-create as stage tag (new Kanban column)
      const result = createStageTag({
        name: tagSlug.charAt(0).toUpperCase() + tagSlug.slice(1).replace(/-/g, ' '),
        slug: tagSlug,
        color: '#6366F1', // Default color for auto-created tags
        source: 'chatwoot',
      });

      if (result.success && result.tagId) {
        // Apply the newly created tag to the contact
        applyStageTag({
          contactId,
          tagId: result.tagId,
          source: 'chatwoot',
          actorType: 'external',
          actorId: null,
        });
      }
    }
  }, [getTagBySlug, applyStageTag, toggleOperationalTag, createStageTag]);

  // ============= CONTEXT VALUE =============

  const value = useMemo<TagContextType>(() => ({
    tags,
    stageTags,
    operationalTags,
    leadTags,
    tagHistory,
    getTagById,
    getTagBySlug,
    getLeadTags,
    getLeadStageTag,
    getLeadOperationalTags,
    getContactTagHistory,
    hasTag,
    addTag,
    removeTag,
    toggleOperationalTag,
    applyStageTag,
    createStageTag,
    simulateChatwootTagApplied,
  }), [
    tags,
    stageTags,
    operationalTags,
    leadTags,
    tagHistory,
    getTagById,
    getTagBySlug,
    getLeadTags,
    getLeadStageTag,
    getLeadOperationalTags,
    getContactTagHistory,
    hasTag,
    addTag,
    removeTag,
    toggleOperationalTag,
    applyStageTag,
    createStageTag,
    simulateChatwootTagApplied,
  ]);

  return <TagContext.Provider value={value}>{children}</TagContext.Provider>;
};
