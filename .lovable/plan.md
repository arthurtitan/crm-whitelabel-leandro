

## Correção Rápida — Referência a `env.GOOGLE_CLIENT_ID` removida

O build falha porque `server.ts` linha 104 ainda referencia `env.GOOGLE_CLIENT_ID`, que foi removido do schema Zod em `env.ts` (já que credenciais Google agora vêm do banco).

### Alteração

**`backend/src/server.ts` linha 104** — substituir:

```typescript
// De:
logger.info(`📅 Google Calendar: ${env.GOOGLE_CLIENT_ID ? 'configurado' : 'NÃO configurado'}`);

// Para:
logger.info(`📅 Google Calendar: credenciais no banco de dados (por conta)`);
```

Uma única linha. Build vai passar.

