import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, MessageCircle, Bot, User, Filter } from 'lucide-react';

interface DashboardFiltersProps {
  onPeriodChange?: (period: string) => void;
  onChannelChange?: (channel: string) => void;
  onTypeChange?: (type: string) => void;
}

export function DashboardFilters({
  onPeriodChange,
  onChannelChange,
  onTypeChange,
}: DashboardFiltersProps) {
  const [activePeriod, setActivePeriod] = useState('7d');
  const [channel, setChannel] = useState('all');
  const [type, setType] = useState('all');

  const periods = [
    { value: 'today', label: 'Hoje' },
    { value: '7d', label: '7 dias' },
    { value: '30d', label: '30 dias' },
    { value: 'custom', label: 'Personalizado' },
  ];

  const handlePeriodChange = (period: string) => {
    setActivePeriod(period);
    onPeriodChange?.(period);
  };

  const handleChannelChange = (value: string) => {
    setChannel(value);
    onChannelChange?.(value);
  };

  const handleTypeChange = (value: string) => {
    setType(value);
    onTypeChange?.(value);
  };

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <div className="flex bg-muted rounded-lg p-1">
          {periods.map((period) => (
            <Button
              key={period.value}
              variant={activePeriod === period.value ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => handlePeriodChange(period.value)}
            >
              {period.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="h-6 w-px bg-border" />

      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-muted-foreground" />
        <Select value={channel} onValueChange={handleChannelChange}>
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border z-50">
            <SelectItem value="all">Todos Canais</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="webchat">Webchat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={type} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border z-50">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ia">
              <div className="flex items-center gap-2">
                <Bot className="w-3 h-3" />
                IA
              </div>
            </SelectItem>
            <SelectItem value="human">
              <div className="flex items-center gap-2">
                <User className="w-3 h-3" />
                Humano
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
