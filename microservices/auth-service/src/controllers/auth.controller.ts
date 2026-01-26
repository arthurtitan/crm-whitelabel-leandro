import { Response } from 'express';
import {
  AuthenticatedRequest,
  loginSchema,
  refreshTokenSchema,
  UnauthorizedError,
  ValidationError,
  publishEvent,
} from '@gleps/shared';
import * as authService from '../services/auth.service';

export async function login(req: AuthenticatedRequest, res: Response): Promise<void> {
  const body = loginSchema.parse(req.body);
  const result = await authService.login(body.email, body.password);

  // Publish login event
  await publishEvent({
    eventType: 'auth.login',
    accountId: result.user.accountId || undefined,
    actorType: 'user',
    actorId: result.user.id,
    entityType: 'user',
    entityId: result.user.id,
    payload: { email: result.user.email },
  });

  res.json({ data: result });
}

export async function refresh(req: AuthenticatedRequest, res: Response): Promise<void> {
  const body = refreshTokenSchema.parse(req.body);
  const result = await authService.refreshToken(body.refreshToken);

  res.json({ data: result });
}

export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { refreshToken } = req.body;

  if (refreshToken) {
    await authService.revokeRefreshToken(refreshToken);
  }

  // Publish logout event
  if (req.user) {
    await publishEvent({
      eventType: 'auth.logout',
      accountId: req.user.accountId,
      actorType: 'user',
      actorId: req.user.userId,
      entityType: 'user',
      entityId: req.user.userId,
    });
  }

  res.json({ data: { success: true } });
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  const user = await authService.getUserById(req.user.userId);

  res.json({ data: user });
}

export async function verifyPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    throw new UnauthorizedError();
  }

  const { password } = req.body;
  if (!password) {
    throw new ValidationError('Senha é obrigatória');
  }

  const valid = await authService.verifyPassword(req.user.userId, password);

  res.json({ data: { valid } });
}
