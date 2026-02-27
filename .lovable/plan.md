

# Fix: Erros de compilacao TypeScript no chatwoot-metrics.service.ts

## Problema

O build falha com 4 erros identicos:
```
src/services/chatwoot-metrics.service.ts(142,29): error TS18046: 'data' is of type 'unknown'.
src/services/chatwoot-metrics.service.ts(142,51): error TS18046: 'data' is of type 'unknown'.
src/services/chatwoot-metrics.service.ts(171,44): error TS18046: 'data' is of type 'unknown'.
src/services/chatwoot-metrics.service.ts(193,14): error TS18046: 'data' is of type 'unknown'.
```

O `tsconfig.json` do backend usa `strict: true`, o que faz `response.json()` retornar `unknown` em vez de `any`. O codigo acessa propriedades diretamente sem type assertion.

## Solucao

Adicionar `as any` nas 3 chamadas `response.json()` nas funcoes `fetchAllConversations`, `fetchAgents` e `fetchInboxes`:

### Arquivo: `backend/src/services/chatwoot-metrics.service.ts`

**Linha 141** (fetchAllConversations):
```typescript
const data = await response.json() as any;
```

**Linha 170** (fetchAgents):
```typescript
const data = await response.json() as any;
```

**Linha 192** (fetchInboxes):
```typescript
const data = await response.json() as any;
```

Isso resolve os 4 erros de compilacao (linha 142 tem 2 acessos ao mesmo `data`). Nenhuma outra mudanca necessaria — apos o rebuild o servico de metricas estara operacional.

