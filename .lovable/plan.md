

## Diagnóstico Completo

### Problema 1: Variáveis Google vazias

A saída do debug confirma:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

As variáveis EXISTEM no ambiente do EasyPanel (você confirmou com valores corretos), mas chegam **vazias** no container. O mecanismo:

```text
1. EasyPanel armazena as variáveis
2. docker-compose.yml tem: GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
3. Compose interpola ${GOOGLE_CLIENT_ID:-} → "" (vazio, pois a var não está disponível no contexto de interpolação)
4. O valor "" é escrito no environment do container
5. EasyPanel TAMBÉM tenta injetar via Docker API, mas o valor "" do compose TEM PRIORIDADE
6. Container recebe GOOGLE_CLIENT_ID="" (vazio)
```

Prova: `JWT_SECRET` funciona porque foi configurado ANTES do deploy ou porque o EasyPanel trata diferentemente variáveis com valor default vs. default vazio.

**Correção definitiva**: Remover GOOGLE_* da seção `environment` do compose. Assim, o compose não sobrescreve com vazio, e o EasyPanel injeta diretamente os valores via Docker API.

### Problema 2: Loop de renderização na Agenda

Os logs mostram `GET /admin/agenda` sendo requisitado a cada ~200ms — são recarregamentos completos da página, não apenas re-renders do React.

Após análise extensiva do código (AdminAgendaPage, CalendarContext, ProtectedRoute, BackendAuthProvider, ErrorBoundary, App.tsx), não encontrei uma causa óbvia no código-fonte. A correção anterior (remover `useSearchParams`) está correta, mas preciso confirmar que o **build de produção** inclui essa mudança.

Duas hipóteses restantes:
- O build do frontend no Docker está usando cache e não inclui as últimas alterações
- Há uma exceção em runtime no CalendarView que causa crash silencioso e reload

## Plano de Correção

### 1. `docker-compose.yml` — Remover Google vars do environment

Remover as 3 linhas de GOOGLE_* da seção `environment:` do backend. O EasyPanel as injetará diretamente via Docker API sem serem sobrescritas pelo compose.

Para desenvolvimento local, adicionar `env_file: .env` (opcional) para que o Docker Compose passe as variáveis do `.env` diretamente para o container.

### 2. `Dockerfile.frontend` — Forçar build sem cache

Adicionar um `ARG CACHEBUST` para garantir que o frontend é reconstruído com o código mais recente em cada deploy.

### 3. `CalendarContext.tsx` — Guard contra re-inicialização

Adicionar um `useRef` para prevenir que o `useEffect` de inicialização execute mais de uma vez, mesmo que as dependências mudem por alguma razão em produção.

### Arquivos a alterar

| Arquivo | Alteração |
|---------|-----------|
| `docker-compose.yml` | Remover GOOGLE_* do `environment`, adicionar `env_file` |
| `Dockerfile.frontend` | Adicionar `ARG CACHEBUST` antes do build step |
| `src/contexts/CalendarContext.tsx` | Adicionar guard ref na inicialização |

