

## Plano: Compose Unificado

### Problema Atual
Existem dois `docker-compose.yml` com diferenças sutis que causam confusão e bugs. O da raiz usa `context: ./backend`, o do EasyPanel usa `context: ../../backend`. Variáveis faltam em um e sobram no outro.

### Solução
Manter **apenas o `docker-compose.yml` na raiz** do projeto, incorporando as melhorias do EasyPanel (CORS, RUN_SEED, BACKEND_UPSTREAM, healthchecks robustos). Remover o diretório `deploy/easypanel/` completamente, pois o nginx template já é copiado pelo `Dockerfile.frontend`.

### Alterações

**1. `docker-compose.yml` (raiz) — Compose unificado**
Merge do melhor dos dois arquivos:
- Adicionar `CORS_ORIGINS`, `RUN_SEED` ao backend
- Adicionar `BACKEND_UPSTREAM` ao frontend
- Usar `expose` em vez de nenhum port mapping (EasyPanel gerencia portas externas; `docker compose up` local pode usar `--publish`)
- Healthchecks com `start_period` mais generoso no backend (60s para migrations)
- Variáveis Google sem fallback (`${GOOGLE_CLIENT_ID}` sem `:-`)
- Comentário único explicando uso local e EasyPanel

**2. Mover `deploy/easypanel/nginx/default.conf.template` para `nginx/default.conf.template`**
O `Dockerfile.frontend` já referencia `deploy/easypanel/nginx/default.conf.template`. Vamos mudar para `nginx/default.conf.template` (mais limpo) e atualizar o Dockerfile.

**3. Remover `deploy/easypanel/docker-compose.yml`**
Não mais necessário.

**4. Atualizar `Dockerfile.frontend`**
Mudar o COPY do template nginx para `nginx/default.conf.template`. Remover o fallback `nginx.conf` (o template já cobre tudo).

**5. Remover `nginx.conf` da raiz**
Redundante — o template com `envsubst` já gera o conf final.

**6. Atualizar `deploy/easypanel/README.md`**
Reescrever para apontar ao compose único na raiz.

### Compose Unificado Final (resumo)

```yaml
# Funciona em: EasyPanel, Docker local, qualquer VPS
services:
  postgres:
    # ... (com defaults para local via :-)
  backend:
    environment:
      # Variáveis com defaults para local, sem defaults para produção
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
      GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI:-}
      CORS_ORIGINS: ${CORS_ORIGINS:-}
      RUN_SEED: ${RUN_SEED:-true}
    # start_period: 60s (tempo para migrations)
  frontend:
    environment:
      BACKEND_UPSTREAM: ${BACKEND_UPSTREAM:-backend:3000}
```

A diferença-chave: usar `:-` (default vazio) nas variáveis Google para que o Compose **nunca** lance warning. Se a variável não existe no ambiente, recebe string vazia silenciosamente. O backend já trata isso como "não configurado".

### Sobre o bug do Google Calendar
O warning do EasyPanel indica que `${GOOGLE_CLIENT_ID}` (sem default) causa alerta quando o Compose parseia. Com `${GOOGLE_CLIENT_ID:-}` o warning desaparece. Mas o backend AINDA mostra "vazia ou ausente" — isso precisa ser investigado separadamente após o compose unificado estar no lugar. Pode ser um problema de como o EasyPanel injeta variáveis no serviço específico.

