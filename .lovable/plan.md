

## O que falta para subir na VPS com Docker

### Status Atual: 85% pronto

A infraestrutura de deploy (Docker, nginx, Prisma, seed, Dockerfile) esta **pronta**. O que falta sao ajustes no frontend para que todas as paginas funcionem sem Supabase quando `VITE_USE_BACKEND=true`.

---

### Pendencias Identificadas (7 itens)

#### 1. SuperAdminDashboard -- KPIs ainda chamam Edge Function

O arquivo `src/pages/super-admin/SuperAdminDashboard.tsx` (linha 96) faz:
```
supabase.functions.invoke('super-admin-kpis')
```

Precisa de um `if (useBackend)` que chame `apiClient.get('/api/dashboard/kpis')` no lugar. O endpoint ja existe no backend Express.

#### 2. useChatwootMetrics -- Chama Edge Function diretamente

O hook `src/hooks/useChatwootMetrics.ts` usa `supabase.auth.getSession()` e faz fetch direto para a URL da Edge Function `fetch-chatwoot-metrics`. Precisa de versao backend que chame `apiClient.get('/api/chatwoot/metrics')` -- o endpoint ja existe no backend.

#### 3. AdminInsightsPage -- Import direto do supabase

O arquivo `src/pages/admin/AdminInsightsPage.tsx` (linha 24) importa `supabase` diretamente. Mesmo que os dados venham dos contextos (Finance, Calendar), o import esta la e pode ser usado em algum trecho. Precisa ser revisado e, se usado, substituido por chamadas via servico.

#### 4. contacts.cloud.service -- Edge Functions restantes

O `contacts.cloud.service.ts` chama 2 Edge Functions:
- `create-chatwoot-contact` (linha 109)
- `delete-lead` (linha 226)

O `contacts.backend.service.ts` ja existe mas precisa ter equivalentes para essas operacoes chamando o backend Express (que ja tem os endpoints em `/api/chatwoot/` e `/api/contacts/:id`).

#### 5. tags.cloud.service -- Edge Functions e queries Supabase

O `tags.cloud.service.ts` ainda faz:
- `supabase.from('tags').update(...)` (linhas 332-333)
- `supabase.functions.invoke('update-chatwoot-contact-labels')` (linha 438)
- `supabase.auth.getSession()` em multiplos locais

O `tags.backend.service.ts` ja existe mas precisa cobrir todos esses casos (reordenar tags, sync labels Chatwoot).

#### 6. users.cloud.service -- Edge Functions

O `users.cloud.service.ts` faz:
- `supabase.from('profiles').select(...)` (linha 32)
- `supabase.functions.invoke` para criar/deletar usuarios via Edge Functions
- `supabase.auth.getSession()` para obter token

O `users.backend.service.ts` ja existe -- precisa verificar se cobre create/delete com as mesmas funcionalidades.

#### 7. CalendarContext -- Edge Functions do Google OAuth

O `CalendarContext.tsx` ainda chama Edge Functions diretamente quando `useBackend` e false:
- `google-calendar-status` (linha 190)
- `google-calendar-sync` (linha 261)
- `google-calendar-auth-url` (linha 287)
- `google-calendar-disconnect` (linha 315)

Ja tem o branch `useBackend` em alguns desses metodos, mas precisa garantir cobertura completa de todos os 4 endpoints.

---

### O que sera feito

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/super-admin/SuperAdminDashboard.tsx` | Adicionar condicional `useBackend` para KPIs via apiClient |
| `src/hooks/useChatwootMetrics.ts` | Adicionar branch backend que chama `/api/chatwoot/metrics` via apiClient |
| `src/pages/admin/AdminInsightsPage.tsx` | Remover import `supabase` desnecessario ou substituir por chamada backend |
| `src/services/contacts.backend.service.ts` | Adicionar metodos `createChatwootContact` e `deleteLead` |
| `src/services/tags.backend.service.ts` | Adicionar `reorderTags` e `syncChatwootLabels` |
| `src/services/users.backend.service.ts` | Verificar/completar `create` e `delete` com confirmacao de senha |
| `src/contexts/CalendarContext.tsx` | Garantir que todos os 4 metodos Google OAuth usem backend service quando flag ativa |

### O que ja esta pronto (nao precisa mexer)

- Docker Compose, Dockerfiles, nginx.conf
- Backend Express completo (auth, CRUD, chatwoot, calendar, dashboard, insights)
- Prisma schema + seed com dados de teste
- AuthContext.backend.tsx com JWT
- Flag `VITE_USE_BACKEND` + config
- Services backend de accounts, users, contacts, tags, finance, calendar
- `.env.production` template
- `DEPLOY.md` com guia passo-a-passo

### Resultado

Apos essas 7 correcoes, basta:
1. Clonar o repo na VPS
2. Copiar `.env.production` para `.env`
3. Rodar `docker compose up -d --build`
4. O sistema sobe com PostgreSQL proprio, backend Express e frontend Nginx -- sem nenhuma dependencia do Supabase
