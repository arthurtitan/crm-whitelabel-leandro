import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  asyncHandler,
  getPrismaClient,
  getDateRangeParams,
  getPaginationParams,
  getPaginationMeta,
  requirePermission,
} from '@gleps/shared';

const router = Router();
const prisma = getPrismaClient();

const getAccountId = (req: AuthenticatedRequest): string => {
  if (req.user!.role === 'super_admin') {
    return (req.query.accountId as string) || req.user!.accountId!;
  }
  return req.user!.accountId!;
};

// Finance KPIs
router.get('/kpis', requirePermission('finance'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const dateRange = getDateRangeParams(req);

  const where: any = { accountId };
  if (dateRange.startDate || dateRange.endDate) {
    where.createdAt = {};
    if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
    if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
  }

  const [
    totalSales,
    paidSales,
    pendingSales,
    refundedSales,
    totalRevenue,
    avgTicket,
    recurringSales,
  ] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.count({ where: { ...where, status: 'paid' } }),
    prisma.sale.count({ where: { ...where, status: 'pending' } }),
    prisma.sale.count({ where: { ...where, status: { in: ['refunded', 'partial_refund'] } } }),
    prisma.sale.aggregate({ where: { ...where, status: 'paid' }, _sum: { valor: true } }),
    prisma.sale.aggregate({ where: { ...where, status: 'paid' }, _avg: { valor: true } }),
    prisma.sale.count({ where: { ...where, isRecurring: true } }),
  ]);

  res.json({
    data: {
      totalSales,
      paidSales,
      pendingSales,
      refundedSales,
      totalRevenue: Number(totalRevenue._sum.valor || 0),
      avgTicket: Number(avgTicket._avg.valor || 0),
      conversionRate: totalSales > 0 ? (paidSales / totalSales) * 100 : 0,
      recurringRate: totalSales > 0 ? (recurringSales / totalSales) * 100 : 0,
    },
  });
}));

// Revenue chart (daily/weekly/monthly)
router.get('/revenue-chart', requirePermission('finance'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const dateRange = getDateRangeParams(req);
  const { groupBy = 'day' } = req.query;

  const where: any = { accountId, status: 'paid' };
  if (dateRange.startDate || dateRange.endDate) {
    where.paidAt = {};
    if (dateRange.startDate) where.paidAt.gte = dateRange.startDate;
    if (dateRange.endDate) where.paidAt.lte = dateRange.endDate;
  }

  const sales = await prisma.sale.findMany({
    where,
    select: { paidAt: true, valor: true },
    orderBy: { paidAt: 'asc' },
  });

  const grouped = new Map<string, number>();

  sales.forEach(sale => {
    if (!sale.paidAt) return;

    let key: string;
    const date = new Date(sale.paidAt);

    if (groupBy === 'month') {
      key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    } else if (groupBy === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = date.toISOString().split('T')[0];
    }

    grouped.set(key, (grouped.get(key) || 0) + Number(sale.valor));
  });

  const data = Array.from(grouped.entries()).map(([date, revenue]) => ({
    date,
    revenue,
  }));

  res.json({ data });
}));

// Payment methods distribution
router.get('/payment-methods', requirePermission('finance'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const dateRange = getDateRangeParams(req);

  const where: any = { accountId, status: 'paid' };
  if (dateRange.startDate || dateRange.endDate) {
    where.createdAt = {};
    if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
    if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
  }

  const methods = await prisma.sale.groupBy({
    by: ['metodoPagamento'],
    where,
    _count: { id: true },
    _sum: { valor: true },
  });

  const data = methods.map(m => ({
    method: m.metodoPagamento,
    count: m._count.id,
    revenue: Number(m._sum.valor || 0),
  }));

  res.json({ data });
}));

// Funnel conversion
router.get('/funnel-conversion', requirePermission('finance'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const dateRange = getDateRangeParams(req);

  const where: any = { accountId };
  if (dateRange.startDate || dateRange.endDate) {
    where.createdAt = {};
    if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
    if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
  }

  const [totalContacts, contactsWithSales, paidContacts] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.count({ where: { ...where, sales: { some: {} } } }),
    prisma.contact.count({ where: { ...where, sales: { some: { status: 'paid' } } } }),
  ]);

  res.json({
    data: {
      stages: [
        { name: 'Leads', count: totalContacts },
        { name: 'Com Venda', count: contactsWithSales },
        { name: 'Pagantes', count: paidContacts },
      ],
      conversionRates: {
        leadToSale: totalContacts > 0 ? (contactsWithSales / totalContacts) * 100 : 0,
        saleToPaid: contactsWithSales > 0 ? (paidContacts / contactsWithSales) * 100 : 0,
        overall: totalContacts > 0 ? (paidContacts / totalContacts) * 100 : 0,
      },
    },
  });
}));

// Refund audit log
router.get('/refund-audit', requirePermission('finance'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const pagination = getPaginationParams(req);
  const dateRange = getDateRangeParams(req);

  const where: any = {
    accountId,
    eventType: { in: ['sale.refunded', 'sale.item.refunded'] },
  };

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
      include: { actor: { select: { id: true, nome: true } } },
    }),
    prisma.event.count({ where }),
  ]);

  res.json({ data: events, meta: getPaginationMeta(total, pagination) });
}));

export default router;
