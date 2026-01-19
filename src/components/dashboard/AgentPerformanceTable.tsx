import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AgentData {
  agentName: string;
  atendimentosAssumidos: number;
  atendimentosResolvidos: number;
  tempoMedioResposta: string;
  taxaResolucao: number;
}

interface AgentPerformanceTableProps {
  data: AgentData[];
  isLoading?: boolean;
}

export function AgentPerformanceTable({
  data,
  isLoading = false,
}: AgentPerformanceTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getResolutionColor = (rate: number) => {
    if (rate >= 90) return 'bg-success/10 text-success';
    if (rate >= 70) return 'bg-warning/10 text-warning';
    return 'bg-destructive/10 text-destructive';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Performance por Agente
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead className="text-center">Assumidos</TableHead>
                <TableHead className="text-center">Resolvidos</TableHead>
                <TableHead className="text-center">Tempo Médio</TableHead>
                <TableHead className="text-center">Taxa Resolução</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum dado de agente disponível
                  </TableCell>
                </TableRow>
              ) : (
                data.map((agent, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {getInitials(agent.agentName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{agent.agentName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {agent.atendimentosAssumidos}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {agent.atendimentosResolvidos}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {agent.tempoMedioResposta}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={cn(getResolutionColor(agent.taxaResolucao))}
                      >
                        {agent.taxaResolucao}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
