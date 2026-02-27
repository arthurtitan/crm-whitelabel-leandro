
# Documentação de Referência: Métricas do Dashboard

## 1. Regras de Metrificação (Contrato n8n/Chatwoot)

Atributos customizados gerenciados pelo n8n em `custom_attributes`:

| Atributo | Tipo | Significado |
|---|---|---|
| `ai_responded` | bool | IA respondeu nesta conversa (sticky, persiste após reopen) |
| `human_active` | bool | Trava: humano assumiu, IA silenciada |
| `handoff_to_human` | bool | Transbordo explícito ocorreu |
| `human_intervened` | bool | Intervenção manual de agente |
| `resolved_by` | 'ai'/'human' | Quem encerrou (gravado antes do resolve) |
| `ai_participated` | bool | Forçado true em resoluções humanas |
| `followup_count` | int | Contador de tentativas de cadência |
| `last_followup_at` | text | Data da última tentativa de contato automático |

**Reset:** Quando conversa reabre (resolved → open), o n8n reseta todos os atributos de ciclo.

## 2. classifyCurrentHandler() — Atendimento ao Vivo

Lógica de 6 prioridades (idêntica em backend e Edge Function):

```
P1: human_active || handoff_to_human || human_intervened → HUMANO
P2: Bot nativo (AgentBot) → IA
P3: ai_responded SEM assignee humano → IA
P4: ai_responded COM assignee humano → HUMANO (transição)
P5: Apenas assignee humano → HUMANO
P6: Ninguém → Em Aberto (none)
```

**Arquivos:** `backend/src/services/chatwoot-metrics.service.ts` e `supabase/functions/fetch-chatwoot-metrics/index.ts`

## 3. classifyResolver() — Resolução Histórica

Lógica de 4 prioridades para classificar quem resolveu:

```
P1: resolved_by = 'ai' (explícito via n8n) → IA
P2: resolved_by = 'human' (explícito via n8n) → HUMANO
P3: Bot nativo (AgentBot) → IA (inferido)
P4: ai_responded sem assignee humano → IA (inferido)
P5: Default → HUMANO (inferido)
```

## 4. Fallback de Resolução

Quando `resolution_logs` está vazio para o período (dados não sincronizados, novo período):
- Filtra conversas com `status === 'resolved'`
- Aplica `classifyResolver()` em cada uma
- Calcula transbordo: humano resolveu + `ai_responded === true`
- Presente em AMBOS backend Express e Edge Function

## 5. Arquitetura de Duas Camadas

### Camada 1: Atendimento ao Vivo
- **Fonte:** API do Chatwoot (conversas abertas/pendentes)
- **Filtro de data:** NÃO (mostra estado atual)
- **Função:** `classifyCurrentHandler()`
- **Card:** "Atendimento Agora" — IA / Humano / Em Aberto

### Camada 2: Resolução (Histórico)
- **Fonte:** Tabela `resolution_logs` (com fallback para API)
- **Filtro de data:** SIM (período selecionado no dashboard)
- **Função:** `classifyResolver()` (no fallback)
- **Card:** "Resolução" — IA / Humano / Transbordo

### Persistência
- `resolution_logs`: tabela com unique constraint (account_id, conversation_id)
- Duas fontes de gravação: n8n (tempo real) + sincronização passiva (backend)
- ON CONFLICT DO NOTHING evita duplicação

## 6. Métricas Exibidas no Dashboard

### KPIs Principais
| Métrica | Cálculo |
|---|---|
| Total de Leads | Contagem total de conversas no período |
| Conversas Ativas | Conversas com status `open` |
| Retornos no Período | Total - Novos leads |
| Conversas Resolvidas | Conversas com status `resolved` |
| Conversas Pendentes | Conversas com status `pending` |
| Conversas Sem Resposta | Abertas sem nenhuma mensagem de agente |

### Card: Atendimento em Tempo Real
| Campo | Significado |
|---|---|
| `atendimento.ia` | Conversas abertas classificadas como IA via classifyCurrentHandler |
| `atendimento.humano` | Conversas abertas classificadas como humano |
| `atendimento.semAssignee` | Conversas sem IA confirmada nem humano atribuído |
| `atendimento.total` | Soma dos três |

### Card: Resolução (Histórico)
| Campo | Significado |
|---|---|
| `resolucao.ia.total` | Total resolvidas por IA (explícito + inferido) |
| `resolucao.humano.total` | Total resolvidas por humano |
| `resolucao.transbordoFinalizado` | IA iniciou, humano fechou |
| `resolucao.naoClassificado` | Sem resolved_by (conversas antigas) |

### Taxas Calculadas
| Taxa | Fórmula |
|---|---|
| Resolução IA | `resolucao.ia.total / (ia + humano) * 100` |
| Resolução Humano | `100 - taxaResolucaoIA` |
| Transbordo | `transbordoCount / (resolucaoIA + transbordoCount) * 100` |
| Eficiência IA | `resolucao.ia.total / resolucao.total * 100` |

### Card: Backlog Humano
| Faixa | Significado |
|---|---|
| ≤ 15 min | Conversas aguardando há até 15 minutos |
| 15-60 min | Conversas aguardando entre 15 e 60 minutos |
| > 60 min | Conversas aguardando há mais de 1 hora |

### Outros Cards
- **Pico por Hora:** Distribuição de conversas por hora do dia
- **Conversas por Canal:** Agrupamento por inbox (WhatsApp, Instagram, Webchat)
- **Performance de Agentes:** Atendimentos assumidos, resolvidos, tempo médio, taxa de resolução
- **Qualidade:** Conversas sem resposta, taxa atendimento → venda
- **Tempo Médio:** Primeira resposta e resolução

## 7. Polling e Cache
- Intervalo de polling: 30 segundos (TanStack Query)
- Pausa automática quando aba inativa (`refetchIntervalInBackground: false`)
- staleTime: 25 segundos
- gcTime: 5 minutos
- Retry: 3 tentativas com backoff exponencial + jitter

## 8. Paridade Backend ↔ Edge Function
Ambos os ambientes possuem lógica idêntica para:
- `classifyCurrentHandler()` (6 prioridades)
- `classifyResolver()` (4+ prioridades)
- Fallback de resolução (dados brutos quando resolution_logs vazio)
- Cálculo de taxas e métricas
- Flag `VITE_USE_BACKEND` no frontend controla qual é usado
