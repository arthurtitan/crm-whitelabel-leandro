

# Corrigir Erros de Build do Backend (TypeScript)

O build do backend falhou com ~50 erros TypeScript. Todos sao corrigiveis com mudancas simples. Existem 5 categorias de erro:

---

## 1. `req.params.id` retorna `string | string[]` (maioria dos erros)

O Express v5 (`@types/express@5`) mudou o tipo de `req.params` para `Record<string, string | string[]>`. Todos os controllers usam `const { id } = req.params` e passam direto para funcoes que esperam `string`.

**Correcao:** Adicionar cast `as string` em todos os destructurings de params em todos os controllers:
- `account.controller.ts` (~8 locais)
- `calendar.controller.ts` (~3 locais)
- `contact.controller.ts` (~10 locais)
- `event.controller.ts` (~1 local)
- `product.controller.ts` (~4 locais)
- `sale.controller.ts` (~4 locais)
- `tag.controller.ts` (~8 locais)
- `user.controller.ts` (~7 locais)

Exemplo: `const { id } = req.params;` vira `const id = req.params.id as string;`

---

## 2. `AuthRequest` nao exportado (chatwoot.controller.ts)

O chatwoot.controller.ts importa `AuthRequest` de `auth.middleware`, mas esse tipo nao existe la. O tipo correto e `AuthenticatedRequest` exportado de `../types`.

**Correcao:** Trocar o import para usar `AuthenticatedRequest` de `../types` e substituir todas as referencias de `AuthRequest` por `AuthenticatedRequest`.

---

## 3. `requireRole` recebendo array em vez de rest params (chatwoot.routes.ts)

A funcao `requireRole` usa rest params (`...roles: UserRole[]`), mas as rotas chatwoot passam arrays: `requireRole(['admin', 'super_admin'])`.

**Correcao:** Trocar para spread: `requireRole('admin', 'super_admin')`.

---

## 4. `jwt.sign` expiresIn incompativel (auth.service.ts)

O `jsonwebtoken` v9 com types atualizados nao aceita `string` diretamente no `expiresIn`. A versao nova espera `StringValue | number`.

**Correcao:** Cast `expiresIn` para `any` ou importar o tipo correto: `expiresIn: env.JWT_EXPIRES_IN as any`.

---

## 5. Tipos `unknown` em services

- **calendar.service.ts**: `tokens` e `userInfo` de `response.json()` sao `unknown`. Corrigir com `as any` ou interfaces tipadas.
- **account.service.ts**: `data` de `response.json()` e `unknown`. Corrigir com `as any`.
- **chatwoot.service.ts**: `HeadersInit` nao reconhecido no Node.js. Trocar para `Record<string, string>`.
- **event.service.ts**: `payload` aceita `null` mas Prisma espera `undefined`. Trocar `?? null` por `?? undefined` ou usar `Prisma.InputJsonValue`.

---

## Detalhes Tecnicos

### Arquivos a modificar (10 arquivos):

| Arquivo | Mudancas |
|---|---|
| `backend/src/controllers/account.controller.ts` | Cast `as string` nos params |
| `backend/src/controllers/calendar.controller.ts` | Cast `as string` nos params |
| `backend/src/controllers/chatwoot.controller.ts` | Trocar import `AuthRequest` -> `AuthenticatedRequest` |
| `backend/src/controllers/contact.controller.ts` | Cast `as string` nos params |
| `backend/src/controllers/event.controller.ts` | Cast `as string` nos params |
| `backend/src/controllers/product.controller.ts` | Cast `as string` nos params |
| `backend/src/controllers/sale.controller.ts` | Cast `as string` nos params |
| `backend/src/controllers/tag.controller.ts` | Cast `as string` nos params |
| `backend/src/controllers/user.controller.ts` | Cast `as string` nos params |
| `backend/src/routes/chatwoot.routes.ts` | Trocar `requireRole([...])` para `requireRole(...)` |
| `backend/src/services/auth.service.ts` | Cast `expiresIn as any` |
| `backend/src/services/calendar.service.ts` | Cast `as any` nos `response.json()` |
| `backend/src/services/account.service.ts` | Cast `as any` no `response.json()` |
| `backend/src/services/chatwoot.service.ts` | Trocar `HeadersInit` por `Record<string, string>` |
| `backend/src/services/event.service.ts` | Tratar `payload: null` para Prisma |

Nenhuma dependencia nova e necessaria. Todas as mudancas sao de tipagem TypeScript.

