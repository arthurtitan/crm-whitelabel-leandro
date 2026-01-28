
# Plano: Kanban Fluido com Arquitetura Agnóstica

## Problema Identificado
O código atual causa flickering porque:
1. `setIsLoading(true)` na linha 88 do `AdminKanbanPage.tsx` esconde todo o Kanban
2. `setIsLoadingContacts(true)` na linha 157 do `FinanceContext.tsx` reseta o estado
3. Cada `fetchData()` substitui completamente o array de dados

## Solução: Arquitetura "Stale-While-Revalidate"

Uma abordagem inspirada em como frameworks modernos (Angular, SWR, React Query) lidam com atualizações - **mantém os dados visíveis enquanto busca novos em background**.

---

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                      CAMADA DE APRESENTAÇÃO                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │   LeadCard      │  │  KanbanColumn   │  │   SyncIndicator         │ │
│  │  (animações)    │  │  (drop zone)    │  │  (sutil no header)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CAMADA DE ESTADO (useKanbanData)                   │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │   contacts: Contact[]    ◄──── mergeContacts() ◄──── API Response │ │
│  │   leadTags: LeadTag[]    ◄──── mergeLeadTags() ◄──── API Response │ │
│  │   isInitialLoading: boolean (só no primeiro load)                 │ │
│  │   isSyncing: boolean (indicador sutil para background)            │ │
│  │                                                                    │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      CAMADA DE DADOS (API Agnóstica)                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  Supabase       │  │  REST API       │  │  PostgreSQL Direto      │ │
│  │  (atual)        │  │  (futuro)       │  │  (possível)             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementação em 5 Passos

### Passo 1: Hook de Gerenciamento de Dados do Kanban
**Novo arquivo:** `src/hooks/useKanbanData.ts`

Hook centralizado que:
- Gerencia estado de contatos e lead_tags
- Implementa **polling inteligente** (30s) como fallback universal
- Expõe função de merge para atualizações incrementais
- Separa `isInitialLoading` (skeleton) de `isSyncing` (indicador sutil)

Características agnósticas:
- Recebe função de fetch como parâmetro (pode ser Supabase, REST, etc)
- Merge baseado em ID (funciona com qualquer fonte de dados)
- Não depende de features específicas de banco

### Passo 2: Funções de Merge Inteligente
**Novo arquivo:** `src/utils/dataSync.ts`

Funções puras para merge de dados:
- `mergeContacts(existing, incoming)` - adiciona novos, atualiza existentes
- `mergeLeadTags(existing, incoming)` - sincroniza associações
- `detectChanges(before, after)` - identifica o que mudou para animar

Essas funções são 100% agnósticas de banco.

### Passo 3: Refatorar FinanceContext
**Modificar:** `src/contexts/FinanceContext.tsx`

Mudanças:
- Remover `setIsLoadingContacts(true)` durante refetch
- Substituir `setContacts(data)` por merge inteligente
- Adicionar `isSyncing` para feedback sutil
- Manter `isInitialLoading` apenas para primeira carga

Lógica:
```
if (contacts.length === 0) {
  // Primeira carga - mostra skeleton
  setIsInitialLoading(true)
} else {
  // Refetch - apenas indicador sutil
  setIsSyncing(true)
}
// Após fetch:
setContacts(prev => mergeContacts(prev, newData))
```

### Passo 4: Atualizar AdminKanbanPage
**Modificar:** `src/pages/admin/AdminKanbanPage.tsx`

Mudanças:
- Substituir `isLoading` por `isInitialLoading` (skeleton só na primeira vez)
- Adicionar `SyncIndicator` no header (ícone girando sutilmente)
- Remover lógica de refresh que esconde conteúdo
- Implementar polling automático a cada 30s

### Passo 5: Animações nos Cards
**Modificar:** `src/components/kanban/LeadCard.tsx` e `src/index.css`

Adicionar:
- Classe `animate-slide-up` para cards novos
- Transição CSS suave para movimento entre colunas
- Efeito "glow" temporário em cards recém-adicionados

---

## Detalhes de Animação (CSS)

Novas classes a adicionar no `index.css`:

```css
/* Card entrando no Kanban */
.kanban-card-enter {
  animation: slideUp 0.3s ease-out forwards;
}

/* Card novo - destaque temporário */
.kanban-card-new {
  animation: glowPulse 2s ease-out forwards;
}

@keyframes glowPulse {
  0% { box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4); }
  50% { box-shadow: 0 0 12px 4px hsl(var(--primary) / 0.2); }
  100% { box-shadow: 0 0 0 0 transparent; }
}

/* Transição suave de posição */
.kanban-card {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
```

---

## Fluxo de Sincronização

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE ATUALIZAÇÃO                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. [Inicial] Página carrega                                    │
│     └─► isInitialLoading=true → Skeleton visível                │
│     └─► Fetch dados → mergeContacts() → isInitialLoading=false  │
│                                                                 │
│  2. [Background] A cada 30 segundos                             │
│     └─► isSyncing=true → Indicador sutil no header              │
│     └─► Fetch dados → mergeContacts()                           │
│     └─► Cards novos entram com animação                         │
│     └─► isSyncing=false                                         │
│                                                                 │
│  3. [Manual] Usuário clica "Sincronizar"                        │
│     └─► Mesmo fluxo do background                               │
│     └─► Toast de feedback                                       │
│                                                                 │
│  4. [Drag & Drop] Usuário move card                             │
│     └─► Atualização otimista (move na UI imediatamente)         │
│     └─► API call em background                                  │
│     └─► Rollback se erro                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Componente SyncIndicator

Pequeno componente visual para o header:

```text
┌────────────────────────────────────────────────────────────┐
│  Kanban                               [🔄] [Sincronizar]   │
│  Gerencie seus leads                   ▲                   │
│                                        │                   │
│                              Indicador sutil               │
│                              (gira quando syncing)         │
└────────────────────────────────────────────────────────────┘
```

- Quando `isSyncing=true`: ícone gira suavemente
- Quando `isSyncing=false`: ícone estático ou oculto
- Não bloqueia interação do usuário

---

## Compatibilidade Futura (PostgreSQL Puro)

A arquitetura é preparada para migração:

| Componente | Hoje (Supabase) | Futuro (PostgreSQL) |
|------------|-----------------|---------------------|
| Fetch de dados | `supabase.from()` | `fetch('/api/contacts')` |
| Merge de dados | `mergeContacts()` | `mergeContacts()` (mesmo) |
| Polling | `setInterval(30s)` | `setInterval(30s)` (mesmo) |
| Animações | CSS | CSS (mesmo) |

A única mudança necessária será substituir as chamadas de API no service layer.

---

## Arquivos a Criar/Modificar

1. **`src/hooks/useKanbanData.ts`** (novo) - Hook de gerenciamento de estado
2. **`src/utils/dataSync.ts`** (novo) - Funções de merge
3. **`src/contexts/FinanceContext.tsx`** (modificar) - Remover loading agressivo
4. **`src/pages/admin/AdminKanbanPage.tsx`** (modificar) - Nova UX fluida
5. **`src/components/kanban/LeadCard.tsx`** (modificar) - Animações
6. **`src/components/kanban/SyncIndicator.tsx`** (novo) - Indicador visual
7. **`src/index.css`** (modificar) - Novas animações

---

## Resultado Final

| Antes | Depois |
|-------|--------|
| Tela pisca a cada 30s | Kanban sempre visível |
| Dados desaparecem durante sync | Merge suave de dados |
| Sem feedback de atividade | Indicador sutil de sincronização |
| Cards aparecem "do nada" | Cards entram com animação |
| Dependente de Supabase Realtime | Polling agnóstico (funciona em qualquer banco) |
