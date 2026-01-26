import { Router, Response } from 'express';
import {
  AuthenticatedRequest,
  asyncHandler,
  getPrismaClient,
  getPaginationParams,
  getPaginationMeta,
  getDateRangeParams,
  createCalendarEventSchema,
  updateCalendarEventSchema,
  NotFoundError,
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

// List calendar events
router.get('/events', requirePermission('agenda'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const pagination = getPaginationParams(req);
  const dateRange = getDateRangeParams(req);
  const { type, status, contactId } = req.query;

  const where: any = { accountId };
  if (type) where.type = type;
  if (status) where.status = status;
  if (contactId) where.contactId = contactId;

  if (dateRange.startDate || dateRange.endDate) {
    where.startTime = {};
    if (dateRange.startDate) where.startTime.gte = dateRange.startDate;
    if (dateRange.endDate) where.startTime.lte = dateRange.endDate;
  }

  const [events, total] = await Promise.all([
    prisma.calendarEvent.findMany({
      where,
      orderBy: { startTime: 'asc' },
      skip: pagination.offset,
      take: pagination.limit,
      include: {
        contact: { select: { id: true, nome: true, telefone: true } },
        createdBy: { select: { id: true, nome: true } },
        attendees: true,
      },
    }),
    prisma.calendarEvent.count({ where }),
  ]);

  res.json({ data: events, meta: getPaginationMeta(total, pagination) });
}));

// Get event by ID
router.get('/events/:id', requirePermission('agenda'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;

  const event = await prisma.calendarEvent.findFirst({
    where: { id, accountId },
    include: {
      contact: { select: { id: true, nome: true, telefone: true, email: true } },
      createdBy: { select: { id: true, nome: true, email: true } },
      attendees: true,
    },
  });

  if (!event) throw new NotFoundError('Evento');

  res.json({ data: event });
}));

// Create event
router.post('/events', requirePermission('agenda'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const body = createCalendarEventSchema.parse(req.body);

  const event = await prisma.calendarEvent.create({
    data: {
      accountId,
      title: body.title,
      startTime: body.startTime,
      endTime: body.endTime,
      type: body.type,
      location: body.location,
      meetingLink: body.meetingLink,
      contactId: body.contactId,
      notes: body.notes,
      createdById: req.user!.userId,
      attendees: body.attendees ? {
        create: body.attendees,
      } : undefined,
    },
    include: { attendees: true },
  });

  res.status(201).json({ data: event });
}));

// Update event
router.put('/events/:id', requirePermission('agenda'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;
  const body = updateCalendarEventSchema.parse(req.body);

  const existing = await prisma.calendarEvent.findFirst({ where: { id, accountId } });
  if (!existing) throw new NotFoundError('Evento');

  const event = await prisma.calendarEvent.update({
    where: { id },
    data: body,
    include: { attendees: true },
  });

  res.json({ data: event });
}));

// Delete event
router.delete('/events/:id', requirePermission('agenda'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);
  const { id } = req.params;

  const existing = await prisma.calendarEvent.findFirst({ where: { id, accountId } });
  if (!existing) throw new NotFoundError('Evento');

  await prisma.calendarEvent.delete({ where: { id } });

  res.json({ data: { success: true } });
}));

// Google Calendar OAuth - Get auth URL
router.get('/google/auth-url', requirePermission('agenda'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
    throw new NotFoundError('Google Calendar não configurado');
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ];

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state: accountId,
  });

  res.json({ data: { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` } });
}));

// Google Calendar OAuth - Callback
router.get('/google/callback', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { code, state: accountId } = req.query;

  if (!code || !accountId) {
    throw new NotFoundError('Parâmetros inválidos');
  }

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new NotFoundError('Google Calendar não configurado');
  }

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code: code as string,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_REDIRECT_URI,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Falha ao obter tokens do Google');
  }

  const tokens = await tokenResponse.json();

  // Get user email
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  const userInfo = await userInfoResponse.json();

  // Save tokens
  await prisma.googleCalendarToken.upsert({
    where: { accountId: accountId as string },
    create: {
      accountId: accountId as string,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      connectedEmail: userInfo.email,
      calendarId: 'primary',
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      connectedEmail: userInfo.email,
    },
  });

  // Redirect to frontend
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  res.redirect(`${frontendUrl}/admin/agenda?google=connected`);
}));

// Google Calendar - Get status
router.get('/google/status', requirePermission('agenda'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);

  const token = await prisma.googleCalendarToken.findUnique({
    where: { accountId },
  });

  if (!token) {
    res.json({ data: { connected: false } });
    return;
  }

  res.json({
    data: {
      connected: true,
      email: token.connectedEmail,
      expiresAt: token.expiresAt,
      needsReauth: token.expiresAt < new Date(),
    },
  });
}));

// Google Calendar - Disconnect
router.post('/google/disconnect', requirePermission('agenda'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);

  await prisma.googleCalendarToken.delete({
    where: { accountId },
  }).catch(() => {});

  await prisma.calendarEvent.updateMany({
    where: { accountId },
    data: { googleEventId: null, googleCalendarId: null },
  });

  res.json({ data: { success: true } });
}));

// Google Calendar - Sync
router.post('/google/sync', requirePermission('agenda'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accountId = getAccountId(req);

  const token = await prisma.googleCalendarToken.findUnique({
    where: { accountId },
  });

  if (!token) {
    throw new NotFoundError('Google Calendar não conectado');
  }

  // Refresh token if needed
  let accessToken = token.accessToken;
  if (token.expiresAt < new Date()) {
    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: token.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const refreshData = await refreshResponse.json();
    accessToken = refreshData.access_token;

    await prisma.googleCalendarToken.update({
      where: { accountId },
      data: {
        accessToken,
        expiresAt: new Date(Date.now() + refreshData.expires_in * 1000),
      },
    });
  }

  // Fetch Google events
  const now = new Date();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneMonthAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    new URLSearchParams({
      timeMin: oneMonthAgo.toISOString(),
      timeMax: oneMonthAhead.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
    }),
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const data = await response.json();
  const googleEvents = data.items || [];

  let synced = 0;

  for (const gEvent of googleEvents) {
    if (gEvent.status === 'cancelled') continue;

    const startTime = gEvent.start?.dateTime || gEvent.start?.date;
    const endTime = gEvent.end?.dateTime || gEvent.end?.date;

    if (!startTime || !endTime) continue;

    const existing = await prisma.calendarEvent.findFirst({
      where: { accountId, googleEventId: gEvent.id },
    });

    if (existing) {
      await prisma.calendarEvent.update({
        where: { id: existing.id },
        data: {
          title: gEvent.summary || 'Sem título',
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          location: gEvent.location,
          meetingLink: gEvent.hangoutLink,
        },
      });
    } else {
      await prisma.calendarEvent.create({
        data: {
          accountId,
          title: gEvent.summary || 'Sem título',
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          type: 'meeting',
          source: 'google',
          location: gEvent.location,
          meetingLink: gEvent.hangoutLink,
          googleEventId: gEvent.id,
          googleCalendarId: 'primary',
        },
      });
    }

    synced++;
  }

  res.json({ data: { synced } });
}));

export default router;
