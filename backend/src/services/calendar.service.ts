import { prisma } from '../config/database';
import { CalendarEventType, CalendarEventStatus } from '@prisma/client';
import { PaginationParams, DateRangeFilter } from '../types';
import { NotFoundError, AppError } from '../utils/errors';
import { getPaginationMeta } from '../utils/helpers';

export interface CreateCalendarEventInput {
  accountId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  type?: CalendarEventType;
  location?: string;
  meetingLink?: string;
  contactId?: string;
  notes?: string;
  createdById?: string;
  attendees?: Array<{ name: string; email: string }>;
}

export interface UpdateCalendarEventInput {
  title?: string;
  startTime?: Date;
  endTime?: Date;
  type?: CalendarEventType;
  status?: CalendarEventStatus;
  location?: string;
  meetingLink?: string;
  contactId?: string;
  notes?: string;
}

export interface CalendarEventFilters extends DateRangeFilter {
  accountId: string;
  type?: CalendarEventType;
  status?: CalendarEventStatus;
  contactId?: string;
}

interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

class CalendarService {
  /**
   * Get Google OAuth credentials from the account's DB record
   */
  private async getGoogleCredentials(accountId: string): Promise<GoogleCredentials | null> {
    // 1) Try DB first (per-account)
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        googleClientId: true,
        googleClientSecret: true,
        googleRedirectUri: true,
      },
    });

    if (account?.googleClientId && account?.googleClientSecret && account?.googleRedirectUri) {
      return {
        clientId: account.googleClientId,
        clientSecret: account.googleClientSecret,
        redirectUri: account.googleRedirectUri,
      };
    }

    // 2) Fallback to env vars (global)
    const envClientId = process.env.GOOGLE_CLIENT_ID;
    const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const envRedirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (envClientId && envClientSecret && envRedirectUri) {
      return {
        clientId: envClientId,
        clientSecret: envClientSecret,
        redirectUri: envRedirectUri,
      };
    }

    return null;
  }

  /**
   * List calendar events
   */
  async list(filters: CalendarEventFilters, pagination: PaginationParams) {
    const where: any = {
      accountId: filters.accountId,
    };

    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.contactId) where.contactId = filters.contactId;

    if (filters.startDate || filters.endDate) {
      where.startTime = {};
      if (filters.startDate) where.startTime.gte = filters.startDate;
      if (filters.endDate) where.startTime.lte = filters.endDate;
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

    return {
      data: events,
      meta: getPaginationMeta(total, pagination),
    };
  }

  /**
   * Get event by ID
   */
  async getById(id: string, accountId?: string) {
    const where: any = { id };
    if (accountId) where.accountId = accountId;

    const event = await prisma.calendarEvent.findFirst({
      where,
      include: {
        contact: { select: { id: true, nome: true, telefone: true, email: true } },
        createdBy: { select: { id: true, nome: true, email: true } },
        attendees: true,
      },
    });

    if (!event) throw new NotFoundError('Evento');
    return event;
  }

  /**
   * Create calendar event
   */
  async create(input: CreateCalendarEventInput) {
    const event = await prisma.calendarEvent.create({
      data: {
        accountId: input.accountId,
        title: input.title,
        startTime: input.startTime,
        endTime: input.endTime,
        type: input.type || 'appointment',
        location: input.location,
        meetingLink: input.meetingLink,
        contactId: input.contactId,
        notes: input.notes,
        createdById: input.createdById,
        attendees: input.attendees ? { create: input.attendees } : undefined,
      },
      include: { attendees: true },
    });
    return event;
  }

  /**
   * Update calendar event
   */
  async update(id: string, input: UpdateCalendarEventInput, accountId: string) {
    await this.getById(id, accountId);
    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        title: input.title,
        startTime: input.startTime,
        endTime: input.endTime,
        type: input.type,
        status: input.status,
        location: input.location,
        meetingLink: input.meetingLink,
        contactId: input.contactId,
        notes: input.notes,
      },
      include: { attendees: true },
    });
    return event;
  }

  /**
   * Delete calendar event
   */
  async delete(id: string, accountId: string) {
    await this.getById(id, accountId);
    await prisma.calendarEvent.delete({ where: { id } });
  }

  /**
   * Get Google OAuth URL — credentials from DB
   */
  async getGoogleAuthUrl(accountId: string, userId: string): Promise<string> {
    const creds = await this.getGoogleCredentials(accountId);
    if (!creds) {
      throw new AppError(
        'Google Calendar não configurado para esta conta. O Super Admin deve configurar as credenciais Google na página de controle da conta.',
        422,
        'GOOGLE_NOT_CONFIGURED'
      );
    }

    const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];
    const statePayload = Buffer.from(JSON.stringify({ accountId, userId })).toString('base64');
    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: creds.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: statePayload,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Handle Google OAuth callback — credentials from DB
   */
  async handleGoogleCallback(code: string, stateBase64: string) {
    // Decode state to extract accountId and userId
    let accountId: string;
    let userId: string;
    try {
      const decoded = JSON.parse(Buffer.from(stateBase64, 'base64').toString('utf-8'));
      accountId = decoded.accountId;
      userId = decoded.userId;
      if (!accountId || !userId) throw new Error('Missing fields');
    } catch {
      throw new AppError('State OAuth inválido', 400, 'INVALID_STATE');
    }

    const creds = await this.getGoogleCredentials(accountId);
    if (!creds) {
      throw new AppError('Google Calendar não configurado para esta conta.', 422, 'GOOGLE_NOT_CONFIGURED');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: creds.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Falha ao obter tokens do Google');
    }

    const tokens: any = await tokenResponse.json();

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo: any = await userInfoResponse.json();

    // Upsert by userId (each user has their own token)
    await prisma.googleCalendarToken.upsert({
      where: { userId },
      create: {
        accountId,
        userId,
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

    return { success: true, email: userInfo.email };
  }

  /**
   * Disconnect Google Calendar
   */
  async disconnectGoogle(accountId: string, userId: string) {
    await prisma.googleCalendarToken.delete({ where: { userId } }).catch(() => {});
    await prisma.calendarEvent.updateMany({
      where: { accountId, source: 'google', createdById: userId },
      data: { googleEventId: null, googleCalendarId: null },
    });
  }

  /**
   * Get Google Calendar connection status — credentials from DB
   */
  async getGoogleStatus(accountId: string, userId: string) {
    const creds = await this.getGoogleCredentials(accountId);

    if (!creds) {
      return {
        connected: false,
        configured: false,
        missing: ['google_client_id', 'google_client_secret', 'google_redirect_uri'],
      };
    }

    const token = await prisma.googleCalendarToken.findUnique({ where: { userId } });

    if (!token) {
      return { connected: false, configured: true, missing: [] };
    }

    return {
      connected: true,
      configured: true,
      missing: [],
      email: token.connectedEmail,
      expiresAt: token.expiresAt,
      needsReauth: token.expiresAt < new Date(),
    };
  }

  /**
   * Sync with Google Calendar — credentials from DB
   */
  async syncWithGoogle(accountId: string, userId: string) {
    const token = await prisma.googleCalendarToken.findUnique({ where: { userId } });
    if (!token) throw new Error('Google Calendar não conectado');

    let accessToken = token.accessToken;
    if (token.expiresAt < new Date()) {
      accessToken = await this.refreshGoogleToken(accountId, userId, token.refreshToken);
    }

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

    if (!response.ok) throw new Error('Falha ao sincronizar com Google Calendar');

    const data: any = await response.json();
    const googleEvents = data.items || [];

    for (const gEvent of googleEvents) {
      if (gEvent.status === 'cancelled') continue;
      const startTime = gEvent.start?.dateTime || gEvent.start?.date;
      const endTime = gEvent.end?.dateTime || gEvent.end?.date;
      if (!startTime || !endTime) continue;

      await prisma.calendarEvent.upsert({
        where: { id: await this.getEventIdByGoogleId(gEvent.id, accountId) || 'new' },
        create: {
          accountId,
          createdById: userId,
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
        update: {
          title: gEvent.summary || 'Sem título',
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          location: gEvent.location,
          meetingLink: gEvent.hangoutLink,
        },
      });
    }

    return { synced: googleEvents.length };
  }

  private async getEventIdByGoogleId(googleEventId: string, accountId: string): Promise<string | null> {
    const event = await prisma.calendarEvent.findFirst({
      where: { googleEventId, accountId },
      select: { id: true },
    });
    return event?.id || null;
  }

  private async refreshGoogleToken(accountId: string, userId: string, refreshToken: string): Promise<string> {
    const creds = await this.getGoogleCredentials(accountId);
    if (!creds) {
      throw new AppError('Google Calendar não configurado para esta conta.', 422, 'GOOGLE_NOT_CONFIGURED');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) throw new Error('Falha ao renovar token do Google');

    const tokens: any = await response.json();

    await prisma.googleCalendarToken.update({
      where: { userId },
      data: {
        accessToken: tokens.access_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return tokens.access_token;
  }
}

export const calendarService = new CalendarService();
