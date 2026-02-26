

# Correcao de 10 Erros de Producao

## Resumo

Correcoes cirurgicas nos arquivos do frontend e backend para resolver 10 erros reais que ocorrem em producao (modo backend/VPS). Todas as alteracoes respeitam o padrao hibrido Cloud/Backend existente.

---

## Erro 1: Usuario duplicado redireciona para login (409)

**Arquivo:** `src/pages/super-admin/SuperAdminAccountsPage.tsx` (linha ~327)
**Problema:** `handleUserCreated` nao trata erro 409 (email duplicado). O toast generico confunde o usuario.
**Correcao:** No catch do `handleUserCreated`, verificar `error.status === 409` e mostrar mensagem especifica ("Este email ja esta cadastrado") + permitir pular o agente em vez de travar.

---

## Erro 2: "Erro ao assumir identidade"

**Arquivos:**
- `src/api/endpoints.ts` (linha 21)
- `src/contexts/AuthContext.backend.tsx` (funcao `impersonate`)

**Problema:** Frontend chama `POST /api/auth/impersonate/:id` mas a rota real e `POST /api/users/:id/impersonate` (definida em `user.routes.ts` linha 17).
**Correcao:**
- Alterar `API_ENDPOINTS.AUTH.IMPERSONATE` para usar o path correto: `` `/api/users/${userId}/impersonate` ``
- No `impersonate` do `BackendAuthProvider`, extrair `response.data` corretamente (padrao envelope do backend)

---

## Erro 3: "Referencia de registro inexistente" ao atualizar usuario

**Arquivo:** `src/pages/super-admin/SuperAdminUsersPage.tsx` (linhas 302-338)
**Problema:** `handleUpdate` atualiza apenas estado local, nunca chama a API real. Usuarios "fantasma" (mock) nao existem no banco.
**Correcao:** Tornar `handleUpdate` async e chamar `usersCloudOrBackend.update()`. Tratar erro 404 removendo da lista local.

---

## Erro 4: "Configuracao de senha requerida" ao excluir conta

**Arquivos:**
- `src/services/accounts.backend.service.ts` (linha 71-73)
- `src/pages/super-admin/SuperAdminAccountsPage.tsx` (linhas 388-406)

**Problema:** Backend exige header `x-confirm-password` para DELETE de conta, mas o frontend: (a) valida senha localmente contra string fixa `'Admin@123'` e (b) nao envia a senha no header.
**Correcao:**
- Alterar `accountsBackendService.delete(id)` para aceitar `password` e enviar como header `x-confirm-password`
- Alterar `handleDelete` para remover validacao local fixa e passar `deletePassword` para o service

---

## Erro 5: "Chatwoot nao configurado" ao acessar conta

**Arquivo:** `backend/src/middlewares/auth.middleware.ts` (linhas 74-81)
**Problema:** `req.account` no middleware de autenticacao omite campos Chatwoot (`chatwootBaseUrl`, `chatwootAccountId`, `chatwootApiKey`). O endpoint `/api/auth/me` retorna dados incompletos.
**Correcao:** Adicionar os 3 campos Chatwoot ao objeto `req.account` no middleware. O `authService.getMe()` ja retorna esses campos, mas o middleware que alimenta `req.account` nao.

---

## Erro 6: "(intermediate value).find is not a function" no template Kanban

**Arquivo:** `src/pages/admin/AdminKanbanPage.tsx` (linha 628-629)
**Problema:** `apiClient.get('/api/funnels')` retorna `{ data: [...], meta: {} }` mas o codigo faz `.find()` direto no resultado.
**Correcao:** Normalizar resposta: `const items = Array.isArray(funnels) ? funnels : (funnels?.data || []); let funnelId = items.find(...)?.id;`

---

## Erro 7: "Erro ao obter funil" ao criar etapa manual

**Arquivo:** `src/components/kanban/CreateStageDialog.tsx` (linhas 74-95)
**Problema:** Sempre usa `tagsCloudService` (Supabase direto), que falha em modo backend por falta de sessao Supabase.
**Correcao:**
- Importar `useBackend` e `tagsBackendService`
- Adicionar metodos `getDefaultFunnel` e `createDefaultFunnel` ao `tagsBackendService`
- No `handleSubmit`, usar servico backend quando `useBackend=true`

**Arquivo adicional:** `src/services/tags.backend.service.ts`
- Adicionar `getDefaultFunnel(accountId)` que chama `GET /api/funnels?accountId=...`
- Adicionar `createDefaultFunnel(accountId)` que chama `POST /api/funnels`

---

## Erro 8: "new row violates RLS policy for contacts"

**Arquivo:** `src/contexts/FinanceContext.tsx` (linhas 440-466)
**Problema:** `createContact` cria contato apenas em estado local (mock). Em modo backend, deveria chamar a API.
**Correcao:** Quando `useBackend=true`, chamar `contactsBackendService.createContact()` e usar o ID retornado pelo backend.

---

## Erro 9: Google Calendar "Erro interno do servidor"

**Arquivo:** `supabase/functions/google-calendar-auth-url/index.ts`
**Problema:** A edge function usa `supabase.auth.getUser()` que depende de sessao Supabase Auth. Em modo backend (JWT proprio), nao ha sessao Supabase valida.
**Observacao:** Este erro requer investigacao adicional sobre se o Google Calendar deve ser portado para o backend Express ou se os secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI`) estao configurados. Por ora, adicionaremos tratamento de erro melhorado e documentaremos a limitacao.

---

## Erro 10: Produtos nao persistem

**Arquivo:** `src/contexts/ProductContext.tsx`
**Problema:** Todo o contexto opera com estado local e mock data. Nunca chama a API real.
**Correcao:** Integrar com `productsService` existente:
- `useEffect` no mount para buscar via `productsService.list()`
- `createProduct` chama `productsService.create()`
- `updateProduct` chama `productsService.update()`
- `deleteProduct` chama `productsService.delete()`
- `toggleProductStatus` chama `productsService.toggleStatus()`

---

## Secao Tecnica: Ordem de Execucao

1. `backend/src/middlewares/auth.middleware.ts` - Adicionar campos Chatwoot (Erro 5)
2. `src/api/endpoints.ts` - Corrigir path impersonate (Erro 2)
3. `src/contexts/AuthContext.backend.tsx` - Normalizar response impersonate (Erro 2)
4. `src/services/accounts.backend.service.ts` - Delete com senha (Erro 4)
5. `src/pages/super-admin/SuperAdminAccountsPage.tsx` - Delete + tratamento 409 (Erros 1, 4)
6. `src/pages/super-admin/SuperAdminUsersPage.tsx` - Update via API real (Erro 3)
7. `src/pages/admin/AdminKanbanPage.tsx` - Normalizar funnels (Erro 6)
8. `src/services/tags.backend.service.ts` - Adicionar getDefaultFunnel/createDefaultFunnel (Erro 7)
9. `src/components/kanban/CreateStageDialog.tsx` - Usar backend service (Erro 7)
10. `src/contexts/FinanceContext.tsx` - createContact backend mode (Erro 8)
11. `src/contexts/ProductContext.tsx` - Integrar com API real (Erro 10)
12. Google Calendar - Investigar e documentar limitacao (Erro 9)

## Arquivos Modificados

| Arquivo | Erros |
|---------|-------|
| `backend/src/middlewares/auth.middleware.ts` | 5 |
| `src/api/endpoints.ts` | 2 |
| `src/contexts/AuthContext.backend.tsx` | 2 |
| `src/services/accounts.backend.service.ts` | 4 |
| `src/pages/super-admin/SuperAdminAccountsPage.tsx` | 1, 4 |
| `src/pages/super-admin/SuperAdminUsersPage.tsx` | 3 |
| `src/pages/admin/AdminKanbanPage.tsx` | 6 |
| `src/services/tags.backend.service.ts` | 7 |
| `src/components/kanban/CreateStageDialog.tsx` | 7 |
| `src/contexts/FinanceContext.tsx` | 8 |
| `src/contexts/ProductContext.tsx` | 10 |

