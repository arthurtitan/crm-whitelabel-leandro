
## Migracao Completa: Supabase Cloud para VPS com PostgreSQL Proprio

### Visao Geral do Problema

O sistema atualmente opera em **modo hibrido**:
- **Autenticacao**: Supabase Auth (login/logout/sessao via `supabase.auth`)
- **Dados**: Queries diretas ao Supabase via SDK (`supabase.from('tabela')`) em 12+ arquivos
- **Funcoes serverless**: 19 Edge Functions para operacoes como criar usuario, Chatwoot, Google Calendar
- **Backend Express**: Ja existe completo com Prisma, JWT, controllers, services -- mas o frontend **nao o usa** para a maioria das operacoes

Para subir na VPS, **tudo** precisa passar pelo backend Express, pois nao havera Supabase.

---

### Escopo da Migracao

#### Camada 1: Autenticacao (Critica)

**Problema**: O `AuthContext.tsx` usa `supabase.auth.signInWithPassword()`, `supabase.auth.onAuthStateChange()`, e hydrata perfil/role via queries diretas ao Supabase.

**Solucao**: Criar um `AuthContext` alternativo que usa o backend Express (`/api/auth/login`, `/api/auth/me`) com JWT em localStorage. O backend ja tem tudo pronto (`auth.service.ts`, `auth.middleware.ts`).

**Arquivos a modificar/criar**:
- `src/contexts/AuthContext.tsx` -- reescrever para usar `apiClient` em vez de `supabase.auth`
- `src/services/auth.service.ts` -- remover mocks, usar `apiClient` real
- `src/api/client.ts` -- ja esta pronto, usa JWT Bearer

#### Camada 2: Servicos de Dados (12 arquivos)

Todos os arquivos `*.cloud.service.ts` e contextos que fazem `supabase.from('tabela')` precisam ser migrados para usar `apiClient`:

| Arquivo | Dependencia Supabase | Endpoint Express Existente |
|---------|---------------------|---------------------------|
| `accounts.cloud.service.ts` | `supabase.from('accounts')` | `/api/accounts` (pronto) |
| `users.cloud.service.ts` | `supabase.from('profiles')` + Edge Functions | `/api/users` (pronto) |
| `contacts.cloud.service.ts` | `supabase.from('contacts')` + Edge Functions | `/api/contacts` (pronto) |
| `tags.cloud.service.ts` | `supabase.from('tags/lead_tags')` + Edge Functions | `/api/tags` (pronto) |
| `FinanceContext.tsx` | `supabase.from('sales/contacts/products')` | `/api/sales`, `/api/products` (prontos) |
| `CalendarContext.tsx` | `supabase.from('calendar_events')` + Edge Functions | `/api/calendar` (pronto) |
| `AdminKanbanPage.tsx` | `supabase.from('contacts/tags')` | `/api/contacts`, `/api/tags` |
| `AdminLeadsPage.tsx` | `supabase.from('contacts')` | `/api/contacts` |
| `AdminInsightsPage.tsx` | `supabase.from(...)` | `/api/insights` |
| `SuperAdminDashboard.tsx` | `supabase.functions.invoke('super-admin-kpis')` | `/api/dashboard` |
| `useChatwootMetrics.ts` | `supabase.from('resolution_logs')` | Precisa novo endpoint |

#### Camada 3: Edge Functions para Backend Express

As 19 Edge Functions precisam de equivalentes no backend. A maioria ja tem controllers correspondentes, mas alguns estao faltando:

**Ja tem equivalente no backend Express:**
- Autenticacao (login/logout/refresh/me)
- CRUD de contas, usuarios, contatos, produtos, vendas, tags
- Dashboard, finance, insights, calendar, events

**Precisam ser adicionados ao backend:**
- Chatwoot integration endpoints (create contact, sync labels, fetch metrics, test connection, etc.)
- Google Calendar OAuth flow (auth URL, callback, disconnect, status, sync)
- Super Admin KPIs (ja tem parcial em `dashboard.controller.ts`)
- `log-resolution` endpoint
- `create-user` com hash de senha (ja existe `user.controller.ts`)
- `delete-lead` com limpeza Chatwoot

#### Camada 4: Configuracao de Build e Deploy

**`Dockerfile.frontend`** -- Precisa receber `VITE_API_URL` como build arg para apontar ao backend.

**`docker-compose.yml`** -- Ja esta pronto, porem precisa:
- Variavel `VITE_API_URL` no build do frontend
- Remover qualquer referencia a Supabase

**`nginx.conf`** -- Ja faz proxy de `/api` para `backend:3000` (pronto).

**`vite.config.ts`** -- Verificar proxy de desenvolvimento para `/api`.

#### Camada 5: Schema do Banco

O Prisma schema ja espelha as tabelas Supabase, com uma diferenca importante:
- **Supabase**: Usa `auth.users` + `profiles` + `user_roles` (tabelas separadas)
- **Express/Prisma**: Usa `users` com `passwordHash` e `role` na mesma tabela + `refresh_tokens`

O seed (`seed.ts`) ja cria os dados de teste com as mesmas credenciais.

---

### Plano de Implementacao (Ordem)

**Fase 1 -- Abstracacao de API (Flag de Ambiente)**

Criar uma variavel `VITE_USE_BACKEND` que controla se o frontend usa Supabase ou o backend Express. Isso permite manter os dois modos funcionando durante a transicao.

1. Criar `src/config/backend.config.ts` com flag `useBackend`
2. Para cada servico `*.cloud.service.ts`, criar versao `*.backend.service.ts` que usa `apiClient`
3. Criar factory em cada `index.ts` que retorna o servico correto baseado na flag

**Fase 2 -- Migrar AuthContext**

1. Criar `src/contexts/AuthContext.backend.tsx` que usa `apiClient.post('/api/auth/login')` + JWT
2. Manter sessao via `tokenManager` (ja existe em `api/client.ts`)
3. Hydrar usuario via `apiClient.get('/api/auth/me')`
4. Auto-refresh do token via interceptor

**Fase 3 -- Migrar Servicos de Dados**

Para cada servico, criar a versao backend:
1. `accounts.backend.service.ts` -- usa `/api/accounts`
2. `users.backend.service.ts` -- usa `/api/users`
3. `contacts.backend.service.ts` -- usa `/api/contacts`
4. `tags.backend.service.ts` -- usa `/api/tags`
5. Atualizar contextos (Finance, Calendar, Tag) para usar `apiClient`

**Fase 4 -- Adicionar Endpoints Faltantes ao Backend**

1. Chatwoot routes no backend Express (proxy para Chatwoot API)
2. Google Calendar OAuth routes
3. Resolution log endpoint
4. Super Admin KPIs consolidado

**Fase 5 -- Configuracao Final de Deploy**

1. Atualizar `docker-compose.yml` com `VITE_API_URL`
2. Atualizar `Dockerfile.frontend` para aceitar ARG
3. Verificar `nginx.conf`
4. Documentar `.env.production` completo
5. Script de deploy automatizado

---

### Detalhes Tecnicos por Arquivo

#### Novos Arquivos
| Arquivo | Descricao |
|---------|-----------|
| `src/config/backend.config.ts` | Flag `useBackend` + deteccao de ambiente |
| `src/contexts/AuthContext.backend.tsx` | Auth via JWT/Express |
| `src/services/accounts.backend.service.ts` | Contas via apiClient |
| `src/services/users.backend.service.ts` | Usuarios via apiClient |
| `src/services/contacts.backend.service.ts` | Contatos via apiClient |
| `src/services/tags.backend.service.ts` | Tags via apiClient |
| `src/services/finance.backend.service.ts` | Sales/Products via apiClient |
| `src/services/calendar.backend.service.ts` | Calendar via apiClient |
| `backend/src/routes/chatwoot.routes.ts` | Ja existe, verificar completude |
| `backend/src/routes/calendar.routes.ts` | Ja existe, verificar Google OAuth |

#### Arquivos Modificados
| Arquivo | Mudanca |
|---------|---------|
| `src/App.tsx` | Selecionar AuthProvider correto baseado na flag |
| `src/contexts/FinanceContext.tsx` | Substituir `supabase.from()` por chamadas ao service |
| `src/contexts/CalendarContext.tsx` | Substituir `supabase.from()` por chamadas ao service |
| `src/pages/admin/AdminKanbanPage.tsx` | Usar service em vez de supabase direto |
| `src/pages/admin/AdminLeadsPage.tsx` | Usar service em vez de supabase direto |
| `src/pages/admin/AdminInsightsPage.tsx` | Usar service em vez de supabase direto |
| `src/pages/super-admin/SuperAdminDashboard.tsx` | Usar apiClient em vez de `supabase.functions.invoke` |
| `src/hooks/useChatwootMetrics.ts` | Usar apiClient |
| `docker-compose.yml` | Adicionar `VITE_API_URL` no build frontend |
| `vite.config.ts` | Adicionar proxy `/api` para dev |

---

### Estimativa de Complexidade

Este e um trabalho grande que envolve ~25 arquivos. Recomendo implementar em fases, comecando pela Fase 1 (flag de ambiente) e Fase 2 (auth), pois sem autenticacao funcionando nada mais funciona. As fases subsequentes podem ser feitas incrementalmente.

O backend Express ja esta **90% pronto** -- a maior parte do trabalho e no frontend, criando os services que usam `apiClient` em vez de `supabase.from()`.
