import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { tagsCloudService, type ChatwootLabel, type ImportLabelsResult } from '@/services/tags.cloud.service';

interface ImportChatwootLabelsDialogProps {
  accountId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

export function ImportChatwootLabelsDialog({
  accountId,
  open,
  onOpenChange,
  onImportComplete,
}: ImportChatwootLabelsDialogProps) {
  const [step, setStep] = useState<'loading' | 'select' | 'importing' | 'result'>('loading');
  const [labels, setLabels] = useState<ChatwootLabel[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ImportLabelsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLabels = async () => {
    console.log('[ImportLabels] Starting fetch for account:', accountId);
    setStep('loading');
    setError(null);

    try {
      const fetchedLabels = await tagsCloudService.fetchChatwootLabels(accountId);
      console.log('[ImportLabels] Fetched labels:', fetchedLabels.length);
      setLabels(fetchedLabels);
      setSelectedLabels(new Set(fetchedLabels.map(l => l.id)));
      setStep('select');
    } catch (err) {
      console.error('[ImportLabels] Error fetching labels:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar labels');
      setStep('select');
    }
  };

  // Fetch labels when dialog opens
  useEffect(() => {
    if (open && step === 'loading') {
      fetchLabels();
    }
  }, [open]);

  const handleImport = async () => {
    setStep('importing');

    try {
      console.log('[ImportLabels] Starting import for account:', accountId, 'selected:', selectedLabels.size);
      const importResult = await tagsCloudService.importChatwootLabels(
        accountId,
        Array.from(selectedLabels)
      );
      setResult(importResult);

      if (importResult.success) {
        const changed = (importResult.imported || 0) + (importResult.updated || 0);
        if (changed > 0) {
          toast.success(
            `Importação concluída: ${importResult.imported} importada(s), ${importResult.updated} atualizada(s), ${importResult.skipped} ignorada(s).`
          );
        } else {
          toast.info(`Nenhuma mudança: ${importResult.skipped} label(s) já estavam sincronizadas.`);
        }
        onImportComplete?.();
        // Close dialog after successful import
        handleOpenChange(false);
      } else {
        setStep('result');
        toast.error(importResult.error || 'Erro ao importar labels');
      }
    } catch (err) {
      console.error('Error importing labels:', err);
      setResult({
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        labels: [],
        error: err instanceof Error ? err.message : 'Erro ao importar',
      });
      setStep('result');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setStep('loading');
      setLabels([]);
      setSelectedLabels(new Set());
      setResult(null);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  const toggleLabel = (labelId: number) => {
    setSelectedLabels(prev => {
      const next = new Set(prev);
      if (next.has(labelId)) {
        next.delete(labelId);
      } else {
        next.add(labelId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedLabels.size === labels.length) {
      setSelectedLabels(new Set());
    } else {
      setSelectedLabels(new Set(labels.map(l => l.id)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Importar Labels do Chatwoot
          </DialogTitle>
          <DialogDescription>
            {step === 'loading' && 'Buscando labels do Chatwoot...'}
            {step === 'select' && 'Selecione as labels que deseja importar como etapas do Kanban'}
            {step === 'importing' && 'Importando labels...'}
            {step === 'result' && 'Importação concluída'}
          </DialogDescription>
        </DialogHeader>

        {/* Loading State */}
        {step === 'loading' && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {step === 'select' && error && (
          <div className="py-4 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={fetchLabels}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* Select Labels */}
        {step === 'select' && !error && (
          <div className="space-y-4">
            {labels.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p>Nenhuma label encontrada no Chatwoot.</p>
                <p className="text-sm mt-2">Crie labels no Chatwoot primeiro.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {labels.length} label(s) encontrada(s)
                  </span>
                  <Button variant="ghost" size="sm" onClick={toggleAll}>
                    {selectedLabels.size === labels.length ? 'Desmarcar Todas' : 'Marcar Todas'}
                  </Button>
                </div>

                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-2">
                    {labels.map(label => (
                      <div
                        key={label.id}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleLabel(label.id)}
                      >
                        <Checkbox
                          checked={selectedLabels.has(label.id)}
                          onCheckedChange={() => toggleLabel(label.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: label.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{label.title}</p>
                          {label.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {label.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        )}

        {/* Importing State */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Importando labels como etapas...</p>
          </div>
        )}

        {/* Result State */}
        {step === 'result' && result && (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-4">
              {result.success ? (
                <CheckCircle2 className="w-12 h-12 text-primary" />
              ) : (
                <AlertCircle className="w-12 h-12 text-destructive" />
              )}
            </div>

            <div className="flex justify-center gap-4">
              <Badge variant="secondary" className="text-sm">
                {result.imported} importada(s)
              </Badge>
              <Badge variant="outline" className="text-sm">
                {result.updated} atualizada(s)
              </Badge>
              <Badge variant="outline" className="text-sm text-muted-foreground">
                {result.skipped} ignorada(s)
              </Badge>
            </div>

            {result.labels.length > 0 && (
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-2">
                  {result.labels.map((label, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded bg-muted/50"
                    >
                      <span className="text-sm">{label.name}</span>
                      <Badge
                        variant={
                          label.action === 'imported'
                            ? 'default'
                            : label.action === 'updated'
                            ? 'secondary'
                            : 'outline'
                        }
                        className="text-xs"
                      >
                        {label.action === 'imported' && 'Importada'}
                        {label.action === 'updated' && 'Atualizada'}
                        {label.action === 'skipped' && 'Ignorada'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'select' && !error && labels.length > 0 && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={selectedLabels.size === 0}>
                <Download className="w-4 h-4 mr-2" />
                Importar {selectedLabels.size} Label(s)
              </Button>
            </>
          )}

          {step === 'result' && (
            <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
