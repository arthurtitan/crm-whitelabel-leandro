import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { mockEvents, mockUsers } from '@/data/mockData';
import { CRMEvent, EventType } from '@/types/crm';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  User,
  Clock,
  Filter,
  LogIn,
  LogOut,
  XCircle,
  Monitor,
  Globe,
  Timer,
} from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminEventsPage() {
  const { account } = useAuth();
  const accountId = account?.id || 'acc-1';

  // Filtrar eventos:
  // 1. Apenas da conta atual
  // 2. Excluir eventos de SuperAdmin (actor_id não pode ser de user com role super_admin)
  // 3. Apenas eventos de autenticação relevantes
  // 4. Últimos 30 dias
  const thirtyDaysAgo = subDays(new Date(), 30);

  const superAdminIds = mockUsers
    .filter((u) => u.role === 'super_admin')
    .map((u) => u.id);

  const accountEvents = mockEvents.filter((e) => {
    // Apenas eventos da conta
    if (e.account_id !== accountId) return false;
    
    // Excluir eventos de SuperAdmin
    if (e.actor_id && superAdminIds.includes(e.actor_id)) return false;
    
    // Apenas eventos de autenticação
    if (!e.event_type.startsWith('auth.')) return false;
    
    // Últimos 30 dias
    const eventDate = new Date(e.created_at);
    if (!isAfter(eventDate, thirtyDaysAgo)) return false;
    
    return true;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredEvents = accountEvents.filter((event) => {
    const user = mockUsers.find((u) => u.id === event.actor_id);
    const userName = user?.nome || '';
    const userEmail = user?.email || '';
    
    const matchesSearch =
      userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(event.payload).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || event.event_type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Ordenar por data mais recente
  const sortedEvents = [...filteredEvents].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const getUserInfo = (event: CRMEvent) => {
    const user = mockUsers.find((u) => u.id === event.actor_id);
    return {
      name: user?.nome || 'Usuário',
      email: user?.email || '',
      role: user?.role || 'agent',
    };
  };

  const getEventIcon = (eventType: EventType) => {
    switch (eventType) {
      case 'auth.login.success':
        return <LogIn className="w-4 h-4 text-success" />;
      case 'auth.login.failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'auth.logout':
        return <LogOut className="w-4 h-4 text-warning" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getEventLabel = (eventType: EventType) => {
    switch (eventType) {
      case 'auth.login.success':
        return { label: 'Login', color: 'bg-success/10 text-success border-success/20' };
      case 'auth.login.failed':
        return { label: 'Login Falhou', color: 'bg-destructive/10 text-destructive border-destructive/20' };
      case 'auth.logout':
        return { label: 'Logout', color: 'bg-warning/10 text-warning border-warning/20' };
      default:
        return { label: eventType, color: 'bg-muted text-muted-foreground' };
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="default" className="text-xs">Admin</Badge>;
      case 'agent':
        return <Badge variant="secondary" className="text-xs">Agente</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{role}</Badge>;
    }
  };

  const eventTypeOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'auth.login.success', label: 'Logins bem-sucedidos' },
    { value: 'auth.login.failed', label: 'Logins falhados' },
    { value: 'auth.logout', label: 'Logouts' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Eventos</h1>
        <p className="text-muted-foreground">
          Registro de atividades dos usuários • Últimos 30 dias
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuário ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Tipo de evento" />
              </SelectTrigger>
              <SelectContent>
                {eventTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
              <LogIn className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {sortedEvents.filter((e) => e.event_type === 'auth.login.success').length}
              </p>
              <p className="text-sm text-muted-foreground">Logins</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {sortedEvents.filter((e) => e.event_type === 'auth.logout').length}
              </p>
              <p className="text-sm text-muted-foreground">Logouts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {sortedEvents.filter((e) => e.event_type === 'auth.login.failed').length}
              </p>
              <p className="text-sm text-muted-foreground">Falhas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Timeline */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="divide-y divide-border">
              {sortedEvents.map((event, index) => {
                const userInfo = getUserInfo(event);
                const eventLabel = getEventLabel(event.event_type);
                const payload = event.payload as Record<string, unknown>;

                return (
                  <div
                    key={event.id}
                    className="p-4 hover:bg-muted/30 transition-colors animate-fade-in"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            event.event_type === 'auth.login.success'
                              ? 'bg-success/10'
                              : event.event_type === 'auth.login.failed'
                              ? 'bg-destructive/10'
                              : 'bg-warning/10'
                          }`}
                        >
                          {getEventIcon(event.event_type)}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge className={eventLabel.color}>
                                {eventLabel.label}
                              </Badge>
                              {getRoleBadge(userInfo.role)}
                            </div>
                            <p className="font-medium">{userInfo.name}</p>
                            <p className="text-sm text-muted-foreground">{userInfo.email}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm:ss", {
                                locale: ptBR,
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Device Info */}
                        <div className="mt-3 p-3 rounded-lg bg-muted/50 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            {payload.browser && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Globe className="w-4 h-4" />
                                <span>{String(payload.browser)}</span>
                              </div>
                            )}
                            {payload.os && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Monitor className="w-4 h-4" />
                                <span>{String(payload.os)}</span>
                              </div>
                            )}
                            {payload.device && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Monitor className="w-4 h-4" />
                                <span>{String(payload.device)}</span>
                              </div>
                            )}
                            {payload.ip && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Globe className="w-4 h-4" />
                                <span>IP: {String(payload.ip)}</span>
                              </div>
                            )}
                            {payload.session_duration_minutes && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Timer className="w-4 h-4" />
                                <span>Sessão: {String(payload.session_duration_minutes)} min</span>
                              </div>
                            )}
                            {payload.reason && (
                              <div className="flex items-center gap-2 text-destructive">
                                <XCircle className="w-4 h-4" />
                                <span>{String(payload.reason)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {sortedEvents.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <LogIn className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhum evento encontrado</p>
                  <p className="text-sm mt-1">
                    Os eventos de login/logout dos usuários aparecerão aqui
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
