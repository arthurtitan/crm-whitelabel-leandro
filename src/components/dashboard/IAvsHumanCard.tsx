import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface IAvsHumanCardProps {
  percentualIA: number;
  percentualHumano: number;
  isLoading?: boolean;
}

export function IAvsHumanCard({
  percentualIA,
  percentualHumano,
  isLoading = false,
}: IAvsHumanCardProps) {
  if (isLoading) {
    return (
      <Card className="card-hover">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-32 rounded-full mx-auto" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = percentualIA + percentualHumano;
  const iaDegrees = (percentualIA / total) * 360;

  return (
    <Card className="card-hover">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          IA vs Humano
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Distribuição de atendimentos
        </p>

        {/* Donut Chart */}
        <div className="flex justify-center">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="12"
              />
              {/* IA segment */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="12"
                strokeDasharray={`${(percentualIA / 100) * 251.2} 251.2`}
                className="transition-all duration-500"
              />
              {/* Human segment */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="hsl(var(--success))"
                strokeWidth="12"
                strokeDasharray={`${(percentualHumano / 100) * 251.2} 251.2`}
                strokeDashoffset={`-${(percentualIA / 100) * 251.2}`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-lg font-bold">{percentualIA}%</p>
                <p className="text-xs text-muted-foreground">IA</p>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-sm">IA</span>
            </div>
            <span className="text-sm font-semibold">{percentualIA}%</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success" />
              <User className="w-4 h-4 text-success" />
              <span className="text-sm">Humano</span>
            </div>
            <span className="text-sm font-semibold">{percentualHumano}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
