import { useState, useMemo } from 'react';
import { useAuth, useRoleAccess } from '@/contexts/AuthContext';
import { useFinance } from '@/contexts/FinanceContext';
import { useCalendar } from '@/contexts/CalendarContext';
import { DashboardFilters } from '@/components/dashboard';
import {
  InsightKPICards,
  ProductAnalysisTable,
  TemporalAnalysisChart,
  MarketingMetrics,
  AutomaticInsights,
  PaymentMethodAnalysis,
  type ProductAnalysis,
  type Insight,
} from '@/components/insights';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockUsers, mockConversations } from '@/data/mockData';
import {
  ShoppingCart,
  MessageSquare,
  Medal,
  ArrowRight,
  Users,
  CalendarCheck,
} from 'lucide-react';
import {
  startOfDay,
  endOfDay,
  subDays,
  isWithinInterval,
  parseISO,
  format,
  getDay,
  differenceInDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const paymentMethodLabels: Record<string, string> = {
  pix: 'PIX',
  credit: 'Crédito',
  credito: 'Crédito',
  debit: 'Débito',
  debito: 'Débito',
  boleto: 'Boleto',
  cash: 'Dinheiro',
  dinheiro: 'Dinheiro',
  convenio: 'Convênio',
  unknown: 'Não informado',
};

export default function AdminInsightsPage() {
  const { user } = useAuth();
  const { isAdmin } = useRoleAccess();
  const { sales, contacts, products: contextProducts } = useFinance();
  const { events } = useCalendar();

  // Filter states
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

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

      // Role-based filtering - Agents see only their own, Admins see all
      if (!isAdmin || user?.role !== 'admin') {
        return sale.responsavel_id === user?.id;
      }

      return true;
    });
  }, [sales, dateRange, isAdmin, user]);

  // Filter paid sales for revenue calculations
  const paidSales = useMemo(() => {
    return filteredSales.filter((sale) => sale.status === 'paid');
  }, [filteredSales]);

  // Filter contacts (leads) based on date range
  const filteredLeads = useMemo(() => {
    return contacts.filter((contact) => {
      const contactDate = parseISO(contact.created_at);
      return isWithinInterval(contactDate, {
        start: startOfDay(dateRange.from),
        end: endOfDay(dateRange.to),
      });
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

      if (!isAdmin || user?.role !== 'admin') {
        return event.createdBy === user?.id;
      }

      return true;
    });
  }, [events, dateRange, isAdmin, user]);

  // ============ KPI CALCULATIONS ============
  const kpis = useMemo(() => {
    const faturamento = paidSales.reduce((sum, s) => sum + s.valor, 0);
    const ticketMedio = paidSales.length > 0 ? faturamento / paidSales.length : 0;
    const taxaConversao = filteredLeads.length > 0 
      ? (paidSales.length / filteredLeads.length) * 100 
      : 0;
    const receitaPorLead = filteredLeads.length > 0 
      ? faturamento / filteredLeads.length 
      : 0;

    return {
      faturamento,
      ticketMedio,
      taxaConversao,
      receitaPorLead,
      totalLeads: filteredLeads.length,
      totalVendas: paidSales.length,
    };
  }, [paidSales, filteredLeads]);

  // ============ PRODUCT ANALYSIS ============
  const productAnalysis = useMemo((): ProductAnalysis[] => {
    const productStats: Record<string, { 
      nome: string; 
      unidades: number; 
      receita: number;
    }> = {};

    paidSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const product = contextProducts.find(p => p.id === item.product_id);
        const productName = product?.nome || item.product?.nome || 'Produto';
        
        if (!productStats[item.product_id]) {
          productStats[item.product_id] = { nome: productName, unidades: 0, receita: 0 };
        }
        productStats[item.product_id].unidades += item.quantidade;
        productStats[item.product_id].receita += item.valor_total;
      });
    });

    const totalRevenue = Object.values(productStats).reduce((sum, p) => sum + p.receita, 0);
    
    const products: ProductAnalysis[] = Object.entries(productStats)
      .map(([id, stats]) => ({
        id,
        nome: stats.nome,
        unidadesVendidas: stats.unidades,
        receita: stats.receita,
        ticketMedio: stats.unidades > 0 ? stats.receita / stats.unidades : 0,
        participacao: totalRevenue > 0 ? (stats.receita / totalRevenue) * 100 : 0,
        tendencia: 'stable' as const,
        classification: 'normal' as ProductAnalysis['classification'],
      }))
      .sort((a, b) => b.receita - a.receita);

    // Classify products
    if (products.length > 0) {
      products[0].classification = 'star';
      
      // Find opportunity (high ticket, low volume)
      const avgUnidades = products.reduce((sum, p) => sum + p.unidadesVendidas, 0) / products.length;
      const avgTicket = products.reduce((sum, p) => sum + p.ticketMedio, 0) / products.length;
      
      const opportunity = products.find(p => 
        p.classification !== 'star' && 
        p.ticketMedio > avgTicket * 1.2 && 
        p.unidadesVendidas < avgUnidades
      );
      if (opportunity) opportunity.classification = 'opportunity';
      
      // Find risk (lowest performer)
      if (products.length > 2) {
        const lastProduct = products[products.length - 1];
        if (lastProduct.classification === 'normal') {
          lastProduct.classification = 'risk';
        }
      }
    }

    return products;
  }, [paidSales, contextProducts]);

  // ============ TEMPORAL ANALYSIS ============
  const temporalData = useMemo(() => {
    // Daily revenue
    const dailyMap: Record<string, { valor: number; count: number }> = {};
    const hourlyMap: Record<number, number> = {};
    const weekdayMap: Record<number, { total: number; count: number }> = {};
    
    paidSales.forEach((sale) => {
      const date = format(parseISO(sale.created_at), 'yyyy-MM-dd');
      const hour = parseISO(sale.created_at).getHours();
      const weekday = getDay(parseISO(sale.created_at));
      
      if (!dailyMap[date]) {
        dailyMap[date] = { valor: 0, count: 0 };
      }
      dailyMap[date].valor += sale.valor;
      dailyMap[date].count++;
      
      hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
      
      if (!weekdayMap[weekday]) {
        weekdayMap[weekday] = { total: 0, count: 0 };
      }
      weekdayMap[weekday].total += sale.valor;
      weekdayMap[weekday].count++;
    });

    const dailyData = Object.entries(dailyMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Best and worst days
    const sortedByRevenue = [...dailyData].sort((a, b) => b.valor - a.valor);
    const bestDay = sortedByRevenue.length > 0 ? sortedByRevenue[0] : null;
    const worstDay = sortedByRevenue.length > 0 ? sortedByRevenue[sortedByRevenue.length - 1] : null;

    // Best weekday
    const weekdayStats = Object.entries(weekdayMap)
      .map(([day, data]) => ({
        day: weekdayNames[parseInt(day)],
        dayNumber: parseInt(day),
        averageRevenue: data.count > 0 ? data.total / data.count : 0,
      }))
      .sort((a, b) => b.averageRevenue - a.averageRevenue);
    const bestWeekday = weekdayStats.length > 0 ? weekdayStats[0] : null;

    // Peak hour
    const hourlyStats = Object.entries(hourlyMap)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count);
    const peakHour = hourlyStats.length > 0 ? hourlyStats[0] : null;

    return { dailyData, bestDay, worstDay, bestWeekday, peakHour };
  }, [paidSales]);

  // ============ MARKETING METRICS ============
  const marketingMetrics = useMemo(() => {
    // Identify recurring customers
    const customerSales: Record<string, { count: number; total: number; firstSale: string; lastPaid: string | null }> = {};
    
    paidSales.forEach((sale) => {
      if (!customerSales[sale.contact_id]) {
        customerSales[sale.contact_id] = { count: 0, total: 0, firstSale: sale.created_at, lastPaid: null };
      }
      customerSales[sale.contact_id].count++;
      customerSales[sale.contact_id].total += sale.valor;
      if (sale.paid_at) {
        customerSales[sale.contact_id].lastPaid = sale.paid_at;
      }
    });

    const totalClientes = Object.keys(customerSales).length;
    const clientesRecorrentes = Object.values(customerSales).filter(c => c.count > 1).length;
    const taxaRecorrencia = totalClientes > 0 ? (clientesRecorrentes / totalClientes) * 100 : 0;

    // LTV (average revenue from recurring customers)
    const recurringRevenue = Object.values(customerSales)
      .filter(c => c.count > 1)
      .reduce((sum, c) => sum + c.total, 0);
    const ltv = clientesRecorrentes > 0 ? recurringRevenue / clientesRecorrentes : kpis.ticketMedio;

    // CAC implícito
    const cacImplicito = kpis.totalVendas > 0 ? kpis.totalLeads / kpis.totalVendas : 0;

    // Ciclo médio de venda (days from lead to paid)
    let totalCycleDays = 0;
    let cycleCount = 0;
    
    paidSales.forEach((sale) => {
      const contact = contacts.find(c => c.id === sale.contact_id);
      if (contact && sale.paid_at) {
        const leadDate = parseISO(contact.created_at);
        const paidDate = parseISO(sale.paid_at);
        const days = differenceInDays(paidDate, leadDate);
        if (days >= 0 && days < 365) {
          totalCycleDays += days;
          cycleCount++;
        }
      }
    });
    
    const cicloMedioVenda = cycleCount > 0 ? totalCycleDays / cycleCount : 0;

    return {
      ltv,
      taxaRecorrencia,
      cacImplicito,
      cicloMedioVenda,
      clientesRecorrentes,
      totalClientes,
    };
  }, [paidSales, contacts, kpis]);

  // ============ PAYMENT METHOD ANALYSIS ============
  const paymentMethodData = useMemo(() => {
    const methodStats: Record<string, { count: number; revenue: number }> = {};

    paidSales.forEach((sale) => {
      const method = sale.metodo_pagamento || 'unknown';
      if (!methodStats[method]) {
        methodStats[method] = { count: 0, revenue: 0 };
      }
      methodStats[method].count++;
      methodStats[method].revenue += sale.valor;
    });

    const totalRevenue = Object.values(methodStats).reduce((sum, m) => sum + m.revenue, 0);

    return Object.entries(methodStats)
      .map(([method, stats]) => ({
        method,
        label: paymentMethodLabels[method] || method,
        count: stats.count,
        revenue: stats.revenue,
        ticketMedio: stats.count > 0 ? stats.revenue / stats.count : 0,
        participacao: totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [paidSales]);

  // Generate payment insight
  const paymentInsight = useMemo(() => {
    if (paymentMethodData.length < 2) return null;
    
    const topMethod = paymentMethodData[0];
    const highestTicketMethod = [...paymentMethodData].sort((a, b) => b.ticketMedio - a.ticketMedio)[0];
    
    if (highestTicketMethod.method !== topMethod.method) {
      return `Clientes que pagam via ${highestTicketMethod.label} têm ticket ${((highestTicketMethod.ticketMedio / topMethod.ticketMedio - 1) * 100).toFixed(0)}% maior. Considere incentivar este método.`;
    }
    
    if (topMethod.participacao > 60) {
      return `${topMethod.label} representa ${topMethod.participacao.toFixed(0)}% das vendas. Diversificar métodos pode reduzir riscos.`;
    }
    
    return null;
  }, [paymentMethodData]);

  // ============ AUTOMATIC INSIGHTS ============
  const automaticInsights = useMemo((): Insight[] => {
    const insights: Insight[] = [];
    
    // Product insights
    if (productAnalysis.length > 0) {
      const starProduct = productAnalysis.find(p => p.classification === 'star');
      if (starProduct && starProduct.participacao > 40) {
        insights.push({
          id: 'star-product',
          type: 'success',
          title: `"${starProduct.nome}" é responsável por ${starProduct.participacao.toFixed(0)}% do faturamento`,
          description: 'Este produto é o carro-chefe. Considere destacá-lo em campanhas e garantir estoque/disponibilidade.',
          metric: formatCurrency(starProduct.receita),
        });
      }
      
      const opportunityProduct = productAnalysis.find(p => p.classification === 'opportunity');
      if (opportunityProduct) {
        insights.push({
          id: 'opportunity-product',
          type: 'opportunity',
          title: `"${opportunityProduct.nome}" tem ticket alto mas poucas vendas`,
          description: 'Oportunidade para campanhas focadas. Alto valor agregado com potencial de crescimento.',
          metric: `Ticket: ${formatCurrency(opportunityProduct.ticketMedio)}`,
        });
      }
    }
    
    // Temporal insights
    if (temporalData.bestWeekday && temporalData.worstDay) {
      const worstWeekday = weekdayNames[getDay(parseISO(temporalData.worstDay.date))];
      if (worstWeekday !== temporalData.bestWeekday.day) {
        insights.push({
          id: 'weekday-opportunity',
          type: 'opportunity',
          title: `${temporalData.bestWeekday.day} é o melhor dia para vendas`,
          description: `Média de ${formatCurrency(temporalData.bestWeekday.averageRevenue)} por ${temporalData.bestWeekday.day}. Concentre esforços de marketing neste dia.`,
        });
      }
    }
    
    // Recurrence insight
    if (marketingMetrics.taxaRecorrencia > 20) {
      insights.push({
        id: 'recurrence-high',
        type: 'success',
        title: `${marketingMetrics.taxaRecorrencia.toFixed(0)}% dos clientes são recorrentes`,
        description: 'Excelente taxa de fidelização. Continue investindo em relacionamento e pós-venda.',
        metric: `${marketingMetrics.clientesRecorrentes} clientes`,
      });
    } else if (marketingMetrics.taxaRecorrencia < 10 && marketingMetrics.totalClientes > 5) {
      insights.push({
        id: 'recurrence-low',
        type: 'warning',
        title: 'Taxa de recorrência baixa',
        description: 'Poucos clientes retornam. Considere programas de fidelidade ou follow-up pós-venda.',
        metric: `${marketingMetrics.taxaRecorrencia.toFixed(1)}%`,
      });
    }
    
    // Conversion insight
    if (kpis.taxaConversao < 10 && kpis.totalLeads > 10) {
      insights.push({
        id: 'conversion-low',
        type: 'warning',
        title: 'Taxa de conversão pode ser melhorada',
        description: `Apenas ${kpis.taxaConversao.toFixed(1)}% dos leads viram vendas. Revise o processo de qualificação e follow-up.`,
        metric: `${kpis.totalVendas}/${kpis.totalLeads}`,
      });
    }
    
    return insights;
  }, [productAnalysis, temporalData, marketingMetrics, kpis, formatCurrency]);

  // ============ AGENT RANKING ============
  const agentRanking = useMemo(() => {
    if (!user?.account_id) return [];

    const agents = mockUsers.filter(u => 
      u.account_id === user.account_id && 
      (u.role === 'agent' || u.role === 'admin')
    );

    return agents.map(agent => {
      const agentSales = paidSales.filter(s => s.responsavel_id === agent.id);
      const totalSales = agentSales.length;
      const totalRevenue = agentSales.reduce((sum, s) => sum + s.valor, 0);
      const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      const agentConversations = mockConversations.filter(c => 
        c.assignee_id === agent.id && c.assignee_type === 'user'
      );
      const totalConversations = agentConversations.length;
      const resolvedConversations = agentConversations.filter(c => c.status === 'resolved').length;
      const resolutionRate = totalConversations > 0 
        ? ((resolvedConversations / totalConversations) * 100)
        : 0;

      const agentAppointments = filteredAppointments.filter(e => e.createdBy === agent.id);
      const totalAppointments = agentAppointments.length;

      return {
        id: agent.id,
        name: agent.nome,
        role: agent.role,
        totalSales,
        totalRevenue,
        avgTicket,
        totalConversations,
        resolvedConversations,
        resolutionRate,
        totalAppointments,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [paidSales, filteredAppointments, user]);

  const maxMetrics = useMemo(() => {
    if (agentRanking.length === 0) return { revenue: 1, conversations: 1 };
    return {
      revenue: Math.max(...agentRanking.map(a => a.totalRevenue), 1),
      conversations: Math.max(...agentRanking.map(a => a.totalConversations), 1),
    };
  }, [agentRanking]);

  // ============ HANDLERS ============
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

  const getPositionDisplay = (position: number) => {
    if (position === 1) return <span className="text-xl">🥇</span>;
    if (position === 2) return <span className="text-xl">🥈</span>;
    if (position === 3) return <span className="text-xl">🥉</span>;
    return <span className="text-sm font-bold text-muted-foreground">{position}º</span>;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  // ============ FUNNEL DATA ============
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

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Insights de Negócio</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Métricas inteligentes para decisões estratégicas
            {!isAdmin && ' (seus dados)'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <DashboardFilters
          onPeriodChange={handlePeriodChange}
          showAgentFilter={false}
          showChannelFilter={false}
          showTypeFilter={false}
        />
      </div>

      {/* Main KPIs */}
      <InsightKPICards
        faturamento={kpis.faturamento}
        ticketMedio={kpis.ticketMedio}
        taxaConversao={kpis.taxaConversao}
        receitaPorLead={kpis.receitaPorLead}
        totalLeads={kpis.totalLeads}
        totalVendas={kpis.totalVendas}
      />

      {/* Automatic Insights */}
      {automaticInsights.length > 0 && (
        <AutomaticInsights insights={automaticInsights} />
      )}

      {/* Product Analysis */}
      {productAnalysis.length > 0 && (
        <ProductAnalysisTable 
          products={productAnalysis} 
          totalRevenue={kpis.faturamento}
        />
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Temporal Analysis */}
        <TemporalAnalysisChart
          dailyData={temporalData.dailyData}
          bestDay={temporalData.bestDay}
          worstDay={temporalData.worstDay}
          bestWeekday={temporalData.bestWeekday}
          peakHour={temporalData.peakHour}
        />

        {/* Marketing Metrics */}
        <MarketingMetrics
          ltv={marketingMetrics.ltv}
          taxaRecorrencia={marketingMetrics.taxaRecorrencia}
          cacImplicito={marketingMetrics.cacImplicito}
          cicloMedioVenda={marketingMetrics.cicloMedioVenda}
          clientesRecorrentes={marketingMetrics.clientesRecorrentes}
          totalClientes={marketingMetrics.totalClientes}
        />
      </div>

      {/* Payment Method Analysis */}
      {paymentMethodData.length > 0 && (
        <PaymentMethodAnalysis 
          data={paymentMethodData}
          highlightInsight={paymentInsight}
        />
      )}

      {/* Funnel Conversion */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Funil de Conversão</CardTitle>
          <p className="text-xs text-muted-foreground">
            Jornada do lead até a venda finalizada
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            {/* Leads */}
            <div className="flex-1 flex flex-col sm:flex-row lg:flex-row items-stretch gap-2">
              <div className="flex-1">
                <div className="p-4 sm:p-6 rounded-lg bg-primary/10 text-center h-full flex flex-col justify-center">
                  <Users className="w-6 h-6 sm:w-8 sm:h-8 text-primary mx-auto mb-2" />
                  <p className="text-2xl sm:text-3xl font-bold">{funnelData.totalLeads}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Leads Totais</p>
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
            <div className="flex-1 flex flex-col sm:flex-row lg:flex-row items-stretch gap-2">
              <div className="flex-1">
                <div className="p-4 sm:p-6 rounded-lg bg-warning/10 text-center h-full flex flex-col justify-center">
                  <CalendarCheck className="w-6 h-6 sm:w-8 sm:h-8 text-warning mx-auto mb-2" />
                  <p className="text-2xl sm:text-3xl font-bold">{funnelData.scheduledAppointments}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Agendamentos</p>
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
              <div className="p-4 sm:p-6 rounded-lg bg-success/10 text-center h-full flex flex-col justify-center">
                <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8 text-success mx-auto mb-2" />
                <p className="text-2xl sm:text-3xl font-bold">{funnelData.completedSales}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Vendas Pagas</p>
              </div>
            </div>
          </div>

          {/* Conversion Rate Summary */}
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg bg-muted/30 flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                Taxa de Conversão Total
              </p>
              <p className="text-xl sm:text-2xl font-bold text-primary">
                {funnelData.leadToSale}%
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Lead → Venda</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Ranking Section - Only visible to Admins */}
      {isAdmin && user?.role === 'admin' && agentRanking.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Medal className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Ranking de Performance</CardTitle>
                <p className="text-xs text-muted-foreground">Comparativo entre agentes no período selecionado</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="sales" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="sales" className="gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Por Vendas
                </TabsTrigger>
                <TabsTrigger value="conversations" className="gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Por Atendimentos
                </TabsTrigger>
              </TabsList>

              {/* Sales Ranking Tab */}
              <TabsContent value="sales">
                <ScrollArea className="h-[350px]">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[550px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-14 min-w-[56px]">Pos.</TableHead>
                          <TableHead className="min-w-[140px]">Agente</TableHead>
                          <TableHead className="text-center min-w-[70px]">Vendas</TableHead>
                          <TableHead className="text-right min-w-[100px]">Faturamento</TableHead>
                          <TableHead className="text-right min-w-[90px] hidden sm:table-cell">Ticket Médio</TableHead>
                          <TableHead className="w-[100px] hidden md:table-cell">Performance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...agentRanking].sort((a, b) => b.totalRevenue - a.totalRevenue).map((agent, index) => (
                          <TableRow 
                            key={agent.id}
                            className={index < 3 ? 'bg-primary/5' : ''}
                          >
                            <TableCell className="text-center">
                              {getPositionDisplay(index + 1)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {getInitials(agent.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{agent.name}</p>
                                  <p className="text-xs text-muted-foreground capitalize hidden sm:block">{agent.role}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{agent.totalSales}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-success">
                              {formatCurrency(agent.totalRevenue)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground hidden sm:table-cell">
                              {formatCurrency(agent.avgTicket)}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Progress 
                                value={(agent.totalRevenue / maxMetrics.revenue) * 100} 
                                className="h-2"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Conversations Ranking Tab */}
              <TabsContent value="conversations">
                <ScrollArea className="h-[350px]">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[520px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-14 min-w-[56px]">Pos.</TableHead>
                          <TableHead className="min-w-[140px]">Agente</TableHead>
                          <TableHead className="text-center min-w-[80px]">Conversas</TableHead>
                          <TableHead className="text-center min-w-[80px] hidden sm:table-cell">Resolvidas</TableHead>
                          <TableHead className="text-center min-w-[60px]">Taxa</TableHead>
                          <TableHead className="w-[100px] hidden md:table-cell">Performance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...agentRanking].sort((a, b) => b.totalConversations - a.totalConversations).map((agent, index) => (
                          <TableRow 
                            key={agent.id}
                            className={index < 3 ? 'bg-primary/5' : ''}
                          >
                            <TableCell className="text-center">
                              {getPositionDisplay(index + 1)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {getInitials(agent.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{agent.name}</p>
                                  <p className="text-xs text-muted-foreground capitalize hidden sm:block">{agent.role}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{agent.totalConversations}</Badge>
                            </TableCell>
                            <TableCell className="text-center hidden sm:table-cell">
                              <Badge variant="outline" className="text-success">
                                {agent.resolvedConversations}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`font-medium ${agent.resolutionRate >= 80 ? 'text-success' : agent.resolutionRate >= 50 ? 'text-warning' : 'text-destructive'}`}>
                                {agent.resolutionRate.toFixed(0)}%
                              </span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Progress 
                                value={(agent.totalConversations / maxMetrics.conversations) * 100} 
                                className="h-2"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
