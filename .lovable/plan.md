
# Plano: Google Calendar - Integração Por Usuário

## ✅ CONCLUÍDO - 29/01/2026

### Problema Original
- Sistema vinculava tokens do Google Calendar por `account_id` (empresa)
- Ao trocar a conta Google conectada, eventos antigos permaneciam
- Sincronização não executava corretamente após reconexão

### Solução Implementada

#### 1. Migração de Banco de Dados
- Adicionada coluna `user_id` na tabela `google_calendar_tokens`
- Alterada constraint única de `account_id` para `user_id`
- Criadas políticas RLS baseadas em `user_id`
- Adicionado índice em `calendar_events.created_by` para filtragem

#### 2. Edge Functions Atualizadas

| Função | Alteração |
|--------|-----------|
| `google-calendar-status` | Busca token por `user_id` |
| `google-calendar-auth-url` | Passa `origin` no state para redirect correto |
| `google-calendar-callback` | Salva token com `user_id`, limpa eventos por `created_by` |
| `google-calendar-sync` | Sincroniza eventos usando `created_by = user_id` |
| `google-calendar-disconnect` | Deleta token e eventos por `user_id` |

#### 3. Frontend Atualizado
- `CalendarProvider` agora recebe `userId` além de `accountId`
- `loadEvents()` carrega:
  - Eventos CRM: filtrados por `account_id`
  - Eventos Google: filtrados por `created_by` (user_id)
- `disconnectGoogle()` limpa eventos Google do estado local imediatamente

### Arquitetura Final

```
┌─────────────────┐     ┌─────────────────┐
│  Usuário A      │     │  Usuário B      │
│ (mesmo account) │     │ (mesmo account) │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│ Google Calendar │     │ Google Calendar │
│ arthurh856@...  │     │ glepsai@...     │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│          calendar_events                 │
│  created_by = user_id (per user)        │
│  account_id = shared (CRM events)       │
└─────────────────────────────────────────┘
```

### Comportamento Esperado
1. Cada usuário conecta seu próprio Google Calendar
2. Eventos do Google são exibidos apenas para o usuário que conectou
3. Eventos CRM continuam compartilhados entre usuários da mesma conta
4. Ao desconectar, apenas os eventos Google do usuário são removidos
5. Ao reconectar, eventos antigos são limpos antes de sincronizar novos
