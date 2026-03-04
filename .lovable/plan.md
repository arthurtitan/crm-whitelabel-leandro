

## Diagnóstico

### Problema 1: Variáveis Google vazias no container
O compose usa `GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}` que faz **interpolação no nível do compose**. O EasyPanel injeta variáveis **diretamente nos containers via Docker API**, mas NÃO as disponibiliza para a interpolação do compose. Resultado: compose substitui por string vazia, que sobrescreve o valor que o EasyPanel tentaria injetar.

### Problema 2: Loop de renderização na Agenda
Os logs mostram dezenas de requests por segundo para `/admin/agenda`, `/api/auth/me`, etc. O `useEffect` na `AdminAgendaPage` (linha 39-102) tem `searchParams` e `setSearchParams` como dependências. Quando `setSearchParams({})` é chamado, ele muda `searchParams`, que re-dispara o effect, causando um loop infinito de re-renders.

```text
useEffect → searchParams muda → setSearchParams({}) → searchParams muda → useEffect → ...
```

## Alterações

### 1. `docker-compose.yml` — Fix injeção de variáveis Google
Mudar GOOGLE_* de interpolação (`${VAR:-}`) para **pass-through** (apenas o nome da variável). Isso faz o Docker passar a variável do ambiente do host/EasyPanel direto para o container, sem interpolação do compose.

```yaml
# Antes (quebrado):
environment:
  GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}

# Depois (correto):
environment:
  GOOGLE_CLIENT_ID:       # pass-through: Docker passa do host direto
  GOOGLE_CLIENT_SECRET:
  GOOGLE_REDIRECT_URI:
```

- Local: compose lê `.env` automaticamente e disponibiliza as vars
- EasyPanel: injeta via Docker API, sem passar pelo compose
- Qualquer VPS: export das vars no shell ou `.env` file

### 2. `src/pages/admin/AdminAgendaPage.tsx` — Fix loop de renderização
O `useEffect` que trata o OAuth callback precisa ser reescrito para não causar loop:
- Ler `searchParams` uma vez com `useRef` em vez de como dependência reativa
- Remover `setSearchParams` e `isInitialized` da lista de dependências
- Usar `window.location.search` para leitura inicial e `window.history.replaceState` para limpar URL sem causar re-render

### 3. `.env.example` — Documentar variáveis Google
Adicionar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` ao `.env.example` para que fique claro como configurar localmente.

