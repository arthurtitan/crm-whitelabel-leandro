

## Diagnóstico Definitivo

O warning do EasyPanel confirma tudo:

```
The "GOOGLE_CLIENT_ID" variable is not set. Defaulting to a blank string.
```

**Causa raiz**: A sintaxe `GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}` no `environment:` do compose faz substituição **no nível do Compose**, antes de chegar ao container. O Compose procura essas variáveis no shell ou num `.env` **no mesmo diretório de onde `docker compose` é executado**. Como o EasyPanel executa de um diretório diferente de onde seu `.env` está, as variáveis resolvem para string vazia e sobrescrevem qualquer coisa.

**Solução**: Usar a diretiva `env_file` no compose para injetar variáveis diretamente no container, sem passar pela substituição `${}`. Remover as variáveis GOOGLE_* da seção `environment:`.

## Alterações

### 1. `docker-compose.yml` (raiz)
- Adicionar `env_file: .env` ao serviço `backend`
- Remover `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` da seção `environment:`

### 2. `deploy/easypanel/docker-compose.yml`
- Adicionar `env_file: .env` ao serviço `backend`
- Remover `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` da seção `environment:`

### 3. `deploy/easypanel/README.md`
- Adicionar instrução para criar o `.env` no mesmo diretório do compose, ou configurar as variáveis via `env_file`

### Mecânica

```text
Antes (quebrado):
  compose environment: GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
    → compose substitui no nível do shell → "" (vazio)
    → container recebe GOOGLE_CLIENT_ID=""

Depois (correto):
  compose env_file: .env
    → Docker lê .env e injeta direto no container
    → container recebe GOOGLE_CLIENT_ID="231653..."
    → Sem substituição de compose, sem risco de sobrescrita
```

### Instrução pós-deploy

O arquivo `.env` precisa estar **no mesmo diretório** de onde o EasyPanel executa o compose. Se o EasyPanel usa o compose da raiz, o `.env` deve estar na raiz. Se usa o de `deploy/easypanel/`, deve estar em `deploy/easypanel/.env`.

**Alternativa (mais segura)**: Se o EasyPanel permite configurar "Environment" por serviço (não global), mover as variáveis GOOGLE_* para o serviço `backend` especificamente no painel do EasyPanel — isso injeta direto no container sem passar pelo compose.

