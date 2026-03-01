

# Correcao: Metricas de Leads zeradas e Taxa de Transbordo 100%

## Problemas identificados

Existem **3 bugs** na Edge Function `fetch-chatwoot-metrics` (o caminho ativo em producao, pois `VITE_USE_BACKEND` nao esta habilitado):

### Bug 1: `ai_participated` hardcodado como `true` (linha 682)

No bloco de sincronizacao com `resolution_logs`, toda resolucao humana e inserida no banco com `ai_participated: true`:

```text
const aiResponded = true; // "IA sempre inicia o atendimento"
```

Isso corrompe os dados persistidos: quando o sistema depois consulta `resolution_logs` e filtra por `ai_participated === true`, **todas** as resolucoes humanas sao contadas como transbordo, resultando em taxa de 100%.

**Correcao:** Verificar os metadados reais da conversa (`ai_responded`, `ai_participated`, `handoff_to_human`) nos `custom_attributes` e `additional_attributes`.

### Bug 2: Fallback sem verificacao de IA (linhas 843-851)

Quando `resolution_logs` esta vazio, o fallback conta toda resolucao humana como transbordo:

```text
} else if (result.type === 'human') {
  fallbackHumano++;
  fallbackTransbordo++;  // BUG
}
```

**Correcao:** Mesma logica ja aplicada no backend Express -- verificar `ai_responded`/`ai_participated` antes de incrementar `fallbackTransbordo`.

### Bug 3: Leads zerados - dados corrompidos no `resolution_logs` afetam `novosLeads`

O calculo de `novosLeads` (linha 757) consulta os contatos no banco e filtra por `first_resolved_at`. Porem, como o Bug 1 insere registros com `ai_participated: true` incorretamente, o campo `first_resolved_at` e marcado prematuramente em contatos que nem existem como leads reais no periodo. Alem disso, se nenhum contato do Chatwoot esta sincronizado na tabela `contacts`, a query retorna 0 registros e `novosLeads = 0`.

O fallback via `allConversations` (linhas 768-799) so e acionado se `novosLeads === 0`, mas depende de `finalConversations` ter contatos -- que por sua vez depende de conversas retornadas pela API no periodo selecionado.

**Diagnostico necessario:** Adicionar logs de debug para expor:
- Quantas conversas brutas a API retornou
- Quantas passaram no filtro de data
- Quantos `sender.id` unicos existem
- Quantos contatos foram encontrados na tabela `contacts`

## Arquivo alterado

**`supabase/functions/fetch-chatwoot-metrics/index.ts`**

### Alteracao 1: Linha 682 - Corrigir `aiResponded` hardcodado

Substituir:
```typescript
const aiResponded = true;
```
Por:
```typescript
const aiResponded =
  custom.ai_responded === true ||
  additional.ai_responded === true ||
  custom.ai_participated === true ||
  additional.ai_participated === true ||
  custom.handoff_to_human === true ||
  additional.handoff_to_human === true;
```

### Alteracao 2: Linhas 843-851 - Corrigir fallback de transbordo

Substituir:
```typescript
} else if (result.type === 'human') {
  fallbackHumano++;
  fallbackTransbordo++;
}
```
Por:
```typescript
} else if (result.type === 'human') {
  fallbackHumano++;
  const custom = conv.custom_attributes || {};
  const additional = conv.additional_attributes || {};
  const aiParticipated =
    custom.ai_responded === true ||
    additional.ai_responded === true ||
    custom.ai_participated === true ||
    additional.ai_participated === true;
  if (aiParticipated) {
    fallbackTransbordo++;
  }
}
```

### Alteracao 3: Adicionar logs de debug detalhados para leads

Apos o bloco de contagem de leads (proximo a linha 800), adicionar logs que exponham:
- `contactIdsInPeriod.length` (quantos sender.id unicos existem)
- `finalConversations.length` (quantas conversas passaram no filtro de data)
- Resultado da query ao banco de contatos
- Qual caminho foi usado (DB vs fallback)

Isso permitira diagnosticar se o problema de "0 leads" e causado por:
1. API do Chatwoot nao retornando conversas no periodo
2. Contatos nao sincronizados na tabela `contacts`
3. Filtro de data descartando conversas existentes

## Impacto

- 1 arquivo alterado: `supabase/functions/fetch-chatwoot-metrics/index.ts`
- A Edge Function e redeployada automaticamente
- Corrige taxa de transbordo inflada (100% -> valor real)
- Corrige dados corrompidos sendo inseridos no `resolution_logs`
- Adiciona visibilidade sobre o problema de leads zerados via logs
- Zero alteracao no frontend ou backend Express
- Nao quebra nenhuma funcionalidade existente

