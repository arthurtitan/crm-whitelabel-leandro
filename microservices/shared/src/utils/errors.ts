export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Recurso') {
    super(`${resource} não encontrado`, 404, 'NOT_FOUND');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Não autorizado') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Acesso negado') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Dados inválidos', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflito de dados', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Muitas requisições. Tente novamente mais tarde.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string = 'Serviço') {
    super(`${service} temporariamente indisponível`, 503, 'SERVICE_UNAVAILABLE');
  }
}

export const ErrorCodes = {
  // Auth
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  USER_SUSPENDED: 'USER_SUSPENDED',

  // Validation
  EMAIL_IN_USE: 'EMAIL_IN_USE',
  PASSWORD_INVALID: 'PASSWORD_INVALID',
  USER_LIMIT_EXCEEDED: 'USER_LIMIT_EXCEEDED',

  // Business
  SALE_ALREADY_REFUNDED: 'SALE_ALREADY_REFUNDED',
  ITEM_ALREADY_REFUNDED: 'ITEM_ALREADY_REFUNDED',
  CONTACT_HAS_SALES: 'CONTACT_HAS_SALES',
  PRODUCT_IN_USE: 'PRODUCT_IN_USE',

  // Service
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
} as const;
