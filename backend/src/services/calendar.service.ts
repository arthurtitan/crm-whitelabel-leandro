import { prisma } from '../config/database';
import { CalendarEventType, CalendarEventStatus } from '@prisma/client';
import { PaginationParams, DateRangeFilter } from '../types';
import { NotFoundError } from '../utils/errors';
import { getPaginationMeta } from '../utils/helpers';
import { env } from '../config/env';

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

class CalendarService {
  /**
   * List calendar events
   */
  async list(filters: CalendarEventFilters, pagination: PaginationParams) {
    const where: any = {
      accountId: filters.accountId,
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.contactId) {
      where.contactId = filters.contactId;
    }

    if (filters.startDate || filters.endDate) {
      where.startTime = {};
      if (filters.startDate) {
        where.startTime.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.startTime.lte = filters.endDate;
      }
    }

    const [events, total] = await Promise.all([
      prisma.calendarEvent.findMany({
        where,
        orderBy: { startTime: 'asc' },
        skip: pagination.offset,
        take: pagination.limit,
        include: {
          contact: {
            select: { id: true, nome: true, telefone: true },
          },
          createdBy: {
            select: { id: true, nome: true },
          },
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
    if (accountId) {
      where.accountId = accountId;
    }

    const event = await prisma.calendarEvent.findFirst({
      where,
      include: {
        contact: {
          select: { id: true, nome: true, telefone: true, email: true },
        },
        createdBy: {
          select: { id: true, nome: true, email: true },
        },
        attendees: true,
      },
    });

    if (!event) {
      throw new NotFoundError('Evento');
    }

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
        attendees: input.attendees ? {
          create: input.attendees,
        } : undefined,
      },
      include: {
        attendees: true,
      },
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
      include: {
        attendees: true,
      },
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
   * Get Google OAuth URL
   */
  getGoogleAuthUrl(accountId: string): string {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
      throw new Error('Google Calendar não configurado');
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
    ];

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: accountId,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Handle Google OAuth callback
   */
  async handleGoogleCallback(code: string, accountId: string) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
      throw new Error('Google Calendar não configurado');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: env.GOOGLE_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Falha ao obter tokens do Google');
    }

    const tokens: any = await tokenResponse.json();

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const userInfo: any = await userInfoResponse.json();

    // Save tokens
    await prisma.googleCalendarToken.upsert({
      where: { accountId },
      create: {
        accountId,
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
  async disconnectGoogle(accountId: string) {
    await prisma.googleCalendarToken.delete({
      where: { accountId },
    }).catch(() => {
      // Ignore if not exists
    });

    // Remove google event IDs from events
    await prisma.calendarEvent.updateMany({
      where: { accountId },
      data: {
        googleEventId: null,
        googleCalendarId: null,
      },
    });
  }

  /**
   * Get Google Calendar connection status
   */
  async getGoogleStatus(accountId: string) {
    const token = await prisma.googleCalendarToken.findUnique({
      where: { accountId },
    });

    if (!token) {
      return { connected: false };
    }

    return {
      connected: true,
      email: token.connectedEmail,
      expiresAt: token.expiresAt,
      needsReauth: token.expiresAt < new Date(),
    };
  }

  /**
   * Sync with Google Calendar
   */
  async syncWithGoogle(accountId: string) {
    const token = await prisma.googleCalendarToken.findUnique({
      where: { accountId },
    });

    if (!token) {
      throw new Error('Google Calendar não conectado');
    }

    // Check if token needs refresh
    let accessToken = token.accessToken;
    if (token.expiresAt < new Date()) {
      accessToken = await this.refreshGoogleToken(accountId, token.refreshToken);
    }

    // Fetch events from Google
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
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Falha ao sincronizar com Google Calendar');
    }

    const data: any = await response.json();
    const googleEvents = data.items || [];

    // Sync events
    for (const gEvent of googleEvents) {
      if (gEvent.status === 'cancelled') continue;

      const startTime = gEvent.start?.dateTime || gEvent.start?.date;
      const endTime = gEvent.end?.dateTime || gEvent.end?.date;

      if (!startTime || !endTime) continue;

      await prisma.calendarEvent.upsert({
        where: {
          id: await this.getEventIdByGoogleId(gEvent.id, accountId) || 'new',
        },
        create: {
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

  private async refreshGoogleToken(accountId: string, refreshToken: string): Promise<string> {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google Calendar não configurado');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Falha ao renovar token do Google');
    }

    const tokens: any = await response.json();

    await prisma.googleCalendarToken.update({
      where: { accountId },
      data: {
        accessToken: tokens.access_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return tokens.access_token;
  }
}

export const calendarService = new CalendarService();
