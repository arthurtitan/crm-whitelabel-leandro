import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { mockEvents, mockUsers, mockAgentBots } from '@/data/mockData';
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
  Bot,
  Cog,
  ExternalLink,
  Clock,
  Filter,
  Activity,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminEventsPage() {
  const { account } = useAuth();
  const accountId = account?.id || 'acc-1';

  const accountEvents = mockEvents.filter(
    (e) => e.account_id === accountId || e.account_id === null
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredEvents = accountEvents.filter((event) => {
    const matchesSearch =
      event.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(event.payload).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || event.event_type.startsWith(typeFilter);
    return matchesSearch && matchesType;
  });

  const getActorName = (event: CRMEvent) => {
    if (event.actor_type === 'user' && event.actor_id) {
      const user = mockUsers.find((u) => u.id === event.actor_id);
      return user?.nome || 'Usuário';
    }
    if (event.actor_type === 'agent_bot' && event.actor_id) {
      const bot = mockAgentBots.find((b) => b.id === event.actor_id);
      return bot?.nome || 'IA';
    }
    if (event.actor_type === 'system') return 'Sistema';
    if (event.actor_type === 'external') return 'Externo';
    return 'Desconhecido';
  };

  const getActorIcon = (actorType: string) => {
    switch (actorType) {
      case 'user':
        return <User className="w-4 h-4" />;
      case 'agent_bot':
        return <Bot className="w-4 h-4" />;
      case 'system':
        return <Cog className="w-4 h-4" />;
      case 'external':
        return <ExternalLink className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getEventTypeColor = (eventType: EventType) => {
    if (eventType.startsWith('auth.')) return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    if (eventType.startsWith('conversation.')) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    if (eventType.startsWith('message.')) return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
    if (eventType.startsWith('lead.')) return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    if (eventType.startsWith('sale.')) return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (eventType.startsWith('account.')) return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
    if (eventType.startsWith('user.')) return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
    return 'bg-muted text-muted-foreground';
  };

  const eventTypeCategories = [
    { value: 'all', label: 'Todos' },
    { value: 'auth.', label: 'Autenticação' },
    { value: 'conversation.', label: 'Conversas' },
    { value: 'message.', label: 'Mensagens' },
    { value: 'lead.', label: 'Leads' },
    { value: 'sale.', label: 'Vendas' },
    { value: 'account.', label: 'Conta' },
    { value: 'user.', label: 'Usuários' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Eventos</h1>
        <p className="text-muted-foreground">
          Log de auditoria do sistema • Eventos imutáveis
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar eventos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Tipo de evento" />
              </SelectTrigger>
              <SelectContent>
                {eventTypeCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
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
          <ScrollArea className="h-[600px]">
            <div className="divide-y divide-border">
              {filteredEvents.map((event, index) => (
                <div
                  key={event.id}
                  className="p-4 hover:bg-muted/30 transition-colors animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start gap-4">
                    {/* Timeline Indicator */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          event.actor_type === 'user'
                            ? 'bg-primary/10 text-primary'
                            : event.actor_type === 'agent_bot'
                            ? 'bg-info/10 text-info'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {getActorIcon(event.actor_type)}
                      </div>
                    </div>

                    {/* Event Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={getEventTypeColor(event.event_type)}>
                              <code className="text-xs font-mono">{event.event_type}</code>
                            </Badge>
                            {event.channel && (
                              <Badge variant="outline" className="text-xs">
                                {event.channel}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Por <span className="font-medium text-foreground">{getActorName(event)}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
                          <Clock className="w-3 h-3" />
                          {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm:ss", {
                            locale: ptBR,
                          })}
                        </div>
                      </div>

                      {/* Payload Preview */}
                      {Object.keys(event.payload).length > 0 && (
                        <div className="mt-2 p-2 rounded-lg bg-muted/50 overflow-hidden">
                          <pre className="text-xs text-muted-foreground overflow-x-auto scrollbar-thin">
                            {JSON.stringify(event.payload, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Entity Reference */}
                      {event.entity_type && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium">Entidade:</span>
                          <code className="px-1.5 py-0.5 rounded bg-muted">
                            {event.entity_type}:{event.entity_id?.slice(0, 8)}...
                          </code>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {filteredEvents.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhum evento encontrado</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
