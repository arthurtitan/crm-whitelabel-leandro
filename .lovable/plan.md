
# Correcao: Impersonacao nao troca JWT — accountId permanece null

## Problema raiz

Quando o Super Admin usa "Assumir Identidade", o sistema:
1. Chama `POST /api/users/:id/impersonate`
2. O backend retorna dados do usuario-alvo mas **nao gera um novo JWT**
3. O frontend troca o usuario no React state mas continua usando o **JWT do super_admin** (que tem `accountId: null`)
4. Todas as chamadas subsequentes (calendar, sales, contacts, products) falham com `Argument accountId must not be null`
5. O Chatwoot aparece como "nao configurado" porque os campos chatwoot tambem nao estao no response

## Solucao

### 1. Backend: Gerar JWT para usuario-alvo na impersonacao

**Arquivo:** `backend/src/controllers/user.controller.ts`

No metodo `impersonate`, usar o `authService.generateAccessToken` (atualmente privado) para gerar um token real para o usuario-alvo. Alternativa: chamar `jwt.sign` diretamente no controller com os dados do usuario-alvo (sub, email, role, accountId, permissions).

```typescript
// Gerar token com accountId do usuario-alvo
const token = jwt.sign({
  sub: result.user.id,
  email: result.user.email,
  role: result.user.role,
  accountId: result.user.accountId,  // <-- essencial
  permissions: result.user.permissions,
}, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
```

### 2. Backend: Incluir accountId e campos Chatwoot no response da impersonacao

**Arquivo:** `backend/src/services/user.service.ts`

No metodo `impersonate`, adicionar `accountId` ao objeto `user` e campos Chatwoot ao objeto `account`:

```typescript
user: {
  id: targetUser.id,
  nome: targetUser.nome,
  email: targetUser.email,
  role: targetUser.role,
  accountId: targetUser.accountId,           // ADICIONAR
  permissions: targetUser.permissions,
  status: targetUser.status,
  chatwootAgentId: targetUser.chatwootAgentId, // ADICIONAR
},
account: targetUser.account ? {
  id: targetUser.account.id,
  nome: targetUser.account.nome,
  status: targetUser.account.status,
  timezone: targetUser.account.timezone,
  chatwootBaseUrl: targetUser.account.chatwootBaseUrl,     // ADICIONAR
  chatwootAccountId: targetUser.account.chatwootAccountId, // ADICIONAR
  chatwootApiKey: targetUser.account.chatwootApiKey,       // ADICIONAR
} : null,
```

### 3. Frontend: Salvar token original e usar novo token durante impersonacao

**Arquivo:** `src/contexts/AuthContext.backend.tsx`

No `impersonate`:
- Salvar o token atual do super_admin antes de trocar
- Extrair e usar o novo token retornado pelo backend
- Mapear corretamente os campos de account (snake_case)

No `exitImpersonation`:
- Restaurar o token original do super_admin

```typescript
const impersonate = useCallback(async (userId: string) => {
  // ... 
  // Salvar token original
  const originalToken = tokenManager.getToken();
  localStorage.setItem('original_token', originalToken);
  
  // Usar novo token do usuario-alvo
  if (response.token) {
    tokenManager.setToken(response.token);
  }
  // ...
}, []);

const exitImpersonation = useCallback(() => {
  // Restaurar token original
  const originalToken = localStorage.getItem('original_token');
  if (originalToken) {
    tokenManager.setToken(originalToken);
    localStorage.removeItem('original_token');
  }
  // ...
}, []);
```

## Resultado esperado

- Impersonacao gera JWT com `accountId` do usuario-alvo
- Todas as queries (calendar, sales, contacts, products) recebem `accountId` valido
- Chatwoot aparece como "configurado" com as credenciais da conta
- Ao sair da impersonacao, o token do super_admin e restaurado
- Nenhum erro Prisma `accountId must not be null`

## Sequencia de execucao

1. `backend/src/services/user.service.ts` — adicionar campos faltantes
2. `backend/src/controllers/user.controller.ts` — gerar JWT real
3. `src/contexts/AuthContext.backend.tsx` — trocar/restaurar token
4. Rebuild no EasyPanel
