import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { mockEvents, mockUsers } from '@/data/mockData';
import { CRMEvent, EventType, User } from '@/types/crm';
import { KPICard } from '@/components/dashboard/KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  User as UserIcon,
  Clock,
  Filter,
  LogIn,
  LogOut,
  XCircle,
  Monitor,
  Globe,
  Timer,
  TrendingUp,
  Trophy,
  Medal,
  Award,
  BarChart3,
  Users,
  UserCheck,
  UserX,
} from 'lucide-react';
import { format, subDays, isAfter, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { safeFormatDateBR } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';

interface UserPerformance {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  totalLogins: number;
  totalLogouts: number;
  totalFailures: number;
  totalSessionMinutes: number;
  avgSessionMinutes: number;
  daysWorked: number;
}

interface UserOnlineStatus {
  user: User;
  isOnline: boolean;
  lastEventType: EventType | null;
  lastEventTime: Date | null;
  sessionStartTime: Date | null;
  currentSessionMinutes: number;
}

export default function AdminEventsPage() {
  const { account } = useAuth();
  const accountId = account?.id || 'acc-1';

  // Filtrar eventos:
  // 1. Apenas da conta atual
  // 2. Excluir eventos de SuperAdmin
  // 3. Apenas eventos de autenticação
  // 4. Últimos 30 dias
  const thirtyDaysAgo = subDays(new Date(), 30);

  const superAdminIds = mockUsers
    .filter((u) => u.role === 'super_admin')
    .map((u) => u.id);

  const accountEvents = mockEvents.filter((e) => {
    if (e.account_id !== accountId) return false;
    if (e.actor_id && superAdminIds.includes(e.actor_id)) return false;
    if (!e.event_type.startsWith('auth.')) return false;
    const eventDate = new Date(e.created_at);
    if (!isAfter(eventDate, thirtyDaysAgo)) return false;
    return true;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('ponto');

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

  const sortedEvents = [...filteredEvents].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Calcular status online/offline de cada usuário
  const userOnlineStatuses = useMemo((): UserOnlineStatus[] => {
    const accountUsers = mockUsers.filter(
      (u) => u.account_id === accountId && u.role !== 'super_admin' && u.status === 'active'
    );

    return accountUsers.map((user) => {
      // Encontrar eventos do usuário ordenados por data (mais recente primeiro)
      const userEvents = accountEvents
        .filter((e) => e.actor_id === user.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const lastEvent = userEvents[0];
      const lastEventType = lastEvent?.event_type as EventType | null;
      const lastEventTime = lastEvent ? new Date(lastEvent.created_at) : null;

      // Determinar se está online: último evento é login.success sem logout posterior
      const isOnline = lastEventType === 'auth.login.success';

      // Se estiver online, calcular tempo de sessão atual
      let sessionStartTime: Date | null = null;
      let currentSessionMinutes = 0;

      if (isOnline && lastEventTime) {
        sessionStartTime = lastEventTime;
        currentSessionMinutes = differenceInMinutes(new Date(), lastEventTime);
      }

      return {
        user,
        isOnline,
        lastEventType,
        lastEventTime,
        sessionStartTime,
        currentSessionMinutes,
      };
    }).sort((a, b) => {
      // Online primeiro, depois por tempo de sessão
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      if (a.isOnline && b.isOnline) {
        return b.currentSessionMinutes - a.currentSessionMinutes;
      }
      // Offline: ordenar por último acesso (mais recente primeiro)
      if (a.lastEventTime && b.lastEventTime) {
        return b.lastEventTime.getTime() - a.lastEventTime.getTime();
      }
      return 0;
    });
  }, [accountEvents, accountId]);

  const onlineCount = userOnlineStatuses.filter((u) => u.isOnline).length;
  const offlineCount = userOnlineStatuses.filter((u) => !u.isOnline).length;
  const totalUsers = userOnlineStatuses.length;

  // Calcular performance por funcionário
  const userPerformance = useMemo((): UserPerformance[] => {
    const performanceMap = new Map<string, UserPerformance>();
    const daysWithLoginMap = new Map<string, Set<string>>();

    accountEvents.forEach((event) => {
      if (!event.actor_id) return;
      
      const user = mockUsers.find((u) => u.id === event.actor_id);
      if (!user) return;

      if (!performanceMap.has(event.actor_id)) {
        performanceMap.set(event.actor_id, {
          userId: event.actor_id,
          userName: user.nome,
          userEmail: user.email,
          userRole: user.role,
          totalLogins: 0,
          totalLogouts: 0,
          totalFailures: 0,
          totalSessionMinutes: 0,
          avgSessionMinutes: 0,
          daysWorked: 0,
        });
        daysWithLoginMap.set(event.actor_id, new Set());
      }

      const perf = performanceMap.get(event.actor_id)!;
      const dayKey = safeFormatDateBR(event.created_at, 'yyyy-MM-dd') || 'unknown';

      switch (event.event_type) {
        case 'auth.login.success':
          perf.totalLogins++;
          daysWithLoginMap.get(event.actor_id)!.add(dayKey);
          break;
        case 'auth.logout':
          perf.totalLogouts++;
          const sessionDuration = (event.payload as any).session_duration_minutes || 0;
          perf.totalSessionMinutes += sessionDuration;
          break;
        case 'auth.login.failed':
          perf.totalFailures++;
          break;
      }
    });

    // Calcular médias e dias trabalhados
    performanceMap.forEach((perf, userId) => {
      perf.daysWorked = daysWithLoginMap.get(userId)?.size || 0;
      perf.avgSessionMinutes = perf.totalLogouts > 0 
        ? Math.round(perf.totalSessionMinutes / perf.totalLogouts) 
        : 0;
    });

    return Array.from(performanceMap.values()).sort((a, b) => b.totalSessionMinutes - a.totalSessionMinutes);
  }, [accountEvents]);

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
        return <UserIcon className="w-4 h-4" />;
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

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-5 h-5 text-warning" />;
      case 1:
        return <Medal className="w-5 h-5 text-muted-foreground" />;
      case 2:
        return <Award className="w-5 h-5 text-primary" />;
      default:
        return <span className="text-sm font-medium text-muted-foreground w-5 text-center">{index + 1}</span>;
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const eventTypeOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'auth.login.success', label: 'Logins bem-sucedidos' },
    { value: 'auth.login.failed', label: 'Logins falhados' },
    { value: 'auth.logout', label: 'Logouts' },
  ];

  const maxSessionMinutes = Math.max(...userPerformance.map(p => p.totalSessionMinutes), 1);

  return (
    <div className="page-container">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">Eventos</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Controle de ponto e registro de atividades • Últimos 30 dias
        </p>
      </div>

      {/* Summary Stats */}
      <div className="kpi-grid">
        <KPICard
          title="Usuários Online"
          subtitle="Sessões ativas agora"
          value={onlineCount}
          icon={UserCheck}
          iconColor="text-success"
          iconBgColor="bg-success/10"
        />
        <KPICard
          title="Usuários Offline"
          subtitle="Sem sessão ativa"
          value={offlineCount}
          icon={UserX}
          iconColor="text-muted-foreground"
          iconBgColor="bg-muted"
        />
        <KPICard
          title="Total de Funcionários"
          subtitle="Usuários ativos da conta"
          value={totalUsers}
          icon={Users}
          iconColor="text-primary"
          iconBgColor="bg-primary/10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="ponto" className="gap-2">
            <Users className="w-4 h-4" />
            Controle de Ponto
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <Clock className="w-4 h-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="report" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Relatório Mensal
          </TabsTrigger>
        </TabsList>

        {/* Controle de Ponto Tab */}
        <TabsContent value="ponto" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-5 h-5 text-primary" />
                Status dos Funcionários
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Visão em tempo real de quem está online no sistema
              </p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {userOnlineStatuses.map((status) => (
                    <div
                      key={status.user.id}
                      className={cn(
                        "p-4 rounded-lg border transition-all",
                        status.isOnline 
                          ? "bg-success/5 border-success/20" 
                          : "bg-card border-border"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        {/* Avatar com indicador de status */}
                        <div className="relative">
                          <Avatar className="h-12 w-12">
                            <AvatarFallback className={cn(
                              "text-sm font-medium",
                              status.isOnline 
                                ? "bg-success/20 text-success" 
                                : "bg-muted text-muted-foreground"
                            )}>
                              {getInitials(status.user.nome)}
                            </AvatarFallback>
                          </Avatar>
                          {/* Bolinha de status */}
                          <div 
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background",
                              status.isOnline ? "bg-success" : "bg-muted-foreground/50"
                            )}
                          />
                        </div>

                        {/* Info do usuário */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground truncate">
                              {status.user.nome}
                            </p>
                            {getRoleBadge(status.user.role)}
                            <Badge 
                              variant={status.isOnline ? "success" : "secondary"}
                              className="text-xs"
                            >
                              {status.isOnline ? 'Online' : 'Offline'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {status.user.email}
                          </p>
                        </div>

                        {/* Tempo e último acesso */}
                        <div className="text-right hidden sm:block">
                          {status.isOnline ? (
                            <div>
                              <p className="text-sm font-medium text-success flex items-center gap-1.5 justify-end">
                                <Timer className="w-4 h-4" />
                                {formatDuration(status.currentSessionMinutes)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Sessão ativa
                              </p>
                            </div>
                          ) : (
                            <div>
                              {status.lastEventTime ? (
                                <>
                                  <p className="text-sm text-muted-foreground">
                                    {safeFormatDateBR(status.lastEventTime, "dd/MM 'às' HH:mm")}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Último acesso
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Sem atividade recente
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Mobile: Info adicional */}
                      <div className="sm:hidden mt-3 pt-3 border-t border-border/50">
                        {status.isOnline ? (
                          <div className="flex items-center gap-2 text-sm text-success">
                            <Timer className="w-4 h-4" />
                            <span>Sessão ativa há {formatDuration(status.currentSessionMinutes)}</span>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            {status.lastEventTime ? (
                              <span>Último acesso: {safeFormatDateBR(status.lastEventTime, "dd/MM 'às' HH:mm")}</span>
                            ) : (
                              <span>Sem atividade recente</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {userOnlineStatuses.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>Nenhum funcionário encontrado</p>
                      <p className="text-sm mt-1">
                        Os funcionários da conta aparecerão aqui
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
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
                        style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
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
                                  {safeFormatDateBR(event.created_at, "dd/MM/yyyy 'às' HH:mm:ss")}
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
        </TabsContent>

        {/* Monthly Report Tab */}
        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Ranking de Performance - Últimos 30 dias
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Funcionários ordenados por tempo total de sessão ativa
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userPerformance.map((perf, index) => (
                  <div
                    key={perf.userId}
                    className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="flex items-center justify-center w-8">
                        {getRankIcon(index)}
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">{perf.userName}</p>
                          {getRoleBadge(perf.userRole)}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{perf.userEmail}</p>
                      </div>

                      {/* Stats */}
                      <div className="hidden sm:flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <p className="font-semibold text-success">{perf.totalLogins}</p>
                          <p className="text-xs text-muted-foreground">Logins</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold">{perf.daysWorked}</p>
                          <p className="text-xs text-muted-foreground">Dias</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-primary">{formatDuration(perf.avgSessionMinutes)}</p>
                          <p className="text-xs text-muted-foreground">Média/Sessão</p>
                        </div>
                        <div className="text-center min-w-[80px]">
                          <p className="font-semibold text-primary">{formatDuration(perf.totalSessionMinutes)}</p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <Progress 
                        value={(perf.totalSessionMinutes / maxSessionMinutes) * 100} 
                        className="h-2"
                      />
                    </div>

                    {/* Mobile Stats */}
                    <div className="sm:hidden mt-3 grid grid-cols-4 gap-2 text-center text-sm">
                      <div>
                        <p className="font-semibold text-success">{perf.totalLogins}</p>
                        <p className="text-xs text-muted-foreground">Logins</p>
                      </div>
                      <div>
                        <p className="font-semibold">{perf.daysWorked}</p>
                        <p className="text-xs text-muted-foreground">Dias</p>
                      </div>
                      <div>
                        <p className="font-semibold text-primary">{formatDuration(perf.avgSessionMinutes)}</p>
                        <p className="text-xs text-muted-foreground">Média</p>
                      </div>
                      <div>
                        <p className="font-semibold text-primary">{formatDuration(perf.totalSessionMinutes)}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                    </div>
                  </div>
                ))}

                {userPerformance.length === 0 && (
                  <div className="p-12 text-center text-muted-foreground">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Nenhum dado de performance disponível</p>
                    <p className="text-sm mt-1">
                      Os dados de performance aparecerão após eventos de login/logout
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhamento por Funcionário</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Funcionário</TableHead>
                      <TableHead className="text-center min-w-[60px]">Logins</TableHead>
                      <TableHead className="text-center min-w-[60px] hidden sm:table-cell">Logouts</TableHead>
                      <TableHead className="text-center min-w-[60px] hidden sm:table-cell">Falhas</TableHead>
                      <TableHead className="text-center min-w-[60px]">Dias</TableHead>
                      <TableHead className="text-right min-w-[80px] hidden md:table-cell">Tempo Médio</TableHead>
                      <TableHead className="text-right min-w-[80px]">Tempo Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userPerformance.map((perf) => (
                      <TableRow key={perf.userId}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{perf.userName}</p>
                            <p className="text-xs text-muted-foreground">{perf.userEmail}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            {perf.totalLogins}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                            {perf.totalLogouts}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                            {perf.totalFailures}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-medium">{perf.daysWorked}</TableCell>
                        <TableCell className="text-right text-muted-foreground hidden md:table-cell">
                          {formatDuration(perf.avgSessionMinutes)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {formatDuration(perf.totalSessionMinutes)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
