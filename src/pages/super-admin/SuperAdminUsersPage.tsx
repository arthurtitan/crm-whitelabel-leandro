import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockUsers, mockAccounts } from '@/data/mockData';
import { User, UserRole, UserStatus } from '@/types/crm';
import { useAuth } from '@/contexts/AuthContext';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  ArrowLeftRight,
  UserCog,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { impersonate } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);

  // Agent permission areas
  const agentPermissionAreas = [
    { id: 'leads', label: 'Leads / Funil' },
    { id: 'conversations', label: 'Conversas' },
    { id: 'sales', label: 'Vendas' },
    { id: 'events', label: 'Eventos' },
    { id: 'reports', label: 'Relatórios' },
  ];

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    role: 'agent' as UserRole,
    account_id: '',
    password: '',
    confirmPassword: '',
    permissions: [] as string[],
  });

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return 'Global';
    const account = mockAccounts.find((a) => a.id === accountId);
    return account?.nome || 'Desconhecido';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const isCreateFormValid = () => {
    const baseValid = formData.nome && formData.email && formData.password && formData.confirmPassword;
    const passwordsMatch = formData.password === formData.confirmPassword;
    const passwordMinLength = formData.password.length >= 6;
    const accountValid = formData.role === 'super_admin' || formData.account_id;
    const permissionsValid = formData.role !== 'agent' || formData.permissions.length > 0;
    
    return baseValid && passwordsMatch && passwordMinLength && accountValid && permissionsValid;
  };

  const handleCreate = () => {
    if (formData.password !== formData.confirmPassword) {
      toast.error('As senhas não coincidem!');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres!');
      return;
    }
    
    const newUser: User = {
      id: `user-${Date.now()}`,
      nome: formData.nome,
      email: formData.email,
      role: formData.role,
      account_id: formData.role === 'super_admin' ? null : formData.account_id || null,
      status: 'active',
      last_login_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // In a real app, permissions would be stored separately
      // permissions: formData.role === 'agent' ? formData.permissions : undefined,
    };
    setUsers([newUser, ...users]);
    setIsCreateOpen(false);
    setFormData({ 
      nome: '', 
      email: '', 
      role: 'agent', 
      account_id: '', 
      password: '', 
      confirmPassword: '',
      permissions: [] 
    });
    setShowPassword(false);
    toast.success('Usuário criado com sucesso!');
  };

  const handleUpdate = () => {
    if (!editingUser) return;
    setUsers(
      users.map((u) =>
        u.id === editingUser.id ? { ...editingUser, updated_at: new Date().toISOString() } : u
      )
    );
    setEditingUser(null);
    toast.success('Usuário atualizado com sucesso!');
  };

  const handleDelete = (userId: string) => {
    setUsers(users.filter((u) => u.id !== userId));
    toast.success('Usuário excluído com sucesso!');
  };

  const handleImpersonate = (user: User) => {
    impersonate(user.id);
    // Navigate based on user role
    if (user.role === 'admin') {
      navigate('/admin');
    } else if (user.role === 'agent') {
      navigate('/agent');
    }
    toast.success(`Visualizando como ${user.nome}`);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return <span className="badge-super-admin">Super Admin</span>;
      case 'admin':
        return <span className="badge-admin">Admin</span>;
      case 'agent':
        return <span className="badge-agent">Agente</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gerencie todos os usuários do sistema</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90 gap-2">
              <Plus className="w-4 h-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>Adicione um novo usuário ao sistema</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome <span className="text-destructive">*</span></Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Papel <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.role}
                    onValueChange={(v) => setFormData({ ...formData, role: v as UserRole, permissions: [] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="agent">Agente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.role !== 'super_admin' && (
                  <div className="space-y-2">
                    <Label htmlFor="account">Conta <span className="text-destructive">*</span></Label>
                    <Select
                      value={formData.account_id}
                      onValueChange={(v) => setFormData({ ...formData, account_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Agent Permissions */}
              {formData.role === 'agent' && (
                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <Label className="font-medium">
                    Permissões de Acesso <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Selecione as áreas que este agente poderá acessar
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {agentPermissionAreas.map((area) => (
                      <div key={area.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`perm-${area.id}`}
                          checked={formData.permissions.includes(area.id)}
                          onCheckedChange={() => togglePermission(area.id)}
                        />
                        <label
                          htmlFor={`perm-${area.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {area.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  {formData.permissions.length === 0 && (
                    <p className="text-sm text-amber-600">
                      Selecione pelo menos uma área de acesso
                    </p>
                  )}
                </div>
              )}

              {/* Password Section */}
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <Label className="font-medium">Definir Senha <span className="text-destructive">*</span></Label>
                <p className="text-sm text-muted-foreground">
                  O Super Admin deve definir a senha inicial do usuário
                </p>
                <div className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Mínimo 6 caracteres"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Digite a senha novamente"
                    />
                  </div>
                  {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-sm text-destructive">As senhas não coincidem</p>
                  )}
                  {formData.password && formData.password.length < 6 && (
                    <p className="text-sm text-amber-600">A senha deve ter pelo menos 6 caracteres</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={!isCreateFormValid()}>
                Criar Usuário
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
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as UserRole | 'all')}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os papéis</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="agent">Agente</SelectItem>
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
                <TableHead>Usuário</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último Login</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback
                          className={
                            user.role === 'super_admin'
                              ? 'bg-role-super-admin/20 text-role-super-admin'
                              : user.role === 'admin'
                              ? 'bg-role-admin/20 text-role-admin'
                              : 'bg-role-agent/20 text-role-agent'
                          }
                        >
                          {getInitials(user.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.nome}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {getAccountName(user.account_id)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        user.status === 'active'
                          ? 'status-active'
                          : user.status === 'suspended'
                          ? 'status-paused'
                          : 'status-cancelled'
                      }
                    >
                      {user.status === 'active'
                        ? 'Ativo'
                        : user.status === 'suspended'
                        ? 'Suspenso'
                        : 'Inativo'}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.last_login_at
                      ? format(new Date(user.last_login_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })
                      : 'Nunca'}
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
                        <DropdownMenuItem onClick={() => setEditingUser(user)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {user.role !== 'super_admin' && (
                          <DropdownMenuItem onClick={() => handleImpersonate(user)}>
                            <ArrowLeftRight className="w-4 h-4 mr-2" />
                            Acessar como usuário
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(user.id)}
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
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Atualize os dados do usuário</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nome">Nome</Label>
                <Input
                  id="edit-nome"
                  value={editingUser.nome}
                  onChange={(e) => setEditingUser({ ...editingUser, nome: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Papel</Label>
                  <Select
                    value={editingUser.role}
                    onValueChange={(v) => setEditingUser({ ...editingUser, role: v as UserRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="agent">Agente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editingUser.status}
                    onValueChange={(v) =>
                      setEditingUser({ ...editingUser, status: v as UserStatus })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
