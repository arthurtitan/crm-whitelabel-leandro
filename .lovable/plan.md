
# Plano: Migrar para TanStack Query nativo para polling de métricas

## Resumo

A implementação atual do `useChatwootMetrics` usa `setInterval` manual para polling, o que causou as falhas intermitentes que você observou. O projeto já tem o **TanStack Query** instalado e configurado, mas não está aproveitando suas funcionalidades nativas. 

A migração para o TanStack Query vai resolver os problemas de forma mais elegante e com menos código.

---

## Benefícios da migração

| Problema atual | Solução com TanStack Query |
|----------------|---------------------------|
| Polling manual com `setInterval` (propenso a bugs) | `refetchInterval` nativo com pausa automática |
| Controle de concorrência manual (`inFlightRef`, `AbortController`) | Gerenciamento automático de requests duplicadas |
| Retry manual com backoff | `retry` e `retryDelay` nativos |
| Cache manual (`lastGoodDataRef`) | Cache automático com `staleTime` e `gcTime` |
| Lógica de loading/syncing manual | Estados `isLoading`, `isFetching`, `isRefetching` nativos |
| ~200 linhas de código | ~50 linhas de código |

---

## Como vai funcionar

```text
┌─────────────────────────────────────────────────────────────┐
│                    TanStack Query                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Cache     │    │   Polling   │    │   Retry     │     │
│  │  staleTime  │    │refetchInterval│  │  3 attempts │     │
│  │   30 seg    │    │   30 seg    │    │  backoff    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Pausa automática quando aba está inativa           │   │
│  │  (refetchIntervalInBackground: false)               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Etapas de implementação

### 1. Criar hook `useChatwootMetricsQuery`

Novo hook usando TanStack Query com:

- **`queryKey`**: Identificador único baseado em `accountId`, `dateFrom`, `dateTo`, `inboxId`, `agentId`
- **`refetchInterval: 30000`**: Polling automático a cada 30 segundos
- **`refetchIntervalInBackground: false`**: Pausa quando aba está inativa
- **`staleTime: 25000`**: Dados considerados frescos por 25s (evita refetch imediato ao trocar de aba)
- **`retry: 3`**: Até 3 tentativas em caso de falha
- **`retryDelay`**: Backoff exponencial com jitter
- **`placeholderData: keepPreviousData`**: Mantém dados anteriores durante refetch

### 2. Atualizar `AdminDashboard.tsx`

Substituir chamada ao hook antigo pelo novo, mapeando os estados:

- `isLoading` → `isPending` (carregamento inicial)
- `isSyncing` → `isFetching && !isPending` (polling em background)
- `error` → `error?.message`
- `refetch` → `refetch` (nativo)

### 3. Manter retrocompatibilidade

O novo hook vai manter a mesma interface de retorno para minimizar mudanças no Dashboard.

---

## Seção técnica

### Código do novo hook (resumido)

```typescript
import { useQuery, keepPreviousData } from '@tanstack/react-query';

export function useChatwootMetricsQuery({
  dateFrom, dateTo, inboxId, agentId,
  pollingInterval = 30000,
  enablePolling = true,
}) {
  const { account } = useAuth();
  
  const query = useQuery({
    queryKey: ['chatwoot-metrics', account?.id, dateFrom, dateTo, inboxId, agentId],
    queryFn: async ({ signal }) => {
      // Fetch com AbortSignal nativo do React Query
      const response = await fetch(..., { signal });
      return response.json();
    },
    enabled: Boolean(account?.chatwoot_api_key),
    refetchInterval: enablePolling ? pollingInterval : false,
    refetchIntervalInBackground: false, // Pausa quando aba inativa
    staleTime: 25000, // Dados frescos por 25s
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    placeholderData: keepPreviousData, // Mantém dados durante refetch
  });
  
  return {
    data: query.data ?? DEFAULT_METRICS,
    isLoading: query.isPending,
    isSyncing: query.isFetching && !query.isPending,
    lastSyncAt: query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toISOString() : null,
    isTabActive: true, // TanStack Query gerencia automaticamente
    error: query.error?.message ?? null,
    isConfigured: Boolean(account?.chatwoot_api_key),
    refetch: query.refetch,
  };
}
```

### Benefícios técnicos adicionais

1. **DevTools**: Com o TanStack Query DevTools, você pode inspecionar cache, estados e histórico de requests em tempo real durante desenvolvimento
2. **Deduplicação**: Se dois componentes usarem o mesmo `queryKey`, apenas uma request será feita
3. **Garbage Collection**: Dados não utilizados são limpos automaticamente após 5 minutos

---

## Arquivos a serem modificados

1. **`src/hooks/useChatwootMetrics.ts`** - Reescrever usando TanStack Query
2. **`src/pages/admin/AdminDashboard.tsx`** - Ajustar mapeamento de estados (se necessário)
3. **`src/App.tsx`** - Adicionar configuração global de retry/staleTime (opcional)

---

## Resultado esperado

Após a migração:
- O Dashboard terá polling mais estável e confiável
- Falhas de rede serão tratadas automaticamente com retry
- Ao trocar de aba e voltar, os dados permanecerão em tela (cache)
- Código mais simples e fácil de manter
- Menos bugs relacionados a concorrência e estado
