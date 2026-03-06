

## Diagnóstico final

O `env_file: - .env` não funciona no EasyPanel porque ele **não monta** um arquivo `.env` no filesystem do container — ele injeta variáveis via Docker API. Porém, as variáveis declaradas na seção `environment` do Compose (com interpolação `${}`) têm **prioridade** e são resolvidas em build-time pelo Compose, onde as vars Google não existem, resultando em strings vazias.

A solução definitiva: hardcodar as credenciais Google diretamente no `environment` do Compose.

## Alterações

**Arquivo: `docker-compose.yml`** — adicionar as 3 variáveis Google com valores literais na seção `environment` do backend (após `LOG_LEVEL`):

```yaml
GOOGLE_CLIENT_ID: "231653132408-iv5b27dlf72ekmbvmviuevcruc6kqs8m.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET: "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"
GOOGLE_REDIRECT_URI: "https://360.gleps.com.br/api/calendar/google/callback"
```

**Seu `.env` no EasyPanel deve ficar assim** (pode remover as 3 linhas do Google já que agora estão no Compose):

```
DB_USER=gleps
DB_PASSWORD=SenhaForte2024!
DB_NAME=gleps_crm
FRONTEND_URL=https://360.gleps.com.br
API_URL=http://backend:3000
CORS_ORIGINS=https://360.gleps.com.br
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
```

As credenciais Google ficam no Compose (valores fixos, sem interpolação). Depois de mudar de domínio ou credenciais, basta atualizar o Compose e fazer rebuild.

