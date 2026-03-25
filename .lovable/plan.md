

## Bateria de Correções — Sistema Redondo e Funcional

### Problemas Identificados

**1. Dashboard Super Admin: Server Metrics causando erro 500 a cada 60s**
O `SuperAdminDashboard` chama `apiClient.get()` para endpoints de métricas do servidor (`/api/admin/server-resources`, `/api/admin/consumption-history`, `/api/admin/weekly-consumption`). Esses endpoints **só existem no backend Express** (VPS). No modo Cloud (Lovable), não há backend Express servindo esses endpoints — o Nginx retorna 500. Isso gera spam de erros no console a cada minuto.

**Solução:** Condicionar os fetches de server metrics com `useBackend`. Se `useBackend === false`, não buscar métricas de servidor e esconder os cards de recursos do servidor (CPU, RAM, Disco). Os KPIs já estão corretos (usam Edge Function).

**2. Dashboard KPIs: branch condicional já funciona**
O fetch de KPIs já verifica `useBackend` e usa a Edge Function `super-admin-kpis` no modo Cloud. Os logs da Edge Function mostram boot sem erros. Isso está OK.

**3. Criar Conta + Chatwoot: funciona mas precisa de ajuste de UX**
A criação de conta usa `accountsCloudService.create()` que faz insert direto no Supabase. O teste de conexão Chatwoot usa a Edge Function `test-chatwoot-connection`. Ambos estão corretos no código. Possível problema: a Edge Function `create-user` tem CORS headers incompletos (falta headers extras do Supabase client).

**4. Edge Function `create-user`: CORS headers incompletos**
O `corsHeaders` na Edge Function `create-user` usa:
```
"authorization, x-client-info, apikey, content-type"
```
Mas deveria incluir os headers extras do Supabase SDK:
```
"authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version"
```
Mesma coisa para `set-user-password` e `delete-user`.

### Alterações Planejadas

**Arquivo 1: `src/pages/super-admin/SuperAdminDashboard.tsx`**
- Importar `useBackend` (já importado como valor, não hook — renomear se necessário)
- Condicionar `fetchServerMetrics` para só executar se `useBackend === true`
- Esconder os cards de Server Resources e charts quando `useBackend === false`
- Remover o polling de 60s quando no modo Cloud

**Arquivo 2: `supabase/functions/create-user/index.ts`**
- Atualizar `corsHeaders` com headers completos do Supabase SDK

**Arquivo 3: `supabase/functions/set-user-password/index.ts`**
- Atualizar `corsHeaders` com headers completos

**Arquivo 4: `supabase/functions/delete-user/index.ts`**
- Atualizar `corsHeaders` com headers completos

**Arquivo 5: `supabase/functions/delete-lead/index.ts`**
- Verificar e atualizar `corsHeaders` se necessário

### Resultado Esperado
- Zero erros 500 no console do Super Admin Dashboard
- KPIs carregam via Edge Function normalmente
- Criar conta funciona sem problemas de CORS
- Teste de conexão Chatwoot continua funcionando (já está OK)
- Criar usuários via wizard funciona sem falhas de CORS

### Detalhes Técnicos

No `SuperAdminDashboard.tsx`, a mudança principal:
```typescript
// Só buscar métricas de servidor no modo backend
useEffect(() => {
  if (!useBackend) {
    setMetricsLoading(false);
    return;
  }
  fetchServerMetrics();
  const interval = setInterval(fetchServerMetrics, 60000);
  return () => clearInterval(interval);
}, [fetchServerMetrics]);
```

E no JSX, esconder a seção de Server Resources:
```typescript
{useBackend && (
  <>
    {/* Server resource cards e charts */}
  </>
)}
```

Para os CORS das Edge Functions, o padrão correto:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

