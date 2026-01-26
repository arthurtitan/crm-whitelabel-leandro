import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  asyncHandler,
  getPrismaClient,
  getDateRangeParams,
  requireSuperAdmin,
  requirePermission,
  startOfDay,
  endOfDay,
  startOfMonth,
  CACHE_KEYS,
  CACHE_TTL,
  getOrSetCache,
} from '@gleps/shared';

const router = Router();
const prisma = getPrismaClient();

const getAccountId = (req: AuthenticatedRequest): string => {
  if (req.user!.role === 'super_admin') {
    return (req.query.accountId as string) || req.user!.accountId!;
  }
  return req.user!.accountId!;
};

// Super Admin KPIs (platform-wide)
router.get('/super-admin/kpis', requireSuperAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const [
    totalAccounts,
    activeAccounts,
    totalUsers,
    totalContacts,
    totalSales,
    totalRevenue,
  ] = await Promise.all([
    prisma.account.count(),
    prisma.account.count({ where: { status: 'active' } }),
    prisma.user.count(),
    prisma.contact.count(),
    prisma.sale.count({ where: { status: 'paid' } }),
    prisma.sale.aggregate({
      where: { status: 'paid' },
      _sum: { valor: true },
    }),
  ]);

  res.json({
    data: {
      totalAccounts,
      activeAccounts,
      totalUsers,
      totalContacts,
      totalSales,
      totalRevenue: Number(totalRevenue._sum.valor || 0),
    },
  });
}));

// Admin KPIs (account-level)
router.get('/admin/kpis', requirePermission('dashboard'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const dateRange = getDateRangeParams(req);

  const today = new Date();
  const startOfToday = startOfDay(today);
  const endOfToday = endOfDay(today);
  const startMonth = startOfMonth(today);

  const where: any = { accountId };
  if (dateRange.startDate || dateRange.endDate) {
    where.createdAt = {};
    if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
    if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
  }

  const [
    totalContacts,
    newContactsToday,
    newContactsMonth,
    totalSales,
    paidSales,
    totalRevenue,
    revenueToday,
    revenueMonth,
    totalUsers,
    activeUsers,
  ] = await Promise.all([
    prisma.contact.count({ where: { accountId } }),
    prisma.contact.count({ where: { accountId, createdAt: { gte: startOfToday, lte: endOfToday } } }),
    prisma.contact.count({ where: { accountId, createdAt: { gte: startMonth } } }),
    prisma.sale.count({ where }),
    prisma.sale.count({ where: { ...where, status: 'paid' } }),
    prisma.sale.aggregate({ where: { ...where, status: 'paid' }, _sum: { valor: true } }),
    prisma.sale.aggregate({ where: { accountId, status: 'paid', createdAt: { gte: startOfToday, lte: endOfToday } }, _sum: { valor: true } }),
    prisma.sale.aggregate({ where: { accountId, status: 'paid', createdAt: { gte: startMonth } }, _sum: { valor: true } }),
    prisma.user.count({ where: { accountId } }),
    prisma.user.count({ where: { accountId, status: 'active' } }),
  ]);

  res.json({
    data: {
      contacts: {
        total: totalContacts,
        today: newContactsToday,
        month: newContactsMonth,
      },
      sales: {
        total: totalSales,
        paid: paidSales,
        conversionRate: totalSales > 0 ? (paidSales / totalSales) * 100 : 0,
      },
      revenue: {
        total: Number(totalRevenue._sum.valor || 0),
        today: Number(revenueToday._sum.valor || 0),
        month: Number(revenueMonth._sum.valor || 0),
      },
      users: {
        total: totalUsers,
        active: activeUsers,
      },
    },
  });
}));

// Hourly peak chart
router.get('/hourly-peak', requirePermission('dashboard'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const dateRange = getDateRangeParams(req);

  const where: any = { accountId };
  if (dateRange.startDate) where.createdAt = { gte: dateRange.startDate };
  if (dateRange.endDate) where.createdAt = { ...where.createdAt, lte: dateRange.endDate };

  const contacts = await prisma.contact.findMany({
    where,
    select: { createdAt: true },
  });

  const hourlyData = new Array(24).fill(0);
  contacts.forEach(c => {
    const hour = c.createdAt.getHours();
    hourlyData[hour]++;
  });

  const data = hourlyData.map((count, hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    contacts: count,
  }));

  res.json({ data });
}));

// Agent performance
router.get('/agent-performance', requirePermission('dashboard'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const dateRange = getDateRangeParams(req);

  const where: any = { accountId };
  if (dateRange.startDate || dateRange.endDate) {
    where.createdAt = {};
    if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
    if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
  }

  const users = await prisma.user.findMany({
    where: { accountId, role: 'agent', status: 'active' },
    select: {
      id: true,
      nome: true,
      _count: {
        select: {
          sales: { where },
        },
      },
    },
  });

  const salesByUser = await prisma.sale.groupBy({
    by: ['responsavelId'],
    where: { ...where, status: 'paid' },
    _sum: { valor: true },
    _count: { id: true },
  });

  const salesMap = new Map(salesByUser.map(s => [s.responsavelId, s]));

  const data = users.map(user => {
    const sales = salesMap.get(user.id);
    return {
      id: user.id,
      nome: user.nome,
      totalSales: user._count.sales,
      paidSales: sales?._count.id || 0,
      revenue: Number(sales?._sum.valor || 0),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  res.json({ data });
}));

// Backlog metrics
router.get('/backlog', requirePermission('dashboard'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);

  const [pendingSales, contactsWithoutSales, contactsInKanban] = await Promise.all([
    prisma.sale.count({ where: { accountId, status: 'pending' } }),
    prisma.contact.count({
      where: { accountId, sales: { none: {} } },
    }),
    prisma.contact.count({
      where: { accountId, leadTags: { some: { tag: { type: 'stage' } } } },
    }),
  ]);

  res.json({
    data: {
      pendingSales,
      contactsWithoutSales,
      contactsInKanban,
    },
  });
}));

export default router;
