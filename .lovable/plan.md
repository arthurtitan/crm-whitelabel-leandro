

# Correcao Definitiva: accountId null e Chatwoot 404

## Diagnostico

Ha dois problemas distintos nos logs:

### Problema 1: Chatwoot API retorna 404
A URL chamada e:
```text
/reports/summary?type=account&since=2026-02-20T04:57:08.310Z&until=2026-02-27T04:57:08.310Z
```
A API do Chatwoot espera **timestamps Unix em segundos** (ex: `1740009428`), nao strings ISO. O formato errado faz o Chatwoot retornar 404 ("The page you were looking for doesn't exist").

### Problema 2: accountId null em multiplos controllers
Todos os controllers usam `req.user!.accountId!` (non-null assertion) sem validacao. Se o JWT do Super Admin e usado (antes do rebuild com a correcao de impersonacao), o accountId e null e o Prisma crasha. Precisamos de uma guarda defensiva para que, mesmo em caso de falha, o sistema retorne um erro claro (400) em vez de crashar (500).

## Solucao

### 1. Converter datas ISO para Unix epoch no controller do Chatwoot

**Arquivo:** `backend/src/controllers/chatwoot.controller.ts`

No metodo `getMetrics`, converter as strings ISO para timestamps Unix (segundos):

```typescript
const dateRange = {
  since: dateFrom ? String(Math.floor(new Date(dateFrom as string).getTime() / 1000)) : undefined,
  until: dateTo ? String(Math.floor(new Date(dateTo as string).getTime() / 1000)) : undefined,
};
```

Isso garante que a URL final seja algo como:
```text
/reports/summary?type=account&since=1740009428&until=1740614228
```

### 2. Criar middleware de validacao de accountId

**Arquivo:** `backend/src/middlewares/auth.middleware.ts`

Adicionar uma funcao `requireAccountId` que valida se o usuario tem accountId antes de permitir acesso a rotas de conta:

```typescript
export function requireAccountId(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(new UnauthorizedError());
  }
  if (!req.user.accountId) {
    res.status(400).json({
      error: {
        code: 'ACCOUNT_REQUIRED',
        message: 'Esta operacao requer uma conta vinculada.',
      },
    });
    return;
  }
  next();
}
```

### 3. Aplicar middleware nas rotas que exigem accountId

**Arquivos de rotas afetados:**
- `backend/src/routes/product.routes.ts`
- `backend/src/routes/sale.routes.ts`
- `backend/src/routes/contact.routes.ts`
- `backend/src/routes/chatwoot.routes.ts` (exceto webhook)
- `backend/src/routes/calendar.routes.ts`
- `backend/src/routes/dashboard.routes.ts` (exceto rotas super-admin)

Adicionar `requireAccountId` apos `authenticate` nestas rotas:

```typescript
import { authenticate, requireAccountId } from '../middlewares/auth.middleware';
router.use(authenticate);
router.use(requireAccountId);
```

### 4. Tambem aplicar correcao de datas no getAgentMetrics e getConversationMetrics

**Arquivo:** `backend/src/controllers/chatwoot.controller.ts`

Garantir que os endpoints `/metrics/agents` e `/metrics/conversations` tambem convertam datas para epoch seconds.

## Resultado esperado

- Chatwoot `/reports/summary` recebe timestamps Unix e retorna 200 com metricas reais
- Qualquer rota que exija accountId retorna 400 com mensagem clara em vez de 500 (crash do Prisma)
- O dashboard exibe metricas corretamente durante impersonacao
- O sistema nao crasha mesmo que o rebuild da impersonacao nao tenha sido feito ainda

## Sequencia de implementacao

1. `backend/src/middlewares/auth.middleware.ts` - adicionar `requireAccountId`
2. `backend/src/controllers/chatwoot.controller.ts` - converter datas para epoch
3. Rotas: product, sale, contact, chatwoot, calendar, dashboard - aplicar middleware
4. Rebuild no EasyPanel

