import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  asyncHandler,
  getPrismaClient,
  getPaginationParams,
  getPaginationMeta,
  getDateRangeParams,
  createSaleSchema,
  refundSchema,
  NotFoundError,
  ValidationError,
  publishEvent,
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

// List sales
router.get('/', requirePermission('sales', 'finance'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const pagination = getPaginationParams(req);
  const { status, contactId, responsavelId, metodoPagamento } = req.query;
  const dateRange = getDateRangeParams(req);

  const where: any = { accountId };
  if (status) where.status = status;
  if (contactId) where.contactId = contactId;
  if (responsavelId) where.responsavelId = responsavelId;
  if (metodoPagamento) where.metodoPagamento = metodoPagamento;

  if (dateRange.startDate || dateRange.endDate) {
    where.createdAt = {};
    if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
    if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit,
      include: {
        contact: { select: { id: true, nome: true, telefone: true } },
        responsavel: { select: { id: true, nome: true } },
        items: { include: { product: { select: { id: true, nome: true } } } },
      },
    }),
    prisma.sale.count({ where }),
  ]);

  const data = sales.map(s => ({
    ...s,
    valor: Number(s.valor),
    items: s.items.map(i => ({
      ...i,
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    })),
  }));

  res.json({ data, meta: getPaginationMeta(total, pagination) });
}));

// Get sale by ID
router.get('/:id', requirePermission('sales', 'finance'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;

  const sale = await prisma.sale.findFirst({
    where: { id, accountId },
    include: {
      contact: { select: { id: true, nome: true, telefone: true, email: true } },
      responsavel: { select: { id: true, nome: true, email: true } },
      refundedBy: { select: { id: true, nome: true } },
      items: { include: { product: { select: { id: true, nome: true } } } },
    },
  });

  if (!sale) throw new NotFoundError('Venda');

  res.json({
    data: {
      ...sale,
      valor: Number(sale.valor),
      items: sale.items.map(i => ({
        ...i,
        valorUnitario: Number(i.valorUnitario),
        valorTotal: Number(i.valorTotal),
      })),
    },
  });
}));

// Create sale
router.post('/', requirePermission('sales'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const body = createSaleSchema.parse(req.body);

  // Validate contact
  const contact = await prisma.contact.findFirst({ where: { id: body.contactId, accountId } });
  if (!contact) throw new NotFoundError('Contato');

  // Validate products
  for (const item of body.items) {
    const product = await prisma.product.findFirst({ where: { id: item.productId, accountId } });
    if (!product) throw new NotFoundError(`Produto ${item.productId}`);
  }

  // Check recurring
  const existingSale = await prisma.sale.findFirst({
    where: {
      contactId: body.contactId,
      items: { some: { productId: { in: body.items.map(i => i.productId) } } },
    },
  });

  const totalValue = body.items.reduce((sum, item) => sum + item.quantidade * item.valorUnitario, 0);

  const sale = await prisma.sale.create({
    data: {
      accountId,
      contactId: body.contactId,
      valor: totalValue,
      metodoPagamento: body.metodoPagamento,
      convenioNome: body.convenioNome,
      responsavelId: req.user!.userId,
      isRecurring: !!existingSale,
      items: {
        create: body.items.map(item => ({
          productId: item.productId,
          quantidade: item.quantidade,
          valorUnitario: item.valorUnitario,
          valorTotal: item.quantidade * item.valorUnitario,
        })),
      },
    },
    include: {
      items: { include: { product: { select: { id: true, nome: true } } } },
      contact: { select: { id: true, nome: true } },
    },
  });

  await publishEvent({
    eventType: 'sale.created',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'sale',
    entityId: sale.id,
    payload: { contactId: sale.contactId, valor: totalValue, items: sale.items.length },
  });

  res.status(201).json({ data: { ...sale, valor: Number(sale.valor) } });
}));

// Mark sale as paid
router.post('/:id/paid', requirePermission('sales', 'finance'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;

  const sale = await prisma.sale.findFirst({ where: { id, accountId } });
  if (!sale) throw new NotFoundError('Venda');
  if (sale.status !== 'pending') throw new ValidationError('Venda já foi paga ou estornada');

  const updated = await prisma.sale.update({
    where: { id },
    data: { status: 'paid', paidAt: new Date() },
  });

  await publishEvent({
    eventType: 'sale.paid',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'sale',
    entityId: id,
    payload: { valor: Number(updated.valor) },
  });

  res.json({ data: { ...updated, valor: Number(updated.valor) } });
}));

// Refund entire sale
router.post('/:id/refund', requirePermission('finance'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;
  const body = refundSchema.parse(req.body);

  const sale = await prisma.sale.findFirst({ where: { id, accountId } });
  if (!sale) throw new NotFoundError('Venda');
  if (sale.status === 'refunded') throw new ValidationError('Venda já foi estornada');

  await prisma.saleItem.updateMany({
    where: { saleId: id },
    data: { refunded: true, refundedAt: new Date(), refundReason: body.reason },
  });

  const updated = await prisma.sale.update({
    where: { id },
    data: {
      status: 'refunded',
      refundedAt: new Date(),
      refundReason: body.reason,
      refundedById: req.user!.userId,
    },
  });

  await publishEvent({
    eventType: 'sale.refunded',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'sale',
    entityId: id,
    payload: { valor: Number(updated.valor), reason: body.reason },
  });

  res.json({ data: { ...updated, valor: Number(updated.valor) } });
}));

// Refund single item
router.post('/:id/items/:itemId/refund', requirePermission('finance'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id, itemId } = req.params;
  const body = refundSchema.parse(req.body);

  const sale = await prisma.sale.findFirst({ where: { id, accountId } });
  if (!sale) throw new NotFoundError('Venda');

  const item = await prisma.saleItem.findFirst({ where: { id: itemId, saleId: id } });
  if (!item) throw new NotFoundError('Item');
  if (item.refunded) throw new ValidationError('Item já foi estornado');

  await prisma.saleItem.update({
    where: { id: itemId },
    data: { refunded: true, refundedAt: new Date(), refundReason: body.reason },
  });

  const nonRefundedCount = await prisma.saleItem.count({ where: { saleId: id, refunded: false } });
  const newStatus = nonRefundedCount === 0 ? 'refunded' : 'partial_refund';

  await prisma.sale.update({
    where: { id },
    data: {
      status: newStatus,
      ...(newStatus === 'refunded' ? {
        refundedAt: new Date(),
        refundReason: body.reason,
        refundedById: req.user!.userId,
      } : {}),
    },
  });

  await publishEvent({
    eventType: 'sale.item.refunded',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'sale',
    entityId: id,
    payload: { itemId, valor: Number(item.valorTotal), reason: body.reason },
  });

  res.json({ data: { success: true } });
}));

export default router;
