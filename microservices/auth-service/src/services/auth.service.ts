import {
  getPrismaClient,
  hashPassword,
  comparePassword,
  generateTokenPair,
  verifyRefreshToken,
  getExpirationDate,
  UnauthorizedError,
  ErrorCodes,
  CACHE_KEYS,
  CACHE_TTL,
  getCache,
  setCache,
  deleteCache,
} from '@gleps/shared';
import { randomUUID } from 'crypto';

const prisma = getPrismaClient();

export interface LoginResult {
  user: {
    id: string;
    nome: string;
    email: string;
    role: string;
    permissions: string[];
    accountId: string | null;
  };
  account: {
    id: string;
    nome: string;
    status: string;
    timezone: string;
  } | null;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      account: {
        select: { id: true, nome: true, status: true, timezone: true },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError('Credenciais inválidas');
  }

  // Check password
  const isValid = await comparePassword(password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError('Credenciais inválidas');
  }

  // Check user status
  if (user.status !== 'active') {
    throw new UnauthorizedError('Usuário suspenso ou inativo');
  }

  // Check account status (if not super_admin)
  if (user.account && user.account.status !== 'active') {
    throw new UnauthorizedError('Conta suspensa ou cancelada');
  }

  // Generate tokens
  const tokens = generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role,
    accountId: user.accountId || undefined,
    permissions: user.permissions,
  });

  // Save refresh token
  await prisma.refreshToken.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: getExpirationDate(7 * 24 * 60 * 60), // 7 days
    },
  });

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      accountId: user.accountId,
    },
    account: user.account,
    tokens,
  };
}

export async function refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  // Verify token
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Refresh token inválido');
  }

  // Check if token exists and is not revoked
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: {
      user: {
        include: {
          account: { select: { status: true } },
        },
      },
    },
  });

  if (!storedToken || storedToken.revokedAt) {
    throw new UnauthorizedError('Refresh token inválido ou revogado');
  }

  if (storedToken.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token expirado');
  }

  const user = storedToken.user;

  // Check user and account status
  if (user.status !== 'active') {
    throw new UnauthorizedError('Usuário suspenso ou inativo');
  }

  if (user.account && user.account.status !== 'active') {
    throw new UnauthorizedError('Conta suspensa ou cancelada');
  }

  // Generate new access token
  const tokens = generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role,
    accountId: user.accountId || undefined,
    permissions: user.permissions,
  });

  return {
    accessToken: tokens.accessToken,
    expiresIn: tokens.expiresIn,
  };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getUserById(userId: string) {
  // Try cache first
  const cacheKey = CACHE_KEYS.USER(userId);
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      status: true,
      permissions: true,
      accountId: true,
      chatwootAgentId: true,
      lastLoginAt: true,
      createdAt: true,
      account: {
        select: {
          id: true,
          nome: true,
          status: true,
          timezone: true,
        },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError('Usuário não encontrado');
  }

  // Cache result
  await setCache(cacheKey, user, CACHE_TTL.MEDIUM);

  return user;
}

export async function verifyPassword(userId: string, password: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) return false;

  return comparePassword(password, user.passwordHash);
}
