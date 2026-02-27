

# Correcao: classifyCurrentHandler e Paridade de Metricas

## Regras de Metrificacao (Resumo do Contrato n8n/Chatwoot)

Atributos customizados gerenciados pelo n8n:

| Atributo | Tipo | Significado |
|---|---|---|
| `ai_responded` | bool | IA respondeu nesta conversa (persistente, "sticky") |
| `human_active` | bool | Trava: humano assumiu, IA silenciada |
| `handoff_to_human` | bool | Transbordo explicito ocorreu |
| `human_intervened` | bool | Intervencao manual de agente |
| `resolved_by` | 'ai'/'human' | Quem encerrou (gravado antes do resolve) |

Regra de reset: quando conversa reabre (resolved -> open), o n8n reseta todos os atributos de ciclo.

## Problema Atual

`classifyCurrentHandler()` (identica no backend e na Edge Function) usa esta logica:

```
if (ai_responded) return 'ai'    // <-- BUG: ai_responded e sticky!
if (hasHumanAssignee) return 'human'
return 'none'
```

Consequencia: conversa onde IA respondeu mas humano ja assumiu (`human_active=true`, `handoff_to_human=true`, ou agente atribuido) ainda aparece como "IA atendendo". Isso explica o "1 atendimento de IA" no dashboard quando a IA nem esta ligada.

## Solucao

Atualizar `classifyCurrentHandler()` em **dois arquivos** com logica de prioridade que respeita o contrato:

```
PRIORIDADE 1: human_active || handoff_to_human || human_intervened -> HUMANO
PRIORIDADE 2: Bot nativo (AgentBot) -> IA
PRIORIDADE 3: ai_responded SEM assignee humano -> IA
PRIORIDADE 4: ai_responded COM assignee humano -> HUMANO (transicao)
PRIORIDADE 5: Apenas assignee humano -> HUMANO
PRIORIDADE 6: Ninguem -> Em Aberto (none)
```

## Arquivos Afetados

### 1. `backend/src/services/chatwoot-metrics.service.ts` (linhas 39-48)

Substituir `classifyCurrentHandler()` pela versao corrigida com checks de takeover humano.

### 2. `supabase/functions/fetch-chatwoot-metrics/index.ts` (linhas 25-39)

Mesma correcao para manter paridade entre backend Express e Edge Function.

## Resultado Esperado

| Cenario | Antes (errado) | Depois (correto) |
|---|---|---|
| `ai_responded=true` + `human_active=true` | IA | Humano |
| `ai_responded=true` + assignee humano | IA | Humano |
| `ai_responded=true` sem flags humanas, sem assignee | IA | IA |
| Bot nativo (AgentBot) | depende | IA |
| Apenas assignee humano | Humano | Humano |
| Sem ninguem | none | none |

- Card "Atendimento Agora": IA so aparece quando realmente nao ha indicacao de takeover humano
- Metricas de Resolucao: ja corrigidas pelo fallback adicionado anteriormente (calculam via `classifyResolver()` quando `resolution_logs` indisponivel)
- Edge Function e Backend Express: logica identica, dados coerentes independente do modo

## Detalhes Tecnicos

A mudanca e cirurgica: apenas a funcao `classifyCurrentHandler()` em cada arquivo. Nao afeta `classifyResolver()` (resolucao historica), que ja possui logica correta com prioridade para `resolved_by` explicito.

Apos a correcao, sera necessario rebuild no VPS para aplicar a mudanca do backend Express. A Edge Function sera deployada automaticamente.

