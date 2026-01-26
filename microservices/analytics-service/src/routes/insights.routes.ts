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

// Product analysis
router.get('/products', requirePermission('insights'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const dateRange = getDateRangeParams(req);

  const where: any = { sale: { accountId, status: 'paid' } };
  if (dateRange.startDate || dateRange.endDate) {
    where.sale.createdAt = {};
    if (dateRange.startDate) where.sale.createdAt.gte = dateRange.startDate;
    if (dateRange.endDate) where.sale.createdAt.lte = dateRange.endDate;
  }

  const products = await prisma.saleItem.groupBy({
    by: ['productId'],
    where,
    _count: { id: true },
    _sum: { valorTotal: true, quantidade: true },
  });

  const productDetails = await prisma.product.findMany({
    where: { id: { in: products.map(p => p.productId) } },
    select: { id: true, nome: true },
  });

  const productMap = new Map(productDetails.map(p => [p.id, p.nome]));

  const data = products.map(p => ({
    productId: p.productId,
    productName: productMap.get(p.productId) || 'Desconhecido',
    salesCount: p._count.id,
    totalQuantity: p._sum.quantidade || 0,
    totalRevenue: Number(p._sum.valorTotal || 0),
  })).sort((a, b) => b.totalRevenue - a.totalRevenue);

  res.json({ data });
}));

// Temporal analysis (by day of week, hour)
router.get('/temporal', requirePermission('insights'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const dateRange = getDateRangeParams(req);

  const where: any = { accountId, status: 'paid' };
  if (dateRange.startDate || dateRange.endDate) {
    where.createdAt = {};
    if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
    if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
  }

  const sales = await prisma.sale.findMany({
    where,
    select: { createdAt: true, valor: true },
  });

  // By day of week
  const dayOfWeek = new Array(7).fill(0).map(() => ({ count: 0, revenue: 0 }));
  const hourOfDay = new Array(24).fill(0).map(() => ({ count: 0, revenue: 0 }));

  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  sales.forEach(sale => {
    const date = new Date(sale.createdAt);
    const day = date.getDay();
    const hour = date.getHours();
    const valor = Number(sale.valor);

    dayOfWeek[day].count++;
    dayOfWeek[day].revenue += valor;
    hourOfDay[hour].count++;
    hourOfDay[hour].revenue += valor;
  });

  res.json({
    data: {
      byDayOfWeek: dayOfWeek.map((d, i) => ({
        day: dayNames[i],
        count: d.count,
        revenue: d.revenue,
      })),
      byHourOfDay: hourOfDay.map((h, i) => ({
        hour: `${i.toString().padStart(2, '0')}:00`,
        count: h.count,
        revenue: h.revenue,
      })),
    },
  });
}));

// Marketing metrics (by origin)
router.get('/marketing', requirePermission('insights'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const dateRange = getDateRangeParams(req);

  const contactWhere: any = { accountId };
  if (dateRange.startDate || dateRange.endDate) {
    contactWhere.createdAt = {};
    if (dateRange.startDate) contactWhere.createdAt.gte = dateRange.startDate;
    if (dateRange.endDate) contactWhere.createdAt.lte = dateRange.endDate;
  }

  const byOrigin = await prisma.contact.groupBy({
    by: ['origem'],
    where: contactWhere,
    _count: { id: true },
  });

  // Get conversion by origin
  const originStats = await Promise.all(
    byOrigin.map(async (o) => {
      const contactsWithSales = await prisma.contact.count({
        where: { ...contactWhere, origem: o.origem, sales: { some: { status: 'paid' } } },
      });

      const revenue = await prisma.sale.aggregate({
        where: {
          accountId,
          status: 'paid',
          contact: { origem: o.origem },
        },
        _sum: { valor: true },
      });

      return {
        origem: o.origem || 'não informado',
        contacts: o._count.id,
        conversions: contactsWithSales,
        conversionRate: o._count.id > 0 ? (contactsWithSales / o._count.id) * 100 : 0,
        revenue: Number(revenue._sum.valor || 0),
      };
    })
  );

  res.json({ data: originStats.sort((a, b) => b.revenue - a.revenue) });
}));

// Automatic insights (AI-like suggestions)
router.get('/automatic', requirePermission('insights'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);

  const insights: Array<{ type: string; title: string; description: string; priority: 'high' | 'medium' | 'low' }> = [];

  // Get some metrics
  const [
    pendingSales,
    contactsWithoutActivity,
    topProduct,
    lowConversionDays,
  ] = await Promise.all([
    prisma.sale.count({ where: { accountId, status: 'pending' } }),
    prisma.contact.count({
      where: {
        accountId,
        sales: { none: {} },
        createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { accountId, status: 'paid' } },
      _sum: { valorTotal: true },
      orderBy: { _sum: { valorTotal: 'desc' } },
      take: 1,
    }),
    // Check if weekend has low sales
    prisma.sale.count({
      where: {
        accountId,
        status: 'paid',
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  // Generate insights
  if (pendingSales > 10) {
    insights.push({
      type: 'action',
      title: 'Vendas Pendentes',
      description: `Existem ${pendingSales} vendas pendentes de pagamento. Considere enviar lembretes.`,
      priority: 'high',
    });
  }

  if (contactsWithoutActivity > 20) {
    insights.push({
      type: 'opportunity',
      title: 'Leads Inativos',
      description: `${contactsWithoutActivity} leads não tiveram atividade nos últimos 7 dias. Uma campanha de reengajamento pode ajudar.`,
      priority: 'medium',
    });
  }

  if (topProduct.length > 0) {
    const product = await prisma.product.findUnique({
      where: { id: topProduct[0].productId },
      select: { nome: true },
    });
    insights.push({
      type: 'highlight',
      title: 'Produto Destaque',
      description: `"${product?.nome}" é seu produto mais vendido. Considere criar promoções relacionadas.`,
      priority: 'low',
    });
  }

  insights.push({
    type: 'tip',
    title: 'Horários de Pico',
    description: 'Analise o gráfico de pico horário para otimizar seus horários de atendimento.',
    priority: 'low',
  });

  res.json({ data: insights });
}));

// Agent ranking
router.get('/agent-ranking', requirePermission('insights'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const dateRange = getDateRangeParams(req);

  const where: any = { accountId, status: 'paid' };
  if (dateRange.startDate || dateRange.endDate) {
    where.createdAt = {};
    if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
    if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
  }

  const ranking = await prisma.sale.groupBy({
    by: ['responsavelId'],
    where,
    _count: { id: true },
    _sum: { valor: true },
    orderBy: { _sum: { valor: 'desc' } },
  });

  const userIds = ranking.map(r => r.responsavelId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, nome: true },
  });

  const userMap = new Map(users.map(u => [u.id, u.nome]));

  const data = ranking.map((r, index) => ({
    rank: index + 1,
    userId: r.responsavelId,
    userName: userMap.get(r.responsavelId) || 'Desconhecido',
    salesCount: r._count.id,
    totalRevenue: Number(r._sum.valor || 0),
  }));

  res.json({ data });
}));

export default router;
