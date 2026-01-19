import { useState, useMemo, useEffect, ReactNode } from 'react';
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
import { Plus, AlertCircle, CheckCircle, UserPlus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { mockProducts } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';

interface NewContactForm {
  nome: string;
  telefone: string;
  email: string;
  origem: string;
}

interface CreateSaleDialogProps {
  preSelectedContactId?: string;
  trigger?: ReactNode;
  onClose?: () => void;
}

export function CreateSaleDialog({ preSelectedContactId, trigger, onClose }: CreateSaleDialogProps) {
  const { contacts, createSale, canCreateSale, getContactFunnelStage, createContact } = useFinance();
  const { user, account } = useAuth();
  const [open, setOpen] = useState(false);
  const [isCreatingNewContact, setIsCreatingNewContact] = useState(false);
  
  const [formData, setFormData] = useState({
    contactId: '',
    productId: '',
    valor: '',
    metodoPagamento: '' as PaymentMethod | '',
    convenioNome: '',
  });
  
  const [newContact, setNewContact] = useState<NewContactForm>({
    nome: '',
    telefone: '',
    email: '',
    origem: 'manual',
  });
  
  const [validation, setValidation] = useState<{ allowed: boolean; reason?: string } | null>(null);

  const accountId = account?.id || 'acc-1';
  const accountProducts = useMemo(
    () => mockProducts.filter((p) => p.account_id === accountId && p.ativo),
    [accountId]
  );

  const selectedProduct = useMemo(
    () => accountProducts.find((p) => p.id === formData.productId),
    [accountProducts, formData.productId]
  );

  const availablePaymentMethods = useMemo(() => {
    if (!selectedProduct) return [];
    return selectedProduct.metodos_pagamento;
  }, [selectedProduct]);

  const valorDifersFromDefault = useMemo(() => {
    if (!selectedProduct || !formData.valor) return false;
    const valor = parseFloat(formData.valor);
    return valor !== selectedProduct.valor_padrao;
  }, [selectedProduct, formData.valor]);

  // Handle preSelectedContactId
  useEffect(() => {
    if (preSelectedContactId) {
      setFormData((prev) => ({ ...prev, contactId: preSelectedContactId }));
      const result = canCreateSale(preSelectedContactId);
      setValidation(result);
      setOpen(true);
    }
  }, [preSelectedContactId, canCreateSale]);

  const handleContactChange = (value: string) => {
    if (value === 'new') {
      setIsCreatingNewContact(true);
      setFormData((prev) => ({ ...prev, contactId: '' }));
      setValidation(null);
    } else {
      setIsCreatingNewContact(false);
      setFormData((prev) => ({ ...prev, contactId: value }));
      const result = canCreateSale(value);
      setValidation(result);
    }
  };

  const handleProductChange = (productId: string) => {
    const product = accountProducts.find((p) => p.id === productId);
    setFormData((prev) => ({
      ...prev,
      productId,
      valor: product ? product.valor_padrao.toString() : '',
      metodoPagamento: '',
      convenioNome: '',
    }));
  };

  const handleSubmit = () => {
    // Validations
    if (isCreatingNewContact) {
      if (!newContact.nome.trim() || !newContact.telefone.trim()) {
        toast.error('Nome e telefone são obrigatórios para novo cliente');
        return;
      }
    } else if (!formData.contactId) {
      toast.error('Selecione um cliente');
      return;
    }

    if (!formData.productId) {
      toast.error('Selecione um produto/procedimento');
      return;
    }

    if (!formData.valor || parseFloat(formData.valor) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    if (!formData.metodoPagamento) {
      toast.error('Selecione o método de pagamento');
      return;
    }

    if (formData.metodoPagamento === 'convenio' && !formData.convenioNome.trim()) {
      toast.error('Informe o nome do convênio');
      return;
    }

    let contactId = formData.contactId;

    // Create new contact if needed
    if (isCreatingNewContact) {
      const newContactResult = createContact({
        nome: newContact.nome,
        telefone: newContact.telefone,
        email: newContact.email || null,
        origem: newContact.origem || 'manual',
      });
      
      if (!newContactResult.success || !newContactResult.contactId) {
        toast.error(newContactResult.error || 'Erro ao criar cliente');
        return;
      }
      contactId = newContactResult.contactId;
    }

    const result = createSale({
      contactId,
      productId: formData.productId,
      valor: parseFloat(formData.valor),
      metodoPagamento: formData.metodoPagamento as PaymentMethod,
      responsavelId: user?.id || 'user-admin-1',
      convenioNome: formData.metodoPagamento === 'convenio' ? formData.convenioNome : undefined,
    });

    if (result.success) {
      toast.success('Venda registrada com sucesso!');
      handleClose();
    } else {
      toast.error(result.error || 'Erro ao criar venda');
    }
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
    onClose?.();
  };

  const resetForm = () => {
    setFormData({ contactId: '', productId: '', valor: '', metodoPagamento: '', convenioNome: '' });
    setNewContact({ nome: '', telefone: '', email: '', origem: 'manual' });
    setValidation(null);
    setIsCreatingNewContact(false);
  };

  // Filter contacts that can have sales (in funnel)
  const eligibleContacts = contacts.filter((c) => {
    const stage = getContactFunnelStage(c.id);
    return stage !== null;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Get pre-selected contact name for display
  const preSelectedContact = preSelectedContactId
    ? contacts.find((c) => c.id === preSelectedContactId)
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        } else {
          setOpen(true);
        }
      }}
    >
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Venda
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Nova Venda</DialogTitle>
          <DialogDescription>
            Crie uma nova venda vinculando um cliente e produto. Vendas são lançamentos manuais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Contact Selection */}
          <div className="space-y-2">
            <Label htmlFor="contact">Cliente *</Label>
            {preSelectedContactId && preSelectedContact ? (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="font-medium">{preSelectedContact.nome}</p>
                <p className="text-sm text-muted-foreground">{preSelectedContact.telefone}</p>
              </div>
            ) : (
              <Select 
                value={isCreatingNewContact ? 'new' : formData.contactId} 
                onValueChange={handleContactChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-primary" />
                      <span className="font-medium">Cliente novo</span>
                    </div>
                  </SelectItem>
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
                            <span className="text-xs text-muted-foreground">— {stage}</span>
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            )}

            {/* Validation feedback for existing contact */}
            {!isCreatingNewContact && validation && (
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

          {/* New Contact Form */}
          {isCreatingNewContact && !preSelectedContactId && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
              <p className="text-sm font-medium text-muted-foreground">Dados do novo cliente</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="nome" className="text-xs">Nome *</Label>
                  <Input
                    id="nome"
                    value={newContact.nome}
                    onChange={(e) => setNewContact((prev) => ({ ...prev, nome: e.target.value }))}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="telefone" className="text-xs">Telefone *</Label>
                  <Input
                    id="telefone"
                    value={newContact.telefone}
                    onChange={(e) => setNewContact((prev) => ({ ...prev, telefone: e.target.value }))}
                    placeholder="+55 11 99999-9999"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs">Email (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="origem" className="text-xs">Origem</Label>
                  <Select
                    value={newContact.origem}
                    onValueChange={(v) => setNewContact((prev) => ({ ...prev, origem: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="site">Site</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Product Selection */}
          <div className="space-y-2">
            <Label htmlFor="product">Produto / Procedimento *</Label>
            <Select value={formData.productId} onValueChange={handleProductChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {accountProducts.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum produto cadastrado
                  </SelectItem>
                ) : (
                  accountProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span>{product.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(product.valor_padrao)}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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
            {valorDifersFromDefault && selectedProduct && (
              <Alert className="mt-2 bg-warning/10 border-warning/20">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-sm">
                  Valor diferente do padrão ({formatCurrency(selectedProduct.valor_padrao)}). 
                  Confirme se é uma promoção ou desconto.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Método de Pagamento *</Label>
            <Select
              value={formData.metodoPagamento}
              onValueChange={(v) =>
                setFormData((prev) => ({
                  ...prev,
                  metodoPagamento: v as PaymentMethod,
                  convenioNome: v !== 'convenio' ? '' : prev.convenioNome,
                }))
              }
              disabled={!selectedProduct}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedProduct ? 'Selecione' : 'Selecione um produto primeiro'} />
              </SelectTrigger>
              <SelectContent>
                {availablePaymentMethods.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method === 'pix' && 'PIX'}
                    {method === 'cartao' && 'Cartão'}
                    {method === 'boleto' && 'Boleto'}
                    {method === 'dinheiro' && 'Dinheiro'}
                    {method === 'convenio' && 'Convênio'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Convenio Name (if convenio selected) */}
          {formData.metodoPagamento === 'convenio' && (
            <div className="space-y-2">
              <Label htmlFor="convenioNome">Nome do Convênio *</Label>
              <Input
                id="convenioNome"
                value={formData.convenioNome}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, convenioNome: e.target.value }))
                }
                placeholder="Ex: Unimed, Bradesco Saúde..."
              />
            </div>
          )}

          {/* Status info */}
          <Alert className="bg-muted/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              A venda será criada com status <strong>PENDENTE</strong>. 
              Altere para <strong>PAGA</strong> quando o pagamento for confirmado.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              (!isCreatingNewContact && !preSelectedContactId && !validation?.allowed) ||
              (preSelectedContactId && !validation?.allowed) ||
              !formData.productId ||
              !formData.valor ||
              !formData.metodoPagamento
            }
          >
            Registrar Venda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
