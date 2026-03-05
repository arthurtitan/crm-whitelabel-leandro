

## Problema

A migration `0007_google_token_user_isolation` falha porque tenta criar um índice único em `user_id`, mas essa coluna **nunca foi adicionada** à tabela `google_calendar_tokens`. A tabela original (migration 0001) só tem `account_id`, sem `user_id`.

A migration 0007 atual faz apenas:
```sql
DROP INDEX IF EXISTS "google_calendar_tokens_account_id_key";
CREATE UNIQUE INDEX "google_calendar_tokens_user_id_key" ON "google_calendar_tokens"("user_id");
```

Falta o `ALTER TABLE ADD COLUMN user_id`.

## Correção

Atualizar o arquivo `backend/prisma/migrations/0007_google_token_user_isolation/migration.sql` para incluir todos os passos necessários:

1. Adicionar a coluna `user_id` à tabela
2. Popular `user_id` com dados existentes (se houver tokens, usar um UUID placeholder ou o account owner)
3. Tornar `user_id` NOT NULL
4. Remover o unique index antigo de `account_id`
5. Criar o unique index em `user_id`

```sql
-- Add user_id column (nullable first)
ALTER TABLE "google_calendar_tokens" ADD COLUMN "user_id" UUID;

-- For any existing rows, we need a value - delete orphaned tokens
DELETE FROM "google_calendar_tokens" WHERE "user_id" IS NULL;

-- Make user_id NOT NULL
ALTER TABLE "google_calendar_tokens" ALTER COLUMN "user_id" SET NOT NULL;

-- Drop old unique constraint on account_id
DROP INDEX IF EXISTS "google_calendar_tokens_account_id_key";

-- Add unique constraint on user_id
CREATE UNIQUE INDEX "google_calendar_tokens_user_id_key" ON "google_calendar_tokens"("user_id");
```

### Passo adicional necessário

Como a migration 0007 já foi parcialmente aplicada e falhou (P3018), o `start.sh` precisa resolver essa migration travada. O script já trata P3009, mas precisamos adicionar lógica para resolver 0007 também, **ou** instruir a resolução manual antes do próximo deploy.

A abordagem mais segura: atualizar o `start.sh` para incluir `0007_google_token_user_isolation` na lista de migrations a resolver como rolled-back em caso de falha, e depois re-aplicar.

### Resumo das alterações

| Arquivo | Alteração |
|---|---|
| `backend/prisma/migrations/0007_.../migration.sql` | Adicionar `ADD COLUMN user_id` antes de criar o índice |
| `backend/scripts/start.sh` | Adicionar `0007_google_token_user_isolation` na lista de auto-recovery do P3009/P3018 |

