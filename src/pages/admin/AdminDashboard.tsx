import { useAuth } from '@/contexts/AuthContext';
import { getAdminKPIs, mockConversations, mockSales, mockContacts, mockFunnelStages, mockLeadFunnelStates } from '@/data/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Bot,
  User,
  Clock,
  Target,
  CheckCircle,
  ArrowUpRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminDashboard() {
  const { account } = useAuth();
  const kpis = getAdminKPIs(account?.id || 'acc-1');

  const accountContacts = mockContacts.filter((c) => c.account_id === (account?.id || 'acc-1'));
  const accountSales = mockSales.filter((s) => s.account_id === (account?.id || 'acc-1'));
  const stages = mockFunnelStages.filter((s) => s.funnel_id === 'funnel-1');

  // Calculate funnel distribution
  const funnelDistribution = stages.map((stage) => {
    const count = mockLeadFunnelStates.filter(
      (lfs) =>
        lfs.funnel_stage_id === stage.id &&
        accountContacts.some((c) => c.id === lfs.contact_id)
    ).length;
    return { ...stage, count };
  });

  const kpiCards = [
    {
      title: 'Total de Leads',
      value: kpis.total_leads,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Conversas Abertas',
      value: kpis.open_conversations,
      icon: MessageSquare,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      title: 'Taxa de Conversão',
      value: `${kpis.conversion_rate}%`,
      icon: Target,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Faturamento',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
        kpis.total_revenue
      ),
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Ticket Médio',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
        kpis.avg_ticket
      ),
      icon: TrendingUp,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Tempo Médio Resposta',
      value: `${kpis.avg_response_time_minutes} min`,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral de atendimento e vendas
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="card-hover">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{kpi.title}</p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* IA vs Human Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Atendimento por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">IA (Marília)</p>
                    <p className="text-sm text-muted-foreground">Atendimento automático</p>
                  </div>
                </div>
                <span className="text-2xl font-bold">{kpis.ia_percentage}%</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-primary rounded-full transition-all duration-500"
                  style={{ width: `${kpis.ia_percentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <User className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="font-medium">Humano</p>
                    <p className="text-sm text-muted-foreground">Atendimento manual</p>
                  </div>
                </div>
                <span className="text-2xl font-bold">{kpis.human_percentage}%</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all duration-500"
                  style={{ width: `${kpis.human_percentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Funnel Distribution */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Distribuição no Funil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 h-48">
              {funnelDistribution.map((stage, index) => {
                const maxCount = Math.max(...funnelDistribution.map((s) => s.count), 1);
                const height = (stage.count / maxCount) * 100;
                return (
                  <div key={stage.id} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-sm font-medium">{stage.count}</span>
                    <div
                      className="w-full rounded-t-lg transition-all duration-500"
                      style={{
                        height: `${Math.max(height, 10)}%`,
                        backgroundColor: stage.cor || '#0EA5E9',
                      }}
                    />
                    <span className="text-xs text-muted-foreground text-center truncate w-full">
                      {stage.nome}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Vendas Recentes</CardTitle>
          <DollarSign className="w-5 h-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {accountSales.slice(0, 5).map((sale) => {
              const contact = accountContacts.find((c) => c.id === sale.contact_id);
              return (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        sale.status === 'paid'
                          ? 'bg-success/10'
                          : sale.status === 'pending'
                          ? 'bg-warning/10'
                          : 'bg-destructive/10'
                      }`}
                    >
                      {sale.status === 'paid' ? (
                        <CheckCircle className="w-5 h-5 text-success" />
                      ) : sale.status === 'pending' ? (
                        <Clock className="w-5 h-5 text-warning" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 text-destructive rotate-180" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{contact?.nome || 'Cliente'}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(sale.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        sale.valor
                      )}
                    </p>
                    <span
                      className={
                        sale.status === 'paid'
                          ? 'status-active'
                          : sale.status === 'pending'
                          ? 'status-paused'
                          : 'status-cancelled'
                      }
                    >
                      {sale.status === 'paid'
                        ? 'Pago'
                        : sale.status === 'pending'
                        ? 'Pendente'
                        : sale.status === 'refunded'
                        ? 'Estornado'
                        : 'Cancelado'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
