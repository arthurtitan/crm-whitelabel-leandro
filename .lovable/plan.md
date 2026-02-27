

# Correcao: Metricas de Resolucao zeradas no Backend Express

## Problema Identificado

Comparando a resposta da Edge Function (dados corretos) com o que o dashboard exibe (via backend Express):

| Metrica | Edge Function (correto) | Backend/Dashboard (errado) |
|---|---|---|
| Resolucao IA | 9 (60%) | 0 (0%) |
| Resolucao Humano | 6 (40%) | 3 (100%) |
| Transbordo | 6 (40%) | 3 (100%) |
| Eficiencia IA | 60% | 0% |

A causa raiz: as migrations 0002 e 0003 foram marcadas como `rolled-back`, entao a tabela `resolution_logs` **nao existe** no banco PostgreSQL do VPS. O backend detecta isso corretamente (linhas 416-420) e pula a query, mas o fallback simplesmente retorna zeros em vez de calcular as resolucoes a partir dos dados brutos das conversas do Chatwoot.

A Edge Function nao tem esse problema porque ela calcula tudo a partir dos dados da API do Chatwoot diretamente.

## Solucao

**Arquivo:** `backend/src/services/chatwoot-metrics.service.ts`

Adicionar um fallback que computa `historicoResolucoes` diretamente das conversas resolvidas usando `classifyResolver()` (funcao que ja existe no arquivo mas nunca e usada como fallback).

### Mudanca especifica:

Apos o bloco de query da `resolution_logs` (linha ~522), adicionar logica de fallback:

```typescript
// Se resolution_logs nao disponivel OU retornou vazio, 
// calcular a partir dos dados brutos do Chatwoot
if (historicoResolucoes.totalIA === 0 && historicoResolucoes.totalHumano === 0) {
  const resolvedConversations = finalConversations.filter(
    (c: any) => c.status === 'resolved'
  );
  
  let fallbackIA = 0;
  let fallbackHumano = 0;
  let fallbackTransbordo = 0;
  
  for (const conv of resolvedConversations) {
    const result = classifyResolver(conv);
    if (result.type === 'ai') fallbackIA++;
    else if (result.type === 'human') {
      fallbackHumano++;
      // Transbordo: humano resolveu mas IA participou
      const custom = conv.custom_attributes || {};
      const additional = conv.additional_attributes || {};
      const aiResponded = custom.ai_responded === true || additional.ai_responded === true;
      if (aiResponded) fallbackTransbordo++;
    }
  }
  
  const fallbackTotal = fallbackIA + fallbackHumano;
  historicoResolucoes = {
    totalIA: fallbackIA,
    totalHumano: fallbackHumano,
    transbordoCount: fallbackTransbordo,
    percentualIA: fallbackTotal > 0 ? Math.round((fallbackIA / fallbackTotal) * 100) : 0,
    percentualHumano: fallbackTotal > 0 ? Math.round((fallbackHumano / fallbackTotal) * 100) : 0,
  };
  
  logger.info('[Metrics] Used Chatwoot API fallback for resolution data', {
    ia: fallbackIA, humano: fallbackHumano, transbordo: fallbackTransbordo
  });
}
```

### Por que isso resolve:

1. A funcao `classifyResolver()` ja implementa toda a logica de classificacao (explicit via `resolved_by`, bot nativo, inferencia via `ai_responded`, fallback por assignee) — identica a Edge Function.
2. Quando `resolution_logs` nao existe ou esta vazio, o sistema calcula automaticamente a partir dos dados do Chatwoot.
3. Quando `resolution_logs` voltar a funcionar (apos re-aplicar migrations), os dados persistidos terao prioridade.

### Resultado esperado apos correcao:

- Resolucao IA: 9 (60%) — igual a Edge Function
- Resolucao Humano: 6 (40%) — igual a Edge Function  
- Transbordo: 6 (40%) — igual a Edge Function
- Eficiencia IA: 60% — igual a Edge Function

## Arquivos afetados

- `backend/src/services/chatwoot-metrics.service.ts` — unico arquivo, adicao de ~25 linhas de fallback

## Observacoes

- As demais metricas (Total de Leads, Atendimento ao Vivo, Backlog, Performance de Agentes, Qualidade) ja estao corretas e alinhadas entre Edge Function e Backend.
- A correcao e retrocompativel: quando as migrations forem re-aplicadas e `resolution_logs` tiver dados, eles terao prioridade sobre o fallback.
