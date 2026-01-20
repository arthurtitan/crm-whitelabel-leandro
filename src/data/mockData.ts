import {
  Account,
  User,
  Contact,
  Conversation,
  Funnel,
  FunnelStage,
  Sale,
  Product,
  CRMEvent,
  AgentBot,
  LeadFunnelState,
  SuperAdminKPIs,
  AdminKPIs,
  AgentKPIs,
  Tag,
  LeadTag,
  TagHistory,
} from '@/types/crm';

// ============= ACCOUNTS =============
export const mockAccounts: Account[] = [
  {
    id: 'acc-1',
    nome: 'Clínica Vida Plena',
    timezone: 'America/Sao_Paulo',
    plano: 'pro',
    status: 'active',
    limite_usuarios: 10,
    chatwoot_account_id: 'cw-123',
    chatwoot_api_key: 'cw-key-xxx',
    created_at: '2024-06-15T10:00:00Z',
    updated_at: '2025-01-10T08:30:00Z',
  },
  {
    id: 'acc-2',
    nome: 'Tech Solutions LTDA',
    timezone: 'America/Sao_Paulo',
    plano: 'enterprise',
    status: 'active',
    limite_usuarios: 25,
    chatwoot_account_id: 'cw-456',
    chatwoot_api_key: 'cw-key-yyy',
    created_at: '2024-08-20T14:00:00Z',
    updated_at: '2025-01-15T16:45:00Z',
  },
  {
    id: 'acc-3',
    nome: 'Loja Virtual Express',
    timezone: 'America/Sao_Paulo',
    plano: 'starter',
    status: 'paused',
    limite_usuarios: 5,
    chatwoot_account_id: null,
    chatwoot_api_key: null,
    created_at: '2024-10-01T09:00:00Z',
    updated_at: '2025-01-05T11:20:00Z',
  },
];

// ============= USERS =============
export const mockUsers: User[] = [
  // Super Admin
  {
    id: 'user-sa-1',
    account_id: null,
    nome: 'Super Administrador',
    email: 'superadmin@sistema.com',
    role: 'super_admin',
    status: 'active',
    last_login_at: '2025-01-19T08:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2025-01-19T08:00:00Z',
  },
  // Account 1 Users
  {
    id: 'user-admin-1',
    account_id: 'acc-1',
    nome: 'Dr. Carlos Silva',
    email: 'carlos@clinicavidaplena.com',
    role: 'admin',
    status: 'active',
    last_login_at: '2025-01-19T07:30:00Z',
    created_at: '2024-06-15T10:30:00Z',
    updated_at: '2025-01-19T07:30:00Z',
  },
  {
    id: 'user-agent-1',
    account_id: 'acc-1',
    nome: 'Ana Paula Costa',
    email: 'ana@clinicavidaplena.com',
    role: 'agent',
    status: 'active',
    last_login_at: '2025-01-19T08:15:00Z',
    created_at: '2024-07-01T09:00:00Z',
    updated_at: '2025-01-19T08:15:00Z',
  },
  {
    id: 'user-agent-2',
    account_id: 'acc-1',
    nome: 'Pedro Oliveira',
    email: 'pedro@clinicavidaplena.com',
    role: 'agent',
    status: 'active',
    last_login_at: '2025-01-18T17:00:00Z',
    created_at: '2024-07-15T11:00:00Z',
    updated_at: '2025-01-18T17:00:00Z',
  },
  // Account 2 Users
  {
    id: 'user-admin-2',
    account_id: 'acc-2',
    nome: 'Marina Santos',
    email: 'marina@techsolutions.com',
    role: 'admin',
    status: 'active',
    last_login_at: '2025-01-19T09:00:00Z',
    created_at: '2024-08-20T14:30:00Z',
    updated_at: '2025-01-19T09:00:00Z',
  },
  {
    id: 'user-agent-3',
    account_id: 'acc-2',
    nome: 'Lucas Ferreira',
    email: 'lucas@techsolutions.com',
    role: 'agent',
    status: 'active',
    last_login_at: '2025-01-19T08:45:00Z',
    created_at: '2024-09-01T10:00:00Z',
    updated_at: '2025-01-19T08:45:00Z',
  },
  // Account 3 Users
  {
    id: 'user-admin-3',
    account_id: 'acc-3',
    nome: 'Roberto Lima',
    email: 'roberto@lojaexpress.com',
    role: 'admin',
    status: 'suspended',
    last_login_at: '2025-01-05T10:00:00Z',
    created_at: '2024-10-01T09:30:00Z',
    updated_at: '2025-01-05T11:20:00Z',
  },
];

// ============= AGENT BOTS =============
export const mockAgentBots: AgentBot[] = [
  {
    id: 'bot-1',
    account_id: 'acc-1',
    nome: 'Marília IA',
    provider: 'openai',
    ativo: true,
    config: { model: 'gpt-4', temperature: 0.7 },
    created_at: '2024-06-20T10:00:00Z',
  },
  {
    id: 'bot-2',
    account_id: 'acc-2',
    nome: 'TechBot',
    provider: 'anthropic',
    ativo: true,
    config: { model: 'claude-3', temperature: 0.5 },
    created_at: '2024-09-01T14:00:00Z',
  },
];

// ============= CONTACTS =============
export const mockContacts: Contact[] = [
  // Account 1 Contacts
  { id: 'contact-1', account_id: 'acc-1', nome: 'Maria Souza', telefone: '+55 11 99999-1111', email: 'maria@email.com', origem: 'whatsapp', created_at: '2025-01-10T10:00:00Z', updated_at: '2025-01-19T08:00:00Z' },
  { id: 'contact-2', account_id: 'acc-1', nome: 'João Santos', telefone: '+55 11 99999-2222', email: 'joao@email.com', origem: 'instagram', created_at: '2025-01-12T14:00:00Z', updated_at: '2025-01-18T16:00:00Z' },
  { id: 'contact-3', account_id: 'acc-1', nome: 'Fernanda Lima', telefone: '+55 11 99999-3333', email: 'fernanda@email.com', origem: 'site', created_at: '2025-01-15T09:00:00Z', updated_at: '2025-01-19T07:30:00Z' },
  { id: 'contact-4', account_id: 'acc-1', nome: 'Ricardo Almeida', telefone: '+55 11 99999-4444', email: 'ricardo@email.com', origem: 'whatsapp', created_at: '2025-01-16T11:00:00Z', updated_at: '2025-01-19T09:00:00Z' },
  { id: 'contact-5', account_id: 'acc-1', nome: 'Camila Rocha', telefone: '+55 11 99999-5555', email: 'camila@email.com', origem: 'manual', created_at: '2025-01-17T08:00:00Z', updated_at: '2025-01-17T08:00:00Z' },
  { id: 'contact-6', account_id: 'acc-1', nome: 'Bruno Costa', telefone: '+55 11 99999-6666', email: 'bruno@email.com', origem: 'whatsapp', created_at: '2025-01-18T13:00:00Z', updated_at: '2025-01-19T10:00:00Z' },
  { id: 'contact-7', account_id: 'acc-1', nome: 'Juliana Martins', telefone: '+55 11 99999-7777', email: 'juliana@email.com', origem: 'instagram', created_at: '2025-01-18T15:00:00Z', updated_at: '2025-01-19T11:00:00Z' },
  { id: 'contact-8', account_id: 'acc-1', nome: 'André Silva', telefone: '+55 11 99999-8888', email: 'andre@email.com', origem: 'site', created_at: '2025-01-19T07:00:00Z', updated_at: '2025-01-19T07:00:00Z' },
  // Account 2 Contacts
  { id: 'contact-9', account_id: 'acc-2', nome: 'Patricia Nunes', telefone: '+55 21 99999-1111', email: 'patricia@company.com', origem: 'whatsapp', created_at: '2025-01-14T10:00:00Z', updated_at: '2025-01-19T08:00:00Z' },
  { id: 'contact-10', account_id: 'acc-2', nome: 'Eduardo Gomes', telefone: '+55 21 99999-2222', email: 'eduardo@company.com', origem: 'site', created_at: '2025-01-16T14:00:00Z', updated_at: '2025-01-18T16:00:00Z' },
];

// ============= FUNNEL & STAGES =============
export const mockFunnels: Funnel[] = [
  { id: 'funnel-1', account_id: 'acc-1', nome: 'Funil Principal', ativo: true, created_at: '2024-06-15T10:00:00Z' },
  { id: 'funnel-2', account_id: 'acc-2', nome: 'Pipeline de Vendas', ativo: true, created_at: '2024-08-20T14:00:00Z' },
];

export const mockFunnelStages: FunnelStage[] = [
  // Funnel 1 Stages
  { id: 'stage-1', funnel_id: 'funnel-1', nome: 'Novo', ordem: 1, cor: '#0EA5E9', ativo: true, created_at: '2024-06-15T10:00:00Z' },
  { id: 'stage-2', funnel_id: 'funnel-1', nome: 'Contato', ordem: 2, cor: '#8B5CF6', ativo: true, created_at: '2024-06-15T10:00:00Z' },
  { id: 'stage-3', funnel_id: 'funnel-1', nome: 'Interessado', ordem: 3, cor: '#F59E0B', ativo: true, created_at: '2024-06-15T10:00:00Z' },
  { id: 'stage-4', funnel_id: 'funnel-1', nome: 'Qualificado', ordem: 4, cor: '#22C55E', ativo: true, created_at: '2024-06-15T10:00:00Z' },
  { id: 'stage-5', funnel_id: 'funnel-1', nome: 'Convertido', ordem: 5, cor: '#A855F7', ativo: true, created_at: '2024-06-15T10:00:00Z' },
  // Funnel 2 Stages
  { id: 'stage-6', funnel_id: 'funnel-2', nome: 'Lead', ordem: 1, cor: '#0EA5E9', ativo: true, created_at: '2024-08-20T14:00:00Z' },
  { id: 'stage-7', funnel_id: 'funnel-2', nome: 'Proposta', ordem: 2, cor: '#F59E0B', ativo: true, created_at: '2024-08-20T14:00:00Z' },
  { id: 'stage-8', funnel_id: 'funnel-2', nome: 'Negociação', ordem: 3, cor: '#8B5CF6', ativo: true, created_at: '2024-08-20T14:00:00Z' },
  { id: 'stage-9', funnel_id: 'funnel-2', nome: 'Fechado', ordem: 4, cor: '#22C55E', ativo: true, created_at: '2024-08-20T14:00:00Z' },
];

// ============= LEAD FUNNEL STATE =============
export const mockLeadFunnelStates: LeadFunnelState[] = [
  { contact_id: 'contact-1', funnel_stage_id: 'stage-4', updated_at: '2025-01-19T08:00:00Z' },
  { contact_id: 'contact-2', funnel_stage_id: 'stage-3', updated_at: '2025-01-18T16:00:00Z' },
  { contact_id: 'contact-3', funnel_stage_id: 'stage-2', updated_at: '2025-01-19T07:30:00Z' },
  { contact_id: 'contact-4', funnel_stage_id: 'stage-1', updated_at: '2025-01-19T09:00:00Z' },
  { contact_id: 'contact-5', funnel_stage_id: 'stage-1', updated_at: '2025-01-17T08:00:00Z' },
  { contact_id: 'contact-6', funnel_stage_id: 'stage-5', updated_at: '2025-01-19T10:00:00Z' },
  { contact_id: 'contact-7', funnel_stage_id: 'stage-2', updated_at: '2025-01-19T11:00:00Z' },
  { contact_id: 'contact-8', funnel_stage_id: 'stage-1', updated_at: '2025-01-19T07:00:00Z' },
  { contact_id: 'contact-9', funnel_stage_id: 'stage-7', updated_at: '2025-01-19T08:00:00Z' },
  { contact_id: 'contact-10', funnel_stage_id: 'stage-6', updated_at: '2025-01-18T16:00:00Z' },
];

// ============= CONVERSATIONS =============
export const mockConversations: Conversation[] = [
  { id: 'conv-1', account_id: 'acc-1', contact_id: 'contact-1', channel: 'whatsapp', status: 'resolved', assignee_type: 'user', assignee_id: 'user-agent-1', opened_at: '2025-01-10T10:00:00Z', resolved_at: '2025-01-10T11:30:00Z' },
  { id: 'conv-2', account_id: 'acc-1', contact_id: 'contact-2', channel: 'instagram', status: 'open', assignee_type: 'agent_bot', assignee_id: 'bot-1', opened_at: '2025-01-18T14:00:00Z', resolved_at: null },
  { id: 'conv-3', account_id: 'acc-1', contact_id: 'contact-3', channel: 'webchat', status: 'open', assignee_type: 'user', assignee_id: 'user-agent-2', opened_at: '2025-01-19T07:30:00Z', resolved_at: null },
  { id: 'conv-4', account_id: 'acc-1', contact_id: 'contact-4', channel: 'whatsapp', status: 'pending', assignee_type: null, assignee_id: null, opened_at: '2025-01-19T09:00:00Z', resolved_at: null },
  { id: 'conv-5', account_id: 'acc-1', contact_id: 'contact-6', channel: 'whatsapp', status: 'resolved', assignee_type: 'user', assignee_id: 'user-agent-1', opened_at: '2025-01-18T13:00:00Z', resolved_at: '2025-01-19T10:00:00Z' },
  { id: 'conv-6', account_id: 'acc-1', contact_id: 'contact-7', channel: 'instagram', status: 'open', assignee_type: 'agent_bot', assignee_id: 'bot-1', opened_at: '2025-01-18T15:00:00Z', resolved_at: null },
  { id: 'conv-7', account_id: 'acc-2', contact_id: 'contact-9', channel: 'whatsapp', status: 'open', assignee_type: 'user', assignee_id: 'user-agent-3', opened_at: '2025-01-19T08:00:00Z', resolved_at: null },
];

// ============= PRODUCTS =============
export const mockProducts: Product[] = [
  { id: 'prod-1', account_id: 'acc-1', nome: 'Consulta Inicial', valor_padrao: 350.00, metodos_pagamento: ['pix', 'credito', 'dinheiro'], convenios_aceitos: [], ativo: true, created_at: '2024-06-15T10:00:00Z', updated_at: '2024-06-15T10:00:00Z' },
  { id: 'prod-2', account_id: 'acc-1', nome: 'Acompanhamento Mensal', valor_padrao: 280.00, metodos_pagamento: ['pix', 'credito', 'boleto'], convenios_aceitos: [], ativo: true, created_at: '2024-06-15T10:00:00Z', updated_at: '2024-06-15T10:00:00Z' },
  { id: 'prod-3', account_id: 'acc-1', nome: 'Avaliação Completa', valor_padrao: 950.00, metodos_pagamento: ['pix', 'credito', 'boleto', 'convenio'], convenios_aceitos: ['Unimed', 'Bradesco Saúde', 'Amil'], ativo: true, created_at: '2024-06-15T10:00:00Z', updated_at: '2024-06-15T10:00:00Z' },
  { id: 'prod-4', account_id: 'acc-1', nome: 'Procedimento Especial', valor_padrao: 1500.00, metodos_pagamento: ['pix', 'credito', 'debito'], convenios_aceitos: [], ativo: true, created_at: '2024-06-15T10:00:00Z', updated_at: '2024-06-15T10:00:00Z' },
  { id: 'prod-5', account_id: 'acc-1', nome: 'Retorno', valor_padrao: 150.00, metodos_pagamento: ['pix', 'credito', 'dinheiro', 'convenio'], convenios_aceitos: ['Unimed', 'SulAmérica'], ativo: true, created_at: '2024-06-15T10:00:00Z', updated_at: '2024-06-15T10:00:00Z' },
  { id: 'prod-6', account_id: 'acc-2', nome: 'Consultoria Tech', valor_padrao: 5000.00, metodos_pagamento: ['pix', 'credito', 'boleto'], convenios_aceitos: [], ativo: true, created_at: '2024-08-20T14:00:00Z', updated_at: '2024-08-20T14:00:00Z' },
];

// ============= SALES =============
export const mockSales: Sale[] = [
  { id: 'sale-1', account_id: 'acc-1', contact_id: 'contact-1', product_id: 'prod-4', valor: 1500.00, status: 'paid', metodo_pagamento: 'pix', responsavel_id: 'user-agent-1', created_at: '2025-01-10T12:00:00Z', paid_at: '2025-01-10T12:05:00Z', refunded_at: null },
  { id: 'sale-2', account_id: 'acc-1', contact_id: 'contact-6', product_id: 'prod-1', valor: 2800.00, status: 'paid', metodo_pagamento: 'credito', responsavel_id: 'user-agent-1', created_at: '2025-01-19T10:30:00Z', paid_at: '2025-01-19T10:35:00Z', refunded_at: null },
  { id: 'sale-3', account_id: 'acc-1', contact_id: 'contact-2', product_id: 'prod-3', valor: 950.00, status: 'pending', metodo_pagamento: 'boleto', responsavel_id: 'user-agent-2', created_at: '2025-01-18T16:00:00Z', paid_at: null, refunded_at: null },
  { id: 'sale-4', account_id: 'acc-1', contact_id: 'contact-3', product_id: 'prod-2', valor: 3200.00, status: 'pending', metodo_pagamento: null, responsavel_id: 'user-admin-1', created_at: '2025-01-19T08:00:00Z', paid_at: null, refunded_at: null },
  { id: 'sale-5', account_id: 'acc-2', contact_id: 'contact-9', product_id: 'prod-6', valor: 15000.00, status: 'paid', metodo_pagamento: 'pix', responsavel_id: 'user-agent-3', created_at: '2025-01-15T14:00:00Z', paid_at: '2025-01-15T14:30:00Z', refunded_at: null },
  { id: 'sale-6', account_id: 'acc-1', contact_id: 'contact-1', product_id: 'prod-5', valor: 500.00, status: 'refunded', metodo_pagamento: 'pix', responsavel_id: 'user-agent-1', created_at: '2025-01-05T10:00:00Z', paid_at: '2025-01-05T10:05:00Z', refunded_at: '2025-01-08T09:00:00Z' },
];

// ============= EVENTS =============
export const mockEvents: CRMEvent[] = [
  { id: 'evt-1', account_id: null, event_type: 'auth.login.success', actor_type: 'user', actor_id: 'user-sa-1', entity_type: 'user', entity_id: 'user-sa-1', channel: null, payload: { ip: '192.168.1.1', device: 'Chrome/Windows' }, created_at: '2025-01-19T08:00:00Z' },
  { id: 'evt-2', account_id: 'acc-1', event_type: 'auth.login.success', actor_type: 'user', actor_id: 'user-admin-1', entity_type: 'user', entity_id: 'user-admin-1', channel: null, payload: { ip: '192.168.1.2', device: 'Safari/Mac' }, created_at: '2025-01-19T07:30:00Z' },
  { id: 'evt-3', account_id: 'acc-1', event_type: 'conversation.opened', actor_type: 'external', actor_id: null, entity_type: 'conversation', entity_id: 'conv-4', channel: 'whatsapp', payload: { contact_id: 'contact-4' }, created_at: '2025-01-19T09:00:00Z' },
  { id: 'evt-4', account_id: 'acc-1', event_type: 'message.received', actor_type: 'external', actor_id: 'contact-4', entity_type: 'conversation', entity_id: 'conv-4', channel: 'whatsapp', payload: { text: 'Olá, gostaria de informações sobre consultas' }, created_at: '2025-01-19T09:01:00Z' },
  { id: 'evt-5', account_id: 'acc-1', event_type: 'conversation.assigned.bot', actor_type: 'system', actor_id: null, entity_type: 'conversation', entity_id: 'conv-2', channel: 'instagram', payload: { bot_id: 'bot-1', reason: 'auto_assign' }, created_at: '2025-01-18T14:00:30Z' },
  { id: 'evt-6', account_id: 'acc-1', event_type: 'lead.stage.changed', actor_type: 'user', actor_id: 'user-agent-1', entity_type: 'contact', entity_id: 'contact-1', channel: null, payload: { from_stage: 'stage-3', to_stage: 'stage-4' }, created_at: '2025-01-19T08:00:00Z' },
  { id: 'evt-7', account_id: 'acc-1', event_type: 'sale.created', actor_type: 'user', actor_id: 'user-agent-1', entity_type: 'sale', entity_id: 'sale-2', channel: null, payload: { contact_id: 'contact-6', valor: 2800 }, created_at: '2025-01-19T10:30:00Z' },
  { id: 'evt-8', account_id: 'acc-1', event_type: 'sale.paid', actor_type: 'system', actor_id: null, entity_type: 'sale', entity_id: 'sale-2', channel: null, payload: { metodo: 'cartao', paid_at: '2025-01-19T10:35:00Z' }, created_at: '2025-01-19T10:35:00Z' },
  { id: 'evt-9', account_id: 'acc-1', event_type: 'conversation.resolved', actor_type: 'user', actor_id: 'user-agent-1', entity_type: 'conversation', entity_id: 'conv-5', channel: 'whatsapp', payload: { resolution_time_minutes: 127 }, created_at: '2025-01-19T10:00:00Z' },
  { id: 'evt-10', account_id: 'acc-1', event_type: 'message.sent', actor_type: 'agent_bot', actor_id: 'bot-1', entity_type: 'conversation', entity_id: 'conv-6', channel: 'instagram', payload: { text: 'Olá! Sou a Marília, como posso ajudar?' }, created_at: '2025-01-18T15:01:00Z' },
];

// ============= TAGS (CHATWOOT ↔ KANBAN) =============
// Tags de Etapa = Etapas do Kanban (são a MESMA coisa)
// Tags Operacionais = Complementares (urgente, lead-frio, etc)

export const mockTags: Tag[] = [
  // Tags de Etapa (type === 'stage') - Account 1, Funnel 1
  // Cada tag de etapa É uma coluna do Kanban
  { id: 'tag-1', account_id: 'acc-1', funnel_id: 'funnel-1', name: 'Novo', slug: 'novo', type: 'stage', color: '#0EA5E9', ordem: 1, ativo: true, created_at: '2024-06-15T10:00:00Z' },
  { id: 'tag-2', account_id: 'acc-1', funnel_id: 'funnel-1', name: 'Contato', slug: 'contato', type: 'stage', color: '#8B5CF6', ordem: 2, ativo: true, created_at: '2024-06-15T10:00:00Z' },
  { id: 'tag-3', account_id: 'acc-1', funnel_id: 'funnel-1', name: 'Interessado', slug: 'interessado', type: 'stage', color: '#F59E0B', ordem: 3, ativo: true, created_at: '2024-06-15T10:00:00Z' },
  { id: 'tag-4', account_id: 'acc-1', funnel_id: 'funnel-1', name: 'Qualificado', slug: 'qualificado', type: 'stage', color: '#22C55E', ordem: 4, ativo: true, created_at: '2024-06-15T10:00:00Z' },
  { id: 'tag-5', account_id: 'acc-1', funnel_id: 'funnel-1', name: 'Convertido', slug: 'convertido', type: 'stage', color: '#A855F7', ordem: 5, ativo: true, created_at: '2024-06-15T10:00:00Z' },
  
  // Tags Operacionais (type === 'operational') - Account 1
  { id: 'tag-op-1', account_id: 'acc-1', funnel_id: 'funnel-1', name: 'Urgente', slug: 'urgente', type: 'operational', color: '#EF4444', ordem: 0, ativo: true, created_at: '2024-07-01T10:00:00Z' },
  { id: 'tag-op-2', account_id: 'acc-1', funnel_id: 'funnel-1', name: 'Sem Resposta', slug: 'sem-resposta', type: 'operational', color: '#F97316', ordem: 0, ativo: true, created_at: '2024-07-01T10:00:00Z' },
  { id: 'tag-op-3', account_id: 'acc-1', funnel_id: 'funnel-1', name: 'Retorno Agendado', slug: 'retorno-agendado', type: 'operational', color: '#06B6D4', ordem: 0, ativo: true, created_at: '2024-07-01T10:00:00Z' },
  { id: 'tag-op-4', account_id: 'acc-1', funnel_id: 'funnel-1', name: 'Lead Frio', slug: 'lead-frio', type: 'operational', color: '#64748B', ordem: 0, ativo: true, created_at: '2024-07-01T10:00:00Z' },
  { id: 'tag-op-5', account_id: 'acc-1', funnel_id: 'funnel-1', name: 'Lead Quente', slug: 'lead-quente', type: 'operational', color: '#DC2626', ordem: 0, ativo: true, created_at: '2024-07-01T10:00:00Z' },
  { id: 'tag-op-6', account_id: 'acc-1', funnel_id: 'funnel-1', name: 'Já é Cliente', slug: 'ja-e-cliente', type: 'operational', color: '#10B981', ordem: 0, ativo: true, created_at: '2024-07-01T10:00:00Z' },

  // Tags de Etapa - Account 2, Funnel 2
  { id: 'tag-6', account_id: 'acc-2', funnel_id: 'funnel-2', name: 'Lead', slug: 'lead', type: 'stage', color: '#0EA5E9', ordem: 1, ativo: true, created_at: '2024-08-20T14:00:00Z' },
  { id: 'tag-7', account_id: 'acc-2', funnel_id: 'funnel-2', name: 'Proposta', slug: 'proposta', type: 'stage', color: '#F59E0B', ordem: 2, ativo: true, created_at: '2024-08-20T14:00:00Z' },
  { id: 'tag-8', account_id: 'acc-2', funnel_id: 'funnel-2', name: 'Negociação', slug: 'negociacao', type: 'stage', color: '#8B5CF6', ordem: 3, ativo: true, created_at: '2024-08-20T14:00:00Z' },
  { id: 'tag-9', account_id: 'acc-2', funnel_id: 'funnel-2', name: 'Fechado', slug: 'fechado', type: 'stage', color: '#22C55E', ordem: 4, ativo: true, created_at: '2024-08-20T14:00:00Z' },
];

// Tags aplicadas aos leads
export const mockLeadTags: LeadTag[] = [
  // Contact 1 - Qualificado + Urgente
  { id: 'lt-1', contact_id: 'contact-1', tag_id: 'tag-4', applied_by_type: 'user', applied_by_id: 'user-agent-1', source: 'kanban', created_at: '2025-01-19T08:00:00Z' },
  { id: 'lt-2', contact_id: 'contact-1', tag_id: 'tag-op-1', applied_by_type: 'user', applied_by_id: 'user-agent-1', source: 'chatwoot', created_at: '2025-01-19T08:30:00Z' },
  
  // Contact 2 - Interessado + Retorno Agendado
  { id: 'lt-3', contact_id: 'contact-2', tag_id: 'tag-3', applied_by_type: 'system', applied_by_id: null, source: 'kanban', created_at: '2025-01-18T16:00:00Z' },
  { id: 'lt-4', contact_id: 'contact-2', tag_id: 'tag-op-3', applied_by_type: 'user', applied_by_id: 'user-agent-2', source: 'chatwoot', created_at: '2025-01-18T17:00:00Z' },
  
  // Contact 3 - Contato
  { id: 'lt-5', contact_id: 'contact-3', tag_id: 'tag-2', applied_by_type: 'system', applied_by_id: null, source: 'kanban', created_at: '2025-01-19T07:30:00Z' },
  
  // Contact 4 - Novo + Sem Resposta
  { id: 'lt-6', contact_id: 'contact-4', tag_id: 'tag-1', applied_by_type: 'system', applied_by_id: null, source: 'system', created_at: '2025-01-19T09:00:00Z' },
  { id: 'lt-7', contact_id: 'contact-4', tag_id: 'tag-op-2', applied_by_type: 'agent_bot', applied_by_id: 'bot-1', source: 'chatwoot', created_at: '2025-01-19T10:00:00Z' },
  
  // Contact 5 - Novo
  { id: 'lt-8', contact_id: 'contact-5', tag_id: 'tag-1', applied_by_type: 'system', applied_by_id: null, source: 'kanban', created_at: '2025-01-17T08:00:00Z' },
  
  // Contact 6 - Convertido + Já é Cliente
  { id: 'lt-9', contact_id: 'contact-6', tag_id: 'tag-5', applied_by_type: 'user', applied_by_id: 'user-agent-1', source: 'kanban', created_at: '2025-01-19T10:00:00Z' },
  { id: 'lt-10', contact_id: 'contact-6', tag_id: 'tag-op-6', applied_by_type: 'system', applied_by_id: null, source: 'system', created_at: '2025-01-19T10:05:00Z' },
  
  // Contact 7 - Contato + Lead Quente
  { id: 'lt-11', contact_id: 'contact-7', tag_id: 'tag-2', applied_by_type: 'system', applied_by_id: null, source: 'kanban', created_at: '2025-01-19T11:00:00Z' },
  { id: 'lt-12', contact_id: 'contact-7', tag_id: 'tag-op-5', applied_by_type: 'user', applied_by_id: 'user-agent-2', source: 'chatwoot', created_at: '2025-01-19T11:30:00Z' },
  
  // Contact 8 - Novo
  { id: 'lt-13', contact_id: 'contact-8', tag_id: 'tag-1', applied_by_type: 'system', applied_by_id: null, source: 'system', created_at: '2025-01-19T07:00:00Z' },
];

// Histórico de tags
export const mockTagHistory: TagHistory[] = [
  { id: 'th-1', contact_id: 'contact-1', tag_id: 'tag-1', action: 'added', actor_type: 'system', actor_id: null, source: 'system', reason: 'Lead criado', created_at: '2025-01-10T10:00:00Z' },
  { id: 'th-2', contact_id: 'contact-1', tag_id: 'tag-1', action: 'removed', actor_type: 'user', actor_id: 'user-agent-1', source: 'kanban', reason: 'Movido para Contato', created_at: '2025-01-15T10:00:00Z' },
  { id: 'th-3', contact_id: 'contact-1', tag_id: 'tag-2', action: 'added', actor_type: 'user', actor_id: 'user-agent-1', source: 'kanban', reason: 'Movido para Contato', created_at: '2025-01-15T10:00:00Z' },
  { id: 'th-4', contact_id: 'contact-1', tag_id: 'tag-2', action: 'removed', actor_type: 'user', actor_id: 'user-agent-1', source: 'kanban', reason: 'Movido para Interessado', created_at: '2025-01-17T14:00:00Z' },
  { id: 'th-5', contact_id: 'contact-1', tag_id: 'tag-3', action: 'added', actor_type: 'user', actor_id: 'user-agent-1', source: 'kanban', reason: 'Movido para Interessado', created_at: '2025-01-17T14:00:00Z' },
  { id: 'th-6', contact_id: 'contact-1', tag_id: 'tag-3', action: 'removed', actor_type: 'user', actor_id: 'user-agent-1', source: 'kanban', reason: 'Movido para Qualificado', created_at: '2025-01-19T08:00:00Z' },
  { id: 'th-7', contact_id: 'contact-1', tag_id: 'tag-4', action: 'added', actor_type: 'user', actor_id: 'user-agent-1', source: 'kanban', reason: 'Movido para Qualificado', created_at: '2025-01-19T08:00:00Z' },
  { id: 'th-8', contact_id: 'contact-1', tag_id: 'tag-op-1', action: 'added', actor_type: 'user', actor_id: 'user-agent-1', source: 'chatwoot', reason: 'Tag aplicada no Chatwoot', created_at: '2025-01-19T08:30:00Z' },
];
export interface ServerConsumption {
  timestamp: string;
  cpu: number;
  ram: number;
  disk: number;
  network_in: number;
  network_out: number;
}

export interface ServerResources {
  cpu_used: number;
  cpu_total: number;
  ram_used: number;
  ram_total: number;
  disk_used: number;
  disk_total: number;
  network_bandwidth: number;
  network_limit: number;
}

// Últimas 24 horas de consumo (dados por hora)
export const mockServerConsumptionHistory: ServerConsumption[] = Array.from({ length: 24 }, (_, i) => {
  const date = new Date();
  date.setHours(date.getHours() - (23 - i));
  const hour = date.getHours();
  
  // Simular picos de uso em horários comerciais
  const isBusinessHour = hour >= 8 && hour <= 18;
  const baseUsage = isBusinessHour ? 0.6 : 0.25;
  const variance = Math.random() * 0.2;
  
  return {
    timestamp: date.toISOString(),
    cpu: Math.min(95, Math.round((baseUsage + variance) * 100)),
    ram: Math.min(92, Math.round((baseUsage + 0.1 + variance * 0.5) * 100)),
    disk: 45 + Math.round(i * 0.3),
    network_in: Math.round((baseUsage + variance) * 150),
    network_out: Math.round((baseUsage + variance) * 80),
  };
});

// Recursos atuais do servidor
export const getServerResources = (): ServerResources => ({
  cpu_used: 72,
  cpu_total: 100,
  ram_used: 12.4,
  ram_total: 16,
  disk_used: 180,
  disk_total: 500,
  network_bandwidth: 245,
  network_limit: 1000,
});

// Últimos 7 dias de consumo agregado
export const mockWeeklyConsumption = [
  { day: 'Seg', cpu_avg: 65, ram_avg: 72, requests: 12400 },
  { day: 'Ter', cpu_avg: 71, ram_avg: 74, requests: 14200 },
  { day: 'Qua', cpu_avg: 68, ram_avg: 71, requests: 13100 },
  { day: 'Qui', cpu_avg: 74, ram_avg: 78, requests: 15600 },
  { day: 'Sex', cpu_avg: 69, ram_avg: 73, requests: 13800 },
  { day: 'Sáb', cpu_avg: 35, ram_avg: 52, requests: 4200 },
  { day: 'Dom', cpu_avg: 28, ram_avg: 48, requests: 3100 },
];

// ============= KPI CALCULATIONS =============
export const getSuperAdminKPIs = (): SuperAdminKPIs => ({
  total_accounts: mockAccounts.length,
  total_users: mockUsers.length,
  events_count: mockEvents.length,
  active_accounts: mockAccounts.filter(a => a.status === 'active').length,
  paused_accounts: mockAccounts.filter(a => a.status === 'paused').length,
});

export const getAdminKPIs = (accountId: string): AdminKPIs => {
  const accountContacts = mockContacts.filter(c => c.account_id === accountId);
  const accountConversations = mockConversations.filter(c => c.account_id === accountId);
  const accountSales = mockSales.filter(s => s.account_id === accountId);
  
  const botConversations = accountConversations.filter(c => c.assignee_type === 'agent_bot').length;
  const humanConversations = accountConversations.filter(c => c.assignee_type === 'user').length;
  const totalAssigned = botConversations + humanConversations;
  
  const paidSales = accountSales.filter(s => s.status === 'paid');
  const totalRevenue = paidSales.reduce((sum, s) => sum + s.valor, 0);
  
  return {
    total_leads: accountContacts.length,
    ia_percentage: totalAssigned > 0 ? Math.round((botConversations / totalAssigned) * 100) : 0,
    human_percentage: totalAssigned > 0 ? Math.round((humanConversations / totalAssigned) * 100) : 0,
    avg_response_time_minutes: 4.5,
    conversion_rate: accountContacts.length > 0 ? Math.round((paidSales.length / accountContacts.length) * 100) : 0,
    total_revenue: totalRevenue,
    avg_ticket: paidSales.length > 0 ? totalRevenue / paidSales.length : 0,
    open_conversations: accountConversations.filter(c => c.status === 'open').length,
    resolved_today: 2,
  };
};

export const getAgentKPIs = (userId: string): AgentKPIs => {
  const agentConversations = mockConversations.filter(c => c.assignee_id === userId);
  const resolvedConversations = agentConversations.filter(c => c.status === 'resolved');
  
  return {
    atendimentos_realizados: agentConversations.length,
    conversoes: resolvedConversations.length,
    tempo_medio_atendimento_minutes: 12,
    leads_atribuidos: agentConversations.filter(c => c.status !== 'resolved').length,
  };
};
