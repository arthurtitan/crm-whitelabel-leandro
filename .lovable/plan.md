

## Diagnóstico Real

O problema não é de código, é de **arquitetura**. O Docker Compose interpola `${GOOGLE_CLIENT_ID:-}` para `""` porque o EasyPanel não disponibiliza essas variáveis para interpolação do YAML (mesmo que estejam cadastradas). Não há como resolver isso de forma confiável — a interpolação do Compose é um mecanismo frágil que depende de como cada plataforma injeta variáveis.

**A prova**: Chatwoot funciona perfeitamente porque as credenciais são salvas **no banco de dados** via UI, não via variáveis de ambiente. O Google Calendar deve seguir o mesmo padrão.

## Solução Definitiva: Credenciais Google no Banco de Dados

Exatamente como o Chatwoot já funciona — credenciais armazenadas na tabela `accounts`, configuráveis pela UI do Super Admin.

### O que muda

| Componente | Alteração |
|-----------|-----------|
| **Prisma Schema** | Adicionar `google_client_id`, `google_client_secret`, `google_redirect_uri` na model Account |
| **Migration SQL** | `ALTER TABLE accounts ADD COLUMN google_client_id VARCHAR(500), ...` |
| **`calendar.service.ts`** | Ler credenciais do DB (`account.googleClientId`) em vez de `env.GOOGLE_*` |
| **`env.ts`** | Remover GOOGLE_* do schema Zod (não são mais env vars) |
| **`docker-compose.yml`** | Remover as 3 linhas GOOGLE_* |
| **`start.sh`** | Remover diagnóstico de GOOGLE_* (não existe mais em env) |
| **SuperAdminAccountDetailPage** | Adicionar seção "Google Calendar" no painel de controle da conta (idêntico ao Chatwoot) com campos Client ID, Client Secret, Redirect URI e botão de teste |
| **Account service/controller** | Aceitar os novos campos no update da conta |

### Fluxo final

1. Super Admin acessa Conta → Controle
2. Ativa "Google Calendar", preenche Client ID, Client Secret, Redirect URI
3. Salva → credenciais vão para o banco
4. Admin da conta acessa Agenda → botão "Sincronizar" aparece (backend lê do DB)
5. Clica → OAuth flow funciona

### Vantagens

- Funciona em **qualquer hospedagem** sem depender de env vars
- Segue o padrão **já existente** (Chatwoot)
- Configurável por **conta** (multi-tenant)
- Zero dependência de interpolação de Docker Compose

### Arquivos a criar/alterar

1. **Nova migration Prisma** — adicionar 3 colunas na tabela accounts
2. **`backend/prisma/schema.prisma`** — adicionar campos google_* no model Account
3. **`backend/src/services/calendar.service.ts`** — ler credenciais do DB
4. **`backend/src/config/env.ts`** — remover GOOGLE_*
5. **`docker-compose.yml`** — remover GOOGLE_* do environment
6. **`backend/scripts/start.sh`** — remover diagnóstico Google
7. **`src/pages/super-admin/SuperAdminAccountDetailPage.tsx`** — adicionar seção Google Calendar
8. **`backend/src/controllers/account.controller.ts`** — aceitar novos campos no update

