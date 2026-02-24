

# Adaptar docker-compose.yml para EasyPanel

## Problema
O EasyPanel reportou 7 problemas no `docker-compose.yml`:
- `container_name` em todos os servicos causa conflito (EasyPanel nomeia automaticamente)
- `ports` em todos os servicos causa conflito (EasyPanel gerencia portas/dominios)
- `version` esta obsoleto

## Solucao

Remover do `docker-compose.yml`:
1. A linha `version: '3.8'` (obsoleta)
2. Todos os `container_name` (EasyPanel atribui nomes proprios)
3. Todos os `ports` (EasyPanel gerencia exposicao via Dominios)
4. O bloco `networks` e todas as referencias `networks:` nos servicos (EasyPanel gerencia rede interna)

O restante (volumes, healthchecks, depends_on, environment, build) permanece igual.

## Resultado esperado

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-gleps}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-gleps_secret}
      POSTGRES_DB: ${DB_NAME:-gleps_crm}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-gleps} -d ${DB_NAME:-gleps_crm}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      PORT: 3000
      API_URL: ${API_URL:-http://localhost:3000}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:8080}
      DATABASE_URL: postgresql://${DB_USER:-gleps}:${DB_PASSWORD:-gleps_secret}@postgres:5432/${DB_NAME:-gleps_crm}?schema=public
      JWT_SECRET: ${JWT_SECRET:-your-production-jwt-secret-min-32-characters}
      JWT_EXPIRES_IN: ${JWT_EXPIRES_IN:-1h}
      REFRESH_TOKEN_SECRET: ${REFRESH_TOKEN_SECRET:-your-production-refresh-secret-min-32}
      REFRESH_TOKEN_EXPIRES_IN: ${REFRESH_TOKEN_EXPIRES_IN:-7d}
      BCRYPT_SALT_ROUNDS: ${BCRYPT_SALT_ROUNDS:-12}
      RATE_LIMIT_WINDOW_MS: ${RATE_LIMIT_WINDOW_MS:-900000}
      RATE_LIMIT_MAX: ${RATE_LIMIT_MAX:-100}
      CHATWOOT_WEBHOOK_SECRET: ${CHATWOOT_WEBHOOK_SECRET:-}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
      GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI:-}
      LOG_LEVEL: ${LOG_LEVEL:-info}
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
      args:
        VITE_API_URL: /api
        VITE_USE_BACKEND: "true"
    restart: unless-stopped
    depends_on:
      - backend

volumes:
  postgres_data:
```

## O que foi removido e por que

| Item removido | Motivo |
|---|---|
| `version: '3.8'` | Obsoleto no Docker Compose moderno |
| `container_name` (x3) | EasyPanel gerencia nomes automaticamente |
| `ports` (x3) | EasyPanel expoe servicos via aba Dominios |
| `networks` (bloco + refs) | EasyPanel gerencia rede interna entre containers |

## Apos o deploy

1. Na aba **Dominios** do EasyPanel, apontar seu dominio para o servico **frontend** na porta **80**
2. O frontend ja faz proxy de `/api` para o backend via nginx.conf
3. Executar seed inicial no terminal do container **backend**: `npm run db:seed`

