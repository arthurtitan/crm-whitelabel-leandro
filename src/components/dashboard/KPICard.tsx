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
    <Card className={cn('min-w-0', className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0 flex-1">
            {/* Label - uppercase, muted, tracking - sem truncate para texto completo */}
            <p className="text-[10px] sm:text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground leading-tight">
              {title}
            </p>
            {/* KPI Number - responsive size */}
            <p className="text-xl sm:text-2xl lg:text-[28px] font-semibold text-foreground leading-tight">
              {value}
            </p>
            {subtitle && (
              <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2 break-words">{subtitle}</p>
            )}
            {trend && (
              <p
                className={cn(
                  'text-[10px] sm:text-xs font-medium',
                  trend.isPositive ? 'text-success' : 'text-destructive'
                )}
              >
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% vs período anterior
              </p>
            )}
          </div>
          {/* Icon - muted or primary */}
          <div className={cn('p-2 sm:p-2.5 rounded-lg shrink-0', iconBgColor)}>
            <Icon className={cn('w-4 h-4 sm:w-5 sm:h-5', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}