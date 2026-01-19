import { 
  DollarSign, 
  TrendingUp, 
  ShoppingCart, 
  CheckCircle, 
  Clock, 
  XCircle,
  RotateCcw
} from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { useFinance } from '@/contexts/FinanceContext';

interface FinanceKPICardsProps {
  isLoading?: boolean;
}

export function FinanceKPICards({ isLoading = false }: FinanceKPICardsProps) {
  const { kpis } = useFinance();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Main KPIs - Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Faturamento Bruto"
          subtitle="Vendas pagas no período"
          value={formatCurrency(kpis.faturamentoBruto)}
          icon={DollarSign}
          iconColor="text-success"
          iconBgColor="bg-success/10"
          isLoading={isLoading}
        />
        <KPICard
          title="Ticket Médio"
          subtitle="Valor médio por venda"
          value={formatCurrency(kpis.ticketMedio)}
          icon={TrendingUp}
          iconColor="text-primary"
          iconBgColor="bg-primary/10"
          isLoading={isLoading}
        />
        <KPICard
          title="Total de Vendas"
          subtitle="Pagas + Pendentes"
          value={kpis.totalVendas}
          icon={ShoppingCart}
          iconColor="text-info"
          iconBgColor="bg-info/10"
          isLoading={isLoading}
        />
        <KPICard
          title="Vendas Pagas"
          subtitle={formatCurrency(kpis.vendasPagas.valor)}
          value={kpis.vendasPagas.count}
          icon={CheckCircle}
          iconColor="text-success"
          iconBgColor="bg-success/10"
          isLoading={isLoading}
        />
      </div>

      {/* Secondary KPIs - Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          title="Vendas Pendentes"
          subtitle={formatCurrency(kpis.vendasPendentes.valor)}
          value={kpis.vendasPendentes.count}
          icon={Clock}
          iconColor="text-warning"
          iconBgColor="bg-warning/10"
          isLoading={isLoading}
        />
        <KPICard
          title="Vendas Canceladas"
          subtitle={formatCurrency(kpis.vendasCanceladas.valor)}
          value={kpis.vendasCanceladas.count}
          icon={XCircle}
          iconColor="text-destructive"
          iconBgColor="bg-destructive/10"
          isLoading={isLoading}
        />
        <KPICard
          title="Vendas Estornadas"
          subtitle={formatCurrency(kpis.vendasEstornadas.valor)}
          value={kpis.vendasEstornadas.count}
          icon={RotateCcw}
          iconColor="text-muted-foreground"
          iconBgColor="bg-muted"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
