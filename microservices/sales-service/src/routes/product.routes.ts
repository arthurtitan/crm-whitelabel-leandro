import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  asyncHandler,
  getPrismaClient,
  getPaginationParams,
  getPaginationMeta,
  createProductSchema,
  updateProductSchema,
  NotFoundError,
  ValidationError,
  publishEvent,
  requirePermission,
  requireAdmin,
  CACHE_KEYS,
  deleteCache,
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

// List products
router.get('/', requirePermission('sales', 'products'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const pagination = getPaginationParams(req);
  const { search, ativo } = req.query;

  const where: any = { accountId };
  if (search) {
    where.nome = { contains: search, mode: 'insensitive' };
  }
  if (ativo !== undefined) {
    where.ativo = ativo === 'true';
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { nome: 'asc' },
      skip: pagination.offset,
      take: pagination.limit,
    }),
    prisma.product.count({ where }),
  ]);

  const data = products.map(p => ({ ...p, valorPadrao: Number(p.valorPadrao) }));

  res.json({ data, meta: getPaginationMeta(total, pagination) });
}));

// Get product by ID
router.get('/:id', requirePermission('sales', 'products'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;

  const product = await prisma.product.findFirst({
    where: { id, accountId },
    include: {
      _count: { select: { saleItems: true } },
    },
  });

  if (!product) throw new NotFoundError('Produto');

  res.json({ data: { ...product, valorPadrao: Number(product.valorPadrao) } });
}));

// Create product
router.post('/', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const body = createProductSchema.parse(req.body);

  const product = await prisma.product.create({
    data: {
      accountId,
      nome: body.nome,
      valorPadrao: body.valorPadrao,
      metodosPagamento: body.metodosPagamento,
      conveniosAceitos: body.conveniosAceitos,
    },
  });

  await deleteCachePattern(CACHE_KEYS.PRODUCTS_BY_ACCOUNT(accountId));

  await publishEvent({
    eventType: 'product.created',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'product',
    entityId: product.id,
    payload: { nome: product.nome },
  });

  res.status(201).json({ data: { ...product, valorPadrao: Number(product.valorPadrao) } });
}));

// Update product
router.put('/:id', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;
  const body = updateProductSchema.parse(req.body);

  const existing = await prisma.product.findFirst({ where: { id, accountId } });
  if (!existing) throw new NotFoundError('Produto');

  const product = await prisma.product.update({
    where: { id },
    data: body,
  });

  await deleteCache(CACHE_KEYS.PRODUCT(id));
  await deleteCachePattern(CACHE_KEYS.PRODUCTS_BY_ACCOUNT(accountId));

  await publishEvent({
    eventType: 'product.updated',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'product',
    entityId: product.id,
    payload: { changes: body },
  });

  res.json({ data: { ...product, valorPadrao: Number(product.valorPadrao) } });
}));

// Toggle product status
router.post('/:id/toggle', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;

  const existing = await prisma.product.findFirst({ where: { id, accountId } });
  if (!existing) throw new NotFoundError('Produto');

  const product = await prisma.product.update({
    where: { id },
    data: { ativo: !existing.ativo },
  });

  await deleteCache(CACHE_KEYS.PRODUCT(id));
  await deleteCachePattern(CACHE_KEYS.PRODUCTS_BY_ACCOUNT(accountId));

  res.json({ data: { ...product, valorPadrao: Number(product.valorPadrao) } });
}));

// Delete product
router.delete('/:id', requireAdmin, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;

  const existing = await prisma.product.findFirst({
    where: { id, accountId },
    include: { _count: { select: { saleItems: true } } },
  });

  if (!existing) throw new NotFoundError('Produto');

  if (existing._count.saleItems > 0) {
    throw new ValidationError('Não é possível excluir produto com vendas associadas');
  }

  await prisma.product.delete({ where: { id } });

  await deleteCache(CACHE_KEYS.PRODUCT(id));
  await deleteCachePattern(CACHE_KEYS.PRODUCTS_BY_ACCOUNT(accountId));

  await publishEvent({
    eventType: 'product.deleted',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'product',
    entityId: id,
    payload: { nome: existing.nome },
  });

  res.json({ data: { success: true } });
}));

export default router;
