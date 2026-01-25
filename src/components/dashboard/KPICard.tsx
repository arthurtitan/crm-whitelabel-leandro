import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  subtitle?: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  isLoading?: boolean;
  className?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function KPICard({
  title,
  subtitle,
  value,
  icon: Icon,
  iconColor = 'text-primary',
  iconBgColor = 'bg-primary/10',
  isLoading = false,
  className,
  trend,
}: KPICardProps) {
  if (isLoading) {
    return (
      <Card className={cn(className)}>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('min-w-0 w-full h-full min-h-[100px] sm:min-h-[110px]', className)}>
      <CardContent className="p-3 sm:p-4 h-full flex flex-col justify-center">
        <div className="flex items-start justify-between gap-3">
          {/* Conteúdo textual - sempre tem prioridade */}
          <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
            <p className="text-kpi-label font-medium text-muted-foreground">
              {title}
            </p>
            <p className="text-kpi-value font-semibold text-foreground whitespace-nowrap">
              {value}
            </p>
            {subtitle && (
              <p className="text-kpi-subtitle text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <p
                className={cn(
                  'text-kpi-subtitle font-medium whitespace-nowrap',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </p>
            )}
          </div>
          {/* Icon - oculto em telas < 640px para priorizar valores */}
          <div className={cn('hidden sm:flex p-2 rounded-lg shrink-0', iconBgColor)}>
            <Icon className={cn('w-5 h-5', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}