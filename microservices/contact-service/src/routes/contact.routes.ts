import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  asyncHandler,
  getPrismaClient,
  getPaginationParams,
  getPaginationMeta,
  getDateRangeParams,
  createContactSchema,
  updateContactSchema,
  NotFoundError,
  ValidationError,
  publishEvent,
  CACHE_KEYS,
  deleteCache,
  deleteCachePattern,
} from '@gleps/shared';

const router = Router();
const prisma = getPrismaClient();

// Helper to get account ID
const getAccountId = (req: AuthenticatedRequest): string => {
  if (req.user!.role === 'super_admin') {
    return (req.query.accountId as string) || req.user!.accountId!;
  }
  return req.user!.accountId!;
};

// List contacts
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const pagination = getPaginationParams(req);
  const { search, origem, tagId } = req.query;
  const dateRange = getDateRangeParams(req);

  const where: any = { accountId };

  if (search) {
    where.OR = [
      { nome: { contains: search, mode: 'insensitive' } },
      { telefone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (origem) where.origem = origem;

  if (tagId) {
    where.leadTags = { some: { tagId } };
  }

  if (dateRange.startDate || dateRange.endDate) {
    where.createdAt = {};
    if (dateRange.startDate) where.createdAt.gte = dateRange.startDate;
    if (dateRange.endDate) where.createdAt.lte = dateRange.endDate;
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit,
      include: {
        leadTags: {
          include: { tag: { select: { id: true, name: true, color: true, type: true } } },
        },
        _count: { select: { sales: true, leadNotes: true } },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  res.json({ data: contacts, meta: getPaginationMeta(total, pagination) });
}));

// Get contact by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;

  const contact = await prisma.contact.findFirst({
    where: { id, accountId },
    include: {
      leadTags: {
        include: { tag: true },
      },
      sales: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          items: { include: { product: { select: { id: true, nome: true } } } },
          responsavel: { select: { id: true, nome: true } },
        },
      },
      leadNotes: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      tagHistory: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!contact) throw new NotFoundError('Contato');

  res.json({ data: contact });
}));

// Create contact
router.post('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const body = createContactSchema.parse(req.body);

  const contact = await prisma.contact.create({
    data: {
      accountId,
      ...body,
    },
  });

  await publishEvent({
    eventType: 'contact.created',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'contact',
    entityId: contact.id,
    payload: { nome: contact.nome, origem: contact.origem },
  });

  res.status(201).json({ data: contact });
}));

// Update contact
router.put('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;
  const body = updateContactSchema.parse(req.body);

  const existing = await prisma.contact.findFirst({ where: { id, accountId } });
  if (!existing) throw new NotFoundError('Contato');

  const contact = await prisma.contact.update({
    where: { id },
    data: body,
  });

  await deleteCache(CACHE_KEYS.CONTACT(id));

  await publishEvent({
    eventType: 'contact.updated',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'contact',
    entityId: contact.id,
    payload: { changes: body },
  });

  res.json({ data: contact });
}));

// Delete contact
router.delete('/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;

  const existing = await prisma.contact.findFirst({
    where: { id, accountId },
    include: { _count: { select: { sales: true } } },
  });

  if (!existing) throw new NotFoundError('Contato');

  if (existing._count.sales > 0) {
    throw new ValidationError('Não é possível excluir contato com vendas associadas');
  }

  await prisma.contact.delete({ where: { id } });
  await deleteCache(CACHE_KEYS.CONTACT(id));

  await publishEvent({
    eventType: 'contact.deleted',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'contact',
    entityId: id,
    payload: { nome: existing.nome },
  });

  res.json({ data: { success: true } });
}));

// Add tag to contact
router.post('/:id/tags', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;
  const { tagId } = req.body;

  if (!tagId) throw new ValidationError('tagId é obrigatório');

  const contact = await prisma.contact.findFirst({ where: { id, accountId } });
  if (!contact) throw new NotFoundError('Contato');

  const tag = await prisma.tag.findFirst({ where: { id: tagId, accountId } });
  if (!tag) throw new NotFoundError('Tag');

  // Add tag
  await prisma.leadTag.upsert({
    where: { contactId_tagId: { contactId: id, tagId } },
    create: {
      contactId: id,
      tagId,
      appliedByType: 'user',
      appliedById: req.user!.userId,
      source: 'kanban',
    },
    update: {},
  });

  // Add history
  await prisma.tagHistory.create({
    data: {
      contactId: id,
      tagId,
      action: 'added',
      actorType: 'user',
      actorId: req.user!.userId,
      source: 'kanban',
      tagName: tag.name,
      contactNome: contact.nome,
    },
  });

  await publishEvent({
    eventType: 'contact.tag.added',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'contact',
    entityId: id,
    payload: { tagId, tagName: tag.name },
  });

  res.json({ data: { success: true } });
}));

// Remove tag from contact
router.delete('/:id/tags/:tagId', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id, tagId } = req.params;

  const contact = await prisma.contact.findFirst({ where: { id, accountId } });
  if (!contact) throw new NotFoundError('Contato');

  const tag = await prisma.tag.findFirst({ where: { id: tagId, accountId } });

  await prisma.leadTag.deleteMany({
    where: { contactId: id, tagId },
  });

  // Add history
  await prisma.tagHistory.create({
    data: {
      contactId: id,
      tagId,
      action: 'removed',
      actorType: 'user',
      actorId: req.user!.userId,
      source: 'kanban',
      tagName: tag?.name,
      contactNome: contact.nome,
    },
  });

  await publishEvent({
    eventType: 'contact.tag.removed',
    accountId,
    actorType: 'user',
    actorId: req.user!.userId,
    entityType: 'contact',
    entityId: id,
    payload: { tagId },
  });

  res.json({ data: { success: true } });
}));

// Add note to contact
router.post('/:id/notes', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;
  const { content } = req.body;

  if (!content) throw new ValidationError('content é obrigatório');

  const contact = await prisma.contact.findFirst({ where: { id, accountId } });
  if (!contact) throw new NotFoundError('Contato');

  const note = await prisma.leadNote.create({
    data: {
      contactId: id,
      authorId: req.user!.userId,
      authorName: req.user!.email, // Will be replaced with actual name
      content,
    },
  });

  res.status(201).json({ data: note });
}));

// Get tag history
router.get('/:id/history', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;
  const pagination = getPaginationParams(req);

  const contact = await prisma.contact.findFirst({ where: { id, accountId } });
  if (!contact) throw new NotFoundError('Contato');

  const [history, total] = await Promise.all([
    prisma.tagHistory.findMany({
      where: { contactId: id },
      orderBy: { createdAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit,
    }),
    prisma.tagHistory.count({ where: { contactId: id } }),
  ]);

  res.json({ data: history, meta: getPaginationMeta(total, pagination) });
}));

export default router;
