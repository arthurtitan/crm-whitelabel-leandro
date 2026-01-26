import { z } from 'zod';

// ============================================
// COMMON SCHEMAS
// ============================================
export const uuidSchema = z.string().uuid('ID inválido');

export const emailSchema = z.string().email('Email inválido').toLowerCase();

export const passwordSchema = z
  .string()
  .min(6, 'Senha deve ter pelo menos 6 caracteres')
  .max(128, 'Senha deve ter no máximo 128 caracteres');

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// ============================================
// AUTH SCHEMAS
// ============================================
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Senha é obrigatória'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
});

// ============================================
// USER SCHEMAS
// ============================================
export const userRoleSchema = z.enum(['super_admin', 'admin', 'agent']);
export const userStatusSchema = z.enum(['active', 'inactive', 'suspended']);

export const createUserSchema = z.object({
  accountId: uuidSchema.optional(),
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: emailSchema,
  password: passwordSchema,
  role: userRoleSchema,
  permissions: z.array(z.string()).optional(),
  chatwootAgentId: z.number().optional(),
});

export const updateUserSchema = z.object({
  nome: z.string().min(2).optional(),
  email: emailSchema.optional(),
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
  permissions: z.array(z.string()).optional(),
  chatwootAgentId: z.number().nullable().optional(),
});

// ============================================
// ACCOUNT SCHEMAS
// ============================================
export const accountStatusSchema = z.enum(['active', 'paused', 'cancelled']);

export const createAccountSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  timezone: z.string().default('America/Sao_Paulo'),
  plano: z.string().optional(),
  limiteUsuarios: z.number().int().positive().default(10),
  chatwootBaseUrl: z.string().url().optional(),
  chatwootAccountId: z.string().optional(),
  chatwootApiKey: z.string().optional(),
});

export const updateAccountSchema = z.object({
  nome: z.string().min(2).optional(),
  timezone: z.string().optional(),
  plano: z.string().optional(),
  status: accountStatusSchema.optional(),
  limiteUsuarios: z.number().int().positive().optional(),
  chatwootBaseUrl: z.string().url().nullable().optional(),
  chatwootAccountId: z.string().nullable().optional(),
  chatwootApiKey: z.string().nullable().optional(),
});

// ============================================
// CONTACT SCHEMAS
// ============================================
export const contactOriginSchema = z.enum(['whatsapp', 'instagram', 'site', 'indicacao', 'outro']);

export const createContactSchema = z.object({
  nome: z.string().min(1).optional(),
  telefone: z.string().optional(),
  email: emailSchema.optional(),
  origem: contactOriginSchema.optional(),
  chatwootContactId: z.number().optional(),
  chatwootConversationId: z.number().optional(),
});

export const updateContactSchema = z.object({
  nome: z.string().min(1).optional(),
  telefone: z.string().optional(),
  email: emailSchema.nullable().optional(),
  origem: contactOriginSchema.optional(),
});

// ============================================
// PRODUCT SCHEMAS
// ============================================
export const paymentMethodSchema = z.enum(['pix', 'boleto', 'debito', 'credito', 'dinheiro', 'convenio']);

export const createProductSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  valorPadrao: z.number().positive('Valor deve ser positivo'),
  metodosPagamento: z.array(paymentMethodSchema).default(['pix']),
  conveniosAceitos: z.array(z.string()).default([]),
});

export const updateProductSchema = z.object({
  nome: z.string().min(1).optional(),
  valorPadrao: z.number().positive().optional(),
  metodosPagamento: z.array(paymentMethodSchema).optional(),
  conveniosAceitos: z.array(z.string()).optional(),
  ativo: z.boolean().optional(),
});

// ============================================
// SALE SCHEMAS
// ============================================
export const saleStatusSchema = z.enum(['pending', 'paid', 'refunded', 'partial_refund']);

export const saleItemSchema = z.object({
  productId: uuidSchema,
  quantidade: z.number().int().positive().default(1),
  valorUnitario: z.number().positive(),
});

export const createSaleSchema = z.object({
  contactId: uuidSchema,
  metodoPagamento: paymentMethodSchema,
  convenioNome: z.string().optional(),
  items: z.array(saleItemSchema).min(1, 'Pelo menos um item é obrigatório'),
});

export const refundSchema = z.object({
  reason: z.string().min(1, 'Motivo é obrigatório'),
});

// ============================================
// TAG/FUNNEL SCHEMAS
// ============================================
export const tagTypeSchema = z.enum(['stage', 'operational']);

export const createTagSchema = z.object({
  funnelId: uuidSchema,
  name: z.string().min(1, 'Nome é obrigatório'),
  type: tagTypeSchema.default('stage'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#6366F1'),
  ordem: z.number().int().min(0).default(0),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  type: tagTypeSchema.optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  ordem: z.number().int().min(0).optional(),
  ativo: z.boolean().optional(),
});

export const createFunnelSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  isDefault: z.boolean().default(false),
});

export const updateFunnelSchema = z.object({
  name: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
});

// ============================================
// CALENDAR SCHEMAS
// ============================================
export const calendarEventTypeSchema = z.enum(['meeting', 'appointment', 'block', 'other']);
export const calendarEventStatusSchema = z.enum(['scheduled', 'cancelled', 'completed']);

export const createCalendarEventSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  type: calendarEventTypeSchema.default('appointment'),
  location: z.string().optional(),
  meetingLink: z.string().url().optional(),
  contactId: uuidSchema.optional(),
  notes: z.string().optional(),
  attendees: z.array(z.object({
    name: z.string(),
    email: emailSchema,
  })).optional(),
});

export const updateCalendarEventSchema = z.object({
  title: z.string().min(1).optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  type: calendarEventTypeSchema.optional(),
  status: calendarEventStatusSchema.optional(),
  location: z.string().nullable().optional(),
  meetingLink: z.string().url().nullable().optional(),
  contactId: uuidSchema.nullable().optional(),
  notes: z.string().nullable().optional(),
});
