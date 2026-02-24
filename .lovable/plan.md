

## Verificacao Completa -- Dependencias Supabase Restantes

Apos auditoria completa do codigo, identifiquei **5 problemas pendentes** que impedem o deploy 100% independente do Supabase quando `VITE_USE_BACKEND=true`.

---

### Problemas Encontrados

#### 1. AdminKanbanPage -- Usa `supabase.from('lead_tags')` e `tagsCloudService` diretamente

**Arquivo**: `src/pages/admin/AdminKanbanPage.tsx`

- Linha 58: Importa `tagsCloudService` (que usa Supabase internamente)
- Linha 124: Faz `supabase.from('lead_tags').select('*')` diretamente
- Linhas 120, 172, 300, 322, 334, 395, 420, 601: Chama `tagsCloudService.*` (que internamente usa Supabase SDK)

**Correcao**: Adicionar `if (useBackend)` que usa `tagsBackendService` + `apiClient` para buscar lead_tags.

#### 2. AdminLeadsPage -- Usa `supabase.from()` e `contactsCloudService` diretamente

**Arquivo**: `src/pages/admin/AdminLeadsPage.tsx`

- Linha 103: `supabase.from('funnels').select('id')` -- busca funnel default
- Linha 111: `supabase.from('tags').select('*')` -- busca etapas do funnel
- Linha 213: `contactsCloudService.deleteLead()` -- chama cloud service que usa Edge Function

**Correcao**: Adicionar `if (useBackend)` que usa `tagsBackendService.listStageTags()` para tags e `contactsBackendService.deleteLead()` para deletar.

#### 3. CalendarContext -- `loadEvents` ainda usa `supabase.from('calendar_events')` no else

**Arquivo**: `src/contexts/CalendarContext.tsx`

- Linhas 109-126: Quando `useBackend` e false, faz `supabase.from('calendar_events').select('*')` diretamente
- Linhas 184, 258, 345: `supabase.auth.getSession()` no branch cloud

**Status**: Ja tem branches `if (useBackend)` corretas. O codigo Supabase so executa quando `useBackend=false`. **OK -- nao bloqueia deploy VPS**.

#### 4. FinanceContext -- Import do supabase mas sem uso direto

**Arquivo**: `src/contexts/FinanceContext.tsx`

- Linha 6: Importa `supabase` mas busca mostrou zero chamadas `supabase.` no arquivo.

**Status**: O import existe mas nao e usado (ja foi migrado para `financeBackendService`). **OK -- nao bloqueia, mas o import morto deve ser removido quando `useBackend=true`**.

#### 5. accounts.cloud.service -- `testChatwootConnection` usa Edge Function

**Arquivo**: `src/services/accounts.cloud.service.ts`

- Linha 222-249: `supabase.auth.getSession()` + fetch direto a `test-chatwoot-connection` Edge Function

**Correcao**: O `accounts.backend.service.ts` precisa ter um metodo `testChatwootConnection` que chame `/api/chatwoot/test-connection` (ou similar) via apiClient. Verificar se o endpoint existe no backend Express.

---

### Resumo de Acoes Necessarias

| # | Arquivo | Problema | Acao |
|---|---------|----------|------|
| 1 | `AdminKanbanPage.tsx` | Usa `tagsCloudService` e `supabase.from('lead_tags')` | Adicionar branch `useBackend` usando `tagsBackendService` e `apiClient` |
| 2 | `AdminLeadsPage.tsx` | Usa `supabase.from('funnels/tags')` e `contactsCloudService` | Adicionar branch `useBackend` usando backend services |
| 3 | `CalendarContext.tsx` | Branch cloud usa Supabase | Sem acao -- branch `useBackend` ja esta correto |
| 4 | `FinanceContext.tsx` | Import morto do supabase | Limpar import (nao critico) |
| 5 | `accounts.cloud.service.ts` | `testChatwootConnection` usa Edge Function | Adicionar ao `accounts.backend.service.ts` |

### Verificacoes Positivas (OK)

- `SuperAdminDashboard.tsx` -- branch `useBackend` implementada corretamente
- `useChatwootMetrics.ts` -- branch `useBackend` implementada corretamente
- `AdminInsightsPage.tsx` -- branch `useBackend` implementada corretamente
- `AuthContext.tsx` / `AuthContext.backend.tsx` -- separacao correta
- `contacts.backend.service.ts` -- tem `createContactWithChatwoot` e `deleteLead`
- `tags.backend.service.ts` -- tem todos os metodos necessarios (swap, sync, push labels)
- `users.backend.service.ts` -- tem create/delete
- `finance.backend.service.ts` -- tem fetchSales/Products/Contacts
- `calendar.backend.service.ts` -- tem todos os metodos Google OAuth
- `API_ENDPOINTS` -- todos os endpoints definidos
- `Dockerfile.frontend` -- aceita `VITE_USE_BACKEND` como build arg
- `docker-compose.yml` -- configurado para build com flag

### Detalhes Tecnicos da Implementacao

**AdminKanbanPage.tsx** (maior mudanca):
- Importar `useBackend`, `tagsBackendService`, `apiClient`, `API_ENDPOINTS`
- No `fetchTagsData`: se `useBackend`, usar `tagsBackendService.listStageTags()` e `apiClient.get(API_ENDPOINTS.TAGS.BY_CONTACT(...))` para lead_tags
- Em cada chamada `tagsCloudService.xxx()`: trocar por condicional que escolhe entre cloud e backend service

**AdminLeadsPage.tsx**:
- Importar `useBackend`, `tagsBackendService`, `contactsBackendService`
- No `loadData`: se `useBackend`, usar `tagsBackendService.listStageTags()` em vez de queries Supabase
- No `handleDeleteLead`: se `useBackend`, usar `contactsBackendService.deleteLead()`

**accounts.backend.service.ts**:
- Adicionar metodo `testChatwootConnection(baseUrl, accountId, apiKey)` que faz `apiClient.post('/api/chatwoot/test-connection', {...})`

Apos essas 3 correcoes (2 paginas + 1 service), o sistema estara 100% pronto para deploy VPS sem Supabase.
