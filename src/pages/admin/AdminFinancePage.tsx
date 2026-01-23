import { useState } from 'react';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { EmptyState } from '@/components/dashboard/EmptyState';
import {
  FinanceKPICards,
  RevenueChart,
  PaymentMethodChart,
  FunnelConversionChart,
  SalesTable,
  CreateSaleDialog,
} from '@/components/finance';

type ViewState = 'loading' | 'empty' | 'data';

export default function AdminFinancePage() {
  const [viewState, setViewState] = useState<ViewState>('data');
  const [period, setPeriod] = useState('7d');
  const [channel, setChannel] = useState('all');
  const [type, setType] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState('all');

  const isLoading = viewState === 'loading';
  const isEmpty = viewState === 'empty';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient-gleps-light">Dashboard Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Métricas financeiras e gestão de vendas
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* State Toggle (for demo purposes) */}
          <div className="flex gap-2 mr-4">
            <button
              onClick={() => setViewState('data')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                viewState === 'data'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Com Dados
            </button>
            <button
              onClick={() => setViewState('loading')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                viewState === 'loading'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Carregando
            </button>
            <button
              onClick={() => setViewState('empty')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                viewState === 'empty'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Sem Dados
            </button>
          </div>
          
          <CreateSaleDialog />
        </div>
      </div>

      {/* Global Filters */}
      <DashboardFilters
        onPeriodChange={setPeriod}
        onChannelChange={setChannel}
        onTypeChange={setType}
        onAgentChange={setSelectedAgent}
        showAgentFilter={true}
      />

      {isEmpty ? (
        <EmptyState
          title="Nenhum dado financeiro"
          description="Não há vendas registradas para o período selecionado. Crie sua primeira venda ou altere os filtros."
        />
      ) : (
        <>
          {/* KPI Cards */}
          <FinanceKPICards isLoading={isLoading} />

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevenueChart isLoading={isLoading} />
            <PaymentMethodChart isLoading={isLoading} />
          </div>

          {/* Funnel Conversion */}
          <FunnelConversionChart isLoading={isLoading} />

          {/* Sales Table */}
          <SalesTable isLoading={isLoading} />
        </>
      )}
    </div>
  );
}
