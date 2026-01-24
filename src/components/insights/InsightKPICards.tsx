import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Target, Users, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsightKPICardsProps {
  faturamento: number;
  ticketMedio: number;
  taxaConversao: number;
  receitaPorLead: number;
  totalLeads: number;
  totalVendas: number;
  previousPeriod?: {
    faturamento: number;
    ticketMedio: number;
    taxaConversao: number;
    receitaPorLead: number;
  };
}

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  variation?: number;
  iconBgClass?: string;
}

function KPICard({ title, value, subtitle, icon, variation, iconBgClass = 'bg-primary/10' }: KPICardProps) {
  const hasVariation = variation !== undefined && !isNaN(variation);
  const isPositive = hasVariation && variation >= 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mt-1 truncate">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {hasVariation && (
              <Badge 
                variant="outline" 
                className={cn(
                  "mt-2 text-xs font-medium",
                  isPositive 
                    ? "text-success border-success/30 bg-success/10" 
                    : "text-destructive border-destructive/30 bg-destructive/10"
                )}
              >
                {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                {isPositive ? '+' : ''}{variation.toFixed(1)}%
              </Badge>
            )}
          </div>
          <div className={cn("p-2 sm:p-3 rounded-lg shrink-0", iconBgClass)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function InsightKPICards({
  faturamento,
  ticketMedio,
  taxaConversao,
  receitaPorLead,
  totalLeads,
  totalVendas,
  previousPeriod,
}: InsightKPICardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const calculateVariation = (current: number, previous: number | undefined) => {
    if (!previous || previous === 0) return undefined;
    return ((current - previous) / previous) * 100;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      <KPICard
        title="Faturamento"
        value={formatCurrency(faturamento)}
        subtitle={`${totalVendas} venda${totalVendas !== 1 ? 's' : ''} paga${totalVendas !== 1 ? 's' : ''}`}
        icon={<DollarSign className="w-5 h-5 text-success" />}
        iconBgClass="bg-success/10"
        variation={calculateVariation(faturamento, previousPeriod?.faturamento)}
      />
      <KPICard
        title="Ticket Médio"
        value={formatCurrency(ticketMedio)}
        subtitle="Valor médio por venda"
        icon={<ShoppingCart className="w-5 h-5 text-primary" />}
        iconBgClass="bg-primary/10"
        variation={calculateVariation(ticketMedio, previousPeriod?.ticketMedio)}
      />
      <KPICard
        title="Taxa de Conversão"
        value={`${taxaConversao.toFixed(1)}%`}
        subtitle="Lead → Venda paga"
        icon={<Target className="w-5 h-5 text-warning" />}
        iconBgClass="bg-warning/10"
        variation={calculateVariation(taxaConversao, previousPeriod?.taxaConversao)}
      />
      <KPICard
        title="Receita por Lead"
        value={formatCurrency(receitaPorLead)}
        subtitle={`${totalLeads} lead${totalLeads !== 1 ? 's' : ''} no período`}
        icon={<Users className="w-5 h-5 text-secondary-foreground" />}
        iconBgClass="bg-secondary"
        variation={calculateVariation(receitaPorLead, previousPeriod?.receitaPorLead)}
      />
    </div>
  );
}
