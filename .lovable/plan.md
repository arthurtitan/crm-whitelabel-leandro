

## Diagnóstico: Por que a integração Google Calendar não funciona

Existem **3 bugs críticos** que impedem o fluxo completo:

### Bug 1: Callback do Google bloqueado por autenticação
O arquivo `backend/src/routes/calendar.routes.ts` aplica `router.use(authenticate)` e `router.use(requireAccountId)` em **todas** as rotas, incluindo `/google/callback`. Quando o Google redireciona o usuário de volta para `https://360.gleps.com.br/api/calendar/google/callback?code=...&state=...`, não há JWT token no request → o middleware retorna 401 e o fluxo morre.

### Bug 2: State do OAuth não inclui o userId
O método `getGoogleAuthUrl` no `calendar.service.ts` (linha 206) passa apenas `state: accountId`. Mas para isolamento por usuário (tokens vinculados ao user), o callback precisa saber **qual usuário** iniciou o fluxo. O `handleGoogleCallback` também não recebe o userId.

### Bug 3: Callback não redireciona no erro
O `googleCallback` no controller usa `next(error)` em caso de erro, retornando JSON em vez de redirecionar para o frontend com `?error=...`.

---

## Plano de Correção (4 arquivos)

### 1. `backend/src/routes/calendar.routes.ts`
Mover o `/google/callback` para **antes** do `router.use(authenticate)`, ou registrá-lo sem os middlewares de auth. O callback do Google é uma requisição de redirecionamento sem token JWT.

### 2. `backend/src/services/calendar.service.ts`
- `getGoogleAuthUrl`: receber `userId` além de `accountId`, codificar ambos no `state` (base64 JSON)
- `handleGoogleCallback`: decodificar o state para extrair `accountId` e `userId`, salvar o token vinculado ao user

### 3. `backend/src/controllers/calendar.controller.ts`
- `connectGoogle`: passar `req.user.id` para o service
- `googleCallback`: decodificar state, tratar erros com redirect para frontend em vez de `next(error)`, usar `FRONTEND_URL` do env

### 4. `backend/prisma/schema.prisma` (verificação)
O model `GoogleCalendarToken` precisa ter `unique` por `userId` (não apenas `accountId`) para suportar múltiplos usuários por conta. Preciso verificar o schema atual.

---

## Resultado esperado

1. Super Admin configura credenciais Google na conta via UI (já funciona)
2. Admin acessa Agenda → vê botão "Sincronizar" (já funciona se credentials no DB)
3. Clica → redirect para Google OAuth → autoriza
4. Google redireciona para `/api/calendar/google/callback` → **rota sem auth** → troca code por tokens → salva no DB → redireciona para `/admin/agenda?google_connected=true`
5. Frontend detecta `google_connected=true` → sincroniza eventos

