

## Reverter filtro do Dashboard para o comportamento original

### O que aconteceu

A alteração anterior removeu incorretamente o filtro `last_activity_at` do backend Express (`chatwoot-metrics.service.ts`). Isso quebrou os KPIs do dashboard, que devem mostrar conversas criadas OU com atividade no periodo selecionado.

A Edge Function (`fetch-chatwoot-metrics/index.ts`) nao foi alterada e ja esta correta com ambos os filtros.

O unico fix necessario era o `status=all` no sync do Kanban, que ja esta aplicado.

### Alteracoes

#### 1. Reverter filtro no backend Express

**Arquivo:** `backend/src/services/chatwoot-metrics.service.ts` (linhas 463-472)

Restaurar o filtro original que usa `created_at OR last_activity_at`:

```typescript
// Restaurar para o comportamento original:
const historyConversations = allConversations.filter((conv: any) => {
  const rawCreatedAt = conv.created_at;
  const createdAtMs = typeof rawCreatedAt === 'number' ? rawCreatedAt * 1000 : new Date(rawCreatedAt).getTime();
  const createdAt = new Date(createdAtMs);

  const rawActivityAt = conv.last_activity_at;
  const activityAtMs = rawActivityAt
    ? (typeof rawActivityAt === 'number' ? rawActivityAt * 1000 : new Date(rawActivityAt).getTime())
    : createdAtMs;
  const activityDate = new Date(activityAtMs);

  return (createdAt >= dateFromParsed && createdAt <= dateToParsed) ||
         (activityDate >= dateFromParsed && activityDate <= dateToParsed);
});
```

#### 2. Reverter documentacao

**Arquivo:** `docs/METRICAS_DASHBOARD.md` (linhas 257-262)

Restaurar o criterio original:

```
Uma conversa e incluida no periodo se:
- created_at esta dentro do intervalo OU
- last_activity_at esta dentro do intervalo

Isso garante que conversas criadas antes do periodo mas com atividade recente tambem sejam contabilizadas.
```

#### 3. Manter fix do Kanban (ja aplicado)

O `status=all` em `chatwoot.service.ts` linha 740 permanece — este era o unico fix necessario.

### Resumo

| Arquivo | Acao |
|---------|------|
| `backend/src/services/chatwoot-metrics.service.ts` | REVERTER para `created_at OR last_activity_at` |
| `docs/METRICAS_DASHBOARD.md` | REVERTER para criterio original |
| `backend/src/services/chatwoot.service.ts` | MANTER `status=all` (ja aplicado) |
| `supabase/functions/fetch-chatwoot-metrics/index.ts` | Nenhuma alteracao (ja esta correto) |

### Resultado

- Dashboard volta a funcionar como antes, exibindo conversas com atividade no periodo
- Kanban sync busca todas as conversas independente de status
- Paridade entre backend Express e Edge Function restaurada
