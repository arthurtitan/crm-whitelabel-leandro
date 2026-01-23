import { useState, useMemo } from 'react';
import { useAuth, useRoleAccess } from '@/contexts/AuthContext';
import { useFinance } from '@/contexts/FinanceContext';
import { useCalendar } from '@/contexts/CalendarContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardFilters } from '@/components/dashboard';
import { AgentFilter } from '@/components/dashboard/AgentFilter';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  TrendingUp,
  TrendingDown,
  Package,
  Calendar,
  CreditCard,
  Users,
  CalendarCheck,
  ShoppingCart,
  ArrowRight,
  Star,
} from 'lucide-react';
import {
  startOfDay,
  endOfDay,
  subDays,
  isWithinInterval,
  parseISO,
  format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

export default function AdminInsightsPage() {
  const { user } = useAuth();
  const { isAdmin } = useRoleAccess();
  const { sales, contacts } = useFinance();
  const { events } = useCalendar();

  // Filter states
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  // Format currency helper
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Filter sales based on date range and user permissions
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const saleDate = parseISO(sale.created_at);
      const inDateRange = isWithinInterval(saleDate, {
        start: startOfDay(dateRange.from),
        end: endOfDay(dateRange.to),
      });

      if (!inDateRange) return false;

      // Role-based filtering
      if (!isAdmin || user?.role !== 'admin') {
        // Agents can only see their own sales
        return sale.responsavel_id === user?.id;
      }

      // Admins can filter by agent
      if (selectedAgent !== 'all') {
        return sale.responsavel_id === selectedAgent;
      }

      return true;
    });
  }, [sales, dateRange, isAdmin, user, selectedAgent]);

  // Filter paid sales for revenue calculations
  const paidSales = useMemo(() => {
    return filteredSales.filter((sale) => sale.status === 'paid');
  }, [filteredSales]);

  // Filter contacts (leads) based on date range and user permissions
  const filteredLeads = useMemo(() => {
    return contacts.filter((contact) => {
      const contactDate = parseISO(contact.created_at);
      const inDateRange = isWithinInterval(contactDate, {
        start: startOfDay(dateRange.from),
        end: endOfDay(dateRange.to),
      });

      return inDateRange;
    });
  }, [contacts, dateRange]);

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    return events.filter((event) => {
      if (event.type !== 'meeting' && event.type !== 'appointment') return false;

      const eventDate = parseISO(event.start);
      const inDateRange = isWithinInterval(eventDate, {
        start: startOfDay(dateRange.from),
        end: endOfDay(dateRange.to),
      });

      if (!inDateRange) return false;

      // Role-based filtering
      if (!isAdmin || user?.role !== 'admin') {
        return event.createdBy === user?.id;
      }

      if (selectedAgent !== 'all') {
        return event.createdBy === selectedAgent;
      }

      return true;
    });
  }, [events, dateRange, isAdmin, user, selectedAgent]);

  // Best selling product
  const bestSellingProduct = useMemo(() => {
    const productCount: Record<string, { name: string; count: number; revenue: number }> = {};

    paidSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const productName = item.product?.nome || 'Produto';
        if (!productCount[item.product_id]) {
          productCount[item.product_id] = { name: productName, count: 0, revenue: 0 };
        }
        productCount[item.product_id].count += item.quantidade;
        productCount[item.product_id].revenue += item.valor_total;
      });
    });

    const sorted = Object.entries(productCount).sort((a, b) => b[1].count - a[1].count);
    return sorted.length > 0 ? { id: sorted[0][0], ...sorted[0][1] } : null;
  }, [paidSales]);

  // Worst selling product
  const worstSellingProduct = useMemo(() => {
    const productCount: Record<string, { name: string; count: number; revenue: number }> = {};

    paidSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const productName = item.product?.nome || 'Produto';
        if (!productCount[item.product_id]) {
          productCount[item.product_id] = { name: productName, count: 0, revenue: 0 };
        }
        productCount[item.product_id].count += item.quantidade;
        productCount[item.product_id].revenue += item.valor_total;
      });
    });

    const sorted = Object.entries(productCount).sort((a, b) => a[1].count - b[1].count);
    return sorted.length > 0 ? { id: sorted[0][0], ...sorted[0][1] } : null;
  }, [paidSales]);

  // Best selling day
  const bestSellingDay = useMemo(() => {
    const dayCount: Record<string, { date: string; count: number; revenue: number }> = {};

    paidSales.forEach((sale) => {
      const day = format(parseISO(sale.created_at), 'yyyy-MM-dd');
      if (!dayCount[day]) {
        dayCount[day] = { date: day, count: 0, revenue: 0 };
      }
      dayCount[day].count++;
      dayCount[day].revenue += sale.valor;
    });

    const sorted = Object.entries(dayCount).sort((a, b) => b[1].revenue - a[1].revenue);
    return sorted.length > 0 ? sorted[0][1] : null;
  }, [paidSales]);

  // Worst selling day
  const worstSellingDay = useMemo(() => {
    const dayCount: Record<string, { date: string; count: number; revenue: number }> = {};

    paidSales.forEach((sale) => {
      const day = format(parseISO(sale.created_at), 'yyyy-MM-dd');
      if (!dayCount[day]) {
        dayCount[day] = { date: day, count: 0, revenue: 0 };
      }
      dayCount[day].count++;
      dayCount[day].revenue += sale.valor;
    });

    const sorted = Object.entries(dayCount).sort((a, b) => a[1].revenue - b[1].revenue);
    return sorted.length > 0 ? sorted[0][1] : null;
  }, [paidSales]);

  // Most used payment method
  const paymentMethodStats = useMemo(() => {
    const methodCount: Record<string, { count: number; revenue: number }> = {};

    paidSales.forEach((sale) => {
      const method = sale.metodo_pagamento || 'unknown';
      if (!methodCount[method]) {
        methodCount[method] = { count: 0, revenue: 0 };
      }
      methodCount[method].count++;
      methodCount[method].revenue += sale.valor;
    });

    const sorted = Object.entries(methodCount).sort((a, b) => b[1].count - a[1].count);
    return sorted.map(([method, stats]) => ({ method, ...stats }));
  }, [paidSales]);

  const mostUsedPaymentMethod = paymentMethodStats.length > 0 ? paymentMethodStats[0] : null;

  // Funnel conversion data
  const funnelData = useMemo(() => {
    const totalLeads = filteredLeads.length;
    const scheduledAppointments = filteredAppointments.length;
    const completedSales = paidSales.length;

    const leadToAppointment = totalLeads > 0 ? ((scheduledAppointments / totalLeads) * 100).toFixed(1) : '0';
    const appointmentToSale = scheduledAppointments > 0 ? ((completedSales / scheduledAppointments) * 100).toFixed(1) : '0';
    const leadToSale = totalLeads > 0 ? ((completedSales / totalLeads) * 100).toFixed(1) : '0';

    return {
      totalLeads,
      scheduledAppointments,
      completedSales,
      leadToAppointment,
      appointmentToSale,
      leadToSale,
    };
  }, [filteredLeads, filteredAppointments, paidSales]);

  // Payment method labels
  const paymentMethodLabels: Record<string, string> = {
    pix: 'PIX',
    credit: 'Crédito',
    debit: 'Débito',
    boleto: 'Boleto',
    cash: 'Dinheiro',
    convenio: 'Convênio',
    unknown: 'Não informado',
  };

  const handlePeriodChange = (period: string, range?: DateRange) => {
    if (range?.from && range?.to) {
      setDateRange({ from: range.from, to: range.to });
    } else {
      const today = new Date();
      if (period === '7d') {
        setDateRange({ from: subDays(today, 7), to: today });
      } else if (period === '30d') {
        setDateRange({ from: subDays(today, 30), to: today });
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient-gleps">Insights</h1>
          <p className="text-muted-foreground">
            Análises e métricas de performance
            {!isAdmin && ' (seus dados)'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <DashboardFilters
          onPeriodChange={handlePeriodChange}
          showAgentFilter={false}
        />
        {isAdmin && user?.role === 'admin' && (
          <AgentFilter value={selectedAgent} onChange={setSelectedAgent} />
        )}
      </div>

      {/* Product Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Best Selling Product */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="w-5 h-5 text-success" />
              </div>
              <CardTitle className="text-base">Produto Mais Vendido</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {bestSellingProduct ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-lg">{bestSellingProduct.name}</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <Badge variant="secondary">{bestSellingProduct.count} unidades</Badge>
                  <span className="text-success font-medium">
                    {formatCurrency(bestSellingProduct.revenue)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhuma venda no período</p>
            )}
          </CardContent>
        </Card>

        {/* Worst Selling Product */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-warning/10">
                <TrendingDown className="w-5 h-5 text-warning" />
              </div>
              <CardTitle className="text-base">Produto Menos Vendido</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {worstSellingProduct ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-lg">{worstSellingProduct.name}</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <Badge variant="secondary">{worstSellingProduct.count} unidades</Badge>
                  <span className="text-muted-foreground font-medium">
                    {formatCurrency(worstSellingProduct.revenue)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhuma venda no período</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Day Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Best Selling Day */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Star className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-base">Melhor Dia de Vendas</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {bestSellingDay ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-lg">
                    {format(parseISO(bestSellingDay.date), "dd 'de' MMMM", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex gap-4 text-sm">
                  <Badge variant="secondary">{bestSellingDay.count} vendas</Badge>
                  <span className="text-success font-medium">
                    {formatCurrency(bestSellingDay.revenue)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhuma venda no período</p>
            )}
          </CardContent>
        </Card>

        {/* Worst Selling Day */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-muted">
                <Calendar className="w-5 h-5 text-muted-foreground" />
              </div>
              <CardTitle className="text-base">Dia com Menor Faturamento</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {worstSellingDay ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-lg">
                    {format(parseISO(worstSellingDay.date), "dd 'de' MMMM", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex gap-4 text-sm">
                  <Badge variant="secondary">{worstSellingDay.count} vendas</Badge>
                  <span className="text-muted-foreground font-medium">
                    {formatCurrency(worstSellingDay.revenue)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhuma venda no período</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Method */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-accent/10">
              <CreditCard className="w-5 h-5 text-accent-foreground" />
            </div>
            <CardTitle className="text-base">Métodos de Pagamento</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {paymentMethodStats.length > 0 ? (
            <div className="space-y-4">
              {/* Most Used Highlight */}
              {mostUsedPaymentMethod && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-1">Mais utilizado</p>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xl">
                      {paymentMethodLabels[mostUsedPaymentMethod.method] || mostUsedPaymentMethod.method}
                    </span>
                    <div className="text-right">
                      <p className="font-semibold text-success">{formatCurrency(mostUsedPaymentMethod.revenue)}</p>
                      <p className="text-sm text-muted-foreground">{mostUsedPaymentMethod.count} transações</p>
                    </div>
                  </div>
                </div>
              )}

              {/* All Methods */}
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {paymentMethodStats.map((item, index) => (
                    <div
                      key={item.method}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-6">
                          {index + 1}º
                        </span>
                        <span className="font-medium">
                          {paymentMethodLabels[item.method] || item.method}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(item.revenue)}</p>
                        <p className="text-xs text-muted-foreground">{item.count} vendas</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhuma venda paga no período</p>
          )}
        </CardContent>
      </Card>

      {/* Funnel Conversion */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Funil de Conversão</CardTitle>
          <p className="text-xs text-muted-foreground">
            Jornada do lead até a venda finalizada
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-stretch gap-4">
            {/* Leads */}
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1">
                <div className="p-6 rounded-lg bg-primary/10 text-center">
                  <Users className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-3xl font-bold">{funnelData.totalLeads}</p>
                  <p className="text-sm text-muted-foreground mt-1">Leads Totais</p>
                </div>
              </div>
              <div className="hidden lg:flex flex-col items-center justify-center px-2">
                <ArrowRight className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground mt-1 font-medium">
                  {funnelData.leadToAppointment}%
                </span>
              </div>
            </div>

            {/* Appointments */}
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1">
                <div className="p-6 rounded-lg bg-warning/10 text-center">
                  <CalendarCheck className="w-8 h-8 text-warning mx-auto mb-2" />
                  <p className="text-3xl font-bold">{funnelData.scheduledAppointments}</p>
                  <p className="text-sm text-muted-foreground mt-1">Agendamentos</p>
                </div>
              </div>
              <div className="hidden lg:flex flex-col items-center justify-center px-2">
                <ArrowRight className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground mt-1 font-medium">
                  {funnelData.appointmentToSale}%
                </span>
              </div>
            </div>

            {/* Sales */}
            <div className="flex-1">
              <div className="p-6 rounded-lg bg-success/10 text-center">
                <ShoppingCart className="w-8 h-8 text-success mx-auto mb-2" />
                <p className="text-3xl font-bold">{funnelData.completedSales}</p>
                <p className="text-sm text-muted-foreground mt-1">Vendas Realizadas</p>
              </div>
            </div>
          </div>

          {/* Conversion Rate Summary */}
          <div className="mt-6 p-4 rounded-lg bg-muted/30 flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Taxa de Conversão Total
              </p>
              <p className="text-2xl font-bold text-primary">
                {funnelData.leadToSale}%
              </p>
              <p className="text-xs text-muted-foreground">Lead → Venda</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
