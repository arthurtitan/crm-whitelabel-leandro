

## Diagnóstico Definitivo

### O que aconteceu nas últimas tentativas

Fizemos 3 abordagens para injetar variáveis Google no container:

```text
Tentativa 1: GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
  → Compose interpola a variável do EasyPanel
  → Mas EasyPanel mostrou warning "not set" → valor vazio chegou ao container
  → Hipótese: variáveis não estavam cadastradas no momento do build

Tentativa 2: GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}  (sem default)
  → Mesma coisa, mas gera warning do Compose

Tentativa 3: GOOGLE_CLIENT_ID:  (pass-through, SEM valor)
  → Docker procura a variável no SHELL do host
  → EasyPanel NÃO define variáveis no shell — só faz interpolação do YAML
  → Variável NUNCA chega ao container
```

**Resumo**: A abordagem pass-through (tentativa 3 — implementação atual) é incompatível com o EasyPanel. O EasyPanel funciona **apenas** via substituição de `${VAR}` no YAML do Compose. Precisamos voltar à tentativa 1, mas desta vez com uma forma de **confirmar** que o valor chega ao container.

### Problema do loop de requests

A correção do `useEffect` na Agenda parece correta (roda uma vez, usa `window.location.search`), mas precisa ser validada após deploy. Se ainda houver loop, pode ser o **auto-sync polling a cada 30s** do `CalendarContext` que causa os logs repetidos (isso é esperado se o Google estiver conectado, mas não deve causar dezenas por segundo).

### Plano de Correção

#### 1. `docker-compose.yml` — Reverter para interpolação `${VAR:-}`

A sintaxe pass-through não funciona no EasyPanel. Voltar para:

```yaml
GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}
GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI:-}
```

Isso silencia warnings do Compose e permite que o EasyPanel substitua os valores.

#### 2. `backend/scripts/start.sh` — Adicionar debug de env vars

Adicionar um comando `env | grep GOOGLE` no diagnóstico para confirmar exatamente o que o container recebe. Isso elimina especulação:

```bash
echo "🔍 Diagnóstico Google Calendar:"
echo "   [DEBUG] Variáveis GOOGLE_* no container:"
env | grep GOOGLE || echo "   (nenhuma variável GOOGLE_* encontrada)"
```

Se após rebuild os valores aparecerem, o problema estava na sintaxe pass-through. Se NÃO aparecerem, o problema está no EasyPanel (variáveis cadastradas no lugar errado ou com nome diferente).

#### 3. Checklist de validação no EasyPanel

Após o deploy, verificar nos logs do backend:
- Se `env | grep GOOGLE` mostra valores
- Se o diagnóstico mostra ✅ para cada variável
- Se a Agenda carrega sem loop

### Arquivos a alterar

| Arquivo | Alteração |
|---------|-----------|
| `docker-compose.yml` | Reverter GOOGLE_* de pass-through para `${VAR:-}` |
| `backend/scripts/start.sh` | Adicionar `env \| grep GOOGLE` no bloco de diagnóstico |

