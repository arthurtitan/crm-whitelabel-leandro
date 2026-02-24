import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';
import {
  ChatwootAgent,
  ChatwootLabel,
  ChatwootInbox,
  ChatwootConversation,
  ChatwootContact,
  ChatwootApiError,
  ChatwootAccountConfig,
  CreateLabelInput,
  UpdateLabelInput,
  ConversationFilters,
  DateRange,
  ChatwootAgentMetrics,
  ChatwootReportMetrics,
  ChatwootAccountMetrics,
} from '../types/chatwoot.types';

class ChatwootService {
  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Get account with Chatwoot configuration
   */
  private async getAccountConfig(accountId: string): Promise<ChatwootAccountConfig> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        chatwootBaseUrl: true,
        chatwootAccountId: true,
        chatwootApiKey: true,
      },
    });

    if (!account) {
      throw new NotFoundError('Conta');
    }

    if (!account.chatwootBaseUrl || !account.chatwootAccountId || !account.chatwootApiKey) {
      throw new ValidationError('Configuração do Chatwoot incompleta. Configure a URL, Account ID e API Key.');
    }

    return {
      baseUrl: account.chatwootBaseUrl.replace(/\/$/, ''), // Remove trailing slash
      accountId: account.chatwootAccountId,
      apiKey: account.chatwootApiKey,
    };
  }

  /**
   * Make authenticated request to Chatwoot API
   */
  private async makeRequest<T>(
    config: ChatwootAccountConfig,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${config.baseUrl}/api/v1/accounts/${config.accountId}${endpoint}`;

    const baseHeaders: Record<string, string> = {
      'api_access_token': config.apiKey,
      'Content-Type': 'application/json',
    };

    if (options.headers) {
      const h = options.headers as Record<string, string>;
      Object.assign(baseHeaders, h);
    }

    const headers = baseHeaders;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error('Chatwoot API Error', {
          url,
          status: response.status,
          body: errorBody,
        });
        throw new ChatwootApiError(response.status, errorBody);
      }

      // Some endpoints return empty response
      const text = await response.text();
      return text ? JSON.parse(text) : {} as T;
    } catch (error) {
      if (error instanceof ChatwootApiError) {
        throw error;
      }
      logger.error('Chatwoot Request Failed', { url, error });
      throw new Error(`Falha na comunicação com Chatwoot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ============================================
  // Connection & Validation
  // ============================================

  /**
   * Test connection to Chatwoot
   */
  async testConnection(accountId: string): Promise<{ success: boolean; message: string }> {
    try {
      const config = await this.getAccountConfig(accountId);
      
      // Try to fetch account info
      await this.makeRequest(config, '/agents');
      
      return {
        success: true,
        message: 'Conexão com Chatwoot estabelecida com sucesso!',
      };
    } catch (error) {
      if (error instanceof ChatwootApiError) {
        if (ChatwootApiError.isUnauthorized(error)) {
          return { success: false, message: 'API Key inválida ou sem permissões' };
        }
        return { success: false, message: `Erro da API: ${error.statusCode}` };
      }
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  /**
   * Test connection with provided credentials (for setup)
   */
  async testConnectionWithCredentials(
    baseUrl: string,
    chatwootAccountId: string,
    apiKey: string
  ): Promise<{
    success: boolean;
    message: string;
    agents?: any[];
    inboxes?: any[];
    labels?: any[];
  }> {
    const config: ChatwootAccountConfig = {
      baseUrl: baseUrl.replace(/\/$/, ''),
      accountId: chatwootAccountId,
      apiKey,
    };

    try {
      // Primary validation: fetch agents
      const agents = await this.makeRequest<any[]>(config, '/agents');
      const mappedAgents = (Array.isArray(agents) ? agents : []).map((a: any) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        availability_status: a.availability_status,
      }));

      // Secondary: fetch inboxes and labels (best effort)
      let inboxes: any[] = [];
      let labels: any[] = [];

      try {
        const inboxesData = await this.makeRequest<{ payload?: any[] } | any[]>(config, '/inboxes');
        const raw = Array.isArray(inboxesData) ? inboxesData : (inboxesData as any).payload || [];
        inboxes = raw.map((i: any) => ({ id: i.id, name: i.name, channel_type: i.channel_type }));
      } catch (e) {
        logger.warn('Failed to fetch inboxes during connection test', { error: e });
      }

      try {
        const labelsData = await this.makeRequest<{ payload?: any[] } | any[]>(config, '/labels');
        const raw = Array.isArray(labelsData) ? labelsData : (labelsData as any).payload || [];
        labels = raw.map((l: any) => ({ id: l.id, title: l.title, color: l.color }));
      } catch (e) {
        logger.warn('Failed to fetch labels during connection test', { error: e });
      }

      return {
        success: true,
        message: `Conexão com Chatwoot estabelecida com sucesso! ${mappedAgents.length} agente(s) encontrado(s).`,
        agents: mappedAgents,
        inboxes,
        labels,
      };
    } catch (error) {
      if (error instanceof ChatwootApiError) {
        if (ChatwootApiError.isUnauthorized(error)) {
          return { success: false, message: 'API Key inválida ou sem permissões' };
        }
        return { success: false, message: `Erro da API: ${error.statusCode}` };
      }
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  // ============================================
  // Agents
  // ============================================

  /**
   * List all agents in the Chatwoot account
   */
  async getAgents(accountId: string): Promise<ChatwootAgent[]> {
    const config = await this.getAccountConfig(accountId);
    const response = await this.makeRequest<ChatwootAgent[]>(config, '/agents');
    return response;
  }

  /**
   * Get agent by ID
   */
  async getAgentById(accountId: string, agentId: number): Promise<ChatwootAgent | null> {
    const agents = await this.getAgents(accountId);
    return agents.find(a => a.id === agentId) || null;
  }

  /**
   * Fetch agents with provided credentials (for import during setup)
   */
  async getAgentsWithCredentials(
    baseUrl: string,
    chatwootAccountId: string,
    apiKey: string
  ): Promise<ChatwootAgent[]> {
    const config: ChatwootAccountConfig = {
      baseUrl: baseUrl.replace(/\/$/, ''),
      accountId: chatwootAccountId,
      apiKey,
    };
    return this.makeRequest<ChatwootAgent[]>(config, '/agents');
  }

  // ============================================
  // Inboxes (Channels)
  // ============================================

  /**
   * List all inboxes (channels)
   */
  async getInboxes(accountId: string): Promise<ChatwootInbox[]> {
    const config = await this.getAccountConfig(accountId);
    const response = await this.makeRequest<{ payload: ChatwootInbox[] }>(config, '/inboxes');
    return response.payload || [];
  }

  // ============================================
  // Labels
  // ============================================

  /**
   * List all labels
   */
  async getLabels(accountId: string): Promise<ChatwootLabel[]> {
    const config = await this.getAccountConfig(accountId);
    const response = await this.makeRequest<{ payload: ChatwootLabel[] }>(config, '/labels');
    return response.payload || [];
  }

  /**
   * Create a new label
   */
  async createLabel(accountId: string, input: CreateLabelInput): Promise<ChatwootLabel> {
    const config = await this.getAccountConfig(accountId);
    
    const body = {
      title: input.title,
      description: input.description || `Etapa do Kanban: ${input.title}`,
      color: (input.color || '#6366F1').replace('#', ''),
      show_on_sidebar: input.show_on_sidebar ?? true,
    };

    const response = await this.makeRequest<ChatwootLabel>(config, '/labels', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    logger.info('Label created in Chatwoot', { accountId, label: response });
    return response;
  }

  /**
   * Update a label
   */
  async updateLabel(accountId: string, labelId: number, input: UpdateLabelInput): Promise<ChatwootLabel> {
    const config = await this.getAccountConfig(accountId);
    
    const body: Record<string, any> = {};
    if (input.title) body.title = input.title;
    if (input.description !== undefined) body.description = input.description;
    if (input.color) body.color = input.color.replace('#', '');
    if (input.show_on_sidebar !== undefined) body.show_on_sidebar = input.show_on_sidebar;

    const response = await this.makeRequest<ChatwootLabel>(config, `/labels/${labelId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    logger.info('Label updated in Chatwoot', { accountId, labelId, changes: input });
    return response;
  }

  /**
   * Delete a label
   */
  async deleteLabel(accountId: string, labelId: number): Promise<void> {
    const config = await this.getAccountConfig(accountId);
    
    await this.makeRequest(config, `/labels/${labelId}`, {
      method: 'DELETE',
    });

    logger.info('Label deleted in Chatwoot', { accountId, labelId });
  }

  // ============================================
  // Conversations
  // ============================================

  /**
   * List conversations with filters
   */
  async getConversations(
    accountId: string,
    filters: ConversationFilters = {}
  ): Promise<ChatwootConversation[]> {
    const config = await this.getAccountConfig(accountId);
    
    const queryParams = new URLSearchParams();
    if (filters.status && filters.status !== 'all') queryParams.set('status', filters.status);
    if (filters.inbox_id) queryParams.set('inbox_id', String(filters.inbox_id));
    if (filters.assignee_type) queryParams.set('assignee_type', filters.assignee_type);
    if (filters.page) queryParams.set('page', String(filters.page));
    if (filters.labels?.length) queryParams.set('labels', filters.labels.join(','));

    const query = queryParams.toString();
    const endpoint = `/conversations${query ? `?${query}` : ''}`;
    
    const response = await this.makeRequest<{ data: { payload: ChatwootConversation[] } }>(config, endpoint);
    return response.data?.payload || [];
  }

  /**
   * Get a single conversation
   */
  async getConversation(accountId: string, conversationId: number): Promise<ChatwootConversation> {
    const config = await this.getAccountConfig(accountId);
    const response = await this.makeRequest<ChatwootConversation>(config, `/conversations/${conversationId}`);
    return response;
  }

  /**
   * Add labels to a conversation
   */
  async addLabelsToConversation(
    accountId: string,
    conversationId: number,
    labels: string[]
  ): Promise<ChatwootLabel[]> {
    const config = await this.getAccountConfig(accountId);
    
    const response = await this.makeRequest<{ payload: ChatwootLabel[] }>(
      config,
      `/conversations/${conversationId}/labels`,
      {
        method: 'POST',
        body: JSON.stringify({ labels }),
      }
    );

    logger.info('Labels added to conversation', { accountId, conversationId, labels });
    return response.payload || [];
  }

  /**
   * Update conversation labels (replace all)
   */
  async updateConversationLabels(
    accountId: string,
    conversationId: number,
    labels: string[]
  ): Promise<ChatwootLabel[]> {
    const config = await this.getAccountConfig(accountId);
    
    // Chatwoot replaces all labels on POST to /labels
    const response = await this.makeRequest<{ payload: ChatwootLabel[] }>(
      config,
      `/conversations/${conversationId}/labels`,
      {
        method: 'POST',
        body: JSON.stringify({ labels }),
      }
    );

    logger.info('Conversation labels updated', { accountId, conversationId, labels });
    return response.payload || [];
  }

  // ============================================
  // Contacts
  // ============================================

  /**
   * Get a contact by ID
   */
  async getContact(accountId: string, contactId: number): Promise<ChatwootContact> {
    const config = await this.getAccountConfig(accountId);
    const response = await this.makeRequest<{ payload: ChatwootContact }>(config, `/contacts/${contactId}`);
    return response.payload;
  }

  /**
   * Search contacts
   */
  async searchContacts(accountId: string, query: string): Promise<ChatwootContact[]> {
    const config = await this.getAccountConfig(accountId);
    const response = await this.makeRequest<{ payload: ChatwootContact[] }>(
      config,
      `/contacts/search?q=${encodeURIComponent(query)}`
    );
    return response.payload || [];
  }

  // ============================================
  // Metrics & Reports
  // ============================================

  /**
   * Get account overview metrics
   */
  async getAccountMetrics(accountId: string): Promise<ChatwootAccountMetrics> {
    const config = await this.getAccountConfig(accountId);
    
    const response = await this.makeRequest<ChatwootAccountMetrics>(
      config,
      '/reports/summary'
    );
    
    return response;
  }

  /**
   * Get conversation metrics for a date range
   */
  async getConversationMetrics(accountId: string, dateRange?: DateRange): Promise<ChatwootReportMetrics> {
    const config = await this.getAccountConfig(accountId);
    
    const queryParams = new URLSearchParams({ metric: 'conversations_count' });
    if (dateRange?.since) queryParams.set('since', dateRange.since);
    if (dateRange?.until) queryParams.set('until', dateRange.until);

    const response = await this.makeRequest<ChatwootReportMetrics>(
      config,
      `/reports?${queryParams.toString()}`
    );
    
    return response;
  }

  /**
   * Get agent performance metrics
   */
  async getAgentMetrics(accountId: string, dateRange?: DateRange): Promise<ChatwootAgentMetrics[]> {
    const config = await this.getAccountConfig(accountId);
    
    const queryParams = new URLSearchParams();
    if (dateRange?.since) queryParams.set('since', dateRange.since);
    if (dateRange?.until) queryParams.set('until', dateRange.until);

    const query = queryParams.toString();
    const response = await this.makeRequest<ChatwootAgentMetrics[]>(
      config,
      `/reports/agents${query ? `?${query}` : ''}`
    );
    
    return response;
  }

  /**
   * Get bot vs human metrics (IA vs Humano)
   */
  async getBotMetrics(accountId: string, dateRange?: DateRange): Promise<{ bot: number; human: number }> {
    const config = await this.getAccountConfig(accountId);
    
    // Fetch conversations and categorize by assignee type
    const queryParams = new URLSearchParams();
    if (dateRange?.since) queryParams.set('since', dateRange.since);
    if (dateRange?.until) queryParams.set('until', dateRange.until);

    const response = await this.makeRequest<{ bot_count?: number; human_count?: number }>(
      config,
      `/reports/bot?${queryParams.toString()}`
    );

    return {
      bot: response.bot_count || 0,
      human: response.human_count || 0,
    };
  }

  // ============================================
  // Sync Helpers
  // ============================================

  /**
   * Sync a local tag with Chatwoot label
   * Creates label if tag doesn't have chatwootLabelId
   */
  async syncTagToLabel(tagId: string, accountId: string): Promise<number | null> {
    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
    });

    if (!tag || tag.type !== 'stage') return null;

    // If already synced, just update
    if (tag.chatwootLabelId) {
      try {
        await this.updateLabel(accountId, tag.chatwootLabelId, {
          title: tag.name,
          color: tag.color,
        });
        return tag.chatwootLabelId;
      } catch (error) {
        logger.warn('Failed to update Chatwoot label, will try creating new', { tagId, error });
      }
    }

    // Create new label
    try {
      const label = await this.createLabel(accountId, {
        title: tag.name,
        color: tag.color,
      });

      // Update tag with label ID
      await prisma.tag.update({
        where: { id: tagId },
        data: { chatwootLabelId: label.id },
      });

      return label.id;
    } catch (error) {
      logger.error('Failed to create Chatwoot label', { tagId, error });
      return null;
    }
  }

  /**
   * Apply label to conversation when lead changes stage
   */
  async syncLeadStageToConversation(
    contactId: string,
    tagName: string,
    accountId: string
  ): Promise<void> {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        chatwootConversationId: true,
        leadTags: {
          include: { tag: true },
          where: { tag: { type: 'stage' } },
        },
      },
    });

    if (!contact?.chatwootConversationId) {
      logger.debug('Contact has no Chatwoot conversation', { contactId });
      return;
    }

    try {
      // Get all stage labels to apply
      const stageLabels = contact.leadTags.map(lt => lt.tag.name);
      
      // Ensure the new tag is in the list
      if (!stageLabels.includes(tagName)) {
        stageLabels.push(tagName);
      }

      await this.updateConversationLabels(
        accountId,
        contact.chatwootConversationId,
        stageLabels
      );

      logger.info('Synced lead stage to Chatwoot conversation', {
        contactId,
        conversationId: contact.chatwootConversationId,
        labels: stageLabels,
      });
    } catch (error) {
      logger.error('Failed to sync lead stage to Chatwoot', { contactId, error });
    }
  }

  /**
   * Find or create contact from Chatwoot data
   */
  async findOrCreateContactFromChatwoot(
    accountId: string,
    chatwootContactId: number,
    chatwootConversationId?: number,
    contactData?: { name?: string; phone_number?: string; email?: string }
  ): Promise<string> {
    // Try to find existing contact
    let contact = await prisma.contact.findFirst({
      where: {
        accountId,
        chatwootContactId,
      },
    });

    if (contact) {
      // Update conversation ID if provided
      if (chatwootConversationId && !contact.chatwootConversationId) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { chatwootConversationId },
        });
      }
      return contact.id;
    }

    // Create new contact
    contact = await prisma.contact.create({
      data: {
        accountId,
        chatwootContactId,
        chatwootConversationId,
        nome: contactData?.name,
        telefone: contactData?.phone_number,
        email: contactData?.email?.toLowerCase(),
        origem: 'whatsapp', // Default to WhatsApp, can be updated based on inbox type
      },
    });

    logger.info('Contact created from Chatwoot', {
      contactId: contact.id,
      chatwootContactId,
    });

    return contact.id;
  }
}

export const chatwootService = new ChatwootService();
