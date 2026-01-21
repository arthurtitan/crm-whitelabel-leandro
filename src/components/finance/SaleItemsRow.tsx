import { useState, Fragment } from 'react';
import { Sale, SaleItem } from '@/types/crm';
import { useFinance } from '@/contexts/FinanceContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ItemRefundDialog } from './ItemRefundDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  CheckCircle,
  RotateCcw,
  Package,
} from 'lucide-react';

interface SaleItemsRowProps {
  sale: Sale;
  contactName: string;
  onMarkAsPaid: (saleId: string) => void;
  onRefundSale: (saleId: string, valor: number) => void;
}

export function SaleItemsRow({
  sale,
  contactName,
  onMarkAsPaid,
  onRefundSale,
}: SaleItemsRowProps) {
  const { getProductById, refundSaleItem } = useFinance();
  const [isExpanded, setIsExpanded] = useState(false);
  const [itemRefundDialog, setItemRefundDialog] = useState<{
    open: boolean;
    item: SaleItem | null;
    productName: string;
  }>({
    open: false,
    item: null,
    productName: '',
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: Sale['status']) => {
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
    const labels: Record<string, string> = {
      pix: 'PIX',
      debito: 'Débito',
      credito: 'Crédito',
      boleto: 'Boleto',
      dinheiro: 'Dinheiro',
      convenio: 'Convênio',
    };
    return method ? (
      <Badge variant="secondary">{labels[method] || method}</Badge>
    ) : (
      <Badge variant="secondary">-</Badge>
    );
  };

  const hasMultipleItems = sale.items.length > 1;

  const handleItemRefundConfirm = (reason: string) => {
    if (!itemRefundDialog.item) return;
    refundSaleItem(sale.id, itemRefundDialog.item.id, reason);
    setItemRefundDialog({ open: false, item: null, productName: '' });
  };

  // Render product summary
  const renderProductSummary = () => {
    if (sale.items.length === 0) {
      return <span className="text-muted-foreground">Sem itens</span>;
    }
    if (sale.items.length === 1) {
      const product = getProductById(sale.items[0].product_id);
      const isRefunded = (sale.items[0] as any).refunded;
      return (
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          <span className={isRefunded ? 'line-through text-muted-foreground' : ''}>
            {product?.nome || 'Produto'}
          </span>
          {sale.items[0].quantidade > 1 && (
            <Badge variant="outline" className="text-xs">
              x{sale.items[0].quantidade}
            </Badge>
          )}
          {isRefunded && (
            <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
              Estornado
            </Badge>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-muted-foreground" />
        <span>{sale.items.length} produtos</span>
        {hasMultipleItems && (
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-auto hover:bg-transparent text-primary"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Fragment>
      {/* Main sale row */}
      <TableRow className="group">
        <TableCell>
          <span className="font-medium">{contactName}</span>
          {sale.is_recurring && (
            <Badge variant="outline" className="ml-2 text-xs">
              Retorno
            </Badge>
          )}
        </TableCell>
        <TableCell>{renderProductSummary()}</TableCell>
        <TableCell className="font-bold">{formatCurrency(sale.valor)}</TableCell>
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
              <DropdownMenuLabel>Ações da Venda</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sale.status === 'pending' && (
                <DropdownMenuItem onClick={() => onMarkAsPaid(sale.id)}>
                  <CheckCircle className="w-4 h-4 mr-2 text-success" />
                  Confirmar Pagamento
                </DropdownMenuItem>
              )}
              {sale.status === 'paid' && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onRefundSale(sale.id, sale.valor)}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Estornar Venda Completa
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

      {/* Expanded item rows */}
      {isExpanded && hasMultipleItems && sale.items.map((item, index) => {
        const product = getProductById(item.product_id);
        const isRefunded = (item as any).refunded;
        return (
          <TableRow
            key={item.id}
            className={`bg-muted/30 ${isRefunded ? 'opacity-60' : ''}`}
          >
            <TableCell className="pl-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                <span className="text-sm text-muted-foreground">Item {index + 1}</span>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className={isRefunded ? 'line-through text-muted-foreground' : ''}>
                  {product?.nome || 'Produto'}
                </span>
                <Badge variant="outline" className="text-xs">
                  x{item.quantidade}
                </Badge>
                {isRefunded && (
                  <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                    Estornado
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className={isRefunded ? 'line-through text-muted-foreground' : ''}>
              {formatCurrency(item.valor_total)}
            </TableCell>
            <TableCell>
              <span className="text-xs text-muted-foreground">
                {formatCurrency(item.valor_unitario)} un.
              </span>
            </TableCell>
            <TableCell />
            <TableCell />
            <TableCell className="text-right">
              {sale.status === 'paid' && !isRefunded && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    setItemRefundDialog({
                      open: true,
                      item,
                      productName: product?.nome || 'Produto',
                    })
                  }
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Estornar
                </Button>
              )}
            </TableCell>
          </TableRow>
        );
      })}

      {/* Item Refund Dialog */}
      <ItemRefundDialog
        open={itemRefundDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setItemRefundDialog({ open: false, item: null, productName: '' });
          }
        }}
        productName={itemRefundDialog.productName}
        itemValue={itemRefundDialog.item?.valor_total || 0}
        onConfirm={handleItemRefundConfirm}
      />
    </Fragment>
  );
}
