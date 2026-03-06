

## Problemas identificados

### 1. Produtos não aparecem no dropdown de vendas
O `financeBackendService.fetchProducts` retorna `res.data || []` sem mapear os campos do backend (camelCase) para o formato esperado pelo frontend (snake_case). O backend retorna `valorPadrao`, `metodosPagamento`, `conveniosAceitos`, mas a interface `Product` espera `valor_padrao`, `metodos_pagamento`, `convenios_aceitos`.

### 2. "Nenhum lead elegível no funil"
O `CreateSaleDialog` filtra contatos por `getContactFunnelStage(c.id) !== null` (linha 253), que depende de `leadFunnelStates` populado com `mockFunnelStages`. No modo backend, essa lista nunca é preenchida, resultando em 0 contatos elegíveis. O usuário quer que **todos** os contatos sejam elegíveis para venda, sem restrição de etapa.

## Correções

### 1. `src/services/finance.backend.service.ts` — método `fetchProducts`
Mapear campos camelCase para snake_case:

```typescript
fetchProducts: async (accountId: string): Promise<Product[]> => {
  const res = await apiClient.get<ApiResponse<any[]>>(API_ENDPOINTS.PRODUCTS.LIST, {
    params: { ativo: true },
  });
  return (res.data || []).map(p => ({
    id: p.id,
    account_id: p.accountId || p.account_id,
    nome: p.nome,
    valor_padrao: Number(p.valorPadrao ?? p.valor_padrao ?? 0),
    ativo: p.ativo ?? true,
    metodos_pagamento: p.metodosPagamento || p.metodos_pagamento || ['pix'],
    convenios_aceitos: p.conveniosAceitos || p.convenios_aceitos || [],
    created_at: p.createdAt || p.created_at,
    updated_at: p.updatedAt || p.updated_at,
  }));
},
```

### 2. `src/components/finance/CreateSaleDialog.tsx` — linha 253
Remover filtro de etapa e usar **todos** os contatos:

```typescript
const eligibleContacts = contacts;
```

Também remover a mensagem "Nenhum lead elegível no funil" e trocar por "Nenhum contato cadastrado" caso a lista esteja vazia.

