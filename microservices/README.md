# GLEPS CRM - Arquitetura de Microserviços

Este diretório contém a implementação do backend em arquitetura de microserviços para o GLEPS CRM.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│                         Port: 8080                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API GATEWAY                                │
│                       Port: 3000                                 │
│  • Rate Limiting  • Load Balancing  • Request Routing           │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Auth Service │     │  User Service │     │Contact Service│
│   Port: 3001  │     │   Port: 3002  │     │   Port: 3003  │
└───────────────┘     └───────────────┘     └───────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Sales Service │     │Kanban Service │     │Analytics Svc  │
│   Port: 3004  │     │   Port: 3005  │     │   Port: 3006  │
└───────────────┘     └───────────────┘     └───────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐
│Calendar Service│    │ Event Service │
│   Port: 3007  │     │   Port: 3008  │
└───────────────┘     └───────────────┘
        │                       │
        └───────────┬───────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
┌─────────────┐ ┌─────────┐ ┌─────────────────┐
│  PostgreSQL │ │  Redis  │ │  Shared Library │
│  Port: 5432 │ │Port:6379│ │  @gleps/shared  │
└─────────────┘ └─────────┘ └─────────────────┘
```

## Serviços

| Serviço | Porta | Responsabilidade |
|---------|-------|------------------|
| **Gateway** | 3000 | Proxy reverso, rate limiting, roteamento |
| **Auth** | 3001 | Login, logout, refresh token, JWT |
| **User** | 3002 | CRUD de usuários e contas (accounts) |
| **Contact** | 3003 | CRUD de leads/contatos, tags, notas |
| **Sales** | 3004 | Vendas, produtos, estornos |
| **Kanban** | 3005 | Tags, funnels, board do kanban |
| **Analytics** | 3006 | Dashboard, KPIs, Finance, Insights |
| **Calendar** | 3007 | Eventos, Google Calendar OAuth |
| **Event** | 3008 | Auditoria, logs, atividade de usuários |

## Shared Library

A biblioteca `@gleps/shared` contém código compartilhado entre todos os serviços:

- **Types**: Tipos TypeScript, enums, interfaces
- **Utils**: Errors, helpers, logger, JWT, password
- **Redis**: Client, cache, pub/sub
- **Middleware**: Auth, error handler, rate limiter
- **Database**: Prisma client wrapper
- **Services**: HTTP client para comunicação entre serviços

## Executar Localmente

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- PostgreSQL 16+ (ou via Docker)
- Redis 7+ (ou via Docker)

### Desenvolvimento

```bash
# 1. Iniciar infraestrutura
docker compose up -d postgres redis

# 2. Instalar dependências da shared library
cd shared && npm install && npm run build && cd ..

# 3. Para cada serviço (em terminais separados):
cd auth-service && npm install && npm run dev
cd user-service && npm install && npm run dev
# ... etc

# 4. Ou usar Docker Compose completo:
docker compose up -d --build
```

### Comandos Úteis

```bash
# Ver logs de todos os serviços
docker compose logs -f

# Ver logs de um serviço específico
docker compose logs -f auth-service

# Reiniciar um serviço
docker compose restart auth-service

# Executar migrations
docker compose exec auth-service npx prisma migrate deploy

# Acessar PostgreSQL
docker compose exec postgres psql -U gleps -d gleps_crm

# Acessar Redis CLI
docker compose exec redis redis-cli
```

## Comunicação entre Serviços

### HTTP (Síncrono)

Os serviços se comunicam via HTTP através do `ServiceClient`:

```typescript
import { userClient } from '@gleps/shared';

const response = await userClient.get('/api/users/123');
if (response.success) {
  console.log(response.data);
}
```

### Redis Pub/Sub (Assíncrono)

Eventos são publicados via Redis para processamento assíncrono:

```typescript
import { publishEvent } from '@gleps/shared';

await publishEvent({
  eventType: 'user.created',
  accountId: 'xxx',
  actorType: 'user',
  actorId: 'yyy',
  entityType: 'user',
  entityId: 'zzz',
  payload: { email: 'user@example.com' },
});
```

O `event-service` escuta esses eventos e persiste no banco.

## Cache

Redis é usado para cache com TTLs configuráveis:

```typescript
import { getOrSetCache, CACHE_KEYS, CACHE_TTL } from '@gleps/shared';

const user = await getOrSetCache(
  CACHE_KEYS.USER(userId),
  () => prisma.user.findUnique({ where: { id: userId } }),
  CACHE_TTL.MEDIUM // 5 minutos
);
```

## Rate Limiting

O Gateway implementa rate limiting via Redis:

- **API geral**: 100 req/min por IP
- **Auth**: 10 req/15min por IP
- **Heavy endpoints**: 10 req/min por IP

## Health Checks

Cada serviço expõe endpoints de health:

- `GET /health` - Status geral com checks de DB e Redis
- `GET /ready` - Readiness probe
- `GET /live` - Liveness probe

## Segurança

- JWT com refresh tokens
- Rate limiting
- Helmet (headers de segurança)
- CORS configurável
- Validação com Zod
- Isolamento multi-tenant por accountId

## Deploy em Produção

```bash
# 1. Copiar e configurar variáveis
cp .env.example .env
# Editar .env com valores de produção

# 2. Build e deploy
docker compose -f docker-compose.yml up -d --build

# 3. Executar migrations
docker compose exec auth-service npx prisma migrate deploy

# 4. (Opcional) Popular dados iniciais
docker compose exec auth-service npm run db:seed
```

## Monitoramento

Recomendações para produção:

- **Logs**: Pino (já implementado) → Loki/Elasticsearch
- **Métricas**: Prometheus + Grafana
- **Tracing**: Jaeger/Zipkin
- **Alertas**: PagerDuty/Opsgenie

## Escalabilidade

Cada serviço pode ser escalado independentemente:

```bash
docker compose up -d --scale sales-service=3
```

Para produção, considere:

- Kubernetes (K8s)
- Load balancer (NGINX/HAProxy)
- Database replicas (read replicas)
- Redis Cluster
