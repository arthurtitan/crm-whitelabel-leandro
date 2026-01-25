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
    <Card className={cn('min-w-0 w-full h-full min-h-[90px] sm:min-h-[100px]', className)}>
      <CardContent className="p-3 sm:p-4 h-full">
        <div className="flex items-start justify-between gap-2 h-full">
          <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
            {/* Label - fonte fluida com clamp */}
            <p className="text-kpi-label font-medium text-muted-foreground">
              {title}
            </p>
            {/* KPI Number - fonte fluida, sempre visível */}
            <p className="text-kpi-value font-semibold text-foreground">
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
          {/* Icon - hidden on very small screens (< 360px) to prevent overlap */}
          <div className={cn('hidden xs:flex p-1.5 sm:p-2 rounded-lg shrink-0', iconBgColor)}>
            <Icon className={cn('w-4 h-4 sm:w-5 sm:h-5', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}