import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Lock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// Demo credentials for validation (matching AuthContext)
const DEMO_CREDENTIALS: Record<string, string> = {
  'superadmin@sistema.com': 'Admin@123',
  'carlos@clinicavidaplena.com': 'Admin@123',
  'ana@clinicavidaplena.com': 'Agent@123',
  'pedro@clinicavidaplena.com': 'Agent@123',
  'marina@techsolutions.com': 'Admin@123',
  'lucas@techsolutions.com': 'Agent@123',
};

interface RefundConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleValue: number;
  onConfirm: (reason: string) => void;
}

export function RefundConfirmationDialog({
  open,
  onOpenChange,
  saleValue,
  onConfirm,
}: RefundConfirmationDialogProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleConfirm = async () => {
    if (!password.trim()) {
      setError('Digite sua senha para confirmar');
      return;
    }

    if (!reason.trim()) {
      setError('Informe o motivo do estorno');
      return;
    }

    setIsValidating(true);
    setError('');

    // Simulate validation delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Validate password
    const userEmail = user?.email;
    if (!userEmail) {
      setError('Erro ao identificar usuário');
      setIsValidating(false);
      return;
    }

    const validPassword = DEMO_CREDENTIALS[userEmail];
    if (!validPassword || validPassword !== password) {
      setError('Senha incorreta');
      setIsValidating(false);
      return;
    }

    // Password validated, proceed with refund
    setIsValidating(false);
    onConfirm(reason);
    handleClose();
    toast.success('Estorno realizado com sucesso!');
  };

  const handleClose = () => {
    setPassword('');
    setReason('');
    setError('');
    setIsValidating(false);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Confirmar Estorno
          </AlertDialogTitle>
          <AlertDialogDescription>
            Você está prestes a estornar uma venda de{' '}
            <strong className="text-foreground">{formatCurrency(saleValue)}</strong>.
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">
              Para confirmar o estorno, digite sua senha de acesso ao sistema.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-reason">Motivo do estorno</Label>
            <Textarea
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo do estorno..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="refund-password" className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Sua senha
            </Label>
            <Input
              id="refund-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Digite sua senha para confirmar"
              className={error ? 'border-destructive' : ''}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose} disabled={isValidating}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isValidating || !password || !reason}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isValidating ? 'Validando...' : 'Confirmar Estorno'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
