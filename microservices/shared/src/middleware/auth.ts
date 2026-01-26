import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, JwtPayload, UserRole } from '../types';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Authentication middleware
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token não fornecido');
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    req.user = payload;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: { code: 'TOKEN_EXPIRED', message: 'Token expirado' },
      });
      return;
    }

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        error: { code: 'TOKEN_INVALID', message: 'Token inválido' },
      });
      return;
    }

    next(error);
  }
}

/**
 * Optional authentication (doesn't fail if no token)
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      req.user = verifyAccessToken(token);
    }

    next();
  } catch {
    // Ignore errors, continue without auth
    next();
  }
}

/**
 * Role-based authorization
 */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Não autenticado' },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Acesso negado para este perfil' },
      });
      return;
    }

    next();
  };
}

/**
 * Permission-based authorization
 */
export function requirePermission(...permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Não autenticado' },
      });
      return;
    }

    // Super admin and admin have all permissions
    if (req.user.role === 'super_admin' || req.user.role === 'admin') {
      next();
      return;
    }

    // Check agent permissions
    const hasPermission = permissions.some(p => req.user!.permissions.includes(p));

    if (!hasPermission) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Permissão insuficiente' },
      });
      return;
    }

    next();
  };
}

/**
 * Ensure user belongs to account (multi-tenant isolation)
 */
export function requireAccount(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Não autenticado' },
    });
    return;
  }

  // Super admin can access any account
  if (req.user.role === 'super_admin') {
    next();
    return;
  }

  // User must have an account
  if (!req.user.accountId) {
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Usuário sem conta associada' },
    });
    return;
  }

  next();
}

/**
 * Super admin only
 */
export const requireSuperAdmin = requireRole('super_admin');

/**
 * Admin or super admin
 */
export const requireAdmin = requireRole('super_admin', 'admin');
