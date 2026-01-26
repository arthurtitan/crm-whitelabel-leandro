import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  asyncHandler,
  getPrismaClient,
  getPaginationParams,
  getPaginationMeta,
  getDateRangeParams,
  NotFoundError,
  requireSuperAdmin,
} from '@gleps/shared';

const router = Router();
const prisma = getPrismaClient();

const getAccountId = (req: AuthenticatedRequest): string | undefined => {
  if (req.user!.role === 'super_admin') {
    return req.query.accountId as string | undefined;
  }
  return req.user!.accountId!;
};

// List events
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const pagination = getPaginationParams(req);
  const dateRange = getDateRangeParams(req);
  const { eventType, entityType, entityId, actorId } = req.query;

  const where: any = {};

  if (accountId) {
    where.accountId = accountId;
  }

  if (eventType) {
    where.eventType = { contains: eventType as string };
  }

  if (entityType) {
    where.entityType = entityType;
  }

  if (entityId) {
    where.entityId = entityId;
  }

  if (actorId) {
    where.actorId = actorId;
  }

  if (dateRange.startDate || dateRange.endDate) {
    where.createdAt = {};
    if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
    if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit,
      include: {
        actor: { select: { id: true, nome: true, email: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);

  res.json({ data: events, meta: getPaginationMeta(total, pagination) });
}));

// Get event by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;

  const where: any = { id };
  if (accountId) {
    where.accountId = accountId;
  }

  const event = await prisma.event.findFirst({
    where,
    include: {
      actor: { select: { id: true, nome: true, email: true } },
    },
  });

  if (!event) throw new NotFoundError('Evento');

  res.json({ data: event });
}));

// Get events for entity
router.get('/entity/:entityType/:entityId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { entityType, entityId } = req.params;
  const pagination = getPaginationParams(req);

  const where: any = { entityType, entityId };
  if (accountId) {
    where.accountId = accountId;
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit,
      include: {
        actor: { select: { id: true, nome: true } },
      },
    }),
    prisma.event.count({ where }),
  ]);

  res.json({ data: events, meta: getPaginationMeta(total, pagination) });
}));

// Get event stats
router.get('/stats/summary', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const dateRange = getDateRangeParams(req);

  const where: any = {};
  if (accountId) {
    where.accountId = accountId;
  }

  if (dateRange.startDate || dateRange.endDate) {
    where.createdAt = {};
    if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
    if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
  }

  const stats = await prisma.event.groupBy({
    by: ['eventType'],
    where,
    _count: { id: true },
  });

  const data = stats.map(s => ({
    eventType: s.eventType,
    count: s._count.id,
  })).sort((a, b) => b.count - a.count);

  res.json({ data });
}));

// Get user activity (who is online)
router.get('/activity/users', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);

  if (!accountId) {
    res.json({ data: [] });
    return;
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const recentEvents = await prisma.event.findMany({
    where: {
      accountId,
      createdAt: { gte: fiveMinutesAgo },
      actorType: 'user',
      actorId: { not: null },
    },
    select: {
      actorId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const userActivity = new Map<string, Date>();
  for (const event of recentEvents) {
    if (event.actorId && !userActivity.has(event.actorId)) {
      userActivity.set(event.actorId, event.createdAt);
    }
  }

  const userIds = Array.from(userActivity.keys());
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nome: true },
  });

  const userMap = new Map(users.map(u => [u.id, u.nome]));

  const data = Array.from(userActivity.entries()).map(([userId, lastActivity]) => ({
    userId,
    userName: userMap.get(userId) || 'Desconhecido',
    lastActivity,
    isOnline: true,
  }));

  res.json({ data });
}));

// Platform-wide stats (Super Admin only)
router.get('/stats/platform', requireSuperAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const dateRange = getDateRangeParams(req);

  const where: any = {};
  if (dateRange.startDate || dateRange.endDate) {
    where.createdAt = {};
    if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
    if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
  }

  const [totalEvents, byAccount, byType] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.groupBy({
      by: ['accountId'],
      where,
      _count: { id: true },
    }),
    prisma.event.groupBy({
      by: ['eventType'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
  ]);

  res.json({
    data: {
      totalEvents,
      accountsWithActivity: byAccount.filter(a => a.accountId).length,
      topEventTypes: byType.map(t => ({
        eventType: t.eventType,
        count: t._count.id,
      })),
    },
  });
}));

export default router;
