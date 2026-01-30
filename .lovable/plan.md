
## Plano: Sistema de Sincronização Central com Auto-Refresh para Dashboard

### Objetivo
Implementar um sistema de sincronização unificado que:
1. Adicione polling automático ao Dashboard de Atendimento (30s)
2. Crie um hook reutilizável de sincronização central
3. Exiba um indicador visual de sincronização consistente em todo o sistema

---

### Arquitetura Proposta

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                         useSyncManager (Central Hook)                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│   │  Dashboard  │    │   Kanban    │    │   Agenda    │    │   Leads     │  │
│   │  Metrics    │    │   Sync      │    │   Sync      │    │   Sync      │  │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│          │                  │                  │                  │          │
│          └──────────────────┴──────────────────┴──────────────────┘          │
│                                    │                                         │
│                        ┌───────────▼───────────┐                             │
│                        │  Polling Controller   │                             │
│                        │  (30s interval)       │                             │
│                        │  - Stale-while-rev    │                             │
│                        │  - Background sync    │                             │
│                        │  - Visual indicator   │                             │
│                        └───────────────────────┘                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### Alterações Técnicas

#### 1. Novo Hook: `src/hooks/useSyncManager.ts`
Hook central para gerenciar sincronização de múltiplos recursos:

```typescript
interface SyncResource {
  name: string;
  fetchFn: () => Promise<void>;
  interval?: number; // Default: 30000
  enabled?: boolean;
}

interface UseSyncManagerReturn {
  isSyncing: boolean;
  lastSyncAt: string | null;
  registerResource: (resource: SyncResource) => void;
  unregisterResource: (name: string) => void;
  triggerSync: (resourceName?: string) => Promise<void>;
  triggerSyncAll: () => Promise<void>;
}
```

#### 2. Atualizar `useChatwootMetrics.ts`
Adicionar polling automático de 30 segundos:

```typescript
// Adicionar polling automático
useEffect(() => {
  if (!isConfigured || !enablePolling) return;
  
  const intervalId = setInterval(() => {
    fetchMetrics();
  }, pollingInterval);

  return () => clearInterval(intervalId);
}, [isConfigured, enablePolling, pollingInterval, fetchMetrics]);
```

Novo parâmetro na interface:
```typescript
interface UseChatwootMetricsParams {
  dateFrom: Date;
  dateTo: Date;
  inboxId?: number;
  agentId?: number;
  pollingInterval?: number;  // Default: 30000
  enablePolling?: boolean;   // Default: true
}
```

#### 3. Atualizar `AdminDashboard.tsx`
- Remover necessidade de botão "Atualizar" manual como ação primária
- Adicionar indicador de sincronização visual (similar ao Kanban)
- Exibir timestamp da última atualização

```tsx
// Adicionar ao useChatwootMetrics
const { 
  data: metricsData, 
  isLoading, 
  isSyncing,           // NOVO
  lastSyncAt,          // NOVO
  error: metricsError, 
  isConfigured, 
  refetch 
} = useChatwootMetrics({
  dateFrom: dateRange?.from || subDays(new Date(), 7),
  dateTo: dateRange?.to || new Date(),
  enablePolling: true,      // NOVO
  pollingInterval: 30000,   // NOVO
});
```

#### 4. Componente `SyncIndicator` Reutilizável
Criar um componente visual consistente para toda a aplicação:

```tsx
// src/components/ui/SyncIndicator.tsx
interface SyncIndicatorProps {
  isSyncing: boolean;
  lastSyncAt: string | null;
  onManualSync?: () => void;
  label?: string;
}
```

---

### Fluxo de Sincronização

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                         Ciclo de Sincronização                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  1. Carregamento Inicial                                                   │
│     └─ isLoading = true                                                    │
│     └─ Fetch dados                                                         │
│     └─ isLoading = false                                                   │
│                                                                            │
│  2. Polling a cada 30s (background)                                        │
│     └─ isSyncing = true                                                    │
│     └─ Fetch dados (sem loading spinner)                                   │
│     └─ Merge com dados existentes                                          │
│     └─ isSyncing = false                                                   │
│     └─ lastSyncAt = timestamp                                              │
│                                                                            │
│  3. Atualização Manual (botão)                                             │
│     └─ Força sync imediato                                                 │
│     └─ Reseta timer do polling                                             │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### Benefícios

1. **Consistência Visual**: Todos os módulos terão o mesmo comportamento de sincronização
2. **Performance**: Polling silencioso não interrompe a experiência do usuário
3. **Feedback Claro**: Usuário sempre sabe quando os dados foram atualizados
4. **Manutenibilidade**: Hook central facilita mudanças de intervalo ou lógica
5. **Extensível**: Fácil adicionar novos recursos ao sistema de sincronização

---

### Configurações Padrão

| Recurso | Intervalo | Ativo por Padrão |
|---------|-----------|------------------|
| Dashboard Chatwoot | 30s | Sim |
| Kanban Chatwoot | 30s | Sim (se configurado) |
| Google Calendar | 30s | Sim (se conectado) |
| Contatos DB | 30s | Sim |

---

### Arquivos a Criar/Modificar

**Criar:**
- `src/hooks/useSyncManager.ts` - Hook central de sincronização

**Modificar:**
- `src/hooks/useChatwootMetrics.ts` - Adicionar polling automático
- `src/pages/admin/AdminDashboard.tsx` - Integrar polling e indicador visual
- `src/components/kanban/SyncIndicator.tsx` - Mover para `src/components/ui/` e tornar reutilizável

---

### Consideração de Performance

Para evitar sobrecarga:
- O polling só ocorre quando a aba está ativa (usar `document.visibilityState`)
- Requisições em background são canceladas se uma nova for iniciada
- Timeout de 45s para Chatwoot (já implementado)
