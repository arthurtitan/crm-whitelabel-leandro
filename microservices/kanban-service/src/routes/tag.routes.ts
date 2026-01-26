import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  asyncHandler,
  getPrismaClient,
  createTagSchema,
  updateTagSchema,
  NotFoundError,
  publishEvent,
  requirePermission,
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

// List tags
router.get('/', requirePermission('kanban'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { funnelId, type, ativo } = req.query;

  const where: any = { accountId };
  if (funnelId) where.funnelId = funnelId;
  if (type) where.type = type;
  if (ativo !== undefined) where.ativo = ativo === 'true';

  const tags = await prisma.tag.findMany({
    where,
    orderBy: [{ funnelId: 'asc' }, { ordem: 'asc' }],
    include: {
      funnel: { select: { id: true, name: true } },
      _count: { select: { leadTags: true } },
    },
  });

  res.json({ data: tags });
}));

// Get tag by ID
router.get('/:id', requirePermission('kanban'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;

  const tag = await prisma.tag.findFirst({
    where: { id, accountId },
    include: {
      funnel: true,
      _count: { select: { leadTags: true } },
    },
  });

  if (!tag) throw new NotFoundError('Tag');

  res.json({ data: tag });
}));

// Create tag
router.post('/', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const body = createTagSchema.parse(req.body);

  const funnel = await prisma.funnel.findFirst({ where: { id: body.funnelId, accountId } });
  if (!funnel) throw new NotFoundError('Funil');

  const slug = generateSlug(body.name);

  const tag = await prisma.tag.create({
    data: {
      accountId,
      funnelId: body.funnelId,
      name: body.name,
      slug,
      type: body.type,
      color: body.color,
      ordem: body.ordem,
    },
  });

  // Record history
  await prisma.tagHistory.create({
    data: {
      tagId: tag.id,
      action: 'tag_created',
      actorType: 'user',
      actorId: req.user!.userId,
      source: 'kanban',
      tagName: tag.name,
    },
  });

  await deleteCachePattern(CACHE_KEYS.TAGS_BY_ACCOUNT(accountId));

  await publishEvent({
    eventType: 'tag.created',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'tag',
    entityId: tag.id,
    payload: { name: tag.name, type: tag.type },
  });

  res.status(201).json({ data: tag });
}));

// Update tag
router.put('/:id', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;
  const body = updateTagSchema.parse(req.body);

  const existing = await prisma.tag.findFirst({ where: { id, accountId } });
  if (!existing) throw new NotFoundError('Tag');

  const tag = await prisma.tag.update({
    where: { id },
    data: {
      name: body.name,
      slug: body.name ? generateSlug(body.name) : undefined,
      type: body.type,
      color: body.color,
      ordem: body.ordem,
      ativo: body.ativo,
    },
  });

  await deleteCachePattern(CACHE_KEYS.TAGS_BY_ACCOUNT(accountId));

  res.json({ data: tag });
}));

// Reorder tags
router.post('/reorder', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { tags } = req.body; // Array of { id, ordem }

  if (!Array.isArray(tags)) {
    throw new NotFoundError('Tags array required');
  }

  for (const { id, ordem } of tags) {
    await prisma.tag.updateMany({
      where: { id, accountId },
      data: { ordem },
    });
  }

  await deleteCachePattern(CACHE_KEYS.TAGS_BY_ACCOUNT(accountId));

  res.json({ data: { success: true } });
}));

// Delete tag
router.delete('/:id', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;

  const existing = await prisma.tag.findFirst({
    where: { id, accountId },
    include: { _count: { select: { leadTags: true } } },
  });

  if (!existing) throw new NotFoundError('Tag');

  // Remove all lead associations first
  await prisma.leadTag.deleteMany({ where: { tagId: id } });

  // Record history
  await prisma.tagHistory.create({
    data: {
      tagId: id,
      action: 'tag_deleted',
      actorType: 'user',
      actorId: req.user!.userId,
      source: 'kanban',
      tagName: existing.name,
    },
  });

  await prisma.tag.delete({ where: { id } });

  await deleteCachePattern(CACHE_KEYS.TAGS_BY_ACCOUNT(accountId));

  await publishEvent({
    eventType: 'tag.deleted',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'tag',
    entityId: id,
    payload: { name: existing.name },
  });

  res.json({ data: { success: true } });
}));

// Get kanban board data
router.get('/kanban/board', requirePermission('kanban'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { funnelId } = req.query;

  const where: any = { accountId, type: 'stage', ativo: true };
  if (funnelId) where.funnelId = funnelId;

  const tags = await prisma.tag.findMany({
    where,
    orderBy: { ordem: 'asc' },
    include: {
      leadTags: {
        include: {
          contact: {
            include: {
              leadTags: {
                where: { tag: { type: 'operational' } },
                include: { tag: { select: { id: true, name: true, color: true } } },
              },
              _count: { select: { sales: true } },
            },
          },
        },
      },
    },
  });

  const board = tags.map(tag => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    ordem: tag.ordem,
    leads: tag.leadTags.map(lt => ({
      id: lt.contact.id,
      nome: lt.contact.nome,
      telefone: lt.contact.telefone,
      origem: lt.contact.origem,
      operationalTags: lt.contact.leadTags.map(ot => ot.tag),
      salesCount: lt.contact._count.sales,
      addedAt: lt.createdAt,
    })),
  }));

  res.json({ data: board });
}));

export default router;
