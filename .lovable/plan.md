
# Plano de Implementacao: Integracao Chatwoot Funcional + Docker + Migrations

## Resumo Executivo

Este plano implementa a integracao completa e funcional com o Chatwoot no backend, incluindo:
- Servico dedicado para comunicacao com API do Chatwoot
- Webhooks para sincronizacao bilateral (Kanban ↔ Labels)
- Scripts de migracao para PostgreSQL
- Configuracao Docker completa para deploy

---

## PARTE 1: Estrutura de Arquivos a Criar/Modificar

### Novos Arquivos

```
backend/
├── src/
│   ├── services/
│   │   └── chatwoot.service.ts      # NOVO - Servico Chatwoot
│   ├── controllers/
│   │   └── chatwoot.controller.ts   # NOVO - Controller webhooks
│   ├── routes/
│   │   └── chatwoot.routes.ts       # NOVO - Rotas webhook
│   └── types/
│       └── chatwoot.types.ts        # NOVO - Tipos Chatwoot
├── prisma/
│   └── migrations/                   # Migrations Prisma
└── scripts/
    └── migrate.sh                    # Script para rodar migrations
```

---

## PARTE 2: Servico Chatwoot (Core da Integracao)

### 2.1 Arquivo: `backend/src/services/chatwoot.service.ts`

Servico centralizado para todas as operacoes com Chatwoot:

```typescript
// Funcionalidades implementadas:

class ChatwootService {
  // === CONEXAO E VALIDACAO ===
  testConnection(accountId: string)     // Testar credenciais
  
  // === AGENTES ===
  getAgents(accountId: string)          // Listar agentes
  getAgentById(accountId, agentId)      // Buscar agente especifico
  
  // === INBOXES (Canais) ===
  getInboxes(accountId: string)         // Listar canais (WhatsApp, Instagram, etc)
  
  // === LABELS (Tags/Etapas) ===
  getLabels(accountId: string)          // Listar todas as labels
  createLabel(accountId, data)          // Criar label (quando criar etapa no Kanban)
  updateLabel(accountId, labelId, data) // Atualizar label
  deleteLabel(accountId, labelId)       // Excluir label
  
  // === CONVERSAS ===
  getConversations(accountId, filters)  // Listar conversas com filtros
  getConversation(accountId, convId)    // Detalhes de uma conversa
  addLabelToConversation(...)           // Aplicar label a conversa
  removeLabelFromConversation(...)      // Remover label de conversa
  
  // === METRICAS (Dashboard) ===
  getConversationMetrics(accountId, dateRange)  // Metricas de conversas
  getAgentMetrics(accountId, dateRange)         // Performance por agente
  getBotMetrics(accountId, dateRange)           // IA vs Humano
  
  // === CONTATOS ===
  getContact(accountId, contactId)      // Buscar contato no Chatwoot
  searchContacts(accountId, query)      // Buscar contatos
}
```

### 2.2 Metodos Detalhados

#### Conexao com Chatwoot API

```typescript
private async makeRequest<T>(
  account: Account,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  // Monta URL completa
  const url = `${account.chatwootBaseUrl}/api/v1/accounts/${account.chatwootAccountId}${endpoint}`;
  
  // Faz requisicao com token
  const response = await fetch(url, {
    ...options,
    headers: {
      'api_access_token': account.chatwootApiKey,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  // Trata erros
  if (!response.ok) {
    throw new ChatwootApiError(response.status, await response.text());
  }
  
  return response.json();
}
```

#### Sincronizacao de Labels (Kanban ↔ Chatwoot)

```typescript
// Quando criar etapa no Kanban → criar label no Chatwoot
async createLabel(accountId: string, data: { title: string; color: string }) {
  const account = await this.getAccountWithChatwoot(accountId);
  
  const label = await this.makeRequest(account, '/labels', {
    method: 'POST',
    body: JSON.stringify({
      title: data.title,
      description: `Etapa do Kanban: ${data.title}`,
      color: data.color.replace('#', ''),
      show_on_sidebar: true,
    }),
  });
  
  return label;
}

// Quando aplicar label no Chatwoot → mover lead no Kanban
async handleLabelApplied(webhookData: ChatwootWebhookEvent) {
  const { conversation, labels } = webhookData;
  
  // Encontra o contato no CRM pelo chatwoot_contact_id
  const contact = await prisma.contact.findFirst({
    where: { chatwootContactId: conversation.contact_id },
  });
  
  // Encontra a tag correspondente a label aplicada
  const tag = await prisma.tag.findFirst({
    where: { chatwootLabelId: labels[0].id },
  });
  
  // Aplica a tag ao contato (move no Kanban)
  await contactService.applyTag(contact.id, contact.accountId, tag.id, 'chatwoot');
}
```

---

## PARTE 3: Webhooks do Chatwoot

### 3.1 Arquivo: `backend/src/controllers/chatwoot.controller.ts`

```typescript
class ChatwootController {
  // POST /api/chatwoot/webhook
  async handleWebhook(req, res) {
    // Valida assinatura do webhook
    const isValid = this.validateWebhookSignature(req);
    if (!isValid) return res.status(401).json({ error: 'Invalid signature' });
    
    const event = req.body;
    
    switch (event.event) {
      case 'conversation_created':
        await this.handleConversationCreated(event);
        break;
        
      case 'conversation_status_changed':
        await this.handleStatusChanged(event);
        break;
        
      case 'conversation_updated':
        // Labels foram alteradas
        await this.handleLabelsChanged(event);
        break;
        
      case 'message_created':
        await this.handleNewMessage(event);
        break;
    }
    
    res.json({ received: true });
  }
  
  // Valida HMAC signature
  private validateWebhookSignature(req) {
    const signature = req.headers['x-chatwoot-signature'];
    const payload = JSON.stringify(req.body);
    const expected = crypto
      .createHmac('sha256', env.CHATWOOT_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    return signature === expected;
  }
}
```

### 3.2 Eventos Tratados

| Evento Chatwoot | Acao no CRM |
|-----------------|-------------|
| `conversation_created` | Cria contato se nao existir |
| `conversation_updated` (labels) | Move lead no Kanban |
| `conversation_status_changed` | Atualiza status/metricas |
| `message_created` | Log para auditoria |

---

## PARTE 4: Tipos TypeScript para Chatwoot

### Arquivo: `backend/src/types/chatwoot.types.ts`

```typescript
// Tipos para API do Chatwoot
export interface ChatwootAgent {
  id: number;
  name: string;
  email: string;
  role: 'agent' | 'administrator';
  availability_status: 'online' | 'busy' | 'offline';
  thumbnail?: string;
}

export interface ChatwootLabel {
  id: number;
  title: string;
  description?: string;
  color: string;
  show_on_sidebar: boolean;
}

export interface ChatwootInbox {
  id: number;
  name: string;
  channel_type: 'Channel::Whatsapp' | 'Channel::Instagram' | 'Channel::WebWidget';
  avatar_url?: string;
}

export interface ChatwootConversation {
  id: number;
  account_id: number;
  inbox_id: number;
  status: 'open' | 'resolved' | 'pending' | 'snoozed';
  assignee_id?: number;
  contact_id: number;
  labels: string[];
  created_at: string;
  // ... outros campos
}

export interface ChatwootWebhookEvent {
  event: string;
  id: number;
  account: { id: number };
  conversation?: ChatwootConversation;
  contact?: { id: number; name: string; phone_number?: string; email?: string };
  labels?: ChatwootLabel[];
}

// Tipos para metricas
export interface ChatwootMetrics {
  conversations_count: number;
  resolved_count: number;
  avg_first_response_time: number;
  avg_resolution_time: number;
}
```

---

## PARTE 5: Rotas do Backend

### Arquivo: `backend/src/routes/chatwoot.routes.ts`

```typescript
const router = Router();

// Webhook (sem autenticacao JWT, valida por signature)
router.post('/webhook', chatwootController.handleWebhook);

// Rotas autenticadas (para frontend)
router.use(authenticate);

// Metricas para Dashboard
router.get('/metrics', requirePermission('dashboard'), chatwootController.getMetrics);
router.get('/agents/:accountId/metrics', requireAdmin, chatwootController.getAgentMetrics);

// Labels
router.get('/labels/:accountId', chatwootController.getLabels);
router.post('/labels/:accountId', requireAdmin, chatwootController.createLabel);
router.put('/labels/:accountId/:labelId', requireAdmin, chatwootController.updateLabel);
router.delete('/labels/:accountId/:labelId', requireAdmin, chatwootController.deleteLabel);

// Inboxes
router.get('/inboxes/:accountId', chatwootController.getInboxes);

export default router;
```

### Atualizar: `backend/src/routes/index.ts`

```typescript
import chatwootRoutes from './chatwoot.routes';

// Adicionar rota
router.use('/chatwoot', chatwootRoutes);
```

---

## PARTE 6: Modificacoes no TagService

### Atualizar: `backend/src/services/tag.service.ts`

Adicionar sincronizacao com Chatwoot ao criar/editar/excluir etapas:

```typescript
async create(input: CreateTagInput, createdById?: string) {
  // Cria tag no banco local
  const tag = await prisma.tag.create({ ... });
  
  // Se for etapa (stage), sincroniza com Chatwoot
  if (input.type === 'stage') {
    try {
      const account = await prisma.account.findUnique({ where: { id: input.accountId } });
      
      if (account?.chatwootApiKey) {
        const label = await chatwootService.createLabel(input.accountId, {
          title: input.name,
          color: input.color || '#6366F1',
        });
        
        // Salva o ID da label do Chatwoot
        await prisma.tag.update({
          where: { id: tag.id },
          data: { chatwootLabelId: label.id },
        });
      }
    } catch (error) {
      logger.warn('Failed to sync tag with Chatwoot', { error });
      // Nao falha a operacao, apenas loga
    }
  }
  
  return tag;
}

async update(id: string, input: UpdateTagInput, accountId: string, updatedById?: string) {
  const tag = await this.getById(id, accountId);
  
  // Atualiza localmente
  const updated = await prisma.tag.update({ ... });
  
  // Sincroniza com Chatwoot se tiver label vinculada
  if (tag.chatwootLabelId) {
    await chatwootService.updateLabel(accountId, tag.chatwootLabelId, {
      title: input.name,
      color: input.color,
    });
  }
  
  return updated;
}
```

---

## PARTE 7: Docker e Migrations

### 7.1 Atualizar: `docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: gleps_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-gleps}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-gleps_secret}
      POSTGRES_DB: ${DB_NAME:-gleps_crm}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "${DB_PORT:-5432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-gleps} -d ${DB_NAME:-gleps_crm}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - gleps_network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: gleps_backend
    restart: unless-stopped
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      PORT: 3000
      API_URL: ${API_URL:-http://localhost:3000}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:8080}
      DATABASE_URL: postgresql://${DB_USER:-gleps}:${DB_PASSWORD:-gleps_secret}@postgres:5432/${DB_NAME:-gleps_crm}?schema=public
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-1h}
      REFRESH_TOKEN_SECRET: ${REFRESH_TOKEN_SECRET}
      REFRESH_TOKEN_EXPIRES_IN: ${REFRESH_TOKEN_EXPIRES_IN:-7d}
      BCRYPT_SALT_ROUNDS: ${BCRYPT_SALT_ROUNDS:-12}
      RATE_LIMIT_WINDOW_MS: ${RATE_LIMIT_WINDOW_MS:-900000}
      RATE_LIMIT_MAX: ${RATE_LIMIT_MAX:-100}
      CHATWOOT_WEBHOOK_SECRET: ${CHATWOOT_WEBHOOK_SECRET:-}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
      GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI:-}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - gleps_network

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
      args:
        VITE_API_URL: ${API_URL:-http://localhost:3000}
    container_name: gleps_frontend
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      - backend
    networks:
      - gleps_network

volumes:
  postgres_data:

networks:
  gleps_network:
    driver: bridge
```

### 7.2 Arquivo: `backend/scripts/migrate.sh`

```bash
#!/bin/bash
# Script para executar migrations do Prisma

set -e

echo "=========================================="
echo "GLEPS CRM - Database Migration Script"
echo "=========================================="

# Verifica se DATABASE_URL esta configurado
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL not set"
    echo "Usage: DATABASE_URL=postgresql://user:pass@host:5432/db ./migrate.sh"
    exit 1
fi

echo "📦 Gerando Prisma Client..."
npx prisma generate

echo "🔄 Aplicando migrations..."
npx prisma migrate deploy

echo "✅ Migrations aplicadas com sucesso!"

# Opcional: rodar seed
if [ "$RUN_SEED" = "true" ]; then
    echo "🌱 Executando seed..."
    npx tsx src/prisma/seed.ts
    echo "✅ Seed concluido!"
fi

echo ""
echo "=========================================="
echo "Database ready!"
echo "=========================================="
```

### 7.3 Arquivo: `.env.example` (raiz do projeto)

```bash
# ===========================================
# GLEPS CRM - Environment Variables
# ===========================================

# Application
NODE_ENV=production
API_URL=http://localhost:3000
FRONTEND_URL=http://localhost:8080

# Database
DB_USER=gleps
DB_PASSWORD=your_secure_password_here
DB_NAME=gleps_crm
DB_PORT=5432

# JWT (GERE VALORES SEGUROS!)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=your-refresh-token-secret-min-32-chars
REFRESH_TOKEN_EXPIRES_IN=7d

# Security
BCRYPT_SALT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Chatwoot Integration
CHATWOOT_WEBHOOK_SECRET=your-chatwoot-webhook-secret

# Google Calendar (Optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Logging
LOG_LEVEL=info
```

### 7.4 Atualizar: `backend/Dockerfile`

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY package*.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/

RUN npm ci --only=production && \
    npx prisma generate && \
    chmod +x scripts/*.sh

COPY --from=builder /app/dist ./dist

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --spider -q http://localhost:3000/api/health || exit 1

# Roda migrations e inicia o app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
```

---

## PARTE 8: Comandos para Deploy

### 8.1 Primeira vez (setup completo)

```bash
# 1. Clone o repositorio
git clone <repo> && cd gleps-crm

# 2. Copie e configure .env
cp .env.example .env
# Edite .env com suas configuracoes

# 3. Suba os containers
docker-compose up -d

# 4. Verifique os logs
docker-compose logs -f backend

# 5. Acesse o sistema
# Frontend: http://localhost:8080
# Backend: http://localhost:3000/api/health
```

### 8.2 Atualizar sistema existente

```bash
# 1. Pull das mudancas
git pull origin main

# 2. Rebuild e restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Migrations sao executadas automaticamente no startup
```

### 8.3 Executar migrations manualmente

```bash
# Via Docker
docker-compose exec backend npx prisma migrate deploy

# Ou localmente
cd backend
DATABASE_URL=postgresql://... npm run db:migrate:prod
```

### 8.4 Seed do banco (dados iniciais)

```bash
# Via Docker
docker-compose exec backend npx tsx src/prisma/seed.ts

# Ou com variavel
docker-compose exec -e RUN_SEED=true backend sh scripts/migrate.sh
```

---

## PARTE 9: Fluxo de Sincronizacao Chatwoot

### Diagrama de Fluxo

```text
+------------------+                      +------------------+
|     KANBAN       |                      |    CHATWOOT      |
|   (CRM GLEPS)    |                      |                  |
+------------------+                      +------------------+
        |                                         |
        | 1. Admin cria etapa "Qualificado"       |
        |---------------------------------------->|
        |    POST /labels { title, color }        |
        |                                         |
        | 2. Atendente aplica label na conversa   |
        |<----------------------------------------|
        |    Webhook: conversation_updated        |
        |                                         |
        | 3. CRM move lead no Kanban              |
        |    contactService.applyTag()            |
        |                                         |
        | 4. Usuario arrasta lead para nova etapa |
        |---------------------------------------->|
        |    PUT /conversations/:id/labels        |
        |                                         |
+------------------+                      +------------------+
```

---

## PARTE 10: Ordem de Implementacao

| # | Tarefa | Arquivos | Prioridade |
|---|--------|----------|------------|
| 1 | Tipos Chatwoot | `chatwoot.types.ts` | Alta |
| 2 | Servico Chatwoot | `chatwoot.service.ts` | Alta |
| 3 | Controller Webhooks | `chatwoot.controller.ts` | Alta |
| 4 | Rotas Chatwoot | `chatwoot.routes.ts` | Alta |
| 5 | Integrar em routes/index | `routes/index.ts` | Alta |
| 6 | Modificar TagService | `tag.service.ts` | Alta |
| 7 | Modificar ContactService | `contact.service.ts` | Media |
| 8 | Script migrate.sh | `scripts/migrate.sh` | Media |
| 9 | Atualizar docker-compose | `docker-compose.yml` | Media |
| 10 | Atualizar Dockerfile | `Dockerfile` | Media |
| 11 | .env.example raiz | `.env.example` | Baixa |
| 12 | Dashboard metrics | `dashboard.service.ts` | Baixa |

---

## Secao Tecnica

### Endpoints Chatwoot Utilizados

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| GET | `/api/v1/accounts/:id/agents` | Listar agentes |
| GET | `/api/v1/accounts/:id/labels` | Listar labels |
| POST | `/api/v1/accounts/:id/labels` | Criar label |
| PATCH | `/api/v1/accounts/:id/labels/:lid` | Atualizar label |
| DELETE | `/api/v1/accounts/:id/labels/:lid` | Excluir label |
| GET | `/api/v1/accounts/:id/inboxes` | Listar canais |
| GET | `/api/v1/accounts/:id/conversations` | Listar conversas |
| POST | `/api/v1/accounts/:id/conversations/:cid/labels` | Adicionar label |
| GET | `/api/v1/accounts/:id/reports/summary` | Metricas gerais |
| GET | `/api/v1/accounts/:id/reports/agents` | Metricas por agente |

### Variaveis de Ambiente Novas

| Variavel | Descricao | Obrigatoria |
|----------|-----------|-------------|
| `CHATWOOT_WEBHOOK_SECRET` | Secret para validar webhooks | Sim (para webhooks) |
| `DB_USER` | Usuario do PostgreSQL | Sim |
| `DB_PASSWORD` | Senha do PostgreSQL | Sim |
| `DB_NAME` | Nome do banco | Sim |

### Campos no Schema Prisma

Os campos ja existem no schema atual:
- `Account.chatwootBaseUrl` - URL da instancia
- `Account.chatwootAccountId` - ID da conta
- `Account.chatwootApiKey` - Access Token
- `User.chatwootAgentId` - Vinculo com agente
- `Tag.chatwootLabelId` - Vinculo com label
- `Contact.chatwootContactId` - Vinculo com contato
- `Contact.chatwootConversationId` - Vinculo com conversa
