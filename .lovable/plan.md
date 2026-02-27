
# Correcao Completa: Endpoints Faltantes e Constraint de Banco

## Diagnostico dos Logs

Os logs mais recentes mostram que a migracao foi aplicada com sucesso (sem mais erros de `resolution_logs` ou `first_resolved_at`). O dashboard retorna 200. Porem, existem **3 endpoints faltantes** que impedem o sistema de funcionar corretamente:

| Endpoint | Status | Impacto |
|----------|--------|---------|
| `GET /api/lead-tags` | 404 | Kanban nao consegue mapear leads para etapas |
| `POST /api/chatwoot/sync` | 404 | Sincronizacao de contatos/labels nao funciona |
| `GET /api/contacts` | 200 (vazio) | Sem sync, nao ha contatos no banco |

Alem disso, a tabela `resolution_logs` nao possui constraint UNIQUE, o que impede o `ON CONFLICT DO NOTHING` de funcionar e causara duplicatas.

## Plano de Implementacao

### 1. Criar endpoint `GET /api/lead-tags`

**Arquivo:** `backend/src/routes/contact.routes.ts`

Adicionar rota para listar todos os `lead_tags` de uma conta (usado pelo Kanban para mapear contatos a etapas).

**Arquivo:** `backend/src/controllers/contact.controller.ts`

Adicionar metodo `listLeadTags` que busca todos os `lead_tags` dos contatos da conta via Prisma.

### 2. Criar endpoint `POST /api/chatwoot/sync`

**Arquivo:** `backend/src/routes/chatwoot.routes.ts`

Adicionar rota `POST /sync` que aceita um body com `action` para despachar diferentes operacoes:
- `sync-contacts`: Busca conversas do Chatwoot e sincroniza contatos no banco
- `push-label`: Cria/atualiza label individual no Chatwoot
- `push-all-labels`: Envia todas as etapas do Kanban para o Chatwoot
- `sync-labels`: Importa labels do Chatwoot
- `update-contact-labels`: Atualiza labels de um contato no Chatwoot

**Arquivo:** `backend/src/controllers/chatwoot.controller.ts`

Adicionar metodo `handleSync` que despacha para o servico correto com base no `action`.

**Arquivo:** `backend/src/services/chatwoot.service.ts`

Adicionar metodo `syncContacts` que:
1. Busca todas as conversas do Chatwoot via API v1
2. Para cada conversa com contato, cria ou atualiza o contato no banco
3. Aplica a etapa correta baseada nas labels da conversa
4. Remove contatos orfaos (respeitando grace period de 5 min)
5. Retorna contadores de criados/atualizados/deletados

### 3. Criar nova migracao para UNIQUE constraint

**Arquivo:** `backend/prisma/migrations/0003_add_resolution_unique/migration.sql`

```sql
CREATE UNIQUE INDEX "resolution_logs_account_conversation_unique" 
  ON "resolution_logs"("account_id", "conversation_id");
```

**Arquivo:** `backend/prisma/schema.prisma`

Adicionar `@@unique([accountId, conversationId])` ao model `ResolutionLog`.

### 4. Adicionar rota de lead-tags no roteador principal

**Arquivo:** `backend/src/routes/index.ts`

Registrar a rota `/lead-tags` no roteador, apontando para o controller de contatos.

## Detalhes Tecnicos

### Endpoint GET /api/lead-tags

```text
GET /api/lead-tags?accountId=xxx
  -> Prisma: SELECT * FROM lead_tags 
     JOIN contacts ON lead_tags.contact_id = contacts.id
     WHERE contacts.account_id = accountId
  -> Response: LeadTag[]
```

### Endpoint POST /api/chatwoot/sync

```text
POST /api/chatwoot/sync
  { action: "sync-contacts", accountId: "xxx" }
  
  -> Chatwoot API: GET /conversations?status=all (paginado)
  -> Para cada conversa:
     - Find or create contact por chatwoot_contact_id
     - Update nome/telefone/email se mudou
     - Aplicar stage tag baseado em labels
  -> Response: { success, contacts_created, contacts_updated, ... }
```

### Fluxo corrigido do Kanban

```text
1. Pagina carrega -> GET /api/tags (stages)     [OK - funciona]
2. Pagina carrega -> GET /api/lead-tags          [NOVO - sera criado]
3. Pagina carrega -> GET /api/contacts           [OK apos sync]
4. A cada 30s    -> POST /api/chatwoot/sync      [NOVO - sera criado]
5. Drag & drop   -> POST /api/contacts/:id/tags  [OK - funciona]
```

## Sequencia de Execucao

1. Adicionar metodo `listLeadTags` ao controller de contatos
2. Criar rota `GET /api/lead-tags` no roteador
3. Adicionar metodo `syncContacts` ao chatwoot service
4. Adicionar metodo `handleSync` ao chatwoot controller
5. Criar rota `POST /api/chatwoot/sync` nas rotas do chatwoot
6. Criar migracao `0003_add_resolution_unique`
7. Atualizar schema Prisma com `@@unique`
8. Rebuild no EasyPanel
