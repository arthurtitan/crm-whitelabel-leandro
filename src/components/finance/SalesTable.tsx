import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useFinance } from '@/contexts/FinanceContext';
import { Sale, SaleStatus, PaymentMethod } from '@/types/crm';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  RotateCcw,
  Receipt,
} from 'lucide-react';
import { toast } from 'sonner';

interface SalesTableProps {
  isLoading?: boolean;
}

export function SalesTable({ isLoading = false }: SalesTableProps) {
  const { sales, getContactById, markAsPaid, cancelSale, refundSale } = useFinance();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SaleStatus | 'all'>('all');
  const [refundDialog, setRefundDialog] = useState<{ open: boolean; sale: Sale | null }>({
    open: false,
    sale: null,
  });
  const [refundReason, setRefundReason] = useState('');

  const filteredSales = sales.filter((sale) => {
    const contact = getContactById(sale.contact_id);
    const matchesSearch = contact?.nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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

  const getPaymentMethodBadge = (method: PaymentMethod | null) => {
    const labels: Record<PaymentMethod, string> = {
      pix: 'PIX',
      cartao: 'Cartão',
      boleto: 'Boleto',
      dinheiro: 'Dinheiro',
      convenio: 'Convênio',
    };
    return method ? (
      <Badge variant="secondary">{labels[method]}</Badge>
    ) : (
      <Badge variant="outline">-</Badge>
    );
  };

  const handleMarkAsPaid = (saleId: string) => {
    markAsPaid(saleId);
    toast.success('Pagamento confirmado!');
  };

  const handleCancelSale = (saleId: string) => {
    cancelSale(saleId);
    toast.success('Venda cancelada!');
  };

  const handleRefund = () => {
    if (!refundDialog.sale) return;
    refundSale(refundDialog.sale.id, refundReason);
    setRefundDialog({ open: false, sale: null });
    setRefundReason('');
    toast.success('Estorno realizado com sucesso!');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-semibold">Tabela de Vendas</CardTitle>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as SaleStatus | 'all')}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="refunded">Estornado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Pagamento</TableHead>
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
                  filteredSales.map((sale) => {
                    const contact = getContactById(sale.contact_id);
                    return (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">
                          {contact?.nome || 'Cliente não encontrado'}
                        </TableCell>
                        <TableCell>{formatCurrency(sale.valor)}</TableCell>
                        <TableCell>{getPaymentMethodBadge(sale.metodo_pagamento)}</TableCell>
                        <TableCell>{getStatusBadge(sale.status)}</TableCell>
                        <TableCell>
                          {format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm', {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {sale.status === 'pending' && (
                                <>
                                  <DropdownMenuItem onClick={() => handleMarkAsPaid(sale.id)}>
                                    <CheckCircle className="w-4 h-4 mr-2 text-success" />
                                    Marcar como Pago
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleCancelSale(sale.id)}>
                                    <XCircle className="w-4 h-4 mr-2 text-destructive" />
                                    Cancelar Venda
                                  </DropdownMenuItem>
                                </>
                              )}
                              {sale.status === 'paid' && (
                                <DropdownMenuItem
                                  onClick={() => setRefundDialog({ open: true, sale })}
                                >
                                  <RotateCcw className="w-4 h-4 mr-2 text-warning" />
                                  Estornar Venda
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <AlertDialog
        open={refundDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setRefundDialog({ open: false, sale: null });
            setRefundReason('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Estorno</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a estornar uma venda de{' '}
              <strong>{refundDialog.sale && formatCurrency(refundDialog.sale.valor)}</strong>.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Motivo do estorno</label>
            <Textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Descreva o motivo do estorno..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRefund} className="bg-destructive text-destructive-foreground">
              Confirmar Estorno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
