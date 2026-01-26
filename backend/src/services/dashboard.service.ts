import { prisma } from '../config/database';
import { DateRangeFilter } from '../types';
import { startOfDay, endOfDay, subDays, format, eachDayOfInterval, eachHourOfInterval, startOfHour } from 'date-fns';

class DashboardService {
  /**
   * Get KPIs for Admin Dashboard
   */
  async getAdminKPIs(accountId: string, filters: DateRangeFilter, agentId?: string) {
    const where: any = { accountId };

    if (agentId) {
      where.responsavelId = agentId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [
      totalLeads,
      newLeads,
      totalSales,
      paidSales,
      totalRevenue,
      conversionRate,
    ] = await Promise.all([
      prisma.contact.count({ where: { accountId } }),
      prisma.contact.count({ where: { accountId, createdAt: where.createdAt } }),
      prisma.sale.count({ where }),
      prisma.sale.count({ where: { ...where, status: 'paid' } }),
      prisma.sale.aggregate({
        where: { ...where, status: 'paid' },
        _sum: { valor: true },
      }),
      Promise.resolve(null), // Will calculate below
    ]);

    return {
      totalLeads,
      newLeads,
      totalSales,
      paidSales,
      totalRevenue: Number(totalRevenue._sum.valor || 0),
      conversionRate: totalSales > 0 ? Math.round((paidSales / totalSales) * 100) : 0,
    };
  }

  /**
   * Get Super Admin KPIs (global platform metrics)
   */
  async getSuperAdminKPIs() {
    const [
      totalAccounts,
      activeAccounts,
      pausedAccounts,
      totalUsers,
      activeUsers,
      totalContacts,
      totalSales,
      totalRevenue,
    ] = await Promise.all([
      prisma.account.count(),
      prisma.account.count({ where: { status: 'active' } }),
      prisma.account.count({ where: { status: 'paused' } }),
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.contact.count(),
      prisma.sale.count({ where: { status: 'paid' } }),
      prisma.sale.aggregate({
        where: { status: 'paid' },
        _sum: { valor: true },
      }),
    ]);

    return {
      totalAccounts,
      activeAccounts,
      pausedAccounts,
      totalUsers,
      activeUsers,
      totalContacts,
      totalSales,
      totalRevenue: Number(totalRevenue._sum.valor || 0),
    };
  }

  /**
   * Get hourly peak data
   */
  async getHourlyPeak(accountId: string, filters: DateRangeFilter) {
    const startDate = filters.startDate || subDays(new Date(), 7);
    const endDate = filters.endDate || new Date();

    // Get events by hour
    const events = await prisma.event.findMany({
      where: {
        accountId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
      },
    });

    // Group by hour
    const hourlyData: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      hourlyData[i] = 0;
    }

    for (const event of events) {
      const hour = event.createdAt.getHours();
      hourlyData[hour]++;
    }

    return Object.entries(hourlyData).map(([hour, count]) => ({
      hour: parseInt(hour),
      count,
    }));
  }

  /**
   * Get backlog metrics
   */
  async getBacklog(accountId: string) {
    const pendingSales = await prisma.sale.count({
      where: { accountId, status: 'pending' },
    });

    const pendingLeads = await prisma.contact.count({
      where: {
        accountId,
        leadTags: {
          none: {
            tag: { type: 'stage' },
          },
        },
      },
    });

    return {
      pendingSales,
      pendingLeads,
      totalPending: pendingSales + pendingLeads,
    };
  }

  /**
   * Get agent performance
   */
  async getAgentPerformance(accountId: string, filters: DateRangeFilter) {
    const where: any = { accountId, role: { in: ['admin', 'agent'] } };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
      },
    });

    const saleWhere: any = { accountId };
    if (filters.startDate || filters.endDate) {
      saleWhere.createdAt = {};
      if (filters.startDate) {
        saleWhere.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        saleWhere.createdAt.lte = filters.endDate;
      }
    }

    // Get performance data for each agent
    const performance = await Promise.all(
      users.map(async (user) => {
        const [totalSales, paidSales, totalRevenue] = await Promise.all([
          prisma.sale.count({ where: { ...saleWhere, responsavelId: user.id } }),
          prisma.sale.count({ where: { ...saleWhere, responsavelId: user.id, status: 'paid' } }),
          prisma.sale.aggregate({
            where: { ...saleWhere, responsavelId: user.id, status: 'paid' },
            _sum: { valor: true },
          }),
        ]);

        return {
          user: {
            id: user.id,
            nome: user.nome,
            email: user.email,
            role: user.role,
          },
          totalSales,
          paidSales,
          totalRevenue: Number(totalRevenue._sum.valor || 0),
          conversionRate: totalSales > 0 ? Math.round((paidSales / totalSales) * 100) : 0,
        };
      })
    );

    return performance.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  /**
   * Get IA vs Human metrics (placeholder - would integrate with Chatwoot)
   */
  async getIAvsHuman(accountId: string, filters: DateRangeFilter) {
    // This would typically integrate with Chatwoot to get actual bot vs human metrics
    // For now, return placeholder data
    return {
      totalInteractions: 100,
      iaInteractions: 40,
      humanInteractions: 60,
      iaPercentage: 40,
      humanPercentage: 60,
    };
  }

  /**
   * Get server resources (Super Admin only)
   */
  async getServerResources() {
    // This would typically integrate with system monitoring
    // For now, return placeholder data
    const memUsage = process.memoryUsage();

    return {
      cpuUsage: Math.random() * 50 + 20, // Simulated
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      uptime: process.uptime(),
    };
  }

  /**
   * Get consumption history (Super Admin only)
   */
  async getConsumptionHistory(period: '24h' | '7d' | '30d') {
    const now = new Date();
    let startDate: Date;
    let interval: 'hour' | 'day';

    switch (period) {
      case '24h':
        startDate = subDays(now, 1);
        interval = 'hour';
        break;
      case '7d':
        startDate = subDays(now, 7);
        interval = 'day';
        break;
      case '30d':
        startDate = subDays(now, 30);
        interval = 'day';
        break;
    }

    const events = await prisma.event.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: { createdAt: true },
    });

    const sales = await prisma.sale.findMany({
      where: {
        createdAt: { gte: startDate },
        status: 'paid',
      },
      select: { createdAt: true, valor: true },
    });

    // Group by interval
    if (interval === 'hour') {
      const hours = eachHourOfInterval({ start: startDate, end: now });
      return hours.map(hour => {
        const hourEvents = events.filter(
          e => startOfHour(e.createdAt).getTime() === hour.getTime()
        );
        const hourSales = sales.filter(
          s => startOfHour(s.createdAt).getTime() === hour.getTime()
        );

        return {
          timestamp: hour.toISOString(),
          events: hourEvents.length,
          sales: hourSales.length,
          revenue: hourSales.reduce((sum, s) => sum + Number(s.valor), 0),
        };
      });
    } else {
      const days = eachDayOfInterval({ start: startDate, end: now });
      return days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const dayEvents = events.filter(
          e => e.createdAt >= dayStart && e.createdAt <= dayEnd
        );
        const daySales = sales.filter(
          s => s.createdAt >= dayStart && s.createdAt <= dayEnd
        );

        return {
          timestamp: day.toISOString(),
          events: dayEvents.length,
          sales: daySales.length,
          revenue: daySales.reduce((sum, s) => sum + Number(s.valor), 0),
        };
      });
    }
  }
}

export const dashboardService = new DashboardService();
