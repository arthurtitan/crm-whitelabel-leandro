

## Problema

O `CreateLeadDialog` importa e chama diretamente `contactsCloudService` (Supabase), ignorando a flag `useBackend`. Em produção com `VITE_USE_BACKEND=true`, não existe sessão Supabase ativa, então toda inserção na tabela `contacts` é bloqueada pelo RLS com o erro "new row violates row-level security policy".

## Correção

### `src/components/kanban/CreateLeadDialog.tsx`

Importar `useBackend` de `@/config/backend.config` e `contactsBackendService` de `@/services/contacts.backend.service`. No `onSubmit`, rotear as chamadas:

- Se `useBackend === true`: usar `contactsBackendService.createContact()`, `contactsBackendService.createContactWithChatwoot()`, e `contactsBackendService.applyStageTagToContact()`
- Se `useBackend === false`: manter o comportamento atual com `contactsCloudService`

```typescript
import { useBackend } from '@/config/backend.config';
import { contactsBackendService } from '@/services/contacts.backend.service';
import { contactsCloudService } from '@/services/contacts.cloud.service';

// No onSubmit:
const service = useBackend ? contactsBackendService : contactsCloudService;

// Substituir todas as chamadas:
// contactsCloudService.createContact → service.createContact
// contactsCloudService.createContactWithChatwoot → service.createContactWithChatwoot
// contactsCloudService.applyStageTagToContact → service.applyStageTagToContact
```

Ambos os serviços já implementam a mesma interface (`CreateContactInput`, `CreateContactResult`, etc.), então a troca é direta sem alterações de tipo.

### Backend service — normalização da resposta

O `contactsBackendService.createContact` retorna o payload bruto do backend Express. Precisamos verificar que a resposta inclui `success: true` e `contact_id`. O backend controller (`POST /contacts`) retorna `{ data: result }` — o service precisa desempacotar:

```typescript
async createContact(input): Promise<CreateContactResult> {
  const res = await apiClient.post<{ data: any }>(API_ENDPOINTS.CONTACTS.CREATE, { ... });
  const contact = res.data || res;
  return {
    success: true,
    contact_id: contact.id,
    chatwoot_contact_id: contact.chatwootContactId || null,
    chatwoot_conversation_id: contact.chatwootConversationId || null,
  };
},
```

Mesma normalização para `createContactWithChatwoot`.

