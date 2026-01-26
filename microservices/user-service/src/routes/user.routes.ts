import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  asyncHandler,
  requireAdmin,
  requireSuperAdmin,
  getPrismaClient,
  getPaginationParams,
  getPaginationMeta,
  hashPassword,
  createUserSchema,
  updateUserSchema,
  NotFoundError,
  ConflictError,
  publishEvent,
  CACHE_KEYS,
  deleteCache,
} from '@gleps/shared';

const router = Router();
const prisma = getPrismaClient();

// List users
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const pagination = getPaginationParams(req);
  const { role, status, search, accountId } = req.query;

  const where: any = {};

  // Multi-tenant isolation
  if (req.user!.role !== 'super_admin') {
    where.accountId = req.user!.accountId;
  } else if (accountId) {
    where.accountId = accountId;
  }

  if (role) where.role = role;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { nome: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit,
      select: {
        id: true,
        accountId: true,
        nome: true,
        email: true,
        role: true,
        status: true,
        permissions: true,
        chatwootAgentId: true,
        lastLoginAt: true,
        createdAt: true,
        account: { select: { id: true, nome: true, status: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ data: users, meta: getPaginationMeta(total, pagination) });
}));

// Get user by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      accountId: true,
      nome: true,
      email: true,
      role: true,
      status: true,
      permissions: true,
      chatwootAgentId: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      account: { select: { id: true, nome: true, status: true, timezone: true } },
    },
  });

  if (!user) throw new NotFoundError('Usuário');

  // Check access
  if (req.user!.role !== 'super_admin' && user.accountId !== req.user!.accountId) {
    throw new NotFoundError('Usuário');
  }

  res.json({ data: user });
}));

// Create user
router.post('/', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = createUserSchema.parse(req.body);

  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw new ConflictError('Email já está em uso');

  // Set account for non-super-admins
  let accountId = body.accountId;
  if (req.user!.role !== 'super_admin') {
    accountId = req.user!.accountId;
    if (body.role === 'super_admin') {
      throw new ConflictError('Não é possível criar Super Admin');
    }
  }

  // Ensure dashboard permission
  let permissions = body.permissions || ['dashboard'];
  if (!permissions.includes('dashboard')) {
    permissions = ['dashboard', ...permissions];
  }

  const user = await prisma.user.create({
    data: {
      accountId: body.role === 'super_admin' ? null : accountId,
      nome: body.nome,
      email: body.email.toLowerCase(),
      passwordHash: await hashPassword(body.password),
      role: body.role,
      permissions,
      chatwootAgentId: body.chatwootAgentId,
    },
    select: {
      id: true,
      accountId: true,
      nome: true,
      email: true,
      role: true,
      permissions: true,
      createdAt: true,
    },
  });

  await publishEvent({
    eventType: 'user.created',
    accountId: user.accountId || undefined,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'user',
    entityId: user.id,
    payload: { email: user.email, role: user.role },
  });

  res.status(201).json({ data: user });
}));

// Update user
router.put('/:id', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const body = updateUserSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Usuário');

  // Check access
  if (req.user!.role !== 'super_admin' && existing.accountId !== req.user!.accountId) {
    throw new NotFoundError('Usuário');
  }

  // Check email uniqueness
  if (body.email && body.email.toLowerCase() !== existing.email) {
    const emailInUse = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (emailInUse) throw new ConflictError('Email já está em uso');
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      nome: body.nome,
      email: body.email?.toLowerCase(),
      role: body.role,
      status: body.status,
      permissions: body.permissions,
      chatwootAgentId: body.chatwootAgentId,
    },
    select: {
      id: true,
      accountId: true,
      nome: true,
      email: true,
      role: true,
      status: true,
      permissions: true,
      updatedAt: true,
    },
  });

  // Invalidate cache
  await deleteCache(CACHE_KEYS.USER(id));

  await publishEvent({
    eventType: 'user.updated',
    accountId: user.accountId || undefined,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'user',
    entityId: user.id,
    payload: { changes: body },
  });

  res.json({ data: user });
}));

// Delete user
router.delete('/:id', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Usuário');

  if (req.user!.role !== 'super_admin' && existing.accountId !== req.user!.accountId) {
    throw new NotFoundError('Usuário');
  }

  if (id === req.user!.userId) {
    throw new ConflictError('Não é possível excluir a si mesmo');
  }

  await prisma.user.delete({ where: { id } });
  await deleteCache(CACHE_KEYS.USER(id));

  await publishEvent({
    eventType: 'user.deleted',
    accountId: existing.accountId || undefined,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'user',
    entityId: id,
    payload: { email: existing.email },
  });

  res.json({ data: { success: true } });
}));

// Impersonate user (Super Admin only)
router.post('/:id/impersonate', requireSuperAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { account: true },
  });

  if (!user) throw new NotFoundError('Usuário');

  await publishEvent({
    eventType: 'user.impersonated',
    accountId: user.accountId || undefined,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'user',
    entityId: id,
    payload: { targetEmail: user.email },
  });

  res.json({
    data: {
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        accountId: user.accountId,
      },
      account: user.account,
      isImpersonating: true,
      originalUserId: req.user!.userId,
    },
  });
}));

export default router;
