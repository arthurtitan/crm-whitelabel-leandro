
# Correcao Completa: Sistema 100% Funcional no VPS/Docker

## Diagnostico

O sistema funciona no Lovable local porque usa Supabase Cloud direto. No VPS com `VITE_USE_BACKEND=true`, todas as operacoes passam pelo Express, e existem 4 problemas criticos de incompatibilidade entre o backend e o frontend.

## Problemas Identificados

### Problema 1: Auth Service nao retorna campos criticos (CRITICO)
O backend `auth.service.ts` retorna o user sem `accountId` e `chatwootAgentId` no login e no `/auth/me`. O frontend (`BackendAuthProvider`) espera esses campos para:
- Rotear admin vs super_admin
- Configurar o hook `useChatwootMetrics` (que checa `account.chatwoot_base_url`)

**Arquivo**: `backend/src/services/auth.service.ts`
**Correcao**: Adicionar `accountId` e `chatwootAgentId` ao objeto `user` retornado no login e no getMe. Adicionar campos Chatwoot ao objeto `account` retornado no getMe.

### Problema 2: KPI field name mismatch (CRITICO)
O backend `dashboardService.getSuperAdminKPIs()` retorna `totalSales`, mas o frontend `SuperAdminDashboard.tsx` espera `totalPaidSales`.

**Arquivo**: `backend/src/services/dashboard.service.ts`
**Correcao**: Renomear `totalSales` para `totalPaidSales` no retorno do `getSuperAdminKPIs()`.

### Problema 3: Nginx proxy nao repassa timeout longo (MENOR)
Operacoes demoradas como teste de conexao Chatwoot podem exceder o timeout padrao do Nginx.

**Arquivo**: `nginx.conf`
**Correcao**: Adicionar `proxy_read_timeout 120s` e `proxy_connect_timeout 10s` no bloco `/api`.

### Problema 4: Account service nao envia `chatwoot_base_url` no retorno de getMe
Quando o admin loga, o `getMe` retorna a conta sem os campos Chatwoot. O dashboard admin usa `account.chatwoot_base_url` para decidir se mostra metricas.

Ja coberto pelo Problema 1.

## Plano de Implementacao

### 1. Corrigir auth.service.ts (backend)
No metodo `login()`, adicionar ao objeto user:
```text
accountId: user.accountId
chatwootAgentId: user.chatwootAgentId
```

No metodo `getMe()`, adicionar ao objeto user:
```text
accountId: user.accountId
chatwootAgentId: user.chatwootAgentId
```

E ao objeto account:
```text
chatwootBaseUrl: user.account.chatwootBaseUrl
chatwootAccountId: user.account.chatwootAccountId
chatwootApiKey: user.account.chatwootApiKey
```

### 2. Corrigir dashboard.service.ts (backend)
No metodo `getSuperAdminKPIs()`, renomear no retorno:
```text
totalSales  ->  totalPaidSales
```

### 3. Melhorar nginx.conf
Adicionar timeouts e buffer no proxy:
```text
proxy_read_timeout 120s;
proxy_connect_timeout 10s;
proxy_send_timeout 120s;
```

### 4. Corrigir BackendAuthProvider hydration
O `BackendAuthProvider` ja faz `response.user.account_id || response.user.accountId` - com o backend retornando `accountId` (camelCase), o segundo fallback vai funcionar. Nenhuma mudanca necessaria no frontend auth context.

## Impacto pos-correcao

Apos rebuild do Docker:
1. Login com `admin@gleps.com.br` vai popular corretamente `user.account_id` e `account.chatwoot_*`
2. SuperAdmin KPIs vao mostrar "Vendas Pagas" corretamente
3. Admin Dashboard vai detectar config Chatwoot e carregar metricas
4. Criacao de conta via Super Admin vai passar pelo Express (sem tocar RLS do Supabase Cloud)

## Checklist de deploy
1. Aplicar correcoes nos 3 arquivos
2. Rebuild containers: `docker compose build --no-cache`
3. Restart: `docker compose up -d`
4. Testar: login -> dashboard -> criar conta -> importar agentes
