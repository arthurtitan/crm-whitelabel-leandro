
## Corrigir Gráfico de Pico de Atendimento para respeitar filtro de datas

### Problema identificado

O gráfico "Pico de Atendimento por Hora" mostra dados mesmo quando não houve atendimentos no período selecionado. Isso acontece por dois motivos:

1. **Conversas fantasma**: O filtro de data inclui conversas que tiveram "qualquer atividade" no período (`activeInRange`), mesmo que tenham sido criadas semanas atrás. O gráfico horário usa `created_at` dessas conversas, plotando horários que não pertencem ao período selecionado.

2. **Falta de filtro por data da atividade**: O `hourlyCount` deveria considerar apenas a atividade que ocorreu dentro do período, não a data de criação original da conversa.

### Solução

**Arquivo:** `supabase/functions/fetch-chatwoot-metrics/index.ts` (linhas 463-466)

Alterar a lógica do `hourlyCount` para contabilizar apenas conversas cuja **data de criação** esteja dentro do período selecionado, ignorando conversas que entraram no filtro apenas por atividade recente:

```text
ANTES:
  // Hourly distribution
  const createdAt = new Date(conv.created_at);
  const hour = createdAt.getHours();
  hourlyCount[hour]++;

DEPOIS:
  // Hourly distribution - only count conversations CREATED within the date range
  const createdAt = new Date(conv.created_at);
  const createdInDateRange = createdAt >= dateFromParsed && createdAt <= dateToParsed;
  if (createdInDateRange) {
    const hour = createdAt.getHours();
    hourlyCount[hour]++;
  }
```

### Por que essa abordagem

- O gráfico mostra "em que horários os atendimentos começam", logo faz sentido usar `created_at`
- Mas deve contar apenas conversas realmente **criadas** no período filtrado
- Conversas antigas que tiveram atividade no período continuam sendo contabilizadas em outras métricas (resolução, KPIs), mas não distorcem o gráfico horário
- Se nos últimos 7 dias não houve nenhuma conversa nova, o gráfico ficará zerado (comportamento correto)

### Impacto

- Nenhum componente de UI precisa mudar
- Apenas a lógica de agregação na Edge Function será ajustada
- A Edge Function será reimplantada automaticamente
