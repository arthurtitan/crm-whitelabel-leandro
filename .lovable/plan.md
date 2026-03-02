

## Correção Definitiva: Credenciais Chatwoot + Tratamento de Erros

### Problema Raiz
O backend lê as credenciais do Chatwoot (URL, Account ID, API Key) da tabela `accounts` no PostgreSQL. O token armazenado está incorreto ou ausente, causando **HTTP 401 "Invalid Access Token"** em todas as chamadas de métricas.

A importação de agentes funciona porque usa credenciais digitadas na hora (endpoint `POST /api/chatwoot/agents/fetch`), mas o dashboard de métricas usa as credenciais do banco.

### Problema Secundário
O frontend não exibe a mensagem de erro correta ("Erro desconhecido" em vez de "Token inválido") porque o `apiClient` lança erros no formato `{ message, status }`, mas o hook tenta acessar `err.response.data.error` (formato Axios), que não existe.

---

### Correções (3 arquivos)

**1. Migration automática para atualizar credenciais**
Arquivo: `backend/prisma/migrations/0005_update_chatwoot_credentials/migration.sql`

Cria uma migration SQL que atualiza as credenciais do Chatwoot para todas as contas existentes. Esta migration será executada automaticamente pelo `prisma migrate deploy` no startup do container (via `start.sh`), sem intervenção manual.

```sql
UPDATE accounts
SET chatwoot_base_url = 'https://atendimento.gleps.com.br',
    chatwoot_account_id = '1',
    chatwoot_api_key = 'UjBMtqZSRxPB72qSm8Fi1hh1'
WHERE chatwoot_base_url IS NOT NULL
   OR chatwoot_account_id IS NOT NULL;
```

Para contas sem nenhuma configuração Chatwoot, a migration não altera nada (WHERE garante que só atualiza contas que já tinham integração parcial).

**2. Corrigir parsing de erro no frontend**
Arquivo: `src/hooks/useChatwootMetrics.ts`

O `apiClient` lança objetos `{ message, status }` diretamente (não `{ response: { data, status } }` como Axios). Corrigir a detecção:

```typescript
// ANTES (formato Axios — errado):
const errorMsg = err?.response?.data?.error || err?.message || '...';
const isChatwootDown = err?.response?.status === 502;

// DEPOIS (formato apiClient — correto):
const errorMsg = err?.message || '...';
const isChatwootDown = err?.status === 502;
```

**3. Log de diagnóstico no backend**
Arquivo: `backend/src/services/chatwoot-metrics.service.ts`

Adicionar log com preview do token (primeiros 4 caracteres) antes de chamar a API do Chatwoot, para facilitar diagnóstico futuro sem expor a chave completa.

---

### Fluxo Pós-Deploy
1. `docker compose build` reconstroi os containers
2. Backend inicia, `prisma migrate deploy` aplica a migration `0005`
3. As credenciais corretas ficam no banco automaticamente
4. Dashboard carrega métricas normalmente
5. Em caso de erro futuro, a mensagem real aparece na tela (ex: "Token inválido") em vez de "Erro desconhecido"

