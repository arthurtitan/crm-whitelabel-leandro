

# Paridade de Fallback: Edge Function + Atualizacao do Plan.md

## Problema Remanescente

O backend Express ja possui um fallback que calcula resolucoes a partir dos dados brutos do Chatwoot quando `resolution_logs` esta vazio (linhas 547-581). Porem, a Edge Function **nao tem esse fallback**. Se a query ao `resolution_logs` retornar zero resultados para o periodo (ex: dados ainda nao sincronizados, novo periodo sem logs), as metricas de resolucao ficam zeradas.

## Mudanca 1: Adicionar fallback na Edge Function

**Arquivo:** `supabase/functions/fetch-chatwoot-metrics/index.ts`

Apos o bloco de consulta ao `resolution_logs` (linha 796) e antes do bloco que popula `resolucao` (linha 798), adicionar o mesmo fallback que o backend ja possui:

```typescript
// FALLBACK: Se resolution_logs vazio, calcular via dados brutos do Chatwoot
if (historicoResolucoes.totalIA === 0 && historicoResolucoes.totalHumano === 0) {
  const resolvedConversations = finalConversations.filter(
    (c: any) => c.status === 'resolved'
  );
  
  let fallbackIA = 0;
  let fallbackHumano = 0;
  let fallbackTransbordo = 0;
  
  for (const conv of resolvedConversations) {
    const result = classifyResolver(conv);
    if (result.type === 'ai') {
      fallbackIA++;
    } else if (result.type === 'human') {
      fallbackHumano++;
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
  
  console.log('[Metrics] Used Chatwoot API fallback for resolution data', {
    ia: fallbackIA, humano: fallbackHumano, transbordo: fallbackTransbordo
  });
}
```

Isso garante paridade total entre Edge Function e Backend Express.

## Mudanca 2: Atualizar `.lovable/plan.md`

O plan.md atualmente descreve o bug de `classifyCurrentHandler` como "Problema Atual", mas ele ja foi corrigido. Atualizar o documento para refletir o estado real do sistema — servindo como documentacao de referencia das regras de metrificacao.

O conteudo atualizado deve documentar:

1. **Regras de Metrificacao** (contrato n8n/Chatwoot) — os 8 atributos customizados
2. **classifyCurrentHandler()** — logica de 6 prioridades (ja implementada)
3. **classifyResolver()** — logica de 4 prioridades para resolucao historica
4. **Fallback de Resolucao** — calculo via dados brutos quando resolution_logs vazio
5. **Arquitetura de Duas Camadas** — Atendimento ao Vivo (sem filtro de data) vs Resolucao (filtrado por data)
6. **Metricas exibidas no Dashboard** — lista completa de KPIs e cards

## Arquivos Afetados

| Arquivo | Tipo de Mudanca |
|---|---|
| `supabase/functions/fetch-chatwoot-metrics/index.ts` | Adicionar ~25 linhas de fallback apos linha 796 |
| `.lovable/plan.md` | Reescrever como documentacao de referencia atualizada |

## Resultado Esperado

- Edge Function e Backend Express com logica 100% identica para todos os cenarios
- Nenhuma metrica zerada por falta de dados em `resolution_logs`
- Documentacao atualizada refletindo o estado real do sistema
- Deploy automatico da Edge Function ao salvar
- Backend requer rebuild manual no VPS (ja descrito em iteracoes anteriores)

