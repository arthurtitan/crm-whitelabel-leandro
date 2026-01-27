import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountsCloudService, Account } from '@/services/accounts.cloud.service';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

type AccountStatus = 'active' | 'paused' | 'cancelled';
type Language = 'pt' | 'en';
type ConnectionStatus = 'idle' | 'loading' | 'success' | 'error';

interface CreateFormData {
  nome: string;
  idioma: Language;
  status: AccountStatus;
  limiteAgentes: number;
  chatwootEnabled: boolean;
  chatwootBaseUrl: string;
  chatwootAccountId: string;
  chatwootApiKey: string;
}

const initialFormData: CreateFormData = {
  nome: '',
  idioma: 'pt',
  status: 'active',
  limiteAgentes: 10,
  chatwootEnabled: false,
  chatwootBaseUrl: '',
  chatwootAccountId: '',
  chatwootApiKey: '',
};

export default function SuperAdminAccountsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<Account | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateFormData>(initialFormData);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Load accounts from database
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      const data = await accountsCloudService.list();
      setAccounts(data);
    } catch (error: any) {
      toast.error('Erro ao carregar contas: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch = account.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || account.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleTestConnection = async () => {
    setConnectionStatus('loading');
    setConnectionError(null);
    
    const result = await accountsCloudService.testChatwootConnection(
      formData.chatwootBaseUrl,
      formData.chatwootAccountId,
      formData.chatwootApiKey
    );

    if (result.success) {
      setConnectionStatus('success');
      toast.success('Conexão estabelecida com sucesso!');
    } else {
      setConnectionStatus('error');
      setConnectionError(result.message);
      toast.error(result.message);
    }
  };

  const handleCreate = async () => {
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      setIsSaving(true);
      await accountsCloudService.create({
        nome: formData.nome,
        chatwoot_base_url: formData.chatwootEnabled ? formData.chatwootBaseUrl : undefined,
        chatwoot_account_id: formData.chatwootEnabled ? formData.chatwootAccountId : undefined,
        chatwoot_api_key: formData.chatwootEnabled ? formData.chatwootApiKey : undefined,
      });
      
      await loadAccounts();
      setIsCreateOpen(false);
      resetForm();
      toast.success('Conta criada com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao criar conta: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setConnectionStatus('idle');
    setConnectionError(null);
  };

  const handleUpdate = async () => {
    if (!editingAccount) return;

    try {
      setIsSaving(true);
      await accountsCloudService.update(editingAccount.id, {
        nome: editingAccount.nome,
        status: editingAccount.status,
        chatwoot_base_url: editingAccount.chatwoot_base_url,
        chatwoot_account_id: editingAccount.chatwoot_account_id,
        chatwoot_api_key: editingAccount.chatwoot_api_key,
      });
      
      await loadAccounts();
      setEditingAccount(null);
      toast.success('Conta atualizada com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao atualizar conta: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteAccount || deletePassword !== 'Admin@123') {
      toast.error('Senha incorreta!');
      return;
    }

    try {
      setIsSaving(true);
      await accountsCloudService.delete(deleteAccount.id);
      await loadAccounts();
      setDeleteAccount(null);
      setDeletePassword('');
      toast.success('Conta excluída com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao excluir conta: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (account: Account) => {
    const newStatus = account.status === 'active' ? 'paused' : 'active';
    
    try {
      await accountsCloudService.update(account.id, { status: newStatus });
      await loadAccounts();
      toast.success(`Conta ${newStatus === 'active' ? 'reativada' : 'pausada'} com sucesso!`);
    } catch (error: any) {
      toast.error('Erro ao alterar status: ' + error.message);
    }
  };

  const canTestConnection = formData.chatwootEnabled && 
    formData.chatwootBaseUrl.trim() !== '' &&
    formData.chatwootAccountId.trim() !== '' && 
    formData.chatwootApiKey.trim() !== '';

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Contas</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Gerencie todas as contas do sistema</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsCreateOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              <Plus className="w-4 h-4" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Criar Nova Conta</DialogTitle>
              <DialogDescription>Adicione uma nova conta ao sistema</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 overflow-y-auto flex-1 px-1">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Clínica Exemplo"
                />
              </div>

              {/* Idioma */}
              <div className="space-y-2">
                <Label htmlFor="idioma">Idioma</Label>
                <Select
                  value={formData.idioma}
                  onValueChange={(v) => setFormData({ ...formData, idioma: v as Language })}
                >
                  <SelectTrigger id="idioma">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt">Português</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Chatwoot Integration */}
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="chatwoot-toggle" className="text-sm font-medium">
                      Integração Chatwoot
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Habilitar para sincronizar agentes do Chatwoot
                    </p>
                  </div>
                  <Switch
                    id="chatwoot-toggle"
                    checked={formData.chatwootEnabled}
                    onCheckedChange={(checked) => {
                      setFormData({ ...formData, chatwootEnabled: checked });
                      if (!checked) {
                        setConnectionStatus('idle');
                        setConnectionError(null);
                      }
                    }}
                  />
                </div>

                {formData.chatwootEnabled && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="chatwootBaseUrl">URL da Instância</Label>
                      <Input
                        id="chatwootBaseUrl"
                        value={formData.chatwootBaseUrl}
                        onChange={(e) => setFormData({ ...formData, chatwootBaseUrl: e.target.value })}
                        placeholder="https://app.chatwoot.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chatwootAccountId">Account ID</Label>
                      <Input
                        id="chatwootAccountId"
                        value={formData.chatwootAccountId}
                        onChange={(e) => setFormData({ ...formData, chatwootAccountId: e.target.value })}
                        placeholder="ID da conta no Chatwoot"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chatwootApiKey">API Key</Label>
                      <Input
                        id="chatwootApiKey"
                        type="password"
                        value={formData.chatwootApiKey}
                        onChange={(e) => setFormData({ ...formData, chatwootApiKey: e.target.value })}
                        placeholder="Access Token do usuário"
                      />
                    </div>

                    {/* Test Connection Button */}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      disabled={!canTestConnection || connectionStatus === 'loading'}
                      onClick={handleTestConnection}
                    >
                      {connectionStatus === 'loading' && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      {connectionStatus === 'success' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                      {connectionStatus === 'error' && (
                        <XCircle className="w-4 h-4 text-destructive" />
                      )}
                      {connectionStatus === 'idle' && <RefreshCw className="w-4 h-4" />}
                      Testar Conexão
                    </Button>

                    {connectionStatus === 'error' && connectionError && (
                      <p className="text-xs text-destructive">{connectionError}</p>
                    )}
                    {connectionStatus === 'success' && (
                      <p className="text-xs text-emerald-500">Conexão estabelecida!</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="flex-shrink-0">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={!formData.nome.trim() || isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar Conta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as AccountStatus | 'all')}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="paused">Pausadas</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadAccounts} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[150px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Conta</TableHead>
                  <TableHead>Usuários</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Chatwoot</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma conta encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono text-xs">
                        {account.id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-primary" />
                          </div>
                          <span className="font-medium">{account.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          {account.users_count || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={account.status === 'active' ? 'default' : 'secondary'}
                          className={
                            account.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                          }
                        >
                          {account.status === 'active' ? 'Ativa' : 'Pausada'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {account.chatwoot_account_id ? (
                          <Badge variant="outline" className="text-xs">
                            ID: {account.chatwoot_account_id}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">Não configurado</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(account.created_at), "dd/MM/yyyy", { locale: ptBR })}
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
                            <DropdownMenuItem onClick={() => navigate(`/super-admin/accounts/${account.id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
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
                              onClick={() => setDeleteAccount(account)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Conta</DialogTitle>
            <DialogDescription>Atualize as informações da conta</DialogDescription>
          </DialogHeader>
          {editingAccount && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome</Label>
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
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-chatwoot-url">URL Chatwoot</Label>
                <Input
                  id="edit-chatwoot-url"
                  value={editingAccount.chatwoot_base_url || ''}
                  onChange={(e) => setEditingAccount({ ...editingAccount, chatwoot_base_url: e.target.value })}
                  placeholder="https://app.chatwoot.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-chatwoot-id">Account ID Chatwoot</Label>
                <Input
                  id="edit-chatwoot-id"
                  value={editingAccount.chatwoot_account_id || ''}
                  onChange={(e) => setEditingAccount({ ...editingAccount, chatwoot_account_id: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAccount(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteAccount} onOpenChange={(open) => !open && setDeleteAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Conta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a conta "{deleteAccount?.nome}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="delete-password">Digite sua senha para confirmar</Label>
            <Input
              id="delete-password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Sua senha"
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletePassword('')}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
