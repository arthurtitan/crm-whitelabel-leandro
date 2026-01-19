import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { useFinance } from '@/contexts/FinanceContext';
import { CreditCard } from 'lucide-react';
import { PaymentMethod } from '@/types/crm';

interface PaymentMethodChartProps {
  isLoading?: boolean;
}

const COLORS = {
  pix: 'hsl(var(--success))',
  cartao: 'hsl(var(--primary))',
  boleto: 'hsl(var(--warning))',
  dinheiro: 'hsl(142 71% 45%)',
  none: 'hsl(var(--muted-foreground))',
};

const LABELS: Record<PaymentMethod | 'none', string> = {
  pix: 'PIX',
  cartao: 'Cartão',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
  none: 'Não informado',
};

const chartConfig = {
  pix: { label: 'PIX', color: COLORS.pix },
  cartao: { label: 'Cartão', color: COLORS.cartao },
  boleto: { label: 'Boleto', color: COLORS.boleto },
  dinheiro: { label: 'Dinheiro', color: COLORS.dinheiro },
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
            <CardTitle className="text-base font-semibold">
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
          <CardTitle className="text-base font-semibold">
            Distribuição por Método de Pagamento
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">Vendas pagas por forma de pagamento</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[entry.method]}
                  stroke="hsl(var(--background))"
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
                  <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                    <p className="font-medium">{data.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(data.value)} ({percentage}%)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {data.count} venda{data.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ChartContainer>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-4">
          {data.map((item) => {
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
            return (
              <div key={item.method} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[item.method] }}
                />
                <span className="text-sm">
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
