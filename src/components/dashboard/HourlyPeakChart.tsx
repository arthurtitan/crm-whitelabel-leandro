import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface HourlyData {
  hora: number;
  totalConversas: number;
}

interface HourlyPeakChartProps {
  data: HourlyData[];
  isLoading?: boolean;
}

export function HourlyPeakChart({ data, isLoading = false }: HourlyPeakChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const formattedData = data.map((item) => ({
    ...item,
    horaLabel: `${String(item.hora).padStart(2, '0')}h`,
  }));

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground truncate">
          Pico de Atendimento por Hora
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-6 pt-0 sm:pt-0">
        <div className="h-[200px] sm:h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={formattedData}
              margin={{ top: 5, right: 5, left: -15, bottom: 5 }}
            >
              {/* Grid - #E5E7EB */}
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="horaLabel"
                tick={{ fontSize: 9, fill: '#64748B' }}
                tickLine={false}
                axisLine={false}
                interval={3}
                height={25}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#64748B' }}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
                  fontSize: '12px',
                }}
                labelFormatter={(label) => `Horário: ${label}`}
              />
              {/* Bar - #2563EB (chart-1) */}
              <Bar
                dataKey="totalConversas"
                fill="#2563EB"
                radius={[3, 3, 0, 0]}
                name="Conversas"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}