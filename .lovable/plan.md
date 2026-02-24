## Migração Supabase → VPS Docker — STATUS: 100% COMPLETO ✅

Todas as dependências do Supabase foram removidas para o modo `VITE_USE_BACKEND=true`.

### Correções Finais Aplicadas

| # | Arquivo | Status |
|---|---------|--------|
| 1 | `AdminKanbanPage.tsx` | ✅ Substituído `tagsCloudService` → `tagsService` (dinâmico), `supabase.from('lead_tags')` → `apiClient` |
| 2 | `AdminLeadsPage.tsx` | ✅ Substituído `supabase.from('funnels/tags')` → `tagsBackendService`, `contactsCloudService` → condicional |
| 3 | `CalendarContext.tsx` | ✅ Já tinha branches corretas |
| 4 | `FinanceContext.tsx` | ✅ Import morto removido |
| 5 | `accounts.backend.service.ts` | ✅ `testChatwootConnection` agora usa `/api/chatwoot/test-connection` |
| 6 | `SuperAdminDashboard.tsx` | ✅ Branch `useBackend` para KPIs |
| 7 | `useChatwootMetrics.ts` | ✅ Branch `useBackend` para métricas |
| 8 | `AdminInsightsPage.tsx` | ✅ Branch `useBackend` para profiles |

### Deploy VPS

```bash
git clone <repo> && cd <repo>
cp .env.production .env
docker compose up -d --build
```

O sistema sobe com PostgreSQL próprio, backend Express e frontend Nginx — sem nenhuma dependência do Supabase.
