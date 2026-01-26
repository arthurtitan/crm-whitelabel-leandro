import { Request } from 'express';

// ============================================
// USER & AUTH TYPES
// ============================================
export type UserRole = 'super_admin' | 'admin' | 'agent';
export type UserStatus = 'active' | 'inactive' | 'suspended';
export type AccountStatus = 'active' | 'paused' | 'cancelled';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  accountId?: string;
  permissions: string[];
  isImpersonating?: boolean;
  originalUserId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  requestId?: string;
}

// ============================================
// PAGINATION & FILTERING
// ============================================
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
}

// ============================================
// SERVICE COMMUNICATION
// ============================================
export interface ServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ServiceConfig {
  name: string;
  port: number;
  host: string;
}

export const SERVICES = {
  GATEWAY: { name: 'gateway', port: 3000, host: 'gateway' },
  AUTH: { name: 'auth-service', port: 3001, host: 'auth-service' },
  USER: { name: 'user-service', port: 3002, host: 'user-service' },
  CONTACT: { name: 'contact-service', port: 3003, host: 'contact-service' },
  SALES: { name: 'sales-service', port: 3004, host: 'sales-service' },
  KANBAN: { name: 'kanban-service', port: 3005, host: 'kanban-service' },
  ANALYTICS: { name: 'analytics-service', port: 3006, host: 'analytics-service' },
  CALENDAR: { name: 'calendar-service', port: 3007, host: 'calendar-service' },
  EVENT: { name: 'event-service', port: 3008, host: 'event-service' },
} as const;

// ============================================
// REDIS CHANNELS
// ============================================
export const REDIS_CHANNELS = {
  // Events
  USER_CREATED: 'user:created',
  USER_UPDATED: 'user:updated',
  USER_DELETED: 'user:deleted',

  CONTACT_CREATED: 'contact:created',
  CONTACT_UPDATED: 'contact:updated',
  CONTACT_DELETED: 'contact:deleted',

  SALE_CREATED: 'sale:created',
  SALE_PAID: 'sale:paid',
  SALE_REFUNDED: 'sale:refunded',

  TAG_ADDED: 'tag:added',
  TAG_REMOVED: 'tag:removed',

  // Cache invalidation
  CACHE_INVALIDATE: 'cache:invalidate',
} as const;

// ============================================
// CACHE KEYS
// ============================================
export const CACHE_KEYS = {
  USER: (id: string) => `user:${id}`,
  USER_BY_EMAIL: (email: string) => `user:email:${email}`,
  ACCOUNT: (id: string) => `account:${id}`,
  CONTACT: (id: string) => `contact:${id}`,
  PRODUCT: (id: string) => `product:${id}`,
  PRODUCTS_BY_ACCOUNT: (accountId: string) => `products:account:${accountId}`,
  TAGS_BY_ACCOUNT: (accountId: string) => `tags:account:${accountId}`,
  FUNNELS_BY_ACCOUNT: (accountId: string) => `funnels:account:${accountId}`,
  DASHBOARD_KPIS: (accountId: string, date: string) => `dashboard:kpis:${accountId}:${date}`,
  SALES_STATS: (accountId: string, date: string) => `sales:stats:${accountId}:${date}`,
} as const;

export const CACHE_TTL = {
  SHORT: 60,          // 1 minute
  MEDIUM: 300,        // 5 minutes
  LONG: 3600,         // 1 hour
  DAY: 86400,         // 24 hours
} as const;

// ============================================
// ENUMS
// ============================================
export type PaymentMethod = 'pix' | 'boleto' | 'debito' | 'credito' | 'dinheiro' | 'convenio';
export type SaleStatus = 'pending' | 'paid' | 'refunded' | 'partial_refund';
export type ContactOrigin = 'whatsapp' | 'instagram' | 'site' | 'indicacao' | 'outro';
export type TagType = 'stage' | 'operational';
export type ActorType = 'user' | 'agent_bot' | 'system' | 'external';
export type LeadTagSource = 'kanban' | 'chatwoot' | 'system' | 'api';

// ============================================
// EVENT TYPES
// ============================================
export interface AuditEvent {
  eventType: string;
  accountId?: string;
  actorType: ActorType;
  actorId?: string;
  entityType: string;
  entityId: string;
  channel?: string;
  payload?: Record<string, unknown>;
  timestamp?: Date;
}
