import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  asyncHandler,
  getPrismaClient,
  createFunnelSchema,
  updateFunnelSchema,
  NotFoundError,
  publishEvent,
  requireAdmin,
  generateSlug,
  CACHE_KEYS,
  deleteCachePattern,
} from '@gleps/shared';

const router = Router();
const prisma = getPrismaClient();

const getAccountId = (req: AuthenticatedRequest): string => {
  if (req.user!.role === 'super_admin') {
    return (req.query.accountId as string) || req.user!.accountId!;
  }
  return req.user!.accountId!;
};

// List funnels
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);

  const funnels = await prisma.funnel.findMany({
    where: { accountId },
    orderBy: { createdAt: 'asc' },
    include: {
      tags: {
        where: { ativo: true },
        orderBy: { ordem: 'asc' },
        select: { id: true, name: true, color: true, type: true, ordem: true },
      },
      _count: { select: { tags: true } },
    },
  });

  res.json({ data: funnels });
}));

// Get funnel by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;

  const funnel = await prisma.funnel.findFirst({
    where: { id, accountId },
    include: {
      tags: {
        orderBy: { ordem: 'asc' },
      },
    },
  });

  if (!funnel) throw new NotFoundError('Funil');

  res.json({ data: funnel });
}));

// Create funnel
router.post('/', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const body = createFunnelSchema.parse(req.body);

  const slug = generateSlug(body.name);

  // If setting as default, remove default from others
  if (body.isDefault) {
    await prisma.funnel.updateMany({
      where: { accountId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const funnel = await prisma.funnel.create({
    data: {
      accountId,
      name: body.name,
      slug,
      isDefault: body.isDefault,
    },
  });

  await deleteCachePattern(CACHE_KEYS.FUNNELS_BY_ACCOUNT(accountId));

  await publishEvent({
    eventType: 'funnel.created',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'funnel',
    entityId: funnel.id,
    payload: { name: funnel.name },
  });

  res.status(201).json({ data: funnel });
}));

// Update funnel
router.put('/:id', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;
  const body = updateFunnelSchema.parse(req.body);

  const existing = await prisma.funnel.findFirst({ where: { id, accountId } });
  if (!existing) throw new NotFoundError('Funil');

  // If setting as default, remove default from others
  if (body.isDefault) {
    await prisma.funnel.updateMany({
      where: { accountId, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const funnel = await prisma.funnel.update({
    where: { id },
    data: {
      name: body.name,
      slug: body.name ? generateSlug(body.name) : undefined,
      isDefault: body.isDefault,
    },
  });

  await deleteCachePattern(CACHE_KEYS.FUNNELS_BY_ACCOUNT(accountId));

  res.json({ data: funnel });
}));

// Delete funnel
router.delete('/:id', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;

  const existing = await prisma.funnel.findFirst({
    where: { id, accountId },
    include: { _count: { select: { tags: true } } },
  });

  if (!existing) throw new NotFoundError('Funil');

  // Delete all tags first
  await prisma.tag.deleteMany({ where: { funnelId: id } });

  await prisma.funnel.delete({ where: { id } });

  await deleteCachePattern(CACHE_KEYS.FUNNELS_BY_ACCOUNT(accountId));

  await publishEvent({
    eventType: 'funnel.deleted',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'funnel',
    entityId: id,
    payload: { name: existing.name },
  });

  res.json({ data: { success: true } });
}));

export default router;
