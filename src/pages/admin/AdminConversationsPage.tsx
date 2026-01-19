import { useAuth } from '@/contexts/AuthContext';
import { mockConversations, mockContacts, mockUsers, mockAgentBots } from '@/data/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState } from 'react';
import {
  Search,
  MessageSquare,
  User,
  Bot,
  Clock,
  CheckCircle,
  Circle,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminConversationsPage() {
  const { account } = useAuth();
  const accountId = account?.id || 'acc-1';

  const accountConversations = mockConversations.filter((c) => c.account_id === accountId);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const filteredConversations = accountConversations.filter((conv) => {
    const contact = mockContacts.find((c) => c.id === conv.contact_id);
    const matchesSearch = contact?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || conv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getContact = (contactId: string) => mockContacts.find((c) => c.id === contactId);

  const getAssignee = (conv: typeof accountConversations[0]) => {
    if (!conv.assignee_id) return null;
    if (conv.assignee_type === 'user') {
      return mockUsers.find((u) => u.id === conv.assignee_id);
    }
    return mockAgentBots.find((b) => b.id === conv.assignee_id);
  };

  const getChannelBadge = (channel: string | null) => {
    switch (channel) {
      case 'whatsapp':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">WhatsApp</Badge>;
      case 'instagram':
        return <Badge className="bg-pink-500/10 text-pink-500 border-pink-500/20">Instagram</Badge>;
      case 'webchat':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">WebChat</Badge>;
      default:
        return <Badge variant="secondary">-</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Circle className="w-3 h-3 text-success fill-success" />;
      case 'pending':
        return <Clock className="w-3 h-3 text-warning" />;
      case 'resolved':
        return <CheckCircle className="w-3 h-3 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Stats
  const openCount = accountConversations.filter((c) => c.status === 'open').length;
  const pendingCount = accountConversations.filter((c) => c.status === 'pending').length;
  const resolvedCount = accountConversations.filter((c) => c.status === 'resolved').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Conversas</h1>
        <p className="text-muted-foreground">
          Gerencie as conversas do Chatwoot
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-success/50 transition-colors" onClick={() => setStatusFilter('open')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
              <Circle className="w-5 h-5 text-success fill-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{openCount}</p>
              <p className="text-xs text-muted-foreground">Abertas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-warning/50 transition-colors" onClick={() => setStatusFilter('pending')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-muted-foreground/50 transition-colors" onClick={() => setStatusFilter('resolved')}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{resolvedCount}</p>
              <p className="text-xs text-muted-foreground">Resolvidas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por contato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="open">Abertas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="resolved">Resolvidas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Conversations List */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="divide-y divide-border">
              {filteredConversations.map((conv) => {
                const contact = getContact(conv.contact_id);
                const assignee = getAssignee(conv);
                return (
                  <div
                    key={conv.id}
                    className="p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(contact?.nome)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{contact?.nome || 'Contato'}</span>
                              {getStatusIcon(conv.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {contact?.telefone || contact?.email}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(conv.opened_at), "dd/MM HH:mm", { locale: ptBR })}
                            </p>
                            {getChannelBadge(conv.channel)}
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          {assignee && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {conv.assignee_type === 'agent_bot' ? (
                                <Bot className="w-3 h-3 text-info" />
                              ) : (
                                <User className="w-3 h-3" />
                              )}
                              <span>{'nome' in assignee ? assignee.nome : 'IA'}</span>
                            </div>
                          )}
                          {!assignee && (
                            <span className="text-xs text-warning">Não atribuída</span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="gap-1.5">
                        <ExternalLink className="w-4 h-4" />
                        Chatwoot
                      </Button>
                    </div>
                  </div>
                );
              })}

              {filteredConversations.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Nenhuma conversa encontrada</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
