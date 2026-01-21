import { useState, useMemo } from 'react';
import { useAuth, useRoleAccess } from '@/contexts/AuthContext';
import { useFinance } from '@/contexts/FinanceContext';
import { CreateSaleDialog } from '@/components/finance/CreateSaleDialog';
import { LeadProfileSheet } from '@/components/leads/LeadProfileSheet';
import { AgentFilter } from '@/components/dashboard/AgentFilter';
import { mockFunnelStages, mockUsers } from '@/data/mockData';
import { Contact, ContactOrigin } from '@/types/crm';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Phone,
  Mail,
  MessageSquare,
  DollarSign,
  Eye,
  ExternalLink,
  User as UserIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AdminLeadsPage() {
  const { account, user } = useAuth();
  const { isAdmin } = useRoleAccess();
  const { 
    contacts, 
    leadFunnelStates, 
    createContact, 
    updateContact,
    deleteContact,
    getContactFunnelStageOrder,
    getContactSales,
  } = useFinance();
  const accountId = account?.id || 'acc-1';

  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [saleContactId, setSaleContactId] = useState<string | null>(null);
  const [profileContact, setProfileContact] = useState<Contact | null>(null);

  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    origem: 'manual' as ContactOrigin,
  });

  // Filter by agent if selected (based on sales association)
  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesSearch =
        contact.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.telefone?.includes(searchTerm) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesOrigin = originFilter === 'all' || contact.origem === originFilter;
      
      // Filter by agent - leads are associated via sales they handled
      let matchesAgent = true;
      if (selectedAgent !== 'all' && isAdmin) {
        const contactSales = getContactSales(contact.id);
        matchesAgent = contactSales.some(sale => sale.responsavel_id === selectedAgent);
      }
      
      return matchesSearch && matchesOrigin && matchesAgent;
    });
  }, [contacts, searchTerm, originFilter, selectedAgent, isAdmin, getContactSales]);

  const getStage = (contactId: string) => {
    const state = leadFunnelStates.find((lfs) => lfs.contact_id === contactId);
    if (!state?.funnel_stage_id) return null;
    return mockFunnelStages.find((s) => s.id === state.funnel_stage_id);
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
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">WhatsApp</Badge>;
      case 'instagram':
        return <Badge className="bg-pink-500/10 text-pink-500 border-pink-500/20">Instagram</Badge>;
      case 'site':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Site</Badge>;
      default:
        return <Badge variant="secondary">Manual</Badge>;
    }
  };

  // Check if lead is eligible for sale (ordem >= 3)
  const canCreateSaleForLead = (leadId: string) => {
    const stageOrder = getContactFunnelStageOrder(leadId);
    return stageOrder >= 3;
  };

  const resetForm = () => {
    setFormData({ nome: '', telefone: '', email: '', origem: 'manual' });
  };

  const handleCreate = () => {
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (!formData.telefone.trim()) {
      toast.error('Telefone é obrigatório');
      return;
    }

    const result = createContact({
      nome: formData.nome.trim(),
      telefone: formData.telefone.trim(),
      email: formData.email.trim() || null,
      origem: formData.origem || 'manual',
    });

    if (result.success) {
      setIsCreateOpen(false);
      resetForm();
      toast.success('Lead cadastrado com sucesso!');
    } else {
      toast.error(result.error || 'Erro ao cadastrar lead');
    }
  };

  const handleUpdate = () => {
    if (!editingContact) return;

    const result = updateContact(editingContact.id, {
      nome: editingContact.nome || undefined,
      telefone: editingContact.telefone || undefined,
      email: editingContact.email,
      origem: editingContact.origem || undefined,
    });

    if (result.success) {
      setEditingContact(null);
      toast.success('Lead atualizado com sucesso!');
    } else {
      toast.error(result.error || 'Erro ao atualizar lead');
    }
  };

  const handleDelete = (contactId: string) => {
    const contactSales = getContactSales(contactId);
    if (contactSales.length > 0) {
      toast.error('Não é possível remover lead com vendas registradas');
      return;
    }

    const result = deleteContact(contactId);
    if (result.success) {
      toast.success('Lead removido com sucesso!');
    } else {
      toast.error(result.error || 'Erro ao remover lead');
    }
  };

  const handleOpenChatwoot = (contact: Contact) => {
    // This will open Chatwoot in a new tab when API is integrated
    toast.info('Abrirá conversa no Chatwoot (integração pendente)');
    // window.open(`https://chatwoot.example.com/contacts/${contact.id}`, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">Gerencie todos os leads da conta</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90 gap-2">
              <Plus className="w-4 h-4" />
              Novo Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Lead</DialogTitle>
              <DialogDescription>Adicione um novo lead manualmente</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone *</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="+55 11 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="origem">Origem</Label>
                <Select
                  value={formData.origem || 'manual'}
                  onValueChange={(v) => setFormData({ ...formData, origem: v as ContactOrigin })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="site">Site</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={!formData.nome || !formData.telefone}>
                Cadastrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="site">Site</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Agent Filter - Only for Admins */}
            {isAdmin && user?.role === 'admin' && (
              <AgentFilter value={selectedAgent} onChange={setSelectedAgent} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => {
                const stage = getStage(contact.id);
                const canSell = canCreateSaleForLead(contact.id);
                return (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(contact.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{contact.nome || 'Sem nome'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {contact.telefone && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            {contact.telefone}
                          </div>
                        )}
                        {contact.email && (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {contact.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getOriginBadge(contact.origem)}</TableCell>
                    <TableCell>
                      {stage ? (
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: stage.cor || '#0EA5E9',
                            color: stage.cor || '#0EA5E9',
                          }}
                        >
                          {stage.nome}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(contact.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setProfileContact(contact)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Ficha do Cliente
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenChatwoot(contact)}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Abrir Chatwoot
                          </DropdownMenuItem>
                          {canSell && (
                            <DropdownMenuItem onClick={() => setSaleContactId(contact.id)}>
                              <DollarSign className="w-4 h-4 mr-2" />
                              Criar Venda
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setEditingContact(contact)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(contact.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingContact} onOpenChange={() => setEditingContact(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
            <DialogDescription>Atualize as informações do lead</DialogDescription>
          </DialogHeader>
          {editingContact && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome</Label>
                <Input
                  id="edit-nome"
                  value={editingContact.nome || ''}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, nome: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-telefone">Telefone</Label>
                  <Input
                    id="edit-telefone"
                    value={editingContact.telefone || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, telefone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingContact.email || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, email: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-origem">Origem</Label>
                <Select
                  value={editingContact.origem || 'manual'}
                  onValueChange={(v) =>
                    setEditingContact({ ...editingContact, origem: v as ContactOrigin })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="site">Site</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingContact(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Profile Sheet */}
      <LeadProfileSheet
        contact={profileContact}
        open={!!profileContact}
        onOpenChange={(open) => !open && setProfileContact(null)}
      />

      {/* Sale Dialog (controlled externally) */}
      {saleContactId && (
        <CreateSaleDialog 
          preSelectedContactId={saleContactId}
          onClose={() => setSaleContactId(null)}
        />
      )}
    </div>
  );
}
