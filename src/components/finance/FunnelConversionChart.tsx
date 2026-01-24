import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useFinance } from '@/contexts/FinanceContext';
import { useTagContext } from '@/contexts/TagContext';
import { ArrowRight, Users, ShoppingCart, CheckCircle, Settings2 } from 'lucide-react';

interface FunnelConversionChartProps {
  isLoading?: boolean;
}

export function FunnelConversionChart({ isLoading = false }: FunnelConversionChartProps) {
  const { kpis } = useFinance();
  const { stageTags, finalStageIds, toggleFinalStage } = useTagContext();
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[120px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const steps = [
    {
      label: 'Leads Convertidos',
      value: kpis.leadsConvertidos,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      description: 'Leads em etapas finais do funil',
    },
    {
      label: 'Vendas Criadas',
      value: kpis.vendasCriadas,
      icon: ShoppingCart,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      description: 'Vendas registradas no sistema',
    },
    {
      label: 'Vendas Pagas',
      value: kpis.vendasPagasCount,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
      description: 'Vendas confirmadas e pagas',
    },
  ];

  const getConversionRate = (from: number, to: number) => {
    if (from === 0) return '0%';
    return `${((to / from) * 100).toFixed(1)}%`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Conversão Financeira do Funil</CardTitle>
            <p className="text-xs text-muted-foreground">
              Jornada do lead até a venda paga
            </p>
          </div>
          <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <div className="space-y-3">
                <p className="text-sm font-medium">Etapas finais do funil</p>
                <p className="text-xs text-muted-foreground">
                  Selecione quais etapas contam como conversão
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {stageTags.map((stage) => (
                    <label 
                      key={stage.id} 
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded-md transition-colors"
                    >
                      <Checkbox
                        checked={finalStageIds.includes(stage.id)}
                        onCheckedChange={() => toggleFinalStage(stage.id)}
                      />
                      <div 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: stage.color }} 
                      />
                      <span className="text-sm truncate">{stage.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-stretch gap-4">
          {steps.map((step, index) => (
            <div key={step.label} className="flex-1 flex items-center gap-2">
              <div className="flex-1">
                <div className={`p-4 rounded-lg ${step.bgColor} text-center`}>
                  <step.icon className={`w-6 h-6 ${step.color} mx-auto mb-2`} />
                  <p className="text-2xl font-bold">{step.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{step.label}</p>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {step.description}
                </p>
              </div>
              
              {index < steps.length - 1 && (
                <div className="hidden sm:flex flex-col items-center justify-center px-2">
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground mt-1">
                    {getConversionRate(steps[index].value, steps[index + 1].value)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
