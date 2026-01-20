import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IntegrationCard, GoogleConnectModal } from '@/components/calendar';
import { useCalendar } from '@/contexts/CalendarContext';
import { Calendar, Video, MessageCircle, Smartphone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminIntegrationsPage() {
  const navigate = useNavigate();
  const { connection, connectGoogle, disconnectGoogle, syncNow } = useCalendar();
  const [showConnectModal, setShowConnectModal] = useState(false);

  const handleConnect = async () => {
    await connectGoogle();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="text-muted-foreground">
          Conecte suas ferramentas para melhorar seu fluxo de trabalho
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <IntegrationCard
          icon={<Calendar className="w-5 h-5" />}
          title="Google Calendar"
          description="Sincronize sua agenda e permita agendamentos automáticos com leads"
          status={connection.status === 'connected' ? 'connected' : connection.status === 'connecting' ? 'connecting' : connection.status === 'error' ? 'error' : 'disconnected'}
          connectedInfo={connection.status === 'connected' ? {
            identifier: connection.email || '',
            connectedAt: connection.connectedAt ? formatDistanceToNow(new Date(connection.connectedAt), { addSuffix: true, locale: ptBR }) : '',
            lastSync: connection.lastSync ? formatDistanceToNow(new Date(connection.lastSync), { addSuffix: true, locale: ptBR }) : undefined,
          } : undefined}
          errorMessage={connection.errorMessage}
          onConnect={() => setShowConnectModal(true)}
          onConfigure={() => navigate('/admin/settings/calendar')}
          onDisconnect={disconnectGoogle}
          onReconnect={() => setShowConnectModal(true)}
          onSync={syncNow}
          isSyncing={connection.status === 'syncing'}
        />

        <IntegrationCard
          icon={<Video className="w-5 h-5" />}
          title="Google Meet"
          description="Crie links de reunião automaticamente para seus agendamentos"
          status="disconnected"
        />

        <IntegrationCard
          icon={<MessageCircle className="w-5 h-5" />}
          title="Chatwoot"
          description="Integração de atendimento multicanal"
          status="connected"
          connectedInfo={{
            identifier: 'Conta #12345',
            connectedAt: 'há 10 dias',
          }}
        />

        <IntegrationCard
          icon={<Smartphone className="w-5 h-5" />}
          title="WhatsApp Business"
          description="Conecte seu WhatsApp Business para atendimento"
          status="coming_soon"
        />
      </div>

      <GoogleConnectModal
        open={showConnectModal}
        onOpenChange={setShowConnectModal}
        onConnect={handleConnect}
      />
    </div>
  );
}
