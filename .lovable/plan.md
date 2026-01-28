

# Plano de Integração Google Calendar

## Resumo

O sistema atual possui toda a estrutura preparada para integração com Google Calendar, mas utiliza apenas **dados mockados** no frontend. O backend (Prisma/Express) está parcialmente implementado, mas não está conectado ao Lovable Cloud. Vamos criar uma integração **real e funcional** usando **Edge Functions** no Lovable Cloud para gerenciar OAuth e sincronização com Google Calendar.

---

## Arquitetura Atual vs. Proposta

```text
+------------------+     +------------------+     +------------------+
|    FRONTEND      |     |  EDGE FUNCTIONS  |     |  GOOGLE APIS     |
|                  |     |  (Lovable Cloud) |     |                  |
|  CalendarContext | --> | google-calendar- | --> | OAuth 2.0        |
|  (mock data)     |     | connect          |     | Calendar API v3  |
+------------------+     +------------------+     +------------------+
                               |
                               v
                         +------------------+
                         |    SUPABASE      |
                         |  (Lovable Cloud) |
                         |                  |
                         | google_calendar_ |
                         | tokens           |
                         | calendar_events  |
                         +------------------+
```

---

## O que precisa ser feito

### 1. Configuracao de Credenciais Google

**Pre-requisito:** Usuario precisa criar um projeto no Google Cloud Console e obter credenciais OAuth 2.0.

- Adicionar secrets no Lovable Cloud:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI` (URL da Edge Function de callback)

### 2. Criacao de Tabelas no Banco de Dados

Criar tabela para armazenar tokens OAuth do Google por conta:

```sql
CREATE TABLE google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  calendar_id VARCHAR(255),
  connected_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id)
);
```

Adicionar colunas na tabela `calendar_events` para sincronizacao:

```sql
ALTER TABLE calendar_events 
  ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS google_calendar_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'crm';
```

### 3. Edge Functions para Google Calendar

#### 3.1 `google-calendar-auth-url`
- Gera URL de autorizacao OAuth 2.0
- Recebe `account_id` e retorna URL de redirecionamento para Google

#### 3.2 `google-calendar-callback`
- Recebe callback do Google com authorization code
- Troca code por access_token + refresh_token
- Salva tokens na tabela `google_calendar_tokens`
- Redireciona usuario de volta ao frontend

#### 3.3 `google-calendar-status`
- Verifica se conta tem Google Calendar conectado
- Retorna email conectado e status de expiracao

#### 3.4 `google-calendar-disconnect`
- Revoga tokens do Google
- Remove registro da tabela `google_calendar_tokens`

#### 3.5 `google-calendar-sync`
- Busca eventos do Google Calendar (30 dias passados e 90 futuros)
- Sincroniza eventos para tabela `calendar_events`
- Atualiza/cria/remove eventos conforme necessario

#### 3.6 `google-calendar-create-event`
- Cria evento no Google Calendar
- Opcional: gera link Google Meet
- Salva referencia `google_event_id` no banco

### 4. Atualizacao do Frontend

#### 4.1 CalendarContext.tsx
- Substituir funcoes mock por chamadas reais as Edge Functions
- `connectGoogle()` - Chamar `google-calendar-auth-url` e redirecionar
- `disconnectGoogle()` - Chamar `google-calendar-disconnect`
- `syncNow()` - Chamar `google-calendar-sync`
- Carregar eventos reais do banco de dados via Supabase client

#### 4.2 AdminAgendaPage.tsx
- Detectar parametro `?google_connected=true` na URL apos callback
- Mostrar toast de sucesso apos conexao
- Atualizar status de conexao automaticamente

#### 4.3 CalendarView.tsx
- Buscar eventos diretamente do Supabase com RLS
- Diferenciar visualmente eventos do Google vs CRM

### 5. Fluxo Completo de Conexao

```text
1. Usuario clica "Sincronizar"
2. Modal GoogleConnectModal abre
3. Usuario clica "Continuar com Google"
4. Frontend chama Edge Function google-calendar-auth-url
5. Usuario e redirecionado para Google OAuth
6. Usuario autoriza permissoes
7. Google redireciona para google-calendar-callback
8. Edge Function salva tokens no banco
9. Usuario e redirecionado para /admin/agenda?google_connected=true
10. Frontend detecta sucesso e atualiza estado
```

---

## Detalhes Tecnicos

### Edge Functions a Criar

| Funcao | Metodo | Descricao |
|--------|--------|-----------|
| `google-calendar-auth-url` | POST | Gera URL OAuth |
| `google-calendar-callback` | GET | Processa callback Google |
| `google-calendar-status` | GET | Status da conexao |
| `google-calendar-disconnect` | POST | Desconecta conta |
| `google-calendar-sync` | POST | Sincroniza eventos |
| `google-calendar-create-event` | POST | Cria evento no Google |

### RLS Policies

```sql
-- Tokens: apenas a propria conta pode ver/modificar
CREATE POLICY "Users can view own account tokens"
  ON google_calendar_tokens FOR SELECT
  USING (account_id IN (SELECT account_id FROM profiles WHERE id = auth.uid()));

-- Events: usuarios da conta podem ver eventos
CREATE POLICY "Users can view own account events"
  ON calendar_events FOR SELECT
  USING (account_id IN (SELECT account_id FROM profiles WHERE id = auth.uid()));
```

### Secrets Necessarios

- `GOOGLE_CLIENT_ID` - ID do cliente OAuth
- `GOOGLE_CLIENT_SECRET` - Secret do cliente OAuth
- `GOOGLE_REDIRECT_URI` - URL do callback (Edge Function URL)

---

## Beneficios

1. **Sincronizacao bidirecional** - Eventos criados no CRM aparecem no Google e vice-versa
2. **Google Meet automatico** - Gera links de reuniao ao criar eventos
3. **Disponibilidade real** - Verifica conflitos com calendario do usuario
4. **Multi-calendario** - Pode sincronizar diferentes calendarios da conta Google

---

## Arquivos a Modificar/Criar

| Arquivo | Acao |
|---------|------|
| `supabase/functions/google-calendar-auth-url/index.ts` | Criar |
| `supabase/functions/google-calendar-callback/index.ts` | Criar |
| `supabase/functions/google-calendar-status/index.ts` | Criar |
| `supabase/functions/google-calendar-disconnect/index.ts` | Criar |
| `supabase/functions/google-calendar-sync/index.ts` | Criar |
| `supabase/functions/google-calendar-create-event/index.ts` | Criar |
| `src/contexts/CalendarContext.tsx` | Modificar |
| `src/pages/admin/AdminAgendaPage.tsx` | Modificar |
| `src/types/calendar.ts` | Manter (ja esta preparado) |
| Migracao SQL (tabelas + RLS) | Criar |

