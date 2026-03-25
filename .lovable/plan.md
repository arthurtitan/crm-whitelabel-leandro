

## Adaptar .env e docker-compose.yml para o domínio correto

### Problema
O `docker-compose.yml` tem valores hardcoded para `360.gleps.com.br` e credenciais Google antigas. O `.env` de deploy precisa refletir o domínio real `goodleads.mychooice.com`.

### Alterações

**1. Atualizar `docker-compose.yml`** — remover hardcodes, usar variáveis do `.env`:
- `FRONTEND_URL`: trocar `"https://360.gleps.com.br"` por `${FRONTEND_URL}`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`: usar `${GOOGLE_CLIENT_ID:-}`, `${GOOGLE_CLIENT_SECRET:-}`, `${GOOGLE_REDIRECT_URI:-}` em vez de valores hardcoded

**2. `.env` adaptado para EasyPanel** (o que o usuário deve colar):

```env
DB_USER=gleps
DB_PASSWORD=SenhaForte2024!
DB_NAME=gleps_crm

FRONTEND_URL=https://goodleads.mychooice.com
API_URL=http://backend:3000
CORS_ORIGINS=https://goodleads.mychooice.com

JWT_SECRET=k8Tj3mZvPqR7xYwN2sLfA9bCdEgHiKoU4nVrXuWyQ1M
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=Bp5GnSx8WqLm3TvRj7YcKfA2dHuE9oZiN6rXwMkJ4Qs
REFRESH_TOKEN_EXPIRES_IN=7d

BCRYPT_SALT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

BACKEND_UPSTREAM=backend:3000
RUN_SEED=true
LOG_LEVEL=info

CHATWOOT_WEBHOOK_SECRET=

GOOGLE_CLIENT_ID=231653132408-iv5b27dlf72ekmbvmviuevcruc6kqs8m.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://goodleads.mychooice.com/api/calendar/google/callback
```

### Detalhes técnicos

**Arquivo: `docker-compose.yml`** — 3 alterações no serviço `backend.environment`:
- Linha `FRONTEND_URL`: de `"https://360.gleps.com.br"` para `${FRONTEND_URL:-https://goodleads.mychooice.com}`
- Linhas `GOOGLE_*`: trocar valores hardcoded por `${GOOGLE_CLIENT_ID:-}`, `${GOOGLE_CLIENT_SECRET:-}`, `${GOOGLE_REDIRECT_URI:-}`

Nenhum outro arquivo precisa ser alterado.

