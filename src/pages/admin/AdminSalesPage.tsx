import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFinance } from '@/contexts/FinanceContext';
import { SaleStatus } from '@/types/crm';
import { RefundConfirmationDialog } from '@/components/finance/RefundConfirmationDialog';
import { CreateSaleDialog } from '@/components/finance/CreateSaleDialog';
import { Card, CardContent } from '@/components/ui/card';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AdminSalesPage() {
  const { 
    sales, 
    getContactById, 
    markAsPaid, 
    refundSale,
    kpis,
  } = useFinance();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SaleStatus | 'all'>('all');
  const [refundDialog, setRefundDialog] = useState<{ open: boolean; saleId: string | null; valor: number }>({
    open: false,
    saleId: null,
    valor: 0,
  });

  const filteredSales = sales.filter((sale) => {
    const contact = getContactById(sale.contact_id);
    const matchesSearch = contact?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPIs from context
  const totalRevenue = kpis.faturamentoBruto;
  const pendingSalesCount = kpis.vendasPendentes.count;
  const paidSalesCount = kpis.vendasPagas.count;
  const avgTicket = kpis.ticketMedio;

  const getContactName = (contactId: string) => {
    const contact = getContactById(contactId);
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

  const getPaymentMethodBadge = (method: string | null) => {
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

  const handleMarkAsPaid = (saleId: string) => {
    markAsPaid(saleId);
    toast.success('Pagamento confirmado!');
  };

  const handleRefundConfirm = (reason: string) => {
    if (!refundDialog.saleId) return;
    refundSale(refundDialog.saleId, reason);
    setRefundDialog({ open: false, saleId: null, valor: 0 });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Vendas</h1>
          <p className="text-muted-foreground">Gerencie vendas e pagamentos</p>
        </div>
        <CreateSaleDialog
          trigger={
            <Button className="bg-gradient-primary hover:opacity-90 gap-2">
              <Plus className="w-4 h-4" />
              Nova Venda
            </Button>
          }
        />
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
                <p className="text-2xl font-bold">{paidSalesCount}</p>
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
                <p className="text-2xl font-bold text-warning">{pendingSalesCount}</p>
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
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma venda encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => (
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
                              onClick={() => setRefundDialog({ open: true, saleId: sale.id, valor: sale.valor })}
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Estornar
                            </DropdownMenuItem>
                          )}
                          {sale.status === 'refunded' && (
                            <DropdownMenuItem disabled>
                              Nenhuma ação disponível
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Refund Dialog with Password Confirmation */}
      <RefundConfirmationDialog
        open={refundDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setRefundDialog({ open: false, saleId: null, valor: 0 });
          }
        }}
        saleValue={refundDialog.valor}
        onConfirm={handleRefundConfirm}
      />
    </div>
  );
}
