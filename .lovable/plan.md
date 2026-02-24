
# Revisao Completa: Correcoes de Alinhamento Frontend-Backend

## Status atual do sistema (360.gleps.com.br)
- Backend health check: OK (uptime ~4.5 min, respondendo em `/api/health`)
- Frontend: SPA servida via Nginx, proxy reverso para backend em `/api`
- Configuracao de build: `VITE_USE_BACKEND=true`, `VITE_API_URL=/api` -- correto

## Problemas encontrados

### Problema 1: Rota do Dashboard Admin incorreta (CRITICO)
- **Frontend**: `ADMIN_KPIS: '/api/dashboard/admin/kpis'`
- **Backend**: `router.get('/kpis', ...)` montado em `/dashboard` = `/api/dashboard/kpis`
- **Resultado**: Quando um admin de conta acessar o dashboard, vai receber "Rota nao encontrada: GET /api/dashboard/admin/kpis"
- **Correcao**: Alterar para `'/api/dashboard/kpis'`

### Problema 2: Rota de Performance dos Agentes incorreta (CRITICO)
- **Frontend**: `AGENT_PERFORMANCE: '/api/dashboard/agent-performance'` (singular)
- **Backend**: `router.get('/agents-performance', ...)` = `/api/dashboard/agents-performance` (plural)
- **Resultado**: Tabela de performance dos agentes nao vai carregar
- **Correcao**: Alterar para `'/api/dashboard/agents-performance'`

### Items ja corrigidos (verificados OK)
- `SUPER_ADMIN_KPIS: '/api/admin/kpis'` -- alinhado com backend
- `SERVER_RESOURCES`, `CONSUMPTION_HISTORY`, `WEEKLY_CONSUMPTION` -- todos `/api/admin/...` -- OK
- `ACCOUNTS` endpoints -- alinhados
- `USERS` endpoints -- alinhados
- `CHATWOOT test-connection` -- POST `/api/chatwoot/test-connection` -- alinhado
- SuperAdmin pages usando `accountsCloudOrBackend` / `usersCloudOrBackend` -- OK
- Services backend com mapeamento camelCase para snake_case -- OK

## Plano de correcao

### 1. Corrigir endpoints no `src/api/endpoints.ts`
Duas linhas a alterar:
```
ADMIN_KPIS: '/api/dashboard/kpis'        (era '/api/dashboard/admin/kpis')
AGENT_PERFORMANCE: '/api/dashboard/agents-performance'  (era '/api/dashboard/agent-performance')
```

### 2. Nenhuma outra mudanca necessaria
Todas as demais rotas estao alinhadas. Os servicos de contas, usuarios e Chatwoot ja usam os proxies corretos.

## Detalhes tecnicos

### Mapa de rotas verificadas (frontend -> backend)

```text
CONTAS
  /api/accounts              GET/POST     OK
  /api/accounts/:id          GET/PUT/DEL  OK

USUARIOS
  /api/users                 GET/POST     OK
  /api/users/:id             GET/PUT/DEL  OK

AUTH
  /api/auth/login            POST         OK
  /api/auth/logout           POST         OK
  /api/auth/me               GET          OK

DASHBOARD
  /api/admin/kpis            GET          OK (super admin)
  /api/dashboard/kpis        GET          CORRIGIR (admin)
  /api/dashboard/agents-performance  GET  CORRIGIR
  /api/dashboard/hourly-peak GET          OK

CHATWOOT
  /api/chatwoot/test-connection  POST     OK
  /api/chatwoot/agents/fetch     POST     OK

SERVIDOR
  /api/admin/server-resources       GET   OK
  /api/admin/consumption-history    GET   OK
  /api/admin/weekly-consumption     GET   OK
```

### Impacto
- **Sem correcao**: O dashboard de contas admin vai falhar ao carregar KPIs e tabela de agentes no modo backend
- **Com correcao**: Todas as rotas do sistema ficam alinhadas entre frontend e backend
