import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ExtractedLead, ChatwootInbox } from './types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: ExtractedLead[];
  accountId: string;
}

export function DispatchDialog({ open, onOpenChange, leads, accountId }: Props) {
  const { toast } = useToast();
  const [inboxes, setInboxes] = useState<ChatwootInbox[]>([]);
  const [selectedInbox, setSelectedInbox] = useState<string>('');
  const [delay, setDelay] = useState('30');
  const [messages, setMessages] = useState<string[]>(['']);
  const [isSending, setIsSending] = useState(false);
  const [loadingInboxes, setLoadingInboxes] = useState(false);

  // Fetch inboxes on open
  useEffect(() => {
    if (!open || !accountId) return;
    setLoadingInboxes(true);
    supabase.functions
      .invoke('dispatch-messages', {
        body: { action: 'list-inboxes', account_id: accountId },
      })
      .then(({ data, error }) => {
        if (error || !data?.inboxes) {
          console.error('Failed to load inboxes', error);
          return;
        }
        setInboxes(data.inboxes);
      })
      .finally(() => setLoadingInboxes(false));
  }, [open, accountId]);

  const addMessage = () => {
    if (messages.length >= 10) return;
    setMessages([...messages, '']);
  };

  const removeMessage = (idx: number) => {
    if (messages.length <= 1) return;
    setMessages(messages.filter((_, i) => i !== idx));
  };

  const updateMessage = (idx: number, value: string) => {
    const next = [...messages];
    next[idx] = value;
    setMessages(next);
  };

  const handleDispatch = async () => {
    const validMessages = messages.filter(m => m.trim());
    if (!selectedInbox || validMessages.length === 0) {
      toast({ title: 'Selecione um número e adicione pelo menos 1 mensagem', variant: 'destructive' });
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('dispatch-messages', {
        body: {
          action: 'dispatch',
          account_id: accountId,
          inbox_id: Number(selectedInbox),
          delay_seconds: Number(delay) || 30,
          messages: validMessages,
          contacts: leads.map(l => ({
            nome: l.nome,
            telefone: l.telefone,
          })),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha no disparo');

      toast({
        title: 'Disparo iniciado!',
        description: `${leads.length} mensagens sendo enviadas com intervalo de ${delay}s.`,
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error('Dispatch error:', err);
      toast({ title: 'Erro no disparo', description: err.message, variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Disparo</DialogTitle>
          <DialogDescription>
            Enviar mensagens para {leads.length} contatos selecionados
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Inbox selection */}
          <div className="space-y-2">
            <Label>Número (Inbox do Chatwoot)</Label>
            {loadingInboxes ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando números...
              </div>
            ) : (
              <Select value={selectedInbox} onValueChange={setSelectedInbox}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o número para envio" />
                </SelectTrigger>
                <SelectContent>
                  {inboxes.map(inbox => (
                    <SelectItem key={inbox.id} value={String(inbox.id)}>
                      {inbox.name} {inbox.phone_number ? `(${inbox.phone_number})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Delay */}
          <div className="space-y-2">
            <Label>Delay entre mensagens (segundos)</Label>
            <Input
              type="number"
              min={5}
              max={300}
              value={delay}
              onChange={e => setDelay(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Intervalo mínimo de 5 segundos entre cada envio
            </p>
          </div>

          {/* Messages */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Variantes de Mensagem ({messages.length}/10)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMessage}
                disabled={messages.length >= 10}
              >
                <Plus className="w-3 h-3 mr-1" />
                Adicionar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O sistema escolherá aleatoriamente uma variante para cada contato
            </p>
            {messages.map((msg, idx) => (
              <div key={idx} className="flex gap-2">
                <Textarea
                  placeholder={`Mensagem ${idx + 1}... Use {nome} para o nome do contato`}
                  value={msg}
                  onChange={e => updateMessage(idx, e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                {messages.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMessage(idx)}
                    className="self-start"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancelar
          </Button>
          <Button onClick={handleDispatch} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar para {leads.length} contatos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
