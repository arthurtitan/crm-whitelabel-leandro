

# Correcao: Taxa de Transbordo incorreta no fallback de metricas

## Problema identificado

No arquivo `backend/src/services/chatwoot-metrics.service.ts`, linhas 599-606, o **fallback** de calculo de resolucoes (usado quando a tabela `resolution_logs` esta vazia ou sem dados no periodo) contabiliza **toda resolucao humana como transbordo**. Isso causa a exibicao de 100% de taxa de transbordo mesmo quando a IA nao participou da conversa.

### Codigo atual com bug (linhas 599-606):

```text
for (const conv of resolvedConversations) {
  const result = classifyResolver(conv);
  if (result.type === 'ai') {
    fallbackIA++;
  } else if (result.type === 'human') {
    fallbackHumano++;
    fallbackTransbordo++;  // BUG: conta TODA resolucao humana como transbordo
  }
}
```

### Logica correta (ja presente no caminho do banco de dados, linhas 569-571):

No caminho que usa `resolution_logs`, o transbordo so e contado quando `ai_participated === true`. O fallback deve replicar essa mesma logica, verificando se a IA participou da conversa antes de contar como transbordo.

## Correcao

### Arquivo: `backend/src/services/chatwoot-metrics.service.ts`

**Alterar o bloco do fallback (linhas 599-606)** para verificar os atributos `ai_responded` e `ai_participated` da conversa antes de incrementar `fallbackTransbordo`:

```typescript
for (const conv of resolvedConversations) {
  const result = classifyResolver(conv);
  if (result.type === 'ai') {
    fallbackIA++;
  } else if (result.type === 'human') {
    fallbackHumano++;
    // Transbordo = humano resolveu, mas IA participou antes
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
}
```

Esta mudanca alinha o fallback com a logica do banco de dados e com o contrato de metadados do n8n (que marca `ai_responded` e `ai_participated` nas conversas onde a IA atuou).

## Impacto

- 1 arquivo backend alterado (`chatwoot-metrics.service.ts`)
- Zero alteracao no frontend
- Corrige a taxa de transbordo inflada (100% quando deveria ser 0% em conversas sem participacao de IA)
- Nao afeta o caminho principal (via `resolution_logs`) que ja funciona corretamente
- Totalmente compativel com o contrato de dados existente do n8n/Chatwoot

