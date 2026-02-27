

# Correcao: Total de Leads, Novos Leads, Retornos e Taxa de Transbordo

## Regras de Negocio (conforme documentacao do sistema)

| Metrica | Definicao Correta |
|---|---|
| **Total de Leads** | Contatos **unicos** com atividade no periodo (nao conversas) |
| **Novos Leads** | Contatos cuja `first_resolved_at` e NULL ou caiu dentro do periodo |
| **Retornos no Periodo** | `Total de Leads - Novos Leads` |
| **Taxa de Transbordo** | `resolucoes_humanas / (resolucoes_ia + resolucoes_humanas) * 100` (toda resolucao humana = transbordo) |

## Bugs Encontrados

### Bug 1: Total de Leads conta conversas, nao contatos unicos

**Ambos os arquivos** retornam `totalLeads: finalConversations.length`, que conta o numero de conversas. Um mesmo contato pode ter multiplas conversas, inflando o numero.

**Correcao:** Contar contatos unicos via `conv.meta?.sender?.id`:

```typescript
const uniqueContactIds = new Set(
  finalConversations
    .map((c: any) => c.meta?.sender?.id)
    .filter(Boolean)
);
const totalLeadsUnicos = uniqueContactIds.size;
```

### Bug 2: Fallback de Transbordo inconsistente com regra de negocio

A regra diz: "Toda resolucao humana e automaticamente um transbordo" (IA sempre inicia o atendimento).

No **sync** para o banco, o codigo ja faz isso corretamente: `ai_participated: true` (hardcoded).

Porem no **fallback** (quando resolution_logs esta vazio), o codigo verifica `ai_responded === true` nos custom_attributes, o que pode retornar `false` para conversas antigas onde a IA nunca respondeu. Isso causa divergencia entre o fallback e o banco.

**Correcao:** No fallback, toda resolucao humana deve contar como transbordo (sem verificar `ai_responded`):

```typescript
// ANTES (incorreto no fallback):
if (aiResponded) fallbackTransbordo++;

// DEPOIS (alinhado com regra de negocio):
fallbackTransbordo++; // Toda resolucao humana = transbordo
```

### Bug 3: Novos Leads no fallback do backend

No backend Express (linha 429), quando `firstResolvedAtAvailable` e `false`, o fallback e `novosLeads = leadsInPeriod`. Porem `leadsInPeriod` conta conversas **criadas** no periodo, nao contatos unicos. Deveria contar contatos unicos criados no periodo.

## Arquivos Afetados

### 1. `supabase/functions/fetch-chatwoot-metrics/index.ts`
- **Linha 879**: Mudar `totalLeads` para contagem de contatos unicos
- **Linhas 814-817**: Remover check de `ai_responded` no fallback de transbordo — toda resolucao humana = transbordo

### 2. `backend/src/services/chatwoot-metrics.service.ts`
- **Linha 657**: Mudar `totalLeads` para contagem de contatos unicos
- **Linhas 562-565**: Mesma correcao do fallback de transbordo
- **Linha 429**: Corrigir fallback de `novosLeads` para contar contatos unicos

## Detalhes da Implementacao

Em ambos os arquivos, adicionar antes do bloco de resposta:

```typescript
// Contagem de contatos UNICOS (nao conversas)
const uniqueContactIds = new Set(
  finalConversations
    .map((c: any) => c.meta?.sender?.id)
    .filter(Boolean)
);
const totalLeadsUnicos = uniqueContactIds.size;
```

E no response:
```typescript
totalLeads: totalLeadsUnicos,
// conversasAtivas permanece = novosLeads (correto)
retornosNoPeriodo: Math.max(0, totalLeadsUnicos - novosLeads),
```

No fallback de transbordo (ambos os arquivos):
```typescript
} else if (result.type === 'human') {
  fallbackHumano++;
  fallbackTransbordo++; // Regra: toda resolucao humana = transbordo
}
```

## Resultado Esperado

| Cenario | Antes (errado) | Depois (correto) |
|---|---|---|
| 10 conversas de 5 contatos | Total Leads = 10 | Total Leads = 5 |
| 5 contatos unicos, 3 novos | Retornos = 10-3 = 7 | Retornos = 5-3 = 2 |
| Fallback: humano resolveu sem ai_responded | Nao conta transbordo | Conta como transbordo |
| Taxa transbordo com fallback | Subestimada | Alinhada com regra de negocio |

