

## Problema

Dois problemas na cadeia de estorno:

1. **Validação de senha hardcoded**: `RefundConfirmationDialog` valida contra um dicionário fixo `DEMO_CREDENTIALS` com apenas 6 emails de demonstração. Emails reais como `admin@gleps.com.br` não estão na lista, causando "Senha incorreta" sempre.

2. **Estorno não persiste no backend**: `FinanceContext.refundSale()` apenas atualiza o state local com `setSales(...)` — nunca chama `financeBackendService.refundSale()`. O mesmo problema existe para `refundSaleItem()`.

## Correção

### 1. `src/components/finance/RefundConfirmationDialog.tsx`

Remover o `DEMO_CREDENTIALS` e a validação local de senha. Em vez disso, o dialog apenas coleta a senha e o motivo, e repassa ambos para o `onConfirm`:

- Alterar a interface: `onConfirm: (reason: string, password: string) => void`
- O `handleConfirm` apenas valida que os campos não estão vazios e chama `onConfirm(reason, password)` — a validação real ocorre no backend via middleware `verifyPassword`

### 2. `src/contexts/FinanceContext.tsx` — `refundSale` e `refundSaleItem`

Quando `useBackend === true`, chamar o backend service com a senha no header:

```typescript
const refundSale = useCallback(
  async (saleId: string, reason: string, password?: string) => {
    if (useBackend) {
      await financeBackendService.refundSale(saleId, reason, password);
      await fetchSalesFromDb(); // re-fetch para atualizar
      return;
    }
    // fallback local...
  },
  [useBackend, createEvent]
);
```

### 3. `src/services/finance.backend.service.ts` — `refundSale` e `refundSaleItem`

Enviar a senha via header `x-confirm-password`:

```typescript
refundSale: async (saleId: string, reason: string, password?: string): Promise<Sale> => {
  const headers: Record<string, string> = {};
  if (password) headers['x-confirm-password'] = password;
  const res = await apiClient.post<ApiResponse<Sale>>(
    API_ENDPOINTS.SALES.REFUND(saleId),
    { reason },
    { headers }
  );
  return res.data;
},
```

### 4. Callers (`SalesTable`, `AdminSalesPage`, `LeadProfileSheet`, `SaleDetailsSheet`)

Atualizar o `handleRefundConfirm` para repassar a senha recebida do dialog:

```typescript
const handleRefundConfirm = (reason: string, password: string) => {
  if (!refundDialog.saleId) return;
  refundSale(refundDialog.saleId, reason, password);
};
```

### 5. `ItemRefundDialog` (estorno parcial)

Aplicar a mesma correção: coletar senha, enviar via `refundSaleItem(saleId, itemId, reason, password)`.

