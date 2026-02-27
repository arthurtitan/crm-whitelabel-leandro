

# Fix: Rota POST /api/chatwoot/metrics retornando 404

## Problema

O frontend envia `POST /api/chatwoot/metrics` com parametros no body (`dateFrom`, `dateTo`, `inboxId`, `agentId`), mas o backend registra apenas `GET /api/chatwoot/metrics`. Resultado: 404 em todas as chamadas de metricas do dashboard.

## Causa raiz

Incompatibilidade de metodo HTTP:
- **Frontend** (`useChatwootMetrics.ts` linha 149): `apiClient.post(API_ENDPOINTS.CHATWOOT.METRICS, { dateFrom, dateTo, inboxId, agentId })`
- **Backend** (`chatwoot.routes.ts` linha 45): `router.get('/metrics', ...)`

Alem disso, o controller `getMetrics` nao le os parametros de data/filtro do body — apenas chama `getAccountMetrics(accountId)` sem repassar datas.

## Solucao

### 1. Backend Route: Adicionar POST /metrics

**Arquivo:** `backend/src/routes/chatwoot.routes.ts`

Adicionar rota POST ao lado da GET existente (mantendo retrocompatibilidade):

```typescript
router.post('/metrics', (req, res, next) => chatwootController.getMetrics(req, res, next));
```

### 2. Backend Controller: Ler parametros do body e passar para o servico

**Arquivo:** `backend/src/controllers/chatwoot.controller.ts`

Atualizar `getMetrics` para extrair `dateFrom`, `dateTo`, `inboxId`, `agentId` do body (POST) ou query (GET) e repassar ao servico:

```typescript
async getMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const accountId = req.user!.accountId!;
    const { dateFrom, dateTo, inboxId, agentId } = { ...req.query, ...req.body };
    
    const dateRange = {
      since: dateFrom as string | undefined,
      until: dateTo as string | undefined,
    };
    
    const metrics = await chatwootService.getAccountMetrics(accountId, dateRange, inboxId, agentId);
    res.json({ success: true, data: metrics });
  } catch (error) {
    next(error);
  }
}
```

### 3. Backend Service: Aceitar parametros de data e filtro

**Arquivo:** `backend/src/services/chatwoot.service.ts`

Atualizar `getAccountMetrics` para aceitar e repassar `dateRange`, `inboxId` e `agentId` na chamada ao Chatwoot:

```typescript
async getAccountMetrics(
  accountId: string,
  dateRange?: DateRange,
  inboxId?: number,
  agentId?: number
): Promise<ChatwootAccountMetrics> {
  const config = await this.getAccountConfig(accountId);
  const queryParams = new URLSearchParams({ type: 'account' });
  if (dateRange?.since) queryParams.set('since', dateRange.since);
  if (dateRange?.until) queryParams.set('until', dateRange.until);
  if (inboxId) queryParams.set('inbox_id', String(inboxId));
  if (agentId) queryParams.set('agent_id', String(agentId));
  
  const response = await this.makeRequest<ChatwootAccountMetrics>(
    config,
    `/reports/summary?${queryParams.toString()}`
  );
  return response;
}
```

### 4. Frontend: Tratar resposta envelope `{ success, data }`

**Arquivo:** `src/hooks/useChatwootMetrics.ts`

A funcao `fetchChatwootMetricsViaBackend` ja trata o envelope — nenhuma alteracao necessaria.

## Resultado esperado

- `POST /api/chatwoot/metrics` retorna 200 com metricas reais do Chatwoot
- O dashboard exibe dados em vez do erro "Rota nao encontrada"
- Filtros de data, canal e agente funcionam corretamente
- Retrocompatibilidade mantida com GET

## Sequencia

1. `backend/src/routes/chatwoot.routes.ts` — adicionar `router.post`
2. `backend/src/controllers/chatwoot.controller.ts` — ler body params
3. `backend/src/services/chatwoot.service.ts` — aceitar dateRange/filters
4. Rebuild no EasyPanel

