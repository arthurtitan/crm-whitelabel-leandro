

## Problema

O erro **"Invalid time value"** ocorre no `LeadCard.tsx` (linha 146) ao tentar formatar a data:

```typescript
format(new Date(lead.updated_at), 'dd/MM', { locale: ptBR })
```

O backend Express/Prisma retorna os campos em **camelCase** (`updatedAt`, `createdAt`, `accountId`, `chatwootContactId`), mas o frontend espera **snake_case** (`updated_at`, `created_at`, `account_id`). Como `lead.updated_at` é `undefined`, `new Date(undefined)` gera um `Invalid Date` e `format()` lança a exceção.

## Correção

### 1. `src/services/finance.backend.service.ts` — método `fetchContacts`

Mapear os campos da resposta do backend de camelCase para snake_case, conforme a interface `Contact`:

```typescript
fetchContacts: async (accountId: string): Promise<Contact[]> => {
  const res = await apiClient.get<ApiResponse<any[]>>(API_ENDPOINTS.CONTACTS.LIST);
  return (res.data || []).map(c => ({
    id: c.id,
    account_id: c.accountId || c.account_id,
    nome: c.nome,
    telefone: c.telefone,
    email: c.email,
    origem: c.origem,
    chatwoot_contact_id: c.chatwootContactId ?? c.chatwoot_contact_id ?? null,
    chatwoot_conversation_id: c.chatwootConversationId ?? c.chatwoot_conversation_id ?? null,
    created_at: c.createdAt || c.created_at,
    updated_at: c.updatedAt || c.updated_at,
  }));
},
```

### 2. `src/components/kanban/LeadCard.tsx` — linha 146

Trocar `format(new Date(...))` por `safeFormatDateBR` para proteger contra datas inválidas:

```typescript
import { safeFormatDateBR } from '@/utils/dateUtils';
// ...
{safeFormatDateBR(lead.updated_at, 'dd/MM')}
```

A correção 1 resolve a causa raiz (mapeamento de campos). A correção 2 adiciona proteção defensiva para evitar crashes futuros caso algum campo de data venha nulo.

