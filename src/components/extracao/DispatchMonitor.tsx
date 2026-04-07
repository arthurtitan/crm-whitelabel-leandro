import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Zap, CheckCircle2, XCircle, Clock, Download, ArrowLeft, Phone, StopCircle, Ban, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DispatchBatch {
  id: string;
  keyword: string | null;
  location: string | null;
  total_contacts: number;
  sent_count: number;
  failed_count: number;
  status: string;
  delay_seconds: number;
  started_at: string;
  completed_at: string | null;
}

interface DispatchLog {
  id: string;
  contact_name: string;
  phone: string;
  inbox_id: number;
  inbox_name: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
}

interface Props {
  accountId: string;
  activeBatchId?: string | null;
}

export function DispatchMonitor({ accountId, activeBatchId }: Props) {
  const { toast } = useToast();
  const [batches, setBatches] = useState<DispatchBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<DispatchBatch | null>(null);
  const [logs, setLogs] = useState<DispatchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  // Load batches
  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from('dispatch_batches')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        console.log('[DispatchMonitor] batches loaded:', data?.length, 'error:', error?.message);
        if (data) setBatches(data as DispatchBatch[]);
        setLoading(false);
      });
  }, [accountId]);

  // Auto-select active batch
  useEffect(() => {
    if (activeBatchId && batches.length > 0) {
      const found = batches.find(b => b.id === activeBatchId);
      if (found) setSelectedBatch(found);
    }
  }, [activeBatchId, batches]);

  // Realtime batch updates
  useEffect(() => {
    if (!accountId) return;
    const channel = supabase
      .channel('dispatch-batches-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dispatch_batches',
      }, (payload) => {
        const updated = payload.new as DispatchBatch;
        setBatches(prev => {
          const exists = prev.find(b => b.id === updated.id);
          if (exists) return prev.map(b => b.id === updated.id ? updated : b);
          return [updated, ...prev];
        });
        if (selectedBatch?.id === updated.id) setSelectedBatch(updated);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [accountId, selectedBatch?.id]);

  // Load logs when batch selected
  useEffect(() => {
    if (!selectedBatch) { setLogs([]); return; }
    supabase
      .from('dispatch_logs')
      .select('*')
      .eq('batch_id', selectedBatch.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setLogs(data as DispatchLog[]);
      });
  }, [selectedBatch?.id]);

  // Realtime log updates
  useEffect(() => {
    if (!selectedBatch) return;
    const channel = supabase
      .channel('dispatch-logs-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dispatch_logs',
        filter: `batch_id=eq.${selectedBatch.id}`,
      }, (payload) => {
        const updated = payload.new as DispatchLog;
        setLogs(prev => {
          const exists = prev.find(l => l.id === updated.id);
          if (exists) return prev.map(l => l.id === updated.id ? updated : l);
          return [...prev, updated];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedBatch?.id]);

  const handleCancel = async (batchId: string) => {
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('dispatch-messages', {
        body: { action: 'cancel', account_id: accountId, batch_id: batchId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Falha ao cancelar');
      toast({ title: 'Disparo cancelado', description: 'Os envios pendentes foram cancelados.' });
    } catch (err: any) {
      toast({ title: 'Erro ao cancelar', description: err.message, variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const exportReport = () => {
    if (!selectedBatch || logs.length === 0) return;
    const headers = ['Contato', 'Telefone', 'Inbox', 'Status', 'Erro', 'Horário'];
    const rows = logs.map(l => [
      l.contact_name, l.phone, l.inbox_name || '', l.status,
      l.error_message || '', l.sent_at ? new Date(l.sent_at).toLocaleTimeString('pt-BR') : '',
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `disparo-${selectedBatch.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'running': return 'Em andamento';
      case 'cancelled': return 'Cancelado';
      default: return 'Falhou';
    }
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'completed': return 'default';
      case 'running': return 'secondary';
      case 'cancelled': return 'outline';
      default: return 'destructive';
    }
  };

  const runningBatches = batches.filter(b => b.status === 'running');

  // Detail view
  if (selectedBatch) {
    const processed = selectedBatch.sent_count + selectedBatch.failed_count;
    const progress = selectedBatch.total_contacts > 0
      ? Math.round((processed / selectedBatch.total_contacts) * 100)
      : 0;

    return (
      <div className="space-y-4">
        {/* Running campaigns switcher */}
        {runningBatches.length > 1 && (
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground mr-1">Campanhas ativas:</span>
                {runningBatches.map(b => (
                  <Button
                    key={b.id}
                    variant={b.id === selectedBatch.id ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setSelectedBatch(b)}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    {b.keyword || 'Campanha'} ({b.sent_count}/{b.total_contacts})
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setSelectedBatch(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant={getStatusVariant(selectedBatch.status)}>
              {getStatusLabel(selectedBatch.status)}
            </Badge>
            {selectedBatch.status === 'running' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleCancel(selectedBatch.id)}
                disabled={cancelling}
              >
                <StopCircle className="w-4 h-4 mr-1" />
                {cancelling ? 'Cancelando...' : 'Parar disparo'}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportReport}>
              <Download className="w-4 h-4 mr-1" />
              Exportar
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold">{selectedBatch.total_contacts}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedBatch.keyword && <span>🔍 {selectedBatch.keyword}</span>}
                {selectedBatch.location && <span> · 📍 {selectedBatch.location}</span>}
                {!selectedBatch.keyword && 'Total de contatos'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-green-600">{selectedBatch.sent_count}</div>
              <p className="text-xs text-muted-foreground mt-1">✅ com sucesso</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-destructive">{selectedBatch.failed_count}</div>
              <p className="text-xs text-muted-foreground mt-1">❌ falha no envio</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="text-xs text-muted-foreground">Número(s) usado(s)</div>
              <div className="text-sm font-medium mt-1 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {[...new Set(logs.map(l => l.inbox_name).filter(Boolean))].join(', ') || '—'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress bar */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso do disparo</span>
              <span className="text-sm text-muted-foreground">
                {processed} de {selectedBatch.total_contacts} contatos processados
              </span>
            </div>
            <Progress
              value={progress}
              className={`h-3 ${selectedBatch.status === 'cancelled' ? '[&>div]:bg-muted-foreground' : selectedBatch.failed_count > 0 ? '[&>div]:bg-gradient-to-r [&>div]:from-green-500 [&>div]:to-green-400' : ''}`}
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-muted-foreground">{processed}/{selectedBatch.total_contacts} contatos</span>
              <span className="text-xs font-medium">{progress}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Log table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Log de envios em tempo real</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contato</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Inbox</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Horário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.contact_name}</TableCell>
                      <TableCell className="text-muted-foreground">{log.phone}</TableCell>
                      <TableCell className="text-xs">{log.inbox_name || '—'}</TableCell>
                      <TableCell>
                        {log.status === 'sent' && (
                          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Enviado
                          </Badge>
                        )}
                        {log.status === 'failed' && (
                          <Badge variant="outline" className="text-destructive border-red-200 bg-red-50">
                            <XCircle className="w-3 h-3 mr-1" /> Erro
                          </Badge>
                        )}
                        {log.status === 'pending' && (
                          <Badge variant="outline" className="text-muted-foreground">
                            <Clock className="w-3 h-3 mr-1" /> Aguardando
                          </Badge>
                        )}
                        {log.status === 'cancelled' && (
                          <Badge variant="outline" className="text-muted-foreground border-muted">
                            <Ban className="w-3 h-3 mr-1" /> Cancelado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {log.sent_at ? new Date(log.sent_at).toLocaleTimeString('pt-BR') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Aguardando início dos envios...
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Batch history list
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          <Clock className="w-5 h-5 animate-spin mr-2" />
          Carregando histórico...
        </CardContent>
      </Card>
    );
  }

  if (batches.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Disparos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Zap className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm font-medium">Nenhum disparo realizado ainda</p>
            <p className="text-xs mt-1">Extraia leads e envie mensagens pela aba Extração</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Histórico de Disparos</h3>
        {runningBatches.length > 0 && (
          <Badge variant="secondary" className="animate-pulse">
            {runningBatches.length} campanha(s) ativa(s)
          </Badge>
        )}
      </div>

      {/* Active campaigns first */}
      {runningBatches.length > 0 && (
        <div className="space-y-2">
          {runningBatches.map(batch => {
            const processed = batch.sent_count + batch.failed_count;
            const progress = batch.total_contacts > 0 ? Math.round((processed / batch.total_contacts) * 100) : 0;
            return (
              <Card
                key={batch.id}
                className="border-primary/30 bg-primary/5 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedBatch(batch)}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-sm flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                        </span>
                        {batch.keyword || 'Disparo manual'}
                        {batch.location && <span className="text-muted-foreground"> · 📍 {batch.location}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Iniciado {new Date(batch.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Em andamento</Badge>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => { e.stopPropagation(); handleCancel(batch.id); }}
                        disabled={cancelling}
                      >
                        <StopCircle className="w-3 h-3 mr-1" /> Parar
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs mb-2">
                    <span className="text-green-600 font-medium">{batch.sent_count} enviados</span>
                    {batch.failed_count > 0 && <span className="text-destructive font-medium">{batch.failed_count} erros</span>}
                    <span className="text-muted-foreground">{batch.total_contacts} total</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Completed / failed batches */}
      {batches.filter(b => b.status !== 'running').map(batch => (
        <Card
          key={batch.id}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setSelectedBatch(batch)}
        >
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-sm">
                  {batch.keyword || 'Disparo manual'}
                  {batch.location && <span className="text-muted-foreground"> · 📍 {batch.location}</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(batch.started_at).toLocaleDateString('pt-BR')} {new Date(batch.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <Badge variant={getStatusVariant(batch.status)}>
                {getStatusLabel(batch.status)}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-green-600 font-medium">{batch.sent_count} enviados</span>
              {batch.failed_count > 0 && <span className="text-destructive font-medium">{batch.failed_count} erros</span>}
              <span className="text-muted-foreground">{batch.total_contacts} total</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
