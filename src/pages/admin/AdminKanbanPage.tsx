import { useMemo, useState, useEffect, useCallback, useRef, type DragEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFinance } from '@/contexts/FinanceContext';
import { CreateSaleDialog } from '@/components/finance/CreateSaleDialog';
import { LeadCard, CreateStageDialog, ImportChatwootLabelsDialog, SyncIndicator } from '@/components/kanban';
import { Contact } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search,
  Phone,
  Mail,
  MessageSquare,
  Clock,
  DollarSign,
  Plus,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Download,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { tagsCloudService, type Tag as CloudTag, type LeadTag } from '@/services/tags.cloud.service';
import { supabase } from '@/integrations/supabase/client';
import { mergeById } from '@/utils/dataSync';

interface KanbanLead extends Contact {
  stage_id: string | null;
}

export default function AdminKanbanPage() {
  const { user, account } = useAuth();
  const { contacts, refetchContacts, isLoadingContacts, isSyncingContacts, lastContactsSync, newContactIds } = useFinance();

  const [stageTags, setStageTags] = useState<CloudTag[]>([]);
  const [leadTags, setLeadTags] = useState<LeadTag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [isSyncingTags, setIsSyncingTags] = useState(false);
  const [lastTagsSync, setLastTagsSync] = useState<string | null>(null);
  const [newLeadTagIds, setNewLeadTagIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null);
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [saleContactId, setSaleContactId] = useState<string | null>(null);
  const [deleteConfirmStage, setDeleteConfirmStage] = useState<CloudTag | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [isSyncingChatwoot, setIsSyncingChatwoot] = useState(false);

  const isFirstTagsLoad = useRef(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const accountId = user?.account_id || account?.id;

  // Clear new lead tag animation after delay
  const clearNewLeadTagIds = useCallback((ids: string[]) => {
    setTimeout(() => {
      setNewLeadTagIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }, 2000);
  }, []);

  // Fetch stage tags and lead_tags with merge strategy
  const fetchTagsData = useCallback(async (isBackground = false) => {
    if (!accountId) {
      setIsLoadingTags(false);
      return;
    }

    if (isFirstTagsLoad.current) {
      setIsLoadingTags(true);
    } else if (isBackground) {
      setIsSyncingTags(true);
    }

    try {
      // Fetch stage tags
      const tags = await tagsCloudService.listStageTags(accountId);
      setStageTags(tags);

      // Fetch all lead_tags for this account's contacts
      const { data: leadTagsData } = await supabase
        .from('lead_tags')
        .select('*');

      const incoming = leadTagsData || [];
      
      setLeadTags(current => {
        if (current.length === 0 || isFirstTagsLoad.current) {
          return incoming;
        }
        
        // Merge with existing data
        const result = mergeById(current, incoming, true);
        
        // Track new items for animation
        if (result.added.length > 0) {
          setNewLeadTagIds(prev => new Set([...prev, ...result.added]));
          clearNewLeadTagIds(result.added);
        }
        
        return result.data;
      });

      setLastTagsSync(new Date().toISOString());
      isFirstTagsLoad.current = false;
    } catch (error) {
      console.error('Error fetching kanban data:', error);
      if (isFirstTagsLoad.current) {
        toast.error('Erro ao carregar etapas');
      }
    } finally {
      setIsLoadingTags(false);
      setIsSyncingTags(false);
    }
  }, [accountId, clearNewLeadTagIds]);

  // Initial fetch
  useEffect(() => {
    fetchTagsData(false);
  }, [fetchTagsData]);

  // Background polling every 30 seconds
  useEffect(() => {
    pollingRef.current = setInterval(() => {
      if (!isFirstTagsLoad.current) {
        fetchTagsData(true);
        refetchContacts();
      }
    }, 30000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchTagsData, refetchContacts]);

  // Get stage tag for a lead
  const getLeadStageTag = useCallback((contactId: string): CloudTag | undefined => {
    const leadTag = leadTags.find(lt => lt.contact_id === contactId);
    if (!leadTag) return undefined;
    return stageTags.find(t => t.id === leadTag.tag_id);
  }, [leadTags, stageTags]);

  const leads: KanbanLead[] = useMemo(() => {
    return contacts
      .map((contact) => {
        const stageTag = getLeadStageTag(contact.id);
        return { ...contact, stage_id: stageTag?.id || null };
      })
      .filter(
        (lead) =>
          !searchTerm ||
          lead.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.telefone?.includes(searchTerm)
      );
  }, [contacts, getLeadStageTag, searchTerm]);

  const getLeadsByStage = (stageTagId: string) => leads.filter((lead) => lead.stage_id === stageTagId);

  const handleDragStart = (leadId: string) => setDraggedLead(leadId);
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault();

  const handleDrop = async (stageTagId: string) => {
    if (!draggedLead) return;

    const lead = leads.find((l) => l.id === draggedLead);
    const stage = stageTags.find((s) => s.id === stageTagId);

    try {
      await tagsCloudService.applyStageTag(draggedLead, stageTagId, 'kanban');
      toast.success(`${lead?.nome} movido para ${stage?.name}`);
      
      // Refresh lead tags
      const { data: leadTagsData } = await supabase
        .from('lead_tags')
        .select('*');
      setLeadTags(leadTagsData || []);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao mover lead');
    }

    setDraggedLead(null);
  };

  const handleMoveStage = async (tagId: string, direction: 'left' | 'right') => {
    const currentIndex = stageTags.findIndex(t => t.id === tagId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= stageTags.length) {
      toast.error('Não é possível mover nessa direção');
      return;
    }

    const adjacentTag = stageTags[newIndex];

    try {
      await tagsCloudService.swapTagOrder(tagId, adjacentTag.id);
      toast.success('Etapa reordenada!');
      fetchTagsData(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao reordenar');
    }
  };

  const handleDeleteStage = async () => {
    if (!deleteConfirmStage) return;

    try {
      await tagsCloudService.deleteTag(deleteConfirmStage.id);
      toast.success(`Etapa "${deleteConfirmStage.name}" excluída!`);
      fetchTagsData(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir etapa');
    }
    setDeleteConfirmStage(null);
  };

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getOriginBadge = (origem: string | null) => {
    switch (origem) {
      case 'whatsapp':
        return <Badge variant="secondary" className="text-xs">WhatsApp</Badge>;
      case 'instagram':
        return <Badge variant="secondary" className="text-xs">Instagram</Badge>;
      case 'site':
        return <Badge variant="secondary" className="text-xs">Site</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Manual</Badge>;
    }
  };

  const handleOpenSaleDialog = (leadId: string) => {
    setSaleContactId(leadId);
    setSelectedLead(null);
  };

  const handleImportComplete = () => {
    fetchTagsData(false);
  };

  const handleSyncChatwoot = async () => {
    if (!accountId || isSyncingChatwoot) return;
    
    setIsSyncingChatwoot(true);
    try {
      const result = await tagsCloudService.syncChatwootContacts(accountId);
      
      if (result.success) {
        const total = result.contacts_created + result.contacts_updated;
        if (total > 0 || result.lead_tags_applied > 0) {
          toast.success(
            `Sincronização concluída: ${result.contacts_created} criado(s), ${result.contacts_updated} atualizado(s), ${result.lead_tags_applied} etapa(s) aplicada(s).`
          );
          // Refresh contacts and lead tags
          await refetchContacts();
          fetchTagsData(false);
        } else {
          toast.info('Nenhuma alteração necessária - tudo sincronizado.');
        }
      } else {
        toast.error(result.errors[0] || 'Erro ao sincronizar contatos');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao sincronizar contatos');
    } finally {
      setIsSyncingChatwoot(false);
    }
  };

  // Check if Chatwoot is configured
  const hasChatwootConfig = Boolean(account?.chatwoot_base_url && account?.chatwoot_account_id && account?.chatwoot_api_key);

  // Check if initial loading (skeleton only on first load)
  const isInitialLoading = isLoadingTags && isLoadingContacts;

  if (isInitialLoading) {
    return (
      <div className="page-container h-[calc(100vh-8rem)]">
        {/* Skeleton Header */}
        <div className="page-header">
          <div className="min-w-0">
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-48" />
          </div>
        </div>
        {/* Skeleton Columns */}
        <div className="flex gap-4 overflow-hidden mt-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-72 flex-shrink-0">
              <Skeleton className="h-[500px] rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="page-header">
        <div className="min-w-0 flex items-center gap-3">
          <div>
            <h1 className="title-responsive text-foreground">Kanban</h1>
            <p className="text-responsive-sm text-muted-foreground">Gerencie seus leads no funil</p>
          </div>
          {/* Sync Indicator - shows when syncing in background */}
          <SyncIndicator 
            isSyncing={isSyncingTags || isSyncingContacts} 
            lastSyncAt={lastTagsSync || lastContactsSync}
          />
        </div>
        <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 sm:gap-3 w-full xs:w-auto">
          {hasChatwootConfig && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 min-h-[40px] sm:min-h-0"
                onClick={handleSyncChatwoot}
                disabled={isSyncingChatwoot}
              >
                {isSyncingChatwoot ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="hidden xs:inline">Sincronizar</span>
                <span className="xs:hidden">Sync</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 min-h-[40px] sm:min-h-0"
                onClick={() => setShowImportDialog(true)}
              >
                <Download className="w-4 h-4" />
                <span className="hidden xs:inline">Importar Labels</span>
                <span className="xs:hidden">Labels</span>
              </Button>
            </>
          )}
          <CreateStageDialog
            trigger={
              <Button variant="outline" size="sm" className="gap-2 min-h-[40px] sm:min-h-0">
                <Plus className="w-4 h-4" />
                <span className="hidden xs:inline">Nova Etapa</span>
                <span className="xs:hidden">Etapa</span>
              </Button>
            }
          />
          <div className="relative w-full xs:w-48 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 min-h-[40px] sm:min-h-0"
            />
          </div>
        </div>
      </div>

      {/* Empty State */}
      {stageTags.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[calc(100%-6rem)] gap-4">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Nenhuma etapa criada</h2>
            <p className="text-muted-foreground">
              {hasChatwootConfig
                ? 'Importe labels do Chatwoot ou crie etapas manualmente.'
                : 'Crie sua primeira etapa para começar a usar o Kanban.'}
            </p>
          </div>
          <div className="flex gap-2">
            {hasChatwootConfig && (
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Download className="w-4 h-4 mr-2" />
                Importar do Chatwoot
              </Button>
            )}
            <CreateStageDialog
              trigger={
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Etapa
                </Button>
              }
            />
          </div>
        </div>
      )}

      {/* Kanban Board - Horizontal scroll with snap */}
      {stageTags.length > 0 && (
        <div className="kanban-container h-[calc(100%-6rem)]">
          {stageTags.map((stage, index) => {
            const stageLeads = getLeadsByStage(stage.id);
            const isFirst = index === 0;
            const isLast = index === stageTags.length - 1;

            return (
              <div
                key={stage.id}
                className="kanban-column kanban-column-snap"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stage.id)}
              >
                <Card className="h-full flex flex-col">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                        <CardTitle className="text-sm font-semibold">{stage.name}</CardTitle>
                        {stage.chatwoot_label_id && (
                          <Badge variant="outline" className="text-xs">Chatwoot</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">{stageLeads.length}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleMoveStage(stage.id, 'left')}
                              disabled={isFirst}
                            >
                              <ChevronLeft className="w-4 h-4 mr-2" />
                              Mover para Esquerda
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleMoveStage(stage.id, 'right')}
                              disabled={isLast}
                            >
                              <ChevronRight className="w-4 h-4 mr-2" />
                              Mover para Direita
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirmStage(stage)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir Etapa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-2 flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                      <div className="space-y-2 pr-2">
                        {stageLeads.map((lead) => (
                          <LeadCard
                            key={lead.id}
                            lead={lead}
                            stage={stage as any}
                            isDragging={draggedLead === lead.id}
                            isNew={newContactIds.has(lead.id) || newLeadTagIds.has(lead.id)}
                            onClick={() => setSelectedLead(lead)}
                            onDragStart={() => handleDragStart(lead.id)}
                          />
                        ))}
                        {stageLeads.length === 0 && (
                          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum lead nesta etapa</div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Lead</DialogTitle>
            <DialogDescription>Informações do lead</DialogDescription>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl bg-primary/10 text-primary">
                    {getInitials(selectedLead.nome)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-bold">{selectedLead.nome || 'Sem nome'}</h3>
                  {getOriginBadge(selectedLead.origem)}
                </div>
              </div>

              <div className="space-y-3">
                {selectedLead.telefone && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Phone className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">{selectedLead.telefone}</p>
                    </div>
                  </div>
                )}
                {selectedLead.email && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedLead.email}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Criado em</p>
                    <p className="font-medium">
                      {format(new Date(selectedLead.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                <Button className="w-full gap-2" variant="outline">
                  <MessageSquare className="w-4 h-4" />
                  Abrir Conversa no Chatwoot
                </Button>
                <Button className="w-full gap-2" onClick={() => handleOpenSaleDialog(selectedLead.id)}>
                  <DollarSign className="w-4 h-4" />
                  Registrar Venda
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmStage} onOpenChange={(open) => !open && setDeleteConfirmStage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Etapa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a etapa "{deleteConfirmStage?.name}"?
              {deleteConfirmStage?.chatwoot_label_id && (
                <>
                  <br /><br />
                  <strong>Nota:</strong> Esta etapa está sincronizada com o Chatwoot. A label não será excluída automaticamente.
                </>
              )}
              <br /><br />
              <strong>Atenção:</strong> Etapas com leads não podem ser excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Chatwoot Labels Dialog */}
      {accountId && (
        <ImportChatwootLabelsDialog
          accountId={accountId}
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          onImportComplete={handleImportComplete}
        />
      )}

      {saleContactId && (
        <CreateSaleDialog preSelectedContactId={saleContactId} onClose={() => setSaleContactId(null)} />
      )}
    </div>
  );
}
