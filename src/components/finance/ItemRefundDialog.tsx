import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';

interface ItemRefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  itemValue: number;
  onConfirm: (reason: string) => void;
}

export function ItemRefundDialog({
  open,
  onOpenChange,
  productName,
  itemValue,
  onConfirm,
}: ItemRefundDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError('Informe o motivo do estorno');
      return;
    }

    onConfirm(reason);
    handleClose();
  };

  const handleClose = () => {
    setReason('');
    setError('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Estornar Item
          </AlertDialogTitle>
          <AlertDialogDescription>
            Você está prestes a estornar o item{' '}
            <strong className="text-foreground">{productName}</strong> no valor de{' '}
            <strong className="text-foreground">{formatCurrency(itemValue)}</strong>.
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">
              Atenção: o item será marcado como estornado na venda.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-refund-reason">Motivo do estorno</Label>
            <Textarea
              id="item-refund-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
              placeholder="Descreva o motivo do estorno..."
              rows={2}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>
            Cancelar
          </AlertDialogCancel>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!reason.trim()}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 px-4 py-2"
          >
            Confirmar Estorno
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
