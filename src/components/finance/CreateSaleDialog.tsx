import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFinance } from '@/contexts/FinanceContext';
import { PaymentMethod } from '@/types/crm';
import { Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export function CreateSaleDialog() {
  const { contacts, createSale, canCreateSale, getContactFunnelStage } = useFinance();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    contactId: '',
    valor: '',
    metodoPagamento: '' as PaymentMethod | '',
  });
  const [validation, setValidation] = useState<{ allowed: boolean; reason?: string } | null>(null);

  const handleContactChange = (contactId: string) => {
    setFormData((prev) => ({ ...prev, contactId }));
    const result = canCreateSale(contactId);
    setValidation(result);
  };

  const handleSubmit = () => {
    if (!formData.contactId || !formData.valor) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const result = createSale({
      contactId: formData.contactId,
      valor: parseFloat(formData.valor),
      metodoPagamento: formData.metodoPagamento || null,
    });

    if (result.success) {
      toast.success('Venda criada com sucesso!');
      setOpen(false);
      setFormData({ contactId: '', valor: '', metodoPagamento: '' });
      setValidation(null);
    } else {
      toast.error(result.error || 'Erro ao criar venda');
    }
  };

  const resetForm = () => {
    setFormData({ contactId: '', valor: '', metodoPagamento: '' });
    setValidation(null);
  };

  // Filter contacts that can have sales (in funnel)
  const eligibleContacts = contacts.filter((c) => {
    const stage = getContactFunnelStage(c.id);
    return stage !== null;
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Venda
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Nova Venda</DialogTitle>
          <DialogDescription>
            Crie uma nova venda vinculada a um lead do funil. Apenas leads em etapas avançadas podem ter vendas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Contact Selection */}
          <div className="space-y-2">
            <Label htmlFor="contact">Cliente *</Label>
            <Select value={formData.contactId} onValueChange={handleContactChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {eligibleContacts.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum lead elegível no funil
                  </SelectItem>
                ) : (
                  eligibleContacts.map((contact) => {
                    const stage = getContactFunnelStage(contact.id);
                    return (
                      <SelectItem key={contact.id} value={contact.id}>
                        <div className="flex items-center gap-2">
                          <span>{contact.nome}</span>
                          <span className="text-xs text-muted-foreground">({stage})</span>
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>

            {/* Validation feedback */}
            {validation && (
              <Alert
                variant={validation.allowed ? 'default' : 'destructive'}
                className="mt-2"
              >
                {validation.allowed ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  {validation.allowed
                    ? 'Lead elegível para venda'
                    : validation.reason}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label htmlFor="valor">Valor *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, valor: e.target.value }))
                }
                className="pl-10"
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Método de Pagamento</Label>
            <Select
              value={formData.metodoPagamento}
              onValueChange={(v) =>
                setFormData((prev) => ({
                  ...prev,
                  metodoPagamento: v as PaymentMethod,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!validation?.allowed || !formData.valor}
          >
            Criar Venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
