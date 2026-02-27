

# Correcao: Migration Travada (P3009) e Resiliencia do Backend

## Problema

A migration `0003_add_resolution_unique` falhou porque existem linhas duplicadas em `resolution_logs` para o par `(account_id, conversation_id)`. O Prisma marcou a migration como "failed" e agora recusa aplicar qualquer migration futura (erro P3009). O backend entra em loop de restart infinito porque `start.sh` usa `set -e` e nao trata falha de migration.

Alem disso, a tabela `resolution_logs` e a coluna `contacts.first_resolved_at` nao existem no banco (migration 0002 pode nao ter sido aplicada), e o servico de metricas tenta usar ambas sem fallback, gerando erros constantes no Postgres.

## Plano de Correcao

### 1. Corrigir migration 0003 para deduplicar antes de criar indice

**Arquivo:** `backend/prisma/migrations/0003_add_resolution_unique/migration.sql`

Substituir o conteudo por SQL que primeiro remove duplicatas e depois cria o indice:

```sql
-- Remove duplicates keeping only the oldest record per pair
DELETE FROM "resolution_logs" a USING "resolution_logs" b
WHERE a.id > b.id 
  AND a.account_id = b.account_id 
  AND a.conversation_id = b.conversation_id;

-- Now create unique index
CREATE UNIQUE INDEX IF NOT EXISTS "resolution_logs_account_id_conversation_id_key" 
  ON "resolution_logs"("account_id", "conversation_id");
```

### 2. Atualizar start.sh para auto-recuperar migrations falhadas

**Arquivo:** `backend/scripts/start.sh`

Antes de `npx prisma migrate deploy`, adicionar etapa que:
1. Tenta `prisma migrate deploy`
2. Se falhar com P3009, executa `npx prisma migrate resolve --rolled-back 0003_add_resolution_unique`
3. Tenta `prisma migrate deploy` novamente

Tambem remover `set -e` do topo e tratar erros individualmente para que o container nao crashe imediatamente.

### 3. Blindar servico de metricas contra tabelas/colunas inexistentes

**Arquivo:** `backend/src/services/chatwoot-metrics.service.ts`

Envolver os 3 blocos de DB (sync resolution_logs, query contacts.firstResolvedAt, query resolution_logs) em try/catch individuais com fallback:
- Se `resolution_logs` nao existe, pular sync e query, usar zeros
- Se `contacts.first_resolved_at` nao existe, usar `leadsInPeriod` como fallback para `novosLeads`
- Nao deixar erros de DB impedir o retorno de metricas validas do Chatwoot

## Sequencia de Execucao

1. Atualizar `0003_add_resolution_unique/migration.sql` com deduplicacao
2. Atualizar `start.sh` com auto-recovery de P3009
3. Blindar `chatwoot-metrics.service.ts`
4. Rebuild no EasyPanel

## Resultado Esperado

- Migration aplica com sucesso (deduplicando antes de criar indice)
- Se migration falhou antes, start.sh resolve automaticamente e re-aplica
- Backend inicia sem loop de restart
- Dashboard funciona mesmo sem tabelas de resolucao (fallback para dados do Chatwoot)
- Endpoints `/api/contacts`, `/api/lead-tags`, `/api/chatwoot/sync` funcionam

