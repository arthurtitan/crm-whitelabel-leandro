import { RefreshCw, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SyncIndicatorProps {
  isSyncing: boolean;
  lastSyncAt: string | null;
  error?: Error | null;
  className?: string;
}

export function SyncIndicator({ isSyncing, lastSyncAt, error, className }: SyncIndicatorProps) {
  const getStatusIcon = () => {
    if (error) {
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    }
    if (isSyncing) {
      return <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />;
    }
    return <Check className="w-4 h-4 text-success" />;
  };

  const getStatusText = () => {
    if (error) {
      return 'Erro na sincronização';
    }
    if (isSyncing) {
      return 'Sincronizando...';
    }
    if (lastSyncAt) {
      return `Atualizado ${format(new Date(lastSyncAt), "HH:mm", { locale: ptBR })}`;
    }
    return 'Sincronizado';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-300",
              isSyncing && "bg-muted/50",
              error && "bg-destructive/10",
              !isSyncing && !error && "bg-success/10",
              className
            )}
          >
            {getStatusIcon()}
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {isSyncing ? 'Sincronizando' : 'Atualizado'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{getStatusText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
