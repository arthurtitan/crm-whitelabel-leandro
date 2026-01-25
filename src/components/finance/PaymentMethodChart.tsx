import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
} from '@/components/ui/chart';
import { PieChart, Pie, Cell } from 'recharts';
import { useFinance } from '@/contexts/FinanceContext';
import { CreditCard } from 'lucide-react';
import { PaymentMethod } from '@/types/crm';

interface PaymentMethodChartProps {
  isLoading?: boolean;
}

// Chart colors from design system - fixed palette
const COLORS: Record<PaymentMethod | 'none', string> = {
  pix: '#16A34A',       // chart-2 green
  debito: '#2563EB',    // chart-1 blue
  credito: '#3B82F6',   // blue variant
  boleto: '#F59E0B',    // chart-3 yellow
  dinheiro: '#22C55E',  // green variant
  convenio: '#8B5CF6',  // purple
  none: '#94A3B8',      // muted
};

const LABELS: Record<PaymentMethod | 'none', string> = {
  pix: 'PIX',
  debito: 'Débito',
  credito: 'Crédito',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
  convenio: 'Convênio',
  none: 'Não informado',
};

const chartConfig = {
  pix: { label: 'PIX', color: COLORS.pix },
  debito: { label: 'Débito', color: COLORS.debito },
  credito: { label: 'Crédito', color: COLORS.credito },
  boleto: { label: 'Boleto', color: COLORS.boleto },
  dinheiro: { label: 'Dinheiro', color: COLORS.dinheiro },
  convenio: { label: 'Convênio', color: COLORS.convenio },
  none: { label: 'Não informado', color: COLORS.none },
} satisfies ChartConfig;

export function PaymentMethodChart({ isLoading = false }: PaymentMethodChartProps) {
  const { kpis } = useFinance();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const data = kpis.porMetodoPagamento.map((item) => ({
    name: LABELS[item.method],
    value: item.valor,
    count: item.count,
    method: item.method,
  }));

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <CardTitle className="text-base font-semibold text-foreground">
              Distribuição por Método de Pagamento
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhuma venda paga no período
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <CardTitle className="text-base font-semibold text-foreground">
            Distribuição por Método de Pagamento
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">Vendas pagas por forma de pagamento</p>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <ChartContainer config={chartConfig} className="h-[180px] sm:h-[220px] md:h-[260px] w-full">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="70%"
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[entry.method]}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <ChartTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const data = payload[0].payload;
                const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
                return (
                  <div className="bg-card border border-border rounded-lg p-2 sm:p-3 shadow-card">
                    <p className="font-medium text-foreground text-sm">{data.name}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {formatCurrency(data.value)} ({percentage}%)
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {data.count} venda{data.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ChartContainer>

        {/* Legend - responsive grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-3 sm:mt-4">
          {data.map((item) => {
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
            return (
              <div key={item.method} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div
                  className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[item.method] }}
                />
                <span className="text-[10px] sm:text-xs md:text-sm text-foreground truncate">
                  {item.name} ({percentage}%)
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}