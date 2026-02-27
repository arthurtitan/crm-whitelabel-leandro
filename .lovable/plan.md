

# Criar migracao Prisma para tabela resolution_logs e coluna first_resolved_at

## Problema

O schema Prisma foi atualizado com:
1. Model `ResolutionLog` (tabela `resolution_logs`)
2. Campo `firstResolvedAt` na tabela `contacts`

Porem, **nenhuma migracao foi criada** para aplicar essas mudancas no banco de dados de producao. A unica migracao existente e `0001_init`, que nao inclui nenhuma dessas estruturas. Por isso o Prisma gera queries para colunas/tabelas que nao existem no PostgreSQL do EasyPanel.

## Solucao

Criar uma nova migracao `0002_add_resolution_logs` com o SQL necessario.

### Arquivo novo: `backend/prisma/migrations/0002_add_resolution_logs/migration.sql`

```sql
-- AlterTable: Add first_resolved_at to contacts
ALTER TABLE "contacts" ADD COLUMN "first_resolved_at" TIMESTAMPTZ;

-- CreateTable: resolution_logs
CREATE TABLE "resolution_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "resolved_by" TEXT NOT NULL,
    "resolution_type" TEXT NOT NULL DEFAULT 'explicit',
    "ai_participated" BOOLEAN DEFAULT false,
    "agent_id" INTEGER,
    "resolved_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "resolution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resolution_logs_account_id_idx" ON "resolution_logs"("account_id");
CREATE INDEX "resolution_logs_resolved_at_idx" ON "resolution_logs"("resolved_at");
```

## Por que funciona

- O script `start.sh` do container ja executa `npx prisma migrate deploy` antes de iniciar o servidor
- Essa migracao sera detectada automaticamente no proximo rebuild
- As tabelas serao criadas no PostgreSQL do EasyPanel
- O Prisma Client ja esta gerado com esses models, entao o codigo backend ja esta pronto

## Sequencia

1. Criar arquivo de migracao `0002_add_resolution_logs/migration.sql`
2. Rebuild no EasyPanel (o `start.sh` aplica automaticamente)

