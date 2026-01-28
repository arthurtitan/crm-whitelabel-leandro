import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { tagsCloudService } from '@/services/tags.cloud.service';

const PRESET_COLORS = [
  '#0EA5E9', // Sky blue
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#22C55E', // Green
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
];

interface CreateStageDialogProps {
  trigger?: React.ReactNode;
  onStageCreated?: () => void;
}

export function CreateStageDialog({ trigger, onStageCreated }: CreateStageDialogProps) {
  const { user, account } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const accountId = user?.account_id || account?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Nome da etapa é obrigatório');
      return;
    }

    if (!accountId) {
      toast.error('Conta não encontrada');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get or create default funnel
      let funnel = await tagsCloudService.getDefaultFunnel(accountId);
      
      if (!funnel) {
        // Create a default funnel if it doesn't exist
        funnel = await tagsCloudService.createDefaultFunnel(accountId);
      }

      if (!funnel) {
        toast.error('Erro ao obter funil');
        setIsSubmitting(false);
        return;
      }

      // Create the stage tag
      await tagsCloudService.createStageTag({
        accountId,
        funnelId: funnel.id,
        name: name.trim(),
        color,
      });

      toast.success(`Etapa "${name}" criada! Ela também aparecerá no Chatwoot como etiqueta.`);
      setName('');
      setColor(PRESET_COLORS[0]);
      setOpen(false);
      onStageCreated?.();
    } catch (error: any) {
      console.error('Error creating stage:', error);
      toast.error(error.message || 'Erro ao criar etapa');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setName('');
      setColor(PRESET_COLORS[0]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Etapa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Nova Etapa</DialogTitle>
          <DialogDescription>
            A etapa será criada no Kanban e sincronizada automaticamente como etiqueta no Chatwoot.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="stage-name">Nome da Etapa</Label>
            <Input
              id="stage-name"
              placeholder="Ex: Orçamento Enviado"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Este nome será usado tanto no Kanban quanto no Chatwoot.
            </p>
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Cor da Etapa
            </Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  onClick={() => setColor(presetColor)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === presetColor
                      ? 'border-foreground scale-110 ring-2 ring-offset-2 ring-offset-background'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: presetColor }}
                  title={presetColor}
                />
              ))}
            </div>

            {/* Custom Color Input */}
            <div className="flex items-center gap-2 mt-2">
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-8 p-0 border-0 cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">Cor personalizada</span>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">Prévia:</p>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="font-medium text-sm">{name || 'Nome da Etapa'}</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Criando...' : 'Criar Etapa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
