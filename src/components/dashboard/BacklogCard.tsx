import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BacklogData {
  ate15min: number;
  de15a60min: number;
  acima60min: number;
}

interface BacklogCardProps {
  data: BacklogData;
  isLoading?: boolean;
}

export function BacklogCard({ data, isLoading = false }: BacklogCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = data.ate15min + data.de15a60min + data.acima60min;

  const backlogItems = [
    {
      label: 'Até 15 minutos',
      value: data.ate15min,
      percentage: total > 0 ? (data.ate15min / total) * 100 : 0,
      icon: Clock,
      color: 'bg-success',
      textColor: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: '15 a 60 minutos',
      value: data.de15a60min,
      percentage: total > 0 ? (data.de15a60min / total) * 100 : 0,
      icon: AlertTriangle,
      color: 'bg-warning',
      textColor: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      label: 'Acima de 60 minutos',
      value: data.acima60min,
      percentage: total > 0 ? (data.acima60min / total) * 100 : 0,
      icon: AlertCircle,
      color: 'bg-destructive',
      textColor: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Backlog de Atendimento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {backlogItems.map((item) => (
            <div
              key={item.label}
              className={cn('p-4 rounded-lg', item.bgColor)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <item.icon className={cn('w-4 h-4', item.textColor)} />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                <span className="text-lg font-bold">{item.value}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', item.color)}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
