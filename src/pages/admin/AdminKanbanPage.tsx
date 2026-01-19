import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  mockContacts,
  mockFunnels,
  mockFunnelStages,
  mockLeadFunnelStates,
  mockConversations,
} from '@/data/mockData';
import { Contact, FunnelStage } from '@/types/crm';
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
} from '@/components/ui/dialog';
import { Search, Phone, Mail, MessageSquare, GripVertical, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface KanbanLead extends Contact {
  stage_id: string | null;
  last_message?: string;
}

export default function AdminKanbanPage() {
  const { account } = useAuth();
  const accountId = account?.id || 'acc-1';

  // Get funnel for this account
  const funnel = mockFunnels.find((f) => f.account_id === accountId);
  const stages = mockFunnelStages
    .filter((s) => s.funnel_id === funnel?.id)
    .sort((a, b) => a.ordem - b.ordem);

  // Build leads with their stage
  const [leadStates, setLeadStates] = useState(
    mockLeadFunnelStates.filter((lfs) =>
      mockContacts.some((c) => c.id === lfs.contact_id && c.account_id === accountId)
    )
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null);
  const [draggedLead, setDraggedLead] = useState<string | null>(null);

  const leads: KanbanLead[] = useMemo(() => {
    return mockContacts
      .filter((c) => c.account_id === accountId)
      .map((contact) => {
        const state = leadStates.find((lfs) => lfs.contact_id === contact.id);
        return {
          ...contact,
          stage_id: state?.funnel_stage_id || null,
        };
      })
      .filter(
        (lead) =>
          !searchTerm ||
          lead.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.telefone?.includes(searchTerm)
      );
  }, [accountId, leadStates, searchTerm]);

  const getLeadsByStage = (stageId: string) => {
    return leads.filter((lead) => lead.stage_id === stageId);
  };

  const handleDragStart = (leadId: string) => {
    setDraggedLead(leadId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (stageId: string) => {
    if (!draggedLead) return;

    // Update lead state
    setLeadStates((prev) => {
      const existing = prev.find((lfs) => lfs.contact_id === draggedLead);
      if (existing) {
        return prev.map((lfs) =>
          lfs.contact_id === draggedLead
            ? { ...lfs, funnel_stage_id: stageId, updated_at: new Date().toISOString() }
            : lfs
        );
      }
      return [
        ...prev,
        {
          contact_id: draggedLead,
          funnel_stage_id: stageId,
          updated_at: new Date().toISOString(),
        },
      ];
    });

    const lead = leads.find((l) => l.id === draggedLead);
    const stage = stages.find((s) => s.id === stageId);
    toast.success(`${lead?.nome} movido para ${stage?.nome}`);
    
    // Event: lead.stage.changed would be created here
    setDraggedLead(null);
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

  return (
    <div className="space-y-6 animate-fade-in h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Kanban</h1>
          <p className="text-muted-foreground">
            Gerencie seus leads no funil • Sincronizado com Chatwoot
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100%-6rem)]">
        {stages.map((stage) => {
          const stageLeads = getLeadsByStage(stage.id);
          return (
            <div
              key={stage.id}
              className="flex-shrink-0 w-80"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(stage.id)}
            >
              <Card className="h-full flex flex-col">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stage.cor || '#0EA5E9' }}
                      />
                      <CardTitle className="text-sm font-semibold">{stage.nome}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {stageLeads.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-2 flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="space-y-2 pr-2">
                      {stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => handleDragStart(lead.id)}
                          onClick={() => setSelectedLead(lead)}
                          className={`p-3 rounded-lg bg-card border border-border cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${
                            draggedLead === lead.id ? 'opacity-50 scale-95' : ''
                          }`}
                          style={{ borderLeftColor: stage.cor || '#0EA5E9', borderLeftWidth: 3 }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {getInitials(lead.nome)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-sm truncate">
                                  {lead.nome || 'Sem nome'}
                                </span>
                              </div>
                              {lead.telefone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                  <Phone className="w-3 h-3" />
                                  {lead.telefone}
                                </p>
                              )}
                              <div className="flex items-center justify-between mt-2">
                                {getOriginBadge(lead.origem)}
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(lead.updated_at), 'dd/MM', { locale: ptBR })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {stageLeads.length === 0 && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          Nenhum lead nesta etapa
                        </div>
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
            <DialogDescription>Informações e histórico do lead</DialogDescription>
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
                      {format(new Date(selectedLead.created_at), "dd 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button className="w-full gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Abrir Conversa no Chatwoot
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
