import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { mockSales, mockContacts } from '@/data/mockData';
import { Sale, SaleStatus } from '@/types/crm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  MoreHorizontal,
  CheckCircle,
  RotateCcw,
  DollarSign,
  TrendingUp,
  Clock,
  CreditCard,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AdminSalesPage() {
  const { account } = useAuth();
  const accountId = account?.id || 'acc-1';
  const accountContacts = mockContacts.filter((c) => c.account_id === accountId);

  const [sales, setSales] = useState<Sale[]>(
    mockSales.filter((s) => s.account_id === accountId)
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SaleStatus | 'all'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [refundSale, setRefundSale] = useState<Sale | null>(null);
  const [refundReason, setRefundReason] = useState('');

  const [formData, setFormData] = useState({
    contact_id: '',
    valor: '',
    metodo_pagamento: 'pix' as Sale['metodo_pagamento'],
  });

  const filteredSales = sales.filter((sale) => {
    const contact = accountContacts.find((c) => c.id === sale.contact_id);
    const matchesSearch = contact?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPIs
  const totalRevenue = sales.filter((s) => s.status === 'paid').reduce((sum, s) => sum + s.valor, 0);
  const pendingSales = sales.filter((s) => s.status === 'pending').length;
  const paidSales = sales.filter((s) => s.status === 'paid').length;
  const avgTicket = paidSales > 0 ? totalRevenue / paidSales : 0;

  const getContactName = (contactId: string) => {
    const contact = accountContacts.find((c) => c.id === contactId);
    return contact?.nome || 'Cliente';
  };

  const getStatusBadge = (status: SaleStatus) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-success/10 text-success border-success/20">Pago</Badge>;
      case 'pending':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Pendente</Badge>;
      case 'refunded':
        return <Badge className="bg-primary/10 text-primary border-primary/20">Estornado</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const getPaymentMethodBadge = (method: Sale['metodo_pagamento']) => {
    switch (method) {
      case 'pix':
        return <Badge variant="secondary">PIX</Badge>;
      case 'cartao':
        return <Badge variant="secondary">Cartão</Badge>;
      case 'boleto':
        return <Badge variant="secondary">Boleto</Badge>;
      case 'dinheiro':
        return <Badge variant="secondary">Dinheiro</Badge>;
      case 'convenio':
        return <Badge variant="secondary">Convênio</Badge>;
      default:
        return <Badge variant="secondary">-</Badge>;
    }
  };

  const handleCreate = () => {
    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      account_id: accountId,
      contact_id: formData.contact_id,
      product_id: 'prod-1',
      valor: parseFloat(formData.valor),
      status: 'pending',
      metodo_pagamento: formData.metodo_pagamento,
      responsavel_id: 'user-admin-1',
      created_at: new Date().toISOString(),
      paid_at: null,
      refunded_at: null,
    };
    setSales([newSale, ...sales]);
    setIsCreateOpen(false);
    setFormData({ contact_id: '', valor: '', metodo_pagamento: 'pix' });
    toast.success('Venda registrada com sucesso!');
  };

  const handleMarkAsPaid = (saleId: string) => {
    setSales(
      sales.map((s) =>
        s.id === saleId ? { ...s, status: 'paid' as SaleStatus, paid_at: new Date().toISOString() } : s
      )
    );
    toast.success('Pagamento confirmado!');
  };

  const handleRefund = () => {
    if (!refundSale) return;
    setSales(
      sales.map((s) =>
        s.id === refundSale.id
          ? { ...s, status: 'refunded' as SaleStatus, refunded_at: new Date().toISOString() }
          : s
      )
    );
    setRefundSale(null);
    setRefundReason('');
    toast.success('Estorno realizado com sucesso!');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Vendas</h1>
          <p className="text-muted-foreground">Gerencie vendas e pagamentos</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary hover:opacity-90 gap-2">
              <Plus className="w-4 h-4" />
              Nova Venda
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Venda</DialogTitle>
              <DialogDescription>Adicione uma nova venda ao sistema</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="contact">Cliente</Label>
                <Select
                  value={formData.contact_id}
                  onValueChange={(v) => setFormData({ ...formData, contact_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountContacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.nome || 'Sem nome'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor (R$)</Label>
                  <Input
                    id="valor"
                    type="number"
                    step="0.01"
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metodo">Método</Label>
                  <Select
                    value={formData.metodo_pagamento || 'pix'}
                    onValueChange={(v) =>
                      setFormData({ ...formData, metodo_pagamento: v as Sale['metodo_pagamento'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formData.contact_id || !formData.valor}
              >
                Registrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Faturamento Total</p>
                <p className="text-2xl font-bold text-success">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-success/10">
                <DollarSign className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(avgTicket)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vendas Pagas</p>
                <p className="text-2xl font-bold">{paidSales}</p>
              </div>
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-warning">{pendingSales}</p>
              </div>
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="w-5 h-5 text-warning" />
              </div>
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
                placeholder="Buscar por cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SaleStatus | 'all')}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="refunded">Estornados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">{getContactName(sale.contact_id)}</TableCell>
                  <TableCell className="font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.valor)}
                  </TableCell>
                  <TableCell>{getPaymentMethodBadge(sale.metodo_pagamento)}</TableCell>
                  <TableCell>{getStatusBadge(sale.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {sale.status === 'pending' && (
                          <DropdownMenuItem onClick={() => handleMarkAsPaid(sale.id)}>
                            <CheckCircle className="w-4 h-4 mr-2 text-success" />
                            Confirmar Pagamento
                          </DropdownMenuItem>
                        )}
                        {sale.status === 'paid' && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setRefundSale(sale)}
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Estornar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={!!refundSale} onOpenChange={() => setRefundSale(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Estornar Venda</DialogTitle>
            <DialogDescription>
              Esta ação criará um evento de estorno no sistema
            </DialogDescription>
          </DialogHeader>
          {refundSale && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Valor a estornar</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(refundSale.valor)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo do estorno</Label>
                <Input
                  id="reason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Descreva o motivo..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundSale(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRefund}>
              Confirmar Estorno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
