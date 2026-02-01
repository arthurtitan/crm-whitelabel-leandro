
# Plano: Métricas de Atendimento (Tempo Real) + Métricas de Resolução (Quem Fechou)

## Conceito

Separar as métricas em duas dimensões complementares que contam histórias diferentes:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DUAS CAMADAS DE MÉTRICAS                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CAMADA 1: ATENDIMENTO (Tempo Real)                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Quem ESTÁ atendendo agora? (baseado no assignee)                 │   │
│  │  • Oscilação em tempo real durante o dia                            │   │
│  │  • Mostra transferências (transbordo) acontecendo                   │   │
│  │  • Usa: assignee atual + ai_responded                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  CAMADA 2: RESOLUÇÃO (Quem Fechou)                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Quem RESOLVEU a conversa? (baseado no resolved_by do n8n)        │   │
│  │  • Métrica de eficiência e ROI da IA                                │   │
│  │  • Usado para análise histórica e relatórios                        │   │
│  │  • Usa: custom_attributes.resolved_by (explícito)                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Por que isso é mais inteligente?

| Aspecto | Camada 1 (Atendimento) | Camada 2 (Resolução) |
|---------|------------------------|----------------------|
| Pergunta | "Quem está atendendo agora?" | "Quem resolveu o problema?" |
| Fonte | assignee + ai_responded | resolved_by do n8n |
| Tempo | Tempo real, muda durante atendimento | Após fechamento (imutável) |
| Uso | Monitorar operação ao vivo | Análise de ROI e eficiência |
| Transbordo | "IA transferiu para humano (em andamento)" | "IA não conseguiu, humano finalizou" |

## Nova Estrutura de Dados

### Edge Function - Novos campos retornados

```typescript
interface DashboardMetrics {
  // CAMADA 1: Atendimento (tempo real - quem ESTÁ atendendo)
  atendimento: {
    total: number;              // Total de conversas abertas
    ia: number;                 // Sendo atendidas por IA agora
    humano: number;             // Sendo atendidas por humanos agora
    semAssignee: number;        // Aguardando atribuição
    transbordoEmAndamento: number; // IA iniciou, humano assumiu (ainda aberta)
  };
  
  // CAMADA 2: Resolução (histórico - quem RESOLVEU)
  resolucao: {
    total: number;              // Total resolvidas no período
    ia: {
      total: number;
      explicito: number;        // resolved_by = 'ai' (n8n)
      botNativo: number;        // agent_bot do Chatwoot
    };
    humano: {
      total: number;
      explicito: number;        // resolved_by = 'human' (n8n)
    };
    naoClassificado: number;    // Sem resolved_by (conversas antigas)
    transbordoFinalizado: number; // IA iniciou, humano fechou
  };
  
  // Taxas calculadas
  taxas: {
    resolucaoIA: string;        // % resolvidas por IA
    resolucaoHumano: string;    // % resolvidas por humano
    transbordo: string;         // % de transbordo (IA -> Humano que fechou)
    eficienciaIA: string;       // % de conversas que IA resolveu sozinha
  };
  
  // Mantém campos existentes para compatibilidade
  // ...
}
```

## Implementacao

### Etapa 1: Atualizar Edge Function

Arquivo: `supabase/functions/fetch-chatwoot-metrics/index.ts`

Adicionar duas funções de classificacao separadas:

```typescript
// CAMADA 1: Quem ESTÁ atendendo (tempo real)
function classifyCurrentHandler(conv: any): 'ai' | 'human' | 'none' {
  const hasBotAssignee = conv.meta?.assignee?.type === 'AgentBot' || !!conv.agent_bot_id;
  const aiResponded = conv.custom_attributes?.ai_responded === true;
  const hasHumanAssignee = !!(conv.meta?.assignee?.id) && !hasBotAssignee;
  
  if (hasBotAssignee) return 'ai';
  if (hasHumanAssignee) return 'human';
  if (aiResponded && !hasHumanAssignee) return 'ai';
  return 'none';
}

// CAMADA 2: Quem RESOLVEU (baseado em resolved_by explícito)
function classifyResolver(conv: any): 'ai' | 'human' | 'unclassified' {
  if (conv.status !== 'resolved') return 'unclassified';
  
  const resolvedBy = conv.custom_attributes?.resolved_by || 
                     conv.additional_attributes?.resolved_by;
  
  if (resolvedBy === 'ai') return 'ai';
  if (resolvedBy === 'human') return 'human';
  
  // Bot nativo do Chatwoot
  if (conv.meta?.assignee?.type === 'AgentBot' || conv.agent_bot_id) return 'ai';
  
  return 'unclassified';
}
```

Processar conversas com ambas as classificacoes:

```typescript
for (const conv of finalConversations) {
  // CAMADA 1: Atendimento (todas as conversas abertas)
  if (conv.status === 'open') {
    const handler = classifyCurrentHandler(conv);
    if (handler === 'ai') atendimento.ia++;
    else if (handler === 'human') atendimento.humano++;
    else atendimento.semAssignee++;
    
    // Detectar transbordo em andamento
    const aiResponded = conv.custom_attributes?.ai_responded === true;
    const hasHumanAssignee = !!(conv.meta?.assignee?.id);
    if (aiResponded && hasHumanAssignee) {
      atendimento.transbordoEmAndamento++;
    }
  }
  
  // CAMADA 2: Resolucao (apenas conversas resolvidas)
  if (conv.status === 'resolved') {
    const resolver = classifyResolver(conv);
    if (resolver === 'ai') resolucao.ia.total++;
    else if (resolver === 'human') resolucao.humano.total++;
    else resolucao.naoClassificado++;
    
    // Transbordo finalizado
    const aiResponded = conv.custom_attributes?.ai_responded === true;
    const handoffMarked = conv.custom_attributes?.handoff_to_human === true;
    if ((aiResponded || handoffMarked) && resolver === 'human') {
      resolucao.transbordoFinalizado++;
    }
  }
}
```

### Etapa 2: Atualizar Tipos TypeScript

Arquivo: `src/types/chatwoot-metrics.ts`

Adicionar novas interfaces:

```typescript
export interface AtendimentoMetrics {
  total: number;
  ia: number;
  humano: number;
  semAssignee: number;
  transbordoEmAndamento: number;
}

export interface ResolucaoMetrics {
  total: number;
  ia: {
    total: number;
    explicito: number;
    botNativo: number;
  };
  humano: {
    total: number;
    explicito: number;
  };
  naoClassificado: number;
  transbordoFinalizado: number;
}

export interface TaxasMetrics {
  resolucaoIA: string;
  resolucaoHumano: string;
  transbordo: string;
  eficienciaIA: string;
}
```

### Etapa 3: Atualizar Hook

Arquivo: `src/hooks/useChatwootMetrics.ts`

Adicionar novos campos na interface DashboardMetrics e garantir retrocompatibilidade.

### Etapa 4: Criar Novos Cards de UI

#### Card: Atendimento em Tempo Real

Arquivo: `src/components/dashboard/AtendimentoRealtimeCard.tsx`

- Mostra quem ESTA atendendo agora
- Barra de progresso animada IA vs Humano
- Contador de transbordo em andamento
- Atualiza a cada 30s

#### Card: Resolucao (Quem Fechou)

Atualizar `IAvsHumanCard.tsx` ou criar novo:

- Mostra quem RESOLVEU as conversas
- Indicador de metodologia (Explicito vs Nao Classificado)
- Aviso quando muitas conversas sem resolved_by

### Etapa 5: Atualizar Dashboard

Arquivo: `src/pages/admin/AdminDashboard.tsx`

Reorganizar layout para mostrar as duas camadas:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  KPIs Gerais: Total Leads | Conversas Ativas | Agendamentos | etc          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐          │
│  │   ATENDIMENTO AO VIVO      │  │   RESOLUCAO (Historico)     │          │
│  │   Quem está atendendo?     │  │   Quem fechou?              │          │
│  │                            │  │                              │          │
│  │   IA: 12 (45%)             │  │   IA: 85 (68%)               │          │
│  │   Humano: 15 (55%)         │  │   Humano: 40 (32%)           │          │
│  │                            │  │                              │          │
│  │   Transbordo: 3 em curso   │  │   Transbordo: 15 finalizados │          │
│  └─────────────────────────────┘  └─────────────────────────────┘          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Graficos: Pico Horario | Backlog | Performance Agentes                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Resumo das Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/fetch-chatwoot-metrics/index.ts` | Duas funcoes de classificacao + novos campos |
| `src/types/chatwoot-metrics.ts` | Novas interfaces AtendimentoMetrics e ResolucaoMetrics |
| `src/hooks/useChatwootMetrics.ts` | Novos campos + retrocompatibilidade |
| `src/components/dashboard/AtendimentoRealtimeCard.tsx` | Novo componente para atendimento ao vivo |
| `src/components/dashboard/IAvsHumanCard.tsx` | Atualizar para mostrar resolucao |
| `src/pages/admin/AdminDashboard.tsx` | Reorganizar layout com duas camadas |

## Contrato n8n (Inalterado)

O n8n continua enviando os mesmos campos:

- `ai_responded: true` - Quando IA responde (usado na Camada 1)
- `handoff_to_human: true` - Quando transfere para humano
- `resolved_by: "ai" | "human"` - Antes de fechar conversa (usado na Camada 2)

## Beneficios Finais

- Metricas de atendimento mostram operacao em tempo real
- Metricas de resolucao mostram eficiencia historica
- Transbordo aparece em ambas as camadas (em andamento vs finalizado)
- Sem ambiguidade sobre quem resolveu
- Compativel com conversas antigas (Camada 1 funciona mesmo sem n8n atualizado)
