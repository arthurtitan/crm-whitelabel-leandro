import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ExtractionSearchForm } from '@/components/extracao/ExtractionSearchForm';
import { ExtractionResultsTable } from '@/components/extracao/ExtractionResultsTable';
import { DispatchDialog } from '@/components/extracao/DispatchDialog';
import { Button } from '@/components/ui/button';
import { Download, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ExtractedLead } from '@/components/extracao/types';

export default function AdminExtracaoPage() {
  const { account } = useAuth();
  const { toast } = useToast();
  const [leads, setLeads] = useState<ExtractedLead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);

  const handleSearchResults = useCallback((results: ExtractedLead[]) => {
    setLeads(results);
    setSelectedIds(new Set(results.map(l => l.id)));
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.id)));
    }
  }, [leads, selectedIds.size]);

  const handleRemoveLead = useCallback((id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleExportExcel = useCallback(() => {
    if (leads.length === 0) return;
    const headers = ['Nome', 'Cidade', 'Endereço', 'Telefone', 'Site'];
    const rows = leads.map(l => [l.nome, l.cidade, l.endereco, l.telefone, l.site || '']);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracao-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exportação concluída', description: `${leads.length} leads exportados.` });
  }, [leads, toast]);

  const selectedLeads = leads.filter(l => selectedIds.has(l.id));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Extração de Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Busque leads no Google Maps por nicho e localização
          </p>
        </div>
        {leads.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
            <Button
              size="sm"
              onClick={() => setDispatchOpen(true)}
              disabled={selectedLeads.length === 0}
            >
              <Send className="w-4 h-4 mr-2" />
              Disparar ({selectedLeads.length})
            </Button>
          </div>
        )}
      </div>

      <ExtractionSearchForm
        accountId={account?.id || ''}
        onResults={handleSearchResults}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
      />

      {leads.length > 0 && (
        <ExtractionResultsTable
          leads={leads}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onRemove={handleRemoveLead}
        />
      )}

      <DispatchDialog
        open={dispatchOpen}
        onOpenChange={setDispatchOpen}
        leads={selectedLeads}
        accountId={account?.id || ''}
      />
    </div>
  );
}
