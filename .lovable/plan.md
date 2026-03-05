

## Diagnóstico

O log confirma: `Google Calendar creds source: db-only (no env fallback)` — ou seja, `process.env.GOOGLE_CLIENT_ID` está **vazio** dentro do container, apesar de estar definido no EasyPanel.

### Causa raiz

No `docker-compose.yml`, a linha `GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}` usa interpolação do Compose. Se o EasyPanel injeta variáveis no **nível do container** (e não no nível de interpolação do Compose), o Compose resolve `${GOOGLE_CLIENT_ID:-}` como string vazia `""` — e essa string vazia **sobrescreve** qualquer injeção posterior do EasyPanel.

As outras variáveis como `JWT_SECRET` funcionam porque têm defaults não-vazios (`${JWT_SECRET:-your-production-jwt-secret-min-32-characters}`) OU porque o EasyPanel as processa antes da interpolação do Compose.

### Correção

Remover as 3 linhas de Google do bloco `environment` do docker-compose.yml. Isso permite que o EasyPanel injete as variáveis diretamente no container sem que o Compose as sobrescreva com strings vazias.

**Arquivo: `docker-compose.yml`** — remover linhas 67-69:
```yaml
# REMOVER estas 3 linhas:
GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI:-}
```

O backend já lê `process.env.GOOGLE_CLIENT_ID` diretamente no `calendar.service.ts`, então não precisa de mais nada. Para dev local, basta ter um `.env` na raiz (que o Compose lê automaticamente).

### Diagnóstico adicional (segurança)

**Arquivo: `backend/src/server.ts`** — expandir o log de bootstrap para mostrar os primeiros 8 chars de cada var Google (mascarados), permitindo confirmar se chegaram ou não:

```typescript
const gId = (process.env.GOOGLE_CLIENT_ID || '').trim();
const gSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const gRedirect = (process.env.GOOGLE_REDIRECT_URI || '').trim();
logger.info(`📅 Google Calendar env: clientId=${gId ? gId.substring(0,8)+'...' : 'EMPTY'}, secret=${gSecret ? 'SET' : 'EMPTY'}, redirect=${gRedirect ? 'SET' : 'EMPTY'}`);
```

### Resultado esperado após deploy

1. Log mostra `clientId=23165313..., secret=SET, redirect=SET`
2. Agenda mostra botão de conectar/sincronizar
3. Fluxo OAuth completo funciona

