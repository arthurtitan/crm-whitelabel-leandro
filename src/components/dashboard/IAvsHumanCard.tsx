import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, User } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
  const [hoveredSegment, setHoveredSegment] = useState<'ia' | 'humano' | null>(null);

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

  const displayValue = hoveredSegment === 'ia' 
    ? percentualIA 
    : hoveredSegment === 'humano' 
    ? percentualHumano 
    : percentualIA;
  
  const displayLabel = hoveredSegment === 'humano' ? 'Humano' : 'IA';

  return (
    <Card className="card-hover h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          IA vs Humano
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          Distribuição de atendimentos
        </p>

        <div className="flex items-center gap-6">
          {/* Donut Chart */}
          <div className="relative w-28 h-28 shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="14"
              />
              {/* IA segment */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={hoveredSegment === 'ia' ? 18 : 14}
                strokeDasharray={`${(percentualIA / 100) * 251.2} 251.2`}
                className={cn(
                  "transition-all duration-300 cursor-pointer",
                  hoveredSegment === 'ia' && "drop-shadow-lg"
                )}
                style={{
                  filter: hoveredSegment === 'ia' ? 'brightness(1.2)' : 'none',
                }}
                onMouseEnter={() => setHoveredSegment('ia')}
                onMouseLeave={() => setHoveredSegment(null)}
              />
              {/* Human segment */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="hsl(var(--success))"
                strokeWidth={hoveredSegment === 'humano' ? 18 : 14}
                strokeDasharray={`${(percentualHumano / 100) * 251.2} 251.2`}
                strokeDashoffset={`-${(percentualIA / 100) * 251.2}`}
                className={cn(
                  "transition-all duration-300 cursor-pointer",
                  hoveredSegment === 'humano' && "drop-shadow-lg"
                )}
                style={{
                  filter: hoveredSegment === 'humano' ? 'brightness(1.2)' : 'none',
                }}
                onMouseEnter={() => setHoveredSegment('humano')}
                onMouseLeave={() => setHoveredSegment(null)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center transition-all duration-200">
                <p className={cn(
                  "text-xl font-bold transition-all duration-200",
                  hoveredSegment === 'humano' ? 'text-success' : 'text-primary'
                )}>
                  {displayValue}%
                </p>
                <p className="text-[10px] text-muted-foreground">{displayLabel}</p>
              </div>
            </div>
          </div>

          {/* Legend - Vertical layout */}
          <div className="flex flex-col gap-3 flex-1">
            <div 
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg transition-all duration-200 cursor-pointer",
                hoveredSegment === 'ia' ? 'bg-primary/10 scale-105' : 'hover:bg-muted/50'
              )}
              onMouseEnter={() => setHoveredSegment('ia')}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              <div className={cn(
                "p-2 rounded-lg bg-primary/10 transition-all duration-200",
                hoveredSegment === 'ia' && "bg-primary/20"
              )}>
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">IA</p>
                <p className="text-xs text-muted-foreground">Atendimento automatizado</p>
              </div>
              <span className={cn(
                "text-lg font-bold transition-all duration-200",
                hoveredSegment === 'ia' ? 'text-primary scale-110' : ''
              )}>
                {percentualIA}%
              </span>
            </div>
            
            <div 
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg transition-all duration-200 cursor-pointer",
                hoveredSegment === 'humano' ? 'bg-success/10 scale-105' : 'hover:bg-muted/50'
              )}
              onMouseEnter={() => setHoveredSegment('humano')}
              onMouseLeave={() => setHoveredSegment(null)}
            >
              <div className={cn(
                "p-2 rounded-lg bg-success/10 transition-all duration-200",
                hoveredSegment === 'humano' && "bg-success/20"
              )}>
                <User className="w-4 h-4 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Humano</p>
                <p className="text-xs text-muted-foreground">Atendimento por agentes</p>
              </div>
              <span className={cn(
                "text-lg font-bold transition-all duration-200",
                hoveredSegment === 'humano' ? 'text-success scale-110' : ''
              )}>
                {percentualHumano}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}