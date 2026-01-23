import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockAccounts, mockUsers } from '@/data/mockData';
import { Account, AccountStatus, ChatwootAgent, User } from '@/types/crm';
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
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { fetchChatwootAgents } from '@/services/chatwootApi';
import { ChatwootAgentImport, CreateUserFromChatwootDialog } from '@/components/chatwoot';

// Counter for generating numeric IDs
let accountIdCounter = 100;

type Language = 'pt' | 'en';
type CreationStep = 'form' | 'agents' | 'creating';
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
  const [accounts, setAccounts] = useState<Account[]>(mockAccounts);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteAccount, setDeleteAccount] = useState<Account | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateFormData>(initialFormData);

  // Chatwoot integration states
  const [creationStep, setCreationStep] = useState<CreationStep>('form');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [chatwootAgents, setChatwootAgents] = useState<ChatwootAgent[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>([]);
  const [currentAgentIndex, setCurrentAgentIndex] = useState(0);
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);
  const [createdUsers, setCreatedUsers] = useState<User[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch = account.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || account.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getUserCount = (accountId: string) => {
    return mockUsers.filter((u) => u.account_id === accountId).length + 
           createdUsers.filter((u) => u.account_id === accountId).length;
  };

  const handleTestConnection = async () => {
    setConnectionStatus('loading');
    setConnectionError(null);
    
    const result = await fetchChatwootAgents({
      baseUrl: formData.chatwootBaseUrl,
      accountId: formData.chatwootAccountId,
      apiKey: formData.chatwootApiKey,
    });

    if (result.success) {
      setChatwootAgents(result.agents);
      setSelectedAgentIds(result.agents.map(a => a.id)); // Auto-seleciona todos
      setConnectionStatus('success');
    } else {
      setConnectionStatus('error');
      setConnectionError(result.error || 'Falha na conexão');
      toast.error(result.error || 'Falha na conexão com Chatwoot');
    }
  };

  const createAccount = (): string => {
    accountIdCounter++;
    const newAccount: Account = {
      id: `acc-${accountIdCounter}`,
      nome: formData.nome,
      timezone: formData.idioma === 'pt' ? 'America/Sao_Paulo' : 'America/New_York',
      plano: null,
      status: formData.status,
      limite_usuarios: formData.limiteAgentes,
      chatwoot_account_id: formData.chatwootEnabled ? formData.chatwootAccountId : null,
      chatwoot_api_key: formData.chatwootEnabled ? formData.chatwootApiKey : null,
      chatwoot_base_url: formData.chatwootEnabled ? formData.chatwootBaseUrl : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setAccounts([newAccount, ...accounts]);
    return newAccount.id;
  };

  const handleCreate = () => {
    const accountId = createAccount();
    setIsCreateOpen(false);
    resetForm();
    toast.success('Conta criada com sucesso!');
  };

  const handleProceedToAgents = () => {
    if (connectionStatus !== 'success') {
      toast.error('Teste a conexão com Chatwoot primeiro');
      return;
    }
    setCreationStep('agents');
  };

  const handleStartUserCreation = () => {
    const accountId = createAccount();
    setCreatedAccountId(accountId);
    setCurrentAgentIndex(0);
    setCreationStep('creating');
  };

  const handleSkipAgentImport = () => {
    const accountId = createAccount();
    setIsCreateOpen(false);
    resetForm();
    toast.success('Conta criada com sucesso!');
  };

  const handleUserCreated = (user: User) => {
    setCreatedUsers(prev => [...prev, user]);
    
    if (currentAgentIndex + 1 >= selectedAgentIds.length) {
      // Último usuário criado
      setIsCreateOpen(false);
      resetForm();
      toast.success(`Conta criada com ${selectedAgentIds.length} usuário(s) importado(s)!`);
    } else {
      // Próximo usuário
      setCurrentAgentIndex(prev => prev + 1);
    }
  };

  const handleSkipAgent = () => {
    if (currentAgentIndex + 1 >= selectedAgentIds.length) {
      // Último usuário
      setIsCreateOpen(false);
      resetForm();
      const importedCount = createdUsers.filter(u => u.account_id === createdAccountId).length;
      toast.success(`Conta criada${importedCount > 0 ? ` com ${importedCount} usuário(s) importado(s)` : ''}!`);
    } else {
      setCurrentAgentIndex(prev => prev + 1);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setCreationStep('form');
    setConnectionStatus('idle');
    setChatwootAgents([]);
    setSelectedAgentIds([]);
    setCurrentAgentIndex(0);
    setCreatedAccountId(null);
    setConnectionError(null);
  };

  const hasFormData = () => {
    return (
      formData.nome.trim() !== '' ||
      formData.chatwootAccountId.trim() !== '' ||
      formData.chatwootApiKey.trim() !== '' ||
      formData.limiteAgentes !== 10 ||
      formData.idioma !== 'pt' ||
      formData.status !== 'active' ||
      formData.chatwootEnabled
    );
  };

  const handleCancelCreate = () => {
    if (hasFormData() || creationStep !== 'form') {
      setShowCancelConfirm(true);
    } else {
      setIsCreateOpen(false);
      resetForm();
    }
  };

  const confirmCancelCreate = () => {
    setShowCancelConfirm(false);
    setIsCreateOpen(false);
    resetForm();
  };

  const getNumericId = (id: string) => id.replace(/\D/g, '');

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

  const canTestConnection = formData.chatwootEnabled && 
    formData.chatwootBaseUrl.trim() !== '' &&
    formData.chatwootAccountId.trim() !== '' && 
    formData.chatwootApiKey.trim() !== '';

  const selectedAgents = chatwootAgents.filter(a => selectedAgentIds.includes(a.id));
  const currentAgent = selectedAgents[currentAgentIndex];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Contas</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Gerencie todas as contas do sistema</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          if (!open) handleCancelCreate();
          else setIsCreateOpen(true);
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              <Plus className="w-4 h-4" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {creationStep === 'form' && 'Criar Nova Conta'}
                {creationStep === 'agents' && 'Importar Agentes do Chatwoot'}
              </DialogTitle>
              <DialogDescription>
                {creationStep === 'form' && 'Adicione uma nova conta ao sistema'}
                {creationStep === 'agents' && 'Selecione os agentes que deseja criar no CRM'}
              </DialogDescription>
            </DialogHeader>

            {/* Step 1: Account Form */}
            {creationStep === 'form' && (
              <>
                <div className="space-y-4 py-4">
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

                  {/* Status */}
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData({ ...formData, status: v as AccountStatus })}
                    >
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativa</SelectItem>
                        <SelectItem value="paused">Pausada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Limite de Agentes */}
                  <div className="space-y-2">
                    <Label htmlFor="limiteAgentes">Limite de Agentes</Label>
                    <Input
                      id="limiteAgentes"
                      type="number"
                      min={1}
                      value={formData.limiteAgentes}
                      onChange={(e) => setFormData({ ...formData, limiteAgentes: parseInt(e.target.value) || 1 })}
                    />
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
                            setChatwootAgents([]);
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
                          <p className="text-xs text-muted-foreground">
                            URL do Chatwoot Cloud ou da sua instância self-hosted
                          </p>
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
                          {connectionStatus === 'idle' && (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          {connectionStatus === 'loading' 
                            ? 'Conectando...' 
                            : connectionStatus === 'success'
                            ? `${chatwootAgents.length} agentes encontrados`
                            : 'Testar Conexão e Buscar Agentes'
                          }
                        </Button>

                        {/* Connection Status */}
                        {connectionStatus === 'success' && (
                          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                Conexão estabelecida!
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {chatwootAgents.length} agentes encontrados no Chatwoot
                            </p>
                          </div>
                        )}

                        {connectionStatus === 'error' && connectionError && (
                          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <div className="flex items-center gap-2 text-destructive">
                              <XCircle className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                Falha na conexão
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {connectionError}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={handleCancelCreate}>
                    Cancelar
                  </Button>
                  {formData.chatwootEnabled && connectionStatus === 'success' ? (
                    <Button 
                      onClick={handleProceedToAgents} 
                      disabled={!formData.nome.trim()}
                    >
                      Próximo: Importar Agentes
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleCreate} 
                      disabled={!formData.nome.trim()}
                    >
                      Criar Conta
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}

            {/* Step 2: Agent Selection */}
            {creationStep === 'agents' && (
              <>
                <div className="py-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-1 mb-4"
                    onClick={() => setCreationStep('form')}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                  </Button>

                  <ChatwootAgentImport
                    agents={chatwootAgents}
                    selectedAgentIds={selectedAgentIds}
                    onSelectionChange={setSelectedAgentIds}
                    onProceed={handleStartUserCreation}
                    onSkip={handleSkipAgentImport}
                  />
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Step 3: User Creation Dialog (separate) */}
      {creationStep === 'creating' && currentAgent && createdAccountId && (
        <CreateUserFromChatwootDialog
          open={true}
          agent={currentAgent}
          currentIndex={currentAgentIndex}
          totalAgents={selectedAgents.length}
          accountId={createdAccountId}
          onUserCreated={handleUserCreated}
          onSkip={handleSkipAgent}
          onClose={() => {
            const importedCount = createdUsers.filter(u => u.account_id === createdAccountId).length;
            toast.success(`Conta criada${importedCount > 0 ? ` com ${importedCount} usuário(s) importado(s)` : ''}!`);
            setIsCreateOpen(false);
            resetForm();
          }}
        />
      )}

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
                      {getNumericId(account.id)}
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
                        <DropdownMenuItem onClick={() => navigate(`/super-admin/accounts/${account.id}`)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Inspecionar
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

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Existem dados preenchidos no formulário. Tem certeza que deseja cancelar? Todos os dados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancelCreate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
