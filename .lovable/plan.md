
## Migracao Completa: Supabase Cloud para VPS com PostgreSQL Proprio

## Status: Fases 1, 2, 3 e 5 ✅ Completas

### ✅ Fase 1 — Flag de Ambiente
- `src/config/backend.config.ts` — `VITE_USE_BACKEND=true` ativa modo Express
- `src/config/api.config.ts` — mocks desabilitados quando backend ativo

### ✅ Fase 2 — Auth Backend
- `src/contexts/AuthContext.backend.tsx` — JWT auth via Express
- `src/App.tsx` — seleciona provider correto baseado na flag

### ✅ Fase 3 — Backend Services
- `accounts.backend.service.ts`, `users.backend.service.ts`, `contacts.backend.service.ts`, `tags.backend.service.ts`
- `src/services/index.ts` — factory cloud vs backend

### ✅ Fase 5 — Deploy Config
- `Dockerfile.frontend` — aceita VITE_API_URL e VITE_USE_BACKEND como build args
- `docker-compose.yml` — passa VITE_USE_BACKEND=true
- `.env.production` — template completo

### 🔲 Fase 4 — Pendente
- Migrar contextos (FinanceContext, CalendarContext, TagContext) para usar apiClient quando useBackend=true
- Chatwoot proxy endpoints no backend Express
- Google Calendar OAuth flow no backend Express
- Resolution log endpoint
