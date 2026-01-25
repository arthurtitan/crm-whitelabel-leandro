import { useState, useMemo } from 'react';
import { useAuth, useRoleAccess } from '@/contexts/AuthContext';
import { useCalendar } from '@/contexts/CalendarContext';
import {
  Users,
  MessageSquare,
  Clock,
  ArrowRightLeft,
  CalendarCheck,
  Bot,
  X,
} from 'lucide-react';
import { subDays, isWithinInterval, parseISO } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';

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

// Mock data by agent for filtered views
const mockAgentDashboardData: Record<string, typeof mockDashboardData.kpis & { 
  backlog: typeof mockDashboardData.backlog;
  qualidade: typeof mockDashboardData.qualidade;
  picoPorHora: typeof mockDashboardData.picoPorHora;
}> = {
  'Ana Silva': {
    totalLeads: 245,
    conversasAtivas: 12,
    percentualIA: 45,
    percentualHumano: 55,
    tempoMedioPrimeiraResposta: '1m 45s',
    tempoMedioResolucao: '15m 20s',
    taxaTransbordo: '8.2%',
    backlog: { ate15min: 8, de15a60min: 3, acima60min: 1 },
    qualidade: { conversasSemResposta: 2, taxaAtendimentoVenda: '22.5%' },
    picoPorHora: [
      { hora: 8, totalConversas: 5 }, { hora: 9, totalConversas: 12 }, { hora: 10, totalConversas: 18 },
      { hora: 11, totalConversas: 22 }, { hora: 12, totalConversas: 15 }, { hora: 13, totalConversas: 10 },
      { hora: 14, totalConversas: 20 }, { hora: 15, totalConversas: 25 }, { hora: 16, totalConversas: 28 },
      { hora: 17, totalConversas: 18 }, { hora: 18, totalConversas: 12 }, { hora: 19, totalConversas: 8 },
      { hora: 20, totalConversas: 5 },
    ],
  },
  'Carlos Santos': {
    totalLeads: 198,
    conversasAtivas: 8,
    percentualIA: 52,
    percentualHumano: 48,
    tempoMedioPrimeiraResposta: '2m 12s',
    tempoMedioResolucao: '22m 10s',
    taxaTransbordo: '15.3%',
    backlog: { ate15min: 5, de15a60min: 4, acima60min: 2 },
    qualidade: { conversasSemResposta: 3, taxaAtendimentoVenda: '18.2%' },
    picoPorHora: [
      { hora: 8, totalConversas: 3 }, { hora: 9, totalConversas: 8 }, { hora: 10, totalConversas: 12 },
      { hora: 11, totalConversas: 15 }, { hora: 12, totalConversas: 10 }, { hora: 13, totalConversas: 8 },
      { hora: 14, totalConversas: 14 }, { hora: 15, totalConversas: 16 }, { hora: 16, totalConversas: 18 },
      { hora: 17, totalConversas: 14 }, { hora: 18, totalConversas: 10 }, { hora: 19, totalConversas: 6 },
      { hora: 20, totalConversas: 4 },
    ],
  },
  'Maria Oliveira': {
    totalLeads: 312,
    conversasAtivas: 15,
    percentualIA: 72,
    percentualHumano: 28,
    tempoMedioPrimeiraResposta: '1m 32s',
    tempoMedioResolucao: '14m 45s',
    taxaTransbordo: '6.8%',
    backlog: { ate15min: 10, de15a60min: 2, acima60min: 1 },
    qualidade: { conversasSemResposta: 1, taxaAtendimentoVenda: '24.8%' },
    picoPorHora: [
      { hora: 8, totalConversas: 6 }, { hora: 9, totalConversas: 14 }, { hora: 10, totalConversas: 22 },
      { hora: 11, totalConversas: 26 }, { hora: 12, totalConversas: 18 }, { hora: 13, totalConversas: 14 },
      { hora: 14, totalConversas: 24 }, { hora: 15, totalConversas: 28 }, { hora: 16, totalConversas: 30 },
      { hora: 17, totalConversas: 22 }, { hora: 18, totalConversas: 16 }, { hora: 19, totalConversas: 10 },
      { hora: 20, totalConversas: 6 },
    ],
  },
  'Pedro Costa': {
    totalLeads: 156,
    conversasAtivas: 5,
    percentualIA: 38,
    percentualHumano: 62,
    tempoMedioPrimeiraResposta: '3m 05s',
    tempoMedioResolucao: '28m 30s',
    taxaTransbordo: '22.1%',
    backlog: { ate15min: 3, de15a60min: 2, acima60min: 2 },
    qualidade: { conversasSemResposta: 2, taxaAtendimentoVenda: '12.3%' },
    picoPorHora: [
      { hora: 8, totalConversas: 2 }, { hora: 9, totalConversas: 5 }, { hora: 10, totalConversas: 8 },
      { hora: 11, totalConversas: 10 }, { hora: 12, totalConversas: 7 }, { hora: 13, totalConversas: 5 },
      { hora: 14, totalConversas: 9 }, { hora: 15, totalConversas: 11 }, { hora: 16, totalConversas: 12 },
      { hora: 17, totalConversas: 9 }, { hora: 18, totalConversas: 6 }, { hora: 19, totalConversas: 4 },
      { hora: 20, totalConversas: 2 },
    ],
  },
  'Julia Ferreira': {
    totalLeads: 337,
    conversasAtivas: 18,
    percentualIA: 78,
    percentualHumano: 22,
    tempoMedioPrimeiraResposta: '1m 58s',
    tempoMedioResolucao: '16m 20s',
    taxaTransbordo: '9.5%',
    backlog: { ate15min: 12, de15a60min: 3, acima60min: 1 },
    qualidade: { conversasSemResposta: 0, taxaAtendimentoVenda: '21.2%' },
    picoPorHora: [
      { hora: 8, totalConversas: 7 }, { hora: 9, totalConversas: 16 }, { hora: 10, totalConversas: 24 },
      { hora: 11, totalConversas: 28 }, { hora: 12, totalConversas: 20 }, { hora: 13, totalConversas: 16 },
      { hora: 14, totalConversas: 26 }, { hora: 15, totalConversas: 30 }, { hora: 16, totalConversas: 32 },
      { hora: 17, totalConversas: 24 }, { hora: 18, totalConversas: 18 }, { hora: 19, totalConversas: 11 },
      { hora: 20, totalConversas: 7 },
    ],
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
  const [selectedAgentFromTable, setSelectedAgentFromTable] = useState<string | null>(null);

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
  const totalAppointments = useMemo(() => {
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
    } else if (selectedAgentFromTable) {
      filteredEvents = periodEvents.filter(event => event.createdBy === selectedAgentFromTable);
    } else if (selectedAgent !== 'all') {
      filteredEvents = periodEvents.filter(event => event.createdBy === selectedAgent);
    }
    
    return filteredEvents.length;
  }, [events, isAdmin, user?.id, selectedAgent, selectedAgentFromTable, dateRange]);

  // Get displayed KPIs based on selected agent from table
  const displayedData = useMemo(() => {
    if (selectedAgentFromTable && mockAgentDashboardData[selectedAgentFromTable]) {
      const agentData = mockAgentDashboardData[selectedAgentFromTable];
      return {
        kpis: agentData,
        picoPorHora: agentData.picoPorHora,
        backlog: agentData.backlog,
        qualidade: agentData.qualidade,
      };
    }
    return {
      kpis: mockDashboardData.kpis,
      picoPorHora: mockDashboardData.picoPorHora,
      backlog: mockDashboardData.backlog,
      qualidade: mockDashboardData.qualidade,
    };
  }, [selectedAgentFromTable]);

  // Calculate AI service count based on percentage and total leads
  const aiServiceCount = useMemo(() => {
    const totalLeads = displayedData.kpis.totalLeads;
    const percentualIA = displayedData.kpis.percentualIA;
    return Math.round((totalLeads * percentualIA) / 100);
  }, [displayedData.kpis.totalLeads, displayedData.kpis.percentualIA]);

  // Simulate different states for demonstration
  const handleStateChange = (state: ViewState) => {
    setViewState(state);
  };

  const data = mockDashboardData;
  const isLoading = viewState === 'loading';
  const isEmpty = viewState === 'empty';

  // Helper for subtitle context
  const getAgentContextSubtitle = (defaultText: string) => {
    if (selectedAgentFromTable) {
      return `Dados de ${selectedAgentFromTable}`;
    }
    return defaultText;
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="title-responsive text-foreground">Dashboard de Atendimento</h1>
          <p className="text-responsive-sm text-muted-foreground">
            Métricas operacionais e estratégicas do atendimento
          </p>
        </div>

        {/* State Toggle (for demo purposes) - hidden on mobile */}
        <div className="hidden sm:flex flex-wrap gap-2">
          <button
            onClick={() => handleStateChange('data')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors min-h-[32px] ${
              viewState === 'data'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Com Dados
          </button>
          <button
            onClick={() => handleStateChange('loading')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors min-h-[32px] ${
              viewState === 'loading'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Carregando
          </button>
          <button
            onClick={() => handleStateChange('empty')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors min-h-[32px] ${
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
        showAgentFilter={false}
      />

      {isEmpty ? (
        <EmptyState
          title="Nenhum dado de atendimento"
          description="Não há conversas registradas para o período e filtros selecionados. Aguarde novos atendimentos ou altere os filtros."
        />
      ) : (
        <>
          {/* Agent Filter Active Banner */}
          {selectedAgentFromTable && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
              <span className="text-sm">
                Visualizando dados de <strong>{selectedAgentFromTable}</strong>
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedAgentFromTable(null)}
                className="h-7 text-xs"
              >
                <X className="w-3 h-3 mr-1" /> Limpar filtro
              </Button>
            </div>
          )}

          {/* KPI Cards - Row 1 */}
          <div className="kpi-grid-6">
            <KPICard
              title="Total de Leads"
              subtitle={getAgentContextSubtitle('Contatos únicos que tiveram conversa')}
              value={displayedData.kpis.totalLeads}
              icon={Users}
              iconColor="text-primary"
              iconBgColor="bg-primary/10"
              isLoading={isLoading}
            />
            <KPICard
              title="Conversas Ativas"
              subtitle={getAgentContextSubtitle('Atendimentos em andamento')}
              value={displayedData.kpis.conversasAtivas}
              icon={MessageSquare}
              iconColor="text-info"
              iconBgColor="bg-info/10"
              isLoading={isLoading}
            />
            <KPICard
              title="Agendamentos"
              subtitle={selectedAgentFromTable 
                ? `Dados de ${selectedAgentFromTable}` 
                : (isAdmin ? (selectedAgent !== 'all' ? 'Do agente selecionado' : 'Visão geral da clínica') : 'Seus agendamentos')}
              value={totalAppointments}
              icon={CalendarCheck}
              iconColor="text-success"
              iconBgColor="bg-success/10"
              isLoading={isLoading}
            />
            <KPICard
              title="Atendimentos IA"
              subtitle={getAgentContextSubtitle('Conversas gerenciadas pela IA')}
              value={aiServiceCount}
              icon={Bot}
              iconColor="text-info"
              iconBgColor="bg-info/10"
              isLoading={isLoading}
            />
            <KPICard
              title="Taxa de Transbordo"
              subtitle={getAgentContextSubtitle('IA → Humano')}
              value={displayedData.kpis.taxaTransbordo}
              icon={ArrowRightLeft}
              iconColor="text-warning"
              iconBgColor="bg-warning/10"
              isLoading={isLoading}
            />
          </div>

          {/* KPI Cards - Row 2 (Time metrics + IA vs Human) */}
          <div className="chart-grid">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <KPICard
                title="Tempo Médio Primeira Resposta"
                subtitle={getAgentContextSubtitle('Primeira resposta após mensagem do lead')}
                value={displayedData.kpis.tempoMedioPrimeiraResposta}
                icon={Clock}
                iconColor="text-primary"
                iconBgColor="bg-primary/10"
                isLoading={isLoading}
                className="min-w-0"
              />
              <KPICard
                title="Tempo Médio de Resolução"
                subtitle={getAgentContextSubtitle('Tempo médio até finalizar atendimento')}
                value={displayedData.kpis.tempoMedioResolucao}
                icon={Clock}
                iconColor="text-success"
                iconBgColor="bg-success/10"
                isLoading={isLoading}
              />
            </div>
            <IAvsHumanCard
              percentualIA={displayedData.kpis.percentualIA}
              percentualHumano={displayedData.kpis.percentualHumano}
              isLoading={isLoading}
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HourlyPeakChart data={displayedData.picoPorHora} isLoading={isLoading} />
            <BacklogCard data={displayedData.backlog} isLoading={isLoading} />
          </div>

          {/* Agent Performance Table */}
          <AgentPerformanceTable 
            data={data.agentes} 
            isLoading={isLoading}
            selectedAgentName={selectedAgentFromTable}
            onAgentSelect={setSelectedAgentFromTable}
          />

          {/* Quality & Conversion Cards */}
          <QualityCards data={displayedData.qualidade} isLoading={isLoading} />
        </>
      )}
    </div>
  );
}
