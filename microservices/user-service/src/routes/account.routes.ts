import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  asyncHandler,
  requireSuperAdmin,
  getPrismaClient,
  getPaginationParams,
  getPaginationMeta,
  createAccountSchema,
  updateAccountSchema,
  NotFoundError,
  publishEvent,
  CACHE_KEYS,
  deleteCache,
} from '@gleps/shared';

const router = Router();
const prisma = getPrismaClient();

// List accounts (Super Admin only)
router.get('/', requireSuperAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const pagination = getPaginationParams(req);
  const { status, search } = req.query;

  const where: any = {};
  if (status) where.status = status;
  if (search) {
    where.nome = { contains: search, mode: 'insensitive' };
  }

  const [accounts, total] = await Promise.all([
    prisma.account.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit,
      include: {
        _count: { select: { users: true, contacts: true, sales: true } },
      },
    }),
    prisma.account.count({ where }),
  ]);

  res.json({ data: accounts, meta: getPaginationMeta(total, pagination) });
}));

// Get account by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  // Check access
  if (req.user!.role !== 'super_admin' && id !== req.user!.accountId) {
    throw new NotFoundError('Conta');
  }

  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, contacts: true, sales: true, products: true } },
    },
  });

  if (!account) throw new NotFoundError('Conta');

  res.json({ data: account });
}));

// Create account (Super Admin only)
router.post('/', requireSuperAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = createAccountSchema.parse(req.body);

  const account = await prisma.account.create({
    data: body,
  });

  await publishEvent({
    eventType: 'account.created',
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'account',
    entityId: account.id,
    payload: { nome: account.nome },
  });

  res.status(201).json({ data: account });
}));

// Update account
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const body = updateAccountSchema.parse(req.body);

  // Only super_admin can update any account
  if (req.user!.role !== 'super_admin' && id !== req.user!.accountId) {
    throw new NotFoundError('Conta');
  }

  // Non-super admins can't change status
  if (req.user!.role !== 'super_admin') {
    delete body.status;
  }

  const account = await prisma.account.update({
    where: { id },
    data: body,
  });

  await deleteCache(CACHE_KEYS.ACCOUNT(id));

  await publishEvent({
    eventType: 'account.updated',
    accountId: id,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'account',
    entityId: id,
    payload: { changes: body },
  });

  res.json({ data: account });
}));

// Pause account (Super Admin only)
router.post('/:id/pause', requireSuperAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const account = await prisma.account.update({
    where: { id },
    data: { status: 'paused' },
  });

  await deleteCache(CACHE_KEYS.ACCOUNT(id));

  await publishEvent({
    eventType: 'account.paused',
    accountId: id,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'account',
    entityId: id,
  });

  res.json({ data: account });
}));

// Activate account (Super Admin only)
router.post('/:id/activate', requireSuperAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const account = await prisma.account.update({
    where: { id },
    data: { status: 'active' },
  });

  await deleteCache(CACHE_KEYS.ACCOUNT(id));

  await publishEvent({
    eventType: 'account.activated',
    accountId: id,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'account',
    entityId: id,
  });

  res.json({ data: account });
}));

// Delete account (Super Admin only)
router.delete('/:id', requireSuperAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  await prisma.account.delete({ where: { id } });
  await deleteCache(CACHE_KEYS.ACCOUNT(id));

  await publishEvent({
    eventType: 'account.deleted',
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'account',
    entityId: id,
  });

  res.json({ data: { success: true } });
}));

// Get account stats
router.get('/:id/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  if (req.user!.role !== 'super_admin' && id !== req.user!.accountId) {
    throw new NotFoundError('Conta');
  }

  const [userCount, contactCount, saleCount, productCount, totalRevenue] = await Promise.all([
    prisma.user.count({ where: { accountId: id } }),
    prisma.contact.count({ where: { accountId: id } }),
    prisma.sale.count({ where: { accountId: id } }),
    prisma.product.count({ where: { accountId: id } }),
    prisma.sale.aggregate({
      where: { accountId: id, status: 'paid' },
      _sum: { valor: true },
    }),
  ]);

  res.json({
    data: {
      users: userCount,
      contacts: contactCount,
      sales: saleCount,
      products: productCount,
      totalRevenue: Number(totalRevenue._sum.valor || 0),
    },
  });
}));

export default router;
