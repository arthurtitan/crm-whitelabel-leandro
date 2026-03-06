

## Problema

O `TagContext` inicializa `stageTags` exclusivamente a partir de `mockTags` filtrado por `accountId`. Em produção, nenhum mock corresponde ao `accountId` real, então `stageTags` fica vazio. O popover de "Etapas que contam como Leads Convertidos" renderiza uma lista vazia — não há checkboxes para selecionar.

## Correção

### `src/contexts/TagContext.tsx`

Adicionar fetch das tags reais do backend quando `useBackend === true`:

1. Importar `useBackend` e `tagsBackendService`
2. No `TagProvider`, adicionar `useEffect` que:
   - Se `useBackend && accountId`: chama `tagsBackendService.listStageTags(accountId)` 
   - Atualiza `setTags` com o resultado (substituindo os mocks vazios)
3. Manter fallback de `mockTags` apenas quando `useBackend === false`

```typescript
import { useBackend } from '@/config/backend.config';
import { tagsBackendService } from '@/services/tags.backend.service';

// Dentro do TagProvider:
const [tags, setTags] = useState<Tag[]>(
  useBackend ? [] : mockTags.filter((t) => t.account_id === accountId && t.ativo)
);

useEffect(() => {
  if (!useBackend || !accountId) return;
  tagsBackendService.listStageTags(accountId).then((backendTags) => {
    setTags(backendTags);
  }).catch(console.error);
}, [accountId]);
```

4. Ajustar a inicialização do `funnelStageConfig` para recalcular os `defaultFinalStages` **após** o fetch (outro `useEffect` que observa `tags`), garantindo que as 2 últimas etapas por ordem sejam selecionadas por padrão quando não houver configuração salva.

### Normalização de resposta

O `tagsBackendService.listStageTags` já retorna `Tag[]`, mas os campos podem vir em `camelCase` do Express. Verificar e adicionar mapper se necessário (como foi feito no `financeBackendService`):
- `accountId → account_id`
- `funnelId → funnel_id`  
- `createdAt → created_at`

Impacto: apenas `src/contexts/TagContext.tsx` e possivelmente `src/services/tags.backend.service.ts` (mapper).

