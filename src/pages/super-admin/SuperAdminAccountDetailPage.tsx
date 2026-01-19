import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { mockAccounts, mockUsers, mockSales, mockConversations, mockContacts } from '@/data/mockData';
import { Account, AccountStatus } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Building2,
  Edit,
  Trash2,
  Users,
  Calendar,
  Clock,
  MessageSquare,
  DollarSign,
  Globe,
  UserCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function SuperAdminAccountDetailPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  
  const [account, setAccount] = useState<Account | null>(
    mockAccounts.find((a) => a.id === accountId) || null
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Building2 className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Conta não encontrada</h2>
        <p className="text-muted-foreground">A conta com ID {accountId} não existe.</p>
        <Button onClick={() => navigate('/super-admin/accounts')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Contas
        </Button>
      </div>
    );
  }

  // Extract numeric ID from account.id (e.g., "acc-1" -> "1")
  const numericId = account.id.replace(/\D/g, '');

  // Get account stats
  const accountUsers = mockUsers.filter((u) => u.account_id === account.id);
  const accountContacts = mockContacts.filter((c) => c.account_id === account.id);
  const accountConversations = mockConversations.filter((c) => c.account_id === account.id);
  const accountSales = mockSales.filter((s) => s.account_id === account.id);
  const totalRevenue = accountSales.filter((s) => s.status === 'paid').reduce((sum, s) => sum + s.valor, 0);

  const handleEdit = () => {
    setEditingAccount({ ...account });
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editingAccount) return;
    setAccount({ ...editingAccount, updated_at: new Date().toISOString() });
    setIsEditOpen(false);
    toast.success('Conta atualizada com sucesso!');
  };

  const handleDelete = () => {
    if (deletePassword !== 'Admin@123') {
      toast.error('Senha incorreta!');
      return;
    }
    toast.success('Conta excluída com sucesso!');
    navigate('/super-admin/accounts');
  };

  const getStatusBadge = (status: AccountStatus) => {
    switch (status) {
      case 'active':
        return <span className="status-active">Ativa</span>;
      case 'paused':
        return <span className="status-paused">Pausada</span>;
      case 'cancelled':
        return <span className="status-cancelled">Cancelada</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/super-admin/accounts')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Conta + {account.nome}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    ID: {numericId}
                  </code>
                  {getStatusBadge(account.status)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleEdit}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
          <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="card-gradient border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{accountUsers.length}</p>
                <p className="text-xs text-muted-foreground">Usuários</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-gradient border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <UserCircle className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{accountContacts.length}</p>
                <p className="text-xs text-muted-foreground">Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-gradient border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{accountConversations.length}</p>
                <p className="text-xs text-muted-foreground">Conversas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-gradient border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-xs text-muted-foreground">Faturamento</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Details */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="card-gradient border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Informações da Conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">ID</span>
              <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{numericId}</code>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium">{account.nome}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Status</span>
              {getStatusBadge(account.status)}
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Timezone</span>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span>{account.timezone}</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Limite de Usuários</span>
              <span>{account.limite_usuarios}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-gradient border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Datas e Timestamps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Criado em
              </span>
              <span className="font-medium">
                {format(new Date(account.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Hora de criação
              </span>
              <span>{format(new Date(account.created_at), 'HH:mm:ss', { locale: ptBR })}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Última atualização
              </span>
              <span className="font-medium">
                {format(new Date(account.updated_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Hora da atualização
              </span>
              <span>{format(new Date(account.updated_at), 'HH:mm:ss', { locale: ptBR })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chatwoot Integration */}
      <Card className="card-gradient border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Integração Chatwoot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Chatwoot Account ID</span>
              {account.chatwoot_account_id ? (
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">{account.chatwoot_account_id}</code>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Não configurado</Badge>
              )}
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-muted-foreground">Chatwoot API Key</span>
              {account.chatwoot_api_key ? (
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">••••••••</code>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Não configurado</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card className="card-gradient border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Usuários da Conta ({accountUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accountUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum usuário vinculado a esta conta.</p>
          ) : (
            <div className="space-y-2">
              {accountUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-medium">{user.nome.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium">{user.nome}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{user.role}</Badge>
                    <span className={user.status === 'active' ? 'status-active' : 'status-paused'}>
                      {user.status === 'active' ? 'Ativo' : user.status === 'suspended' ? 'Suspenso' : 'Inativo'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Conta</DialogTitle>
            <DialogDescription>Atualize os dados da conta</DialogDescription>
          </DialogHeader>
          {editingAccount && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome da Conta</Label>
                <Input
                  id="edit-nome"
                  value={editingAccount.nome}
                  onChange={(e) => setEditingAccount({ ...editingAccount, nome: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editingAccount.status}
                  onValueChange={(v) => setEditingAccount({ ...editingAccount, status: v as AccountStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Excluir Conta</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Digite sua senha de Super Admin para confirmar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Você está prestes a excluir a conta:{' '}
              <strong className="text-foreground">{account.nome}</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="delete-password">Senha do Super Admin</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Digite sua senha"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir Permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
