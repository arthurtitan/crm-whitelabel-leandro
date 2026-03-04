

## Diagnóstico Definitivo — Causa Raiz Encontrada

### A Prova Está nos Logs

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/google/callback
```

A `GOOGLE_REDIRECT_URI` mostra `http://localhost:3000/...` — esse valor **não vem do EasyPanel** (onde você configurou `https://360.gleps.com.br/...`). Esse valor vem do arquivo `backend/.env` que está dentro do repositório:

```text
# backend/.env (linha 33)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/google/callback
```

### O Que Acontece

Na última alteração, adicionamos `env_file: ./backend/.env` ao `docker-compose.yml`. O Docker Compose carrega esse arquivo **primeiro**, e como ele contém `GOOGLE_CLIENT_ID=` (vazio) e `GOOGLE_REDIRECT_URI=http://localhost:3000/...`, esses valores sobrescrevem qualquer coisa que o EasyPanel tente injetar.

```text
Ordem de prioridade (Docker Compose):
1. environment: (seção do compose) → mais alta
2. env_file: → segunda  
3. Docker API (EasyPanel) → mais baixa

Resultado:
- GOOGLE_CLIENT_ID="" (do backend/.env via env_file) → sobrescreve EasyPanel
- GOOGLE_REDIRECT_URI="http://localhost:3000/..." (do backend/.env) → sobrescreve EasyPanel
```

### Consequência Crítica: Backend em Loop

Como `GOOGLE_REDIRECT_URI` tem valor (do .env local) mas `GOOGLE_CLIENT_ID` está vazio, o script detecta "configuração parcial" (1/3) e faz `exit 1`. O Docker reinicia o container infinitamente por causa do `restart: unless-stopped`.

### Plano de Correção

#### 1. `docker-compose.yml` — Remover env_file E adicionar GOOGLE vars de volta

A diretiva `env_file` foi a causa direta. Removê-la e re-adicionar as variáveis Google na seção `environment:` — mas **sem default vazio** para que o EasyPanel possa injetá-las. Usar a mesma sintaxe das outras variáveis que funcionam (como JWT_SECRET):

```yaml
# Remover:
env_file:
  - path: ./backend/.env
    required: false

# Na seção environment, adicionar:
GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI:-}
```

**Porém**, isso já tentamos antes e não funcionou. A razão é que as variáveis do EasyPanel são definidas no nível do **app Compose**, onde o Compose as interpola. Se o EasyPanel disponibiliza as variáveis para interpolação do YAML, `${GOOGLE_CLIENT_ID:-}` deveria funcionar — e de fato **agora sabemos que o problema era o env_file sobrescrevendo**. Com o env_file removido, a interpolação `${VAR:-}` deve funcionar corretamente.

#### 2. `backend/.env` — Remover variáveis Google

Para evitar que o arquivo `.env` (que é commitado no repo) interfira em produção, remover as linhas `GOOGLE_*` dele. O desenvolvimento local usará variáveis de ambiente do shell ou um `.env.local` não commitado.

#### 3. `start.sh` — Não fazer exit 1 em configuração parcial

Como medida de segurança adicional, trocar o `exit 1` por um **warning** quando há configuração parcial. Assim o backend sempre inicia, mesmo com Google parcialmente configurado (a funcionalidade Google simplesmente não funcionará).

### Arquivos a alterar

| Arquivo | Alteração |
|---------|-----------|
| `docker-compose.yml` | Remover `env_file`, re-adicionar `GOOGLE_*: ${VAR:-}` no environment |
| `backend/.env` | Remover linhas GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI |
| `backend/scripts/start.sh` | Trocar `exit 1` por warning na validação parcial do Google |

