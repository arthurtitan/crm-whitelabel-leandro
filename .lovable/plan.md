

# Corrigir Deploy no EasyPanel

## Diagnostico

O sistema esta 100% funcional:
- Login page renderiza corretamente
- Backend inicia, roda migrations, seed e escuta na porta 3000
- Frontend Nginx escuta na porta 80 e faz proxy reverso para `/api`
- Todos os endpoints e rotas estao corretamente configurados

O erro "Service is not reachable" e do proxy do EasyPanel, nao do app. Identifiquei 2 problemas potenciais:

## Problema 1: Healthcheck do frontend no docker-compose.yml esta ausente

O EasyPanel pode ignorar o HEALTHCHECK do Dockerfile e depender do definido no `docker-compose.yml`. Como o servico `frontend` nao tem healthcheck no compose, o EasyPanel pode nao saber que o servico esta pronto.

**Arquivo**: `docker-compose.yml`
**Correcao**: Adicionar healthcheck explicito ao servico frontend no compose, apontando para o endpoint `/health` do Nginx.

## Problema 2: Backend healthcheck pode falhar silenciosamente

O backend usa `wget --spider` no HEALTHCHECK, mas como o usuario roda como `nodejs` (non-root), pode haver problemas de permissao. Se o backend for marcado como unhealthy, e o frontend depende dele, o EasyPanel pode considerar tudo indisponivel.

**Arquivo**: `docker-compose.yml`
**Correcao**: Adicionar healthcheck explicito ao servico backend no compose tambem, e ajustar o `depends_on` do frontend para usar `condition: service_started` (em vez de esperar por healthy).

## Plano de Implementacao

### 1. Atualizar docker-compose.yml

Adicionar healthchecks explicitos nos dois servicos e garantir que o frontend nao dependa do health do backend para iniciar:

```text
services:
  postgres:
    (sem mudanca)

  backend:
    (adicionar healthcheck no compose)
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s    # <-- Maior para dar tempo de migrations/seed

  frontend:
    (adicionar healthcheck no compose)
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:80/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 10s
    depends_on:
      backend:
        condition: service_started   # <-- NAO espera healthy, so started
```

### 2. Corrigir nginx.conf - Endpoint /health

O bloco `/health` atual tem `add_header` depois de `return`, que e ignorado pelo Nginx. Corrigir para garantir resposta limpa:

```text
location /health {
    access_log off;
    default_type text/plain;
    return 200 "OK";
}
```

### 3. Aumentar start_period do backend

O backend roda migrations + seed antes de iniciar o servidor. O start_period de 5s no Dockerfile e insuficiente. Corrigir no Dockerfile tambem:

```text
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --spider -q http://localhost:3000/api/health || exit 1
```

## Resumo das mudancas

| Arquivo | Mudanca |
|---------|---------|
| docker-compose.yml | Adicionar healthcheck aos servicos frontend e backend; mudar depends_on para service_started |
| nginx.conf | Corrigir bloco /health (default_type antes de return) |
| backend/Dockerfile | Aumentar start_period de 5s para 40s |

## Apos aprovacao

1. Aplicar as 3 mudancas
2. No VPS: `docker compose build --no-cache && docker compose up -d`
3. Verificar: `docker compose ps` (ambos servicos devem estar healthy)
4. Acessar o dominio configurado no EasyPanel

