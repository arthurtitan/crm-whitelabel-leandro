import { useMemo, useState, type DragEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFinance } from '@/contexts/FinanceContext';
import { useTagContext } from '@/contexts/TagContext';
import { CreateSaleDialog } from '@/components/finance/CreateSaleDialog';
import { LeadCard, CreateStageDialog } from '@/components/kanban';
import { Contact, Tag } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface KanbanLead extends Contact {
  stage_id: string | null;
}

export default function AdminKanbanPage() {
  const { user } = useAuth();
  const { contacts } = useFinance();
  const { stageTags, getLeadStageTag, applyStageTag, moveStageTag, deleteStageTag } = useTagContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null);
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [saleContactId, setSaleContactId] = useState<string | null>(null);
  const [deleteConfirmStage, setDeleteConfirmStage] = useState<Tag | null>(null);

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

  const handleDrop = (stageTagId: string) => {
    if (!draggedLead) return;

    const result = applyStageTag({
      contactId: draggedLead,
      tagId: stageTagId,
      source: 'kanban',
      actorType: 'user',
      actorId: user?.id || null,
    });

    const lead = leads.find((l) => l.id === draggedLead);
    const stage = stageTags.find((s) => s.id === stageTagId);

    if (!result.success) {
      toast.error(result.error || 'Erro ao mover lead');
    } else {
      toast.success(`${lead?.nome} movido para ${stage?.name}`);
    }

    setDraggedLead(null);
  };

  const handleMoveStage = (tagId: string, direction: 'left' | 'right') => {
    const result = moveStageTag(tagId, direction);
    if (result.success) {
      toast.success('Etapa reordenada!');
    } else {
      toast.error(result.error || 'Erro ao reordenar');
    }
  };

  const handleDeleteStage = () => {
    if (!deleteConfirmStage) return;

    const result = deleteStageTag(deleteConfirmStage.id);
    if (result.success) {
      toast.success(`Etapa "${deleteConfirmStage.name}" excluída!`);
    } else {
      toast.error(result.error || 'Erro ao excluir etapa');
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
        return <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-500">WhatsApp</Badge>;
      case 'instagram':
        return <Badge variant="secondary" className="text-xs bg-pink-500/10 text-pink-500">Instagram</Badge>;
      case 'site':
        return <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-500">Site</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Manual</Badge>;
    }
  };

  const handleOpenSaleDialog = (leadId: string) => {
    setSaleContactId(leadId);
    setSelectedLead(null);
  };

  return (
    <div className="page-container h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="title-responsive text-foreground">Kanban</h1>
          <p className="text-responsive-sm text-muted-foreground">Gerencie seus leads no funil • Sincronizado com Chatwoot</p>
        </div>
        <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 sm:gap-3 w-full xs:w-auto">
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

      {/* Kanban Board - Horizontal scroll with snap */}
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
                          stage={stage}
                          isDragging={draggedLead === lead.id}
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
              Esta ação também removerá a etiqueta correspondente no Chatwoot.
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

      {saleContactId && (
        <CreateSaleDialog preSelectedContactId={saleContactId} onClose={() => setSaleContactId(null)} />
      )}
    </div>
  );
}
