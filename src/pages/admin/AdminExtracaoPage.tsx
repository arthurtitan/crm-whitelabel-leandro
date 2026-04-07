import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ExtractionSearchForm } from '@/components/extracao/ExtractionSearchForm';
import { ExtractionResultsTable } from '@/components/extracao/ExtractionResultsTable';
import { DispatchDialog } from '@/components/extracao/DispatchDialog';
import { DispatchMonitor } from '@/components/extracao/DispatchMonitor';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Download, Send, Search, Zap, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ExtractedLead, ApiUsage } from '@/components/extracao/types';

export default function AdminExtracaoPage() {
  const { account } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<ExtractedLead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [usage, setUsage] = useState<ApiUsage | null>(null);
  const [activeTab, setActiveTab] = useState('extracao');
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  const handleSearchResults = useCallback((results: ExtractedLead[], apiUsage?: ApiUsage) => {
    setLeads(results);
    setSelectedIds(new Set(results.map(l => l.id)));
    if (apiUsage) setUsage(apiUsage);
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === leads.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(leads.map(l => l.id)));
  }, [leads, selectedIds.size]);

  const handleRemoveLead = useCallback((id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  const handleExportExcel = useCallback(() => {
    if (leads.length === 0) return;
    const headers = ['Nome', 'Cidade', 'Endereço', 'Telefone', 'Site', 'Avaliação', 'Total Avaliações'];
    const rows = leads.map(l => [
      l.nome, l.cidade, l.endereco, l.telefone, l.site || '',
      l.avaliacao?.toString() || '', l.total_avaliacoes?.toString() || '',
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `prospeccao-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: 'Exportação concluída', description: `${leads.length} leads exportados.` });
  }, [leads, toast]);

  const handleDispatchStarted = useCallback((batchId: string) => {
    setActiveBatchId(batchId);
    setActiveTab('disparos');
  }, []);

  const selectedLeads = leads.filter(l => selectedIds.has(l.id));
  const usagePercent = usage ? Math.min((usage.used / usage.limit) * 100, 100) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prospecção</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Extraia leads do Google Maps e dispare mensagens via WhatsApp
          </p>
        </div>
        {usage && (
          <Card className="w-full sm:w-64">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Uso mensal da API</span>
                <span className="font-medium text-foreground">{usage.used}/{usage.limit}</span>
              </div>
              <Progress value={usagePercent} className="h-2" />
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="extracao" className="gap-2">
            <Search className="w-4 h-4" /> Extração
          </TabsTrigger>
          <TabsTrigger value="disparos" className="gap-2">
            <Zap className="w-4 h-4" /> Disparos
          </TabsTrigger>
          <TabsTrigger value="metricas" className="gap-2">
            <BarChart3 className="w-4 h-4" /> Métricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="extracao" className="space-y-4">
          <ExtractionSearchForm
            accountId={account?.id || ''}
            onResults={handleSearchResults}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
          {leads.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{leads.length} leads encontrados</Badge>
                  {selectedLeads.length > 0 && <Badge variant="outline">{selectedLeads.length} selecionados</Badge>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportExcel}>
                    <Download className="w-4 h-4 mr-2" /> Exportar CSV
                  </Button>
                  <Button size="sm" onClick={() => setDispatchOpen(true)} disabled={selectedLeads.length === 0}>
                    <Send className="w-4 h-4 mr-2" /> Disparar ({selectedLeads.length})
                  </Button>
                </div>
              </div>
              <ExtractionResultsTable
                leads={leads}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onRemove={handleRemoveLead}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="disparos" className="space-y-4">
          <DispatchMonitor accountId={account?.id || ''} activeBatchId={activeBatchId} />
        </TabsContent>

        <TabsContent value="metricas" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card><CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{usage?.used ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Requisições este mês</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{usage?.limit ?? 500}</div>
              <p className="text-xs text-muted-foreground mt-1">Limite mensal</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{leads.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Leads extraídos (sessão)</p>
            </CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      <DispatchDialog
        open={dispatchOpen}
        onOpenChange={setDispatchOpen}
        leads={selectedLeads}
        accountId={account?.id || ''}
        onDispatchStarted={handleDispatchStarted}
      />
    </div>
  );
}
