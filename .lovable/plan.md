

## Correcao: Filtro de leads por `created_at` apenas

O ultimo diff reverteu a correcao, trazendo de volta o filtro por `last_activity_at` que infla os KPIs. Vamos aplicar a correcao nos 3 arquivos.

### Alteracoes

#### 1. Backend Express - `backend/src/services/chatwoot-metrics.service.ts` (linhas 463-476)

Remover o bloco `last_activity_at` e filtrar apenas por `created_at`:

```typescript
const historyConversations = allConversations.filter((conv: any) => {
  const rawCreatedAt = conv.created_at;
  const createdAtMs = typeof rawCreatedAt === 'number' ? rawCreatedAt * 1000 : new Date(rawCreatedAt).getTime();
  const createdAt = new Date(createdAtMs);
  return createdAt >= dateFromParsed && createdAt <= dateToParsed;
});
```

#### 2. Edge Function - `supabase/functions/fetch-chatwoot-metrics/index.ts` (linhas 295-310)

Mesma correcao: remover `last_activity_at`, usar apenas `created_at`:

```typescript
const historyConversations = allConversations.filter((conv: any) => {
  const rawCreatedAt = conv.created_at;
  const createdAtMs = typeof rawCreatedAt === 'number' ? rawCreatedAt * 1000 : new Date(rawCreatedAt).getTime();
  const createdAt = new Date(createdAtMs);
  return createdAt >= dateFromParsed && createdAt <= dateToParsed;
});
```

#### 3. Documentacao - `docs/METRICAS_DASHBOARD.md` (linhas 257-263)

Atualizar criterio para refletir a nova regra:

```
Uma conversa e incluida no periodo se:
- `created_at` esta dentro do intervalo

Acoes administrativas (etiquetas, atribuicoes, mudancas de status) NAO inflam a contagem de leads, pois alteram apenas `last_activity_at` e nao `created_at`.
```

### Resultado esperado

Para a conta de teste com 0 conversas criadas nos ultimos 7 dias:
- Total de Leads: 0
- Novos Leads: 0
- Retornos: 0

Apos o redeploy do backend em producao (`360.gleps.com.br`), os KPIs refletirao apenas conversas iniciadas por clientes no periodo.
