

# Criar Migration Inicial do Prisma

## Situacao Atual

Os 3 containers estao saudaveis. O backend inicia, conecta ao banco, mas o log diz:

```
No migration found in prisma/migrations
No pending migrations to apply.
```

O diretorio `backend/prisma/migrations/` simplesmente nao existe. Sem ele, `prisma migrate deploy` nao cria nenhuma tabela.

## Correcao

Criar 2 arquivos:

### 1. `backend/prisma/migrations/migration_lock.toml`

Arquivo de controle que indica o provider do banco:

```toml
provider = "postgresql"
```

### 2. `backend/prisma/migrations/0001_init/migration.sql`

SQL completo derivado do `schema.prisma` contendo:

- **14 enums**: AccountStatus, UserRole, UserStatus, ContactOrigin, TagType, ActorType, LeadTagSource, TagHistoryAction, SaleStatus, PaymentMethod, CalendarEventType, CalendarEventSource, CalendarEventStatus, AttendeeStatus
- **16 tabelas**: accounts, users, refresh_tokens, contacts, funnels, tags, lead_tags, tag_history, products, sales, sale_items, lead_notes, events, calendar_events, calendar_attendees, google_calendar_tokens
- Todos os indices, foreign keys, constraints de unicidade e valores default

## Sobre o Dominio no EasyPanel

A configuracao de dominios no print esta correta:
- `360.gleps.com.br` aponta para `frontend:80` (estrela amarela = primario)
- O subdominio do EasyPanel aponta para o servico raiz

Uma vez que as tabelas existam no banco, o backend respondera normalmente e o frontend podera se comunicar via `/api` (proxy nginx).

## Resultado Esperado

Apos o proximo deploy:
1. `prisma migrate deploy` encontra `0001_init` e executa o SQL
2. Todas as 16 tabelas sao criadas no PostgreSQL
3. O backend inicia com `node dist/server.js` sem erros
4. O sistema fica acessivel em `360.gleps.com.br`

