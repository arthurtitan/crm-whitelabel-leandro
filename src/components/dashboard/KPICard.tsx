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
      <CardContent className="p-3 sm:p-4 h-full">
        <div className="flex items-start justify-between gap-2 h-full">
          <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
            {/* Label - uppercase, muted, tracking - wrap natural */}
            <p className="text-[9px] sm:text-[10px] md:text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground leading-tight">
              {title}
            </p>
            {/* KPI Number - responsive size, never wrap */}
            <p className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground leading-tight whitespace-nowrap">
              {value}
            </p>
            {subtitle && (
              <p className="text-[9px] sm:text-[10px] md:text-xs text-muted-foreground leading-snug line-clamp-2">{subtitle}</p>
            )}
            {trend && (
              <p
                className={cn(
                  'text-[9px] sm:text-[10px] md:text-xs font-medium',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% vs período anterior
              </p>
            )}
          </div>
          {/* Icon - muted or primary */}
          <div className={cn('p-1.5 sm:p-2 rounded-lg shrink-0', iconBgColor)}>
            <Icon className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}