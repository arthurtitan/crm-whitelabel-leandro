import { useMemo } from 'react';
import { useFinance } from '@/contexts/FinanceContext';
import { Contact, Tag, SaleStatus } from '@/types/crm';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  GripVertical,
  Phone,
  Clock,
  DollarSign,
  AlertCircle,
  Check,
  RotateCcw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface KanbanLead extends Contact {
  stage_id: string | null;
  last_message?: string;
}

interface LeadCardProps {
  lead: KanbanLead;
  stage: Tag; // Tag de etapa (Chatwoot) = coluna do Kanban
  isDragging?: boolean;
  isNew?: boolean; // Indicates if this is a newly added lead
  onClick: () => void;
  onDragStart: () => void;
}

export function LeadCard({ lead, stage, isDragging, isNew, onClick, onDragStart }: LeadCardProps) {
  const { getContactSales } = useFinance();

  const sales = useMemo(() => getContactSales(lead.id), [lead.id, getContactSales]);

  const saleIndicator = useMemo(() => {
    if (sales.length === 0) return null;

    const hasPaid = sales.some((s) => s.status === 'paid');
    const hasPending = sales.some((s) => s.status === 'pending');
    const hasRefunded = sales.some((s) => s.status === 'refunded');

    if (hasPaid) return { status: 'paid' as SaleStatus, label: 'Paga', color: 'bg-green-500' };
    if (hasPending) return { status: 'pending' as SaleStatus, label: 'Pendente', color: 'bg-yellow-500' };
    if (hasRefunded) return { status: 'refunded' as SaleStatus, label: 'Estornada', color: 'bg-red-500' };

    return null;
  }, [sales]);

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getOriginBadge = (origem: string | null) => {
    switch (origem) {
      case 'whatsapp':
        return <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-500">WhatsApp</Badge>;
      case 'instagram':
        return <Badge variant="secondary" className="text-xs bg-pink-500/10 text-pink-500">Instagram</Badge>;
      case 'site':
        return <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-500">Site</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">Manual</Badge>;
    }
  };

  const getSaleStatusIcon = (status: SaleStatus) => {
    switch (status) {
      case 'paid':
        return <Check className="w-3 h-3" />;
      case 'pending':
        return <AlertCircle className="w-3 h-3" />;
      case 'refunded':
        return <RotateCcw className="w-3 h-3" />;
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        'kanban-card p-3 rounded-lg bg-card border border-border cursor-pointer transition-all hover:shadow-md hover:border-primary/30',
        isDragging && 'opacity-50 scale-95',
        isNew && 'kanban-card-new'
      )}
      style={{ borderLeftColor: stage.color, borderLeftWidth: 3 }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <GripVertical className="w-4 h-4 text-muted-foreground/50" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials(lead.nome)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-sm truncate">{lead.nome || 'Sem nome'}</span>

            {saleIndicator && (
              <div
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white',
                  saleIndicator.color
                )}
                title={`Venda: ${saleIndicator.label}`}
              >
                {getSaleStatusIcon(saleIndicator.status)}
                <DollarSign className="w-2.5 h-2.5" />
              </div>
            )}
          </div>

          {lead.telefone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Phone className="w-3 h-3" />
              {lead.telefone}
            </p>
          )}

          <div className="flex items-center justify-between mt-2">
            {getOriginBadge(lead.origem)}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(new Date(lead.updated_at), 'dd/MM', { locale: ptBR })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
