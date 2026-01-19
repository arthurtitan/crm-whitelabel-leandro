import { useState } from 'react';
import { mockAccounts, mockUsers } from '@/data/mockData';
import { Account, AccountStatus } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Users,
  Pause,
  Play,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function SuperAdminAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>(mockAccounts);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<Account | null>(null);
  const [deletePassword, setDeletePassword] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    status: 'active' as AccountStatus,
  });

  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch = account.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || account.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getUserCount = (accountId: string) => {
    return mockUsers.filter((u) => u.account_id === accountId).length;
  };

  const handleCreate = () => {
    const newAccount: Account = {
      id: `acc-${Date.now()}`,
      nome: formData.nome,
      timezone: 'America/Sao_Paulo',
      plano: '',
      status: formData.status,
      limite_usuarios: 999,
      chatwoot_account_id: null,
      chatwoot_api_key: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setAccounts([newAccount, ...accounts]);
    setIsCreateOpen(false);
    setFormData({ nome: '', status: 'active' });
    toast.success('Conta criada com sucesso!');
  };

  const handleUpdate = () => {
    if (!editingAccount) return;
    setAccounts(
      accounts.map((a) =>
        a.id === editingAccount.id
          ? { ...editingAccount, updated_at: new Date().toISOString() }
          : a
      )
    );
    setEditingAccount(null);
    toast.success('Conta atualizada com sucesso!');
  };

  const handleDelete = () => {
    if (!deleteAccount || deletePassword !== 'Admin@123') {
      toast.error('Senha incorreta!');
      return;
    }
    setAccounts(accounts.filter((a) => a.id !== deleteAccount.id));
    setDeleteAccount(null);
    setDeletePassword('');
    toast.success('Conta excluída com sucesso!');
  };

  const handleToggleStatus = (account: Account) => {
    const newStatus = account.status === 'active' ? 'paused' : 'active';
    setAccounts(
      accounts.map((a) =>
        a.id === account.id ? { ...a, status: newStatus, updated_at: new Date().toISOString() } : a
      )
    );
    toast.success(`Conta ${newStatus === 'active' ? 'reativada' : 'pausada'} com sucesso!`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Contas</h1>
          <p className="text-muted-foreground">Gerencie todas as contas do sistema</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90 gap-2">
              <Plus className="w-4 h-4" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Conta</DialogTitle>
              <DialogDescription>Adicione uma nova conta ao sistema</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Conta</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Clínica Exemplo"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={!formData.nome}>
                Criar Conta
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
                placeholder="Buscar contas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AccountStatus | 'all')}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="paused">Pausadas</SelectItem>
                <SelectItem value="cancelled">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Total de Usuários</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                      {account.id}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-medium">{account.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>{getUserCount(account.id)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        account.status === 'active'
                          ? 'status-active'
                          : account.status === 'paused'
                          ? 'status-paused'
                          : 'status-cancelled'
                      }
                    >
                      {account.status === 'active'
                        ? 'Ativa'
                        : account.status === 'paused'
                        ? 'Pausada'
                        : 'Cancelada'}
                    </span>
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
                        <DropdownMenuItem onClick={() => setEditingAccount(account)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(account)}>
                          {account.status === 'active' ? (
                            <>
                              <Pause className="w-4 h-4 mr-2" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-2" />
                              Reativar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteAccount(account)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingAccount} onOpenChange={() => setEditingAccount(null)}>
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
                  onValueChange={(v) =>
                    setEditingAccount({ ...editingAccount, status: v as AccountStatus })
                  }
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
            <Button variant="outline" onClick={() => setEditingAccount(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteAccount} onOpenChange={() => setDeleteAccount(null)}>
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
              <strong className="text-foreground">{deleteAccount?.nome}</strong>
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
            <Button variant="outline" onClick={() => setDeleteAccount(null)}>
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
