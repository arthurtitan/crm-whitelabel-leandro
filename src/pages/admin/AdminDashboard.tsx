import { useState, useMemo } from 'react';
import { useAuth, useRoleAccess } from '@/contexts/AuthContext';
import { useCalendar } from '@/contexts/CalendarContext';
import {
  Users,
  MessageSquare,
  Clock,
  ArrowRightLeft,
  CalendarCheck,
  CalendarX,
} from 'lucide-react';
import { subDays, isWithinInterval, parseISO } from 'date-fns';
import { DateRange } from 'react-day-picker';

// Dashboard Components
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { KPICard } from '@/components/dashboard/KPICard';
import { IAvsHumanCard } from '@/components/dashboard/IAvsHumanCard';
import { HourlyPeakChart } from '@/components/dashboard/HourlyPeakChart';
import { BacklogCard } from '@/components/dashboard/BacklogCard';
import { AgentPerformanceTable } from '@/components/dashboard/AgentPerformanceTable';
import { QualityCards } from '@/components/dashboard/QualityCards';
import { EmptyState } from '@/components/dashboard/EmptyState';

// Mock data for the dashboard
const mockDashboardData = {
  kpis: {
    totalLeads: 1248,
    conversasAtivas: 47,
    percentualIA: 68,
    percentualHumano: 32,
    tempoMedioPrimeiraResposta: '2m 14s',
    tempoMedioResolucao: '18m 40s',
    taxaTransbordo: '12.5%',
  },
  conversasPorCanal: [
    { canal: 'whatsapp', totalConversas: 456 },
    { canal: 'instagram', totalConversas: 234 },
    { canal: 'webchat', totalConversas: 178 },
  ],
  conversasPorDia: [
    { data: '13/01', totalConversas: 45 },
    { data: '14/01', totalConversas: 62 },
    { data: '15/01', totalConversas: 58 },
    { data: '16/01', totalConversas: 71 },
    { data: '17/01', totalConversas: 89 },
    { data: '18/01', totalConversas: 76 },
    { data: '19/01', totalConversas: 94 },
  ],
  picoPorHora: [
    { hora: 8, totalConversas: 12 },
    { hora: 9, totalConversas: 28 },
    { hora: 10, totalConversas: 45 },
    { hora: 11, totalConversas: 52 },
    { hora: 12, totalConversas: 38 },
    { hora: 13, totalConversas: 32 },
    { hora: 14, totalConversas: 48 },
    { hora: 15, totalConversas: 56 },
    { hora: 16, totalConversas: 62 },
    { hora: 17, totalConversas: 48 },
    { hora: 18, totalConversas: 35 },
    { hora: 19, totalConversas: 22 },
    { hora: 20, totalConversas: 15 },
  ],
  backlog: {
    ate15min: 28,
    de15a60min: 12,
    acima60min: 7,
  },
  agentes: [
    {
      agentName: 'Ana Silva',
      atendimentosAssumidos: 145,
      atendimentosResolvidos: 138,
      tempoMedioResposta: '1m 45s',
      taxaResolucao: 95,
    },
    {
      agentName: 'Carlos Santos',
      atendimentosAssumidos: 128,
      atendimentosResolvidos: 112,
      tempoMedioResposta: '2m 12s',
      taxaResolucao: 87,
    },
    {
      agentName: 'Maria Oliveira',
      atendimentosAssumidos: 156,
      atendimentosResolvidos: 149,
      tempoMedioResposta: '1m 32s',
      taxaResolucao: 96,
    },
    {
      agentName: 'Pedro Costa',
      atendimentosAssumidos: 98,
      atendimentosResolvidos: 82,
      tempoMedioResposta: '3m 05s',
      taxaResolucao: 84,
    },
    {
      agentName: 'Julia Ferreira',
      atendimentosAssumidos: 167,
      atendimentosResolvidos: 158,
      tempoMedioResposta: '1m 58s',
      taxaResolucao: 95,
    },
  ],
  qualidade: {
    conversasSemResposta: 8,
    taxaAtendimentoVenda: '17.5%',
  },
};

type ViewState = 'loading' | 'empty' | 'data';

export default function AdminDashboard() {
  const { user, account } = useAuth();
  const { isAdmin } = useRoleAccess();
  const { events } = useCalendar();
  
  const [viewState, setViewState] = useState<ViewState>('data');
  const [period, setPeriod] = useState('7d');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [channel, setChannel] = useState('all');
  const [type, setType] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState('all');

  // Handle period change from filters
  const handlePeriodChange = (newPeriod: string, range?: DateRange) => {
    setPeriod(newPeriod);
    if (range) {
      setDateRange(range);
    } else if (newPeriod === '7d') {
      setDateRange({ from: subDays(new Date(), 7), to: new Date() });
    } else if (newPeriod === '30d') {
      setDateRange({ from: subDays(new Date(), 30), to: new Date() });
    }
  };

  // Calculate appointments counts based on role, selected agent, and period
  const { totalAppointments, cancelledAppointments } = useMemo(() => {
    const start = dateRange?.from || subDays(new Date(), 7);
    const end = dateRange?.to || new Date();
    
    // Filter events to only include appointments/meetings within the selected period
    const periodEvents = events.filter(event => {
      const eventDate = parseISO(event.start);
      return isWithinInterval(eventDate, { start, end }) &&
             (event.type === 'meeting' || event.type === 'appointment');
    });
    
    // Apply role-based filtering
    let filteredEvents = periodEvents;
    
    // If agent, show only their own appointments
    if (!isAdmin) {
      filteredEvents = periodEvents.filter(event => event.createdBy === user?.id);
    } else if (selectedAgent !== 'all') {
      // If admin with agent filter applied
      filteredEvents = periodEvents.filter(event => event.createdBy === selectedAgent);
    }
    
    const total = filteredEvents.length;
    const cancelled = filteredEvents.filter(event => event.status === 'cancelled').length;
    
    return { totalAppointments: total, cancelledAppointments: cancelled };
  }, [events, isAdmin, user?.id, selectedAgent, dateRange]);

  // Simulate different states for demonstration
  const handleStateChange = (state: ViewState) => {
    setViewState(state);
  };

  const data = mockDashboardData;
  const isLoading = viewState === 'loading';
  const isEmpty = viewState === 'empty';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient-gleps">Dashboard de Atendimento</h1>
          <p className="text-sm text-muted-foreground">
            Métricas operacionais e estratégicas do atendimento
          </p>
        </div>

        {/* State Toggle (for demo purposes) */}
        <div className="flex gap-2">
          <button
            onClick={() => handleStateChange('data')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              viewState === 'data'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Com Dados
          </button>
          <button
            onClick={() => handleStateChange('loading')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              viewState === 'loading'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Carregando
          </button>
          <button
            onClick={() => handleStateChange('empty')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              viewState === 'empty'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Sem Dados
          </button>
        </div>
      </div>

      {/* Global Filters */}
      <DashboardFilters
        onPeriodChange={handlePeriodChange}
        onChannelChange={setChannel}
        onTypeChange={setType}
        onAgentChange={setSelectedAgent}
        showAgentFilter={isAdmin && user?.role === 'admin'}
      />

      {isEmpty ? (
        <EmptyState
          title="Nenhum dado de atendimento"
          description="Não há conversas registradas para o período e filtros selecionados. Aguarde novos atendimentos ou altere os filtros."
        />
      ) : (
        <>
          {/* KPI Cards - Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              title="Total de Leads"
              subtitle="Contatos únicos que tiveram conversa"
              value={data.kpis.totalLeads}
              icon={Users}
              iconColor="text-primary"
              iconBgColor="bg-primary/10"
              isLoading={isLoading}
            />
            <KPICard
              title="Conversas Ativas"
              subtitle="Atendimentos em andamento"
              value={data.kpis.conversasAtivas}
              icon={MessageSquare}
              iconColor="text-info"
              iconBgColor="bg-info/10"
              isLoading={isLoading}
            />
            <KPICard
              title="Agendamentos"
              subtitle={isAdmin ? (selectedAgent !== 'all' ? 'Do agente selecionado' : 'Visão geral da clínica') : 'Seus agendamentos'}
              value={totalAppointments}
              icon={CalendarCheck}
              iconColor="text-success"
              iconBgColor="bg-success/10"
              isLoading={isLoading}
            />
            <KPICard
              title="Desmarcados"
              subtitle={isAdmin ? (selectedAgent !== 'all' ? 'Do agente selecionado' : 'Visão geral da clínica') : 'Seus cancelamentos'}
              value={cancelledAppointments}
              icon={CalendarX}
              iconColor="text-destructive"
              iconBgColor="bg-destructive/10"
              isLoading={isLoading}
            />
            <KPICard
              title="Taxa de Transbordo"
              subtitle="IA → Humano"
              value={data.kpis.taxaTransbordo}
              icon={ArrowRightLeft}
              iconColor="text-warning"
              iconBgColor="bg-warning/10"
              isLoading={isLoading}
            />
          </div>

          {/* KPI Cards - Row 2 (Time metrics + IA vs Human) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <KPICard
                title="Tempo Médio Primeira Resposta"
                subtitle="Primeira resposta após mensagem do lead"
                value={data.kpis.tempoMedioPrimeiraResposta}
                icon={Clock}
                iconColor="text-primary"
                iconBgColor="bg-primary/10"
                isLoading={isLoading}
              />
              <KPICard
                title="Tempo Médio de Resolução"
                subtitle="Tempo médio até finalizar atendimento"
                value={data.kpis.tempoMedioResolucao}
                icon={Clock}
                iconColor="text-success"
                iconBgColor="bg-success/10"
                isLoading={isLoading}
              />
            </div>
            <IAvsHumanCard
              percentualIA={data.kpis.percentualIA}
              percentualHumano={data.kpis.percentualHumano}
              isLoading={isLoading}
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HourlyPeakChart data={data.picoPorHora} isLoading={isLoading} />
            <BacklogCard data={data.backlog} isLoading={isLoading} />
          </div>

          {/* Agent Performance Table */}
          <AgentPerformanceTable data={data.agentes} isLoading={isLoading} />

          {/* Quality & Conversion Cards */}
          <QualityCards data={data.qualidade} isLoading={isLoading} />
        </>
      )}
    </div>
  );
}
