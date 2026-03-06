
Diagnóstico consolidado (pelos arquivos atuais):

1) Vendas “sumindo” / não persistindo
- `src/contexts/FinanceContext.tsx`:
  - `createSale` (linha ~573) só faz `setSales` local (ID `sale-${Date.now()}`), não chama API.
  - `markAsPaid` e `cancelSale` também só alteram estado local.
- `src/services/finance.backend.service.ts`:
  - `fetchSales` retorna payload bruto do backend (`camelCase`) sem mapear para o formato do frontend (`snake_case`).
  - Resultado: campos como `contact_id`, `metodo_pagamento`, `responsavel_id`, `created_at` ficam inválidos/ausentes no UI.
- Efeito prático: venda parece criada no momento, mas ao recarregar não existe no backend (ou, se existir, pode não renderizar corretamente por incompatibilidade de shape).

2) Regra de senha no estorno quebrada
- Backend continua exigindo senha:
  - `backend/src/routes/sale.routes.ts` usa `verifyPassword` em `/sales/:id/refund` e `/sales/:id/items/:itemId/refund`.
  - `backend/src/middlewares/auth.middleware.ts` valida `x-confirm-password` (ou body password fallback).
- Frontend foi alterado para remover senha:
  - `RefundConfirmationDialog.tsx` e `ItemRefundDialog.tsx` só pedem motivo.
  - `FinanceContext.refundSale/refundSaleItem` não recebem senha.
  - `finance.backend.service.ts` não envia header `x-confirm-password`.
- Efeito prático: estorno falha por regra de segurança não atendida.

Plano de correção (eficiente e sem mudar regra de negócio):

Fase A — Corrigir persistência e leitura real de vendas
1. Normalizar mapeamento de vendas no backend service
- Arquivo: `src/services/finance.backend.service.ts`
- Criar mapper único `mapSaleFromApi(raw)` + `mapSaleItemFromApi(raw)` para converter:
  - `accountId -> account_id`
  - `contactId -> contact_id`
  - `metodoPagamento -> metodo_pagamento`
  - `convenioNome -> convenio_nome`
  - `responsavelId -> responsavel_id`
  - `isRecurring -> is_recurring`
  - `createdAt/paidAt/refundedAt -> created_at/paid_at/refunded_at`
  - itens: `productId/valorUnitario/valorTotal/refundReason/refundedAt -> product_id/valor_unitario/valor_total/refund_reason/refunded_at`
- Ajustar `fetchSales`, `createSale`, `markAsPaid`, `refundSale`, `refundSaleItem` para sempre retornar venda mapeada.

2. Persistir operações no backend quando `useBackend === true`
- Arquivo: `src/contexts/FinanceContext.tsx`
- `createSale`:
  - deixar assíncrono em modo backend.
  - chamar `financeBackendService.createSale(...)`.
  - após sucesso: `fetchSalesFromDb()` (fonte de verdade).
- `markAsPaid`:
  - chamar `financeBackendService.markAsPaid(saleId)` + `fetchSalesFromDb()`.
- `cancelSale`:
  - em backend mode, desabilitar/ocultar (não existe endpoint/status compatível no backend atual), evitando “falso sucesso local”.
- Manter fallback local apenas para modo não-backend.

3. Evitar corrida “novo contato + nova venda”
- Hoje `createContact` no contexto retorna ID temporário em backend mode.
- Ajuste:
  - tornar `createContact` assíncrono no contexto (ou tratar direto no `CreateSaleDialog` em backend mode) para usar ID real antes de criar venda.
- Arquivo principal: `src/components/finance/CreateSaleDialog.tsx`
  - `handleSubmit` assíncrono.
  - criar contato (se necessário) e só depois chamar `createSale`.

Fase B — Restaurar senha obrigatória no estorno (total e parcial)
4. Reintroduzir campo de senha nos dois diálogos
- Arquivos:
  - `src/components/finance/RefundConfirmationDialog.tsx`
  - `src/components/finance/ItemRefundDialog.tsx`
- Atualizar assinatura para `onConfirm(reason, password)`.
- Validar “motivo + senha” no frontend (somente presença), mantendo validação real no backend.

5. Propagar senha até API
- Arquivos:
  - `src/contexts/FinanceContext.tsx`
  - `src/services/finance.backend.service.ts`
  - `src/components/finance/SalesTable.tsx`
  - `src/pages/admin/AdminSalesPage.tsx`
  - `src/components/leads/LeadProfileSheet.tsx`
  - `src/components/finance/SaleDetailsSheet.tsx`
- `refundSale/refundSaleItem` passam a receber `password`.
- Service envia `x-confirm-password` nos endpoints de estorno.

6. Tratamento correto de erro de estorno
- Não fechar modal antes do sucesso.
- Exibir mensagem do backend (`PASSWORD_REQUIRED`, `PASSWORD_INVALID`, etc.) no diálogo/toast.
- Evitar “silêncio” quando o estorno falhar.

Fase C — Ajustes de robustez visual/dados
7. Tornar filtro de busca resiliente
- Em listagens de vendas, quando busca estiver vazia, não depender de `contact?.nome` para incluir a venda.
- Evita “sumiço visual” se contato ainda não sincronizou.

8. Compatibilizar status do backend
- Incluir suporte visual para `partial_refund` nas tabelas/badges/filtros (sem quebrar `pending/paid/refunded`).

Critérios de aceite (validação final):
1. Criar venda nova e recarregar página: venda permanece.
2. Marcar como paga e recarregar: status permanece pago.
3. Estorno total:
- sem senha: bloqueia com erro claro;
- senha incorreta: erro claro;
- senha correta: estorna e persiste após recarregar.
4. Estorno parcial (item) com mesma regra de senha.
5. Nenhuma regressão no fluxo de criação de venda com cliente já existente e com cliente novo.

Arquivos que entram no pacote de correção:
- `src/services/finance.backend.service.ts`
- `src/contexts/FinanceContext.tsx`
- `src/components/finance/CreateSaleDialog.tsx`
- `src/components/finance/RefundConfirmationDialog.tsx`
- `src/components/finance/ItemRefundDialog.tsx`
- `src/components/finance/SalesTable.tsx`
- `src/pages/admin/AdminSalesPage.tsx`
- `src/components/leads/LeadProfileSheet.tsx`
- `src/components/finance/SaleDetailsSheet.tsx`
- (opcional para UX) `src/components/finance/SaleItemsRow.tsx`
