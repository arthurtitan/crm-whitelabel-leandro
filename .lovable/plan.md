

## Análise

Hardcodar credenciais no `docker-compose.yml` funciona em qualquer lugar (EasyPanel, VPS, AWS, etc.), mas tem um problema: **segredos ficam versionados no Git**. Se o repositório for compartilhado ou se tornar público, as credenciais ficam expostas.

## Solução universal (sem hardcode, funciona em qualquer orquestrador)

A abordagem portátil é usar a diretiva `env_file` no Compose, que carrega variáveis de um arquivo `.env` local e as injeta no container **diretamente** — sem passar pela interpolação `${}` que causa o problema no EasyPanel.

**Arquivo: `docker-compose.yml`** — no serviço `backend`, adicionar `env_file` e remover qualquer referência direta às variáveis Google:

```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile
  restart: unless-stopped
  env_file:
    - .env          # <-- carrega TODAS as vars do .env direto no container
  environment:
    # Apenas overrides que precisam de interpolação Compose:
    NODE_ENV: ${NODE_ENV:-production}
    PORT: "3000"
    DATABASE_URL: postgresql://${DB_USER:-gleps}:${DB_PASSWORD:-gleps_secret}@postgres:5432/${DB_NAME:-gleps_crm}?schema=public
    API_URL: ${API_URL:-http://backend:3000}
    FRONTEND_URL: ${FRONTEND_URL:-http://localhost}
    CORS_ORIGINS: ${CORS_ORIGINS:-}
    # ... demais vars que precisam de defaults Compose
```

Com `env_file`, todas as variáveis do `.env` (incluindo `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`) são injetadas diretamente no container. As variáveis em `environment` têm prioridade sobre `env_file`, então os defaults do Compose continuam funcionando para as que precisam de interpolação (como `DATABASE_URL`).

**Compatibilidade:**
- **Local**: `.env` na raiz com as credenciais → funciona
- **EasyPanel**: `.env` gerado pela UI ou injetado → funciona
- **Qualquer VPS/cloud**: basta ter um `.env` ao lado do `docker-compose.yml` → funciona
- **CI/CD**: variáveis de pipeline geram `.env` antes do deploy → funciona

**Arquivo: `.env.example`** — atualizar para documentar as variáveis Google:

```env
# Google Calendar (opcional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://seu-dominio.com/api/calendar/google/callback
```

Nenhuma credencial fica no código. O `.env` já está no `.gitignore`.

