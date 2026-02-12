
## Correção: Atendimento ao Vivo - Remover Filtragem por Data e Melhorar Classificação

### Problema Identificado

1. **Conversas resolvidas fora do intervalo de data estão sendo contabilizadas como "ao vivo"**:
   - A filtragem atual (linhas 265-277) inclui conversas se: `createdInRange OR activeInRange`
   - Se uma conversa foi resolvida (status = 'resolved') mas teve `last_activity_at` dentro do intervalo solicitado, ela é incluída no filtered list
   - Depois, ao processar o `status`, a conversa pode ter sido reaberta (status = 'open'), mas os dados da atividade passada a fizeram entrar na lista

2. **Classificação de "Humano" está imprecisa**:
   - Classifica qualquer conversa com `assignee` humano como "humano" mesmo se `human_active` não estiver marcado
   - Ignora o fato de que a IA pode estar usando a conta de agente humano para responder

### Solução

#### Mudança 1: Separar Filtragem por Tipo de Métrica (linhas 264-295)

**Antes:**
```typescript
// Filter conversations by date range (using last_activity_at OR created_at for better coverage)
const conversations = allConversations.filter((conv: any) => {
  const activityDate = conv.last_activity_at 
    ? new Date(conv.last_activity_at * 1000)
    : new Date(conv.created_at);
  const createdAt = new Date(conv.created_at);
  
  const createdInRange = createdAt >= dateFromParsed && createdAt <= dateToParsed;
  const activeInRange = activityDate >= dateFromParsed && activityDate <= dateToParsed;
  
  return createdInRange || activeInRange;
});

const filteredConversations = inboxId 
  ? conversations.filter(c => c.inbox_id === inboxId)
  : conversations;

const filteredByAgentConversations = agentId 
  ? filteredConversations.filter(c => c.meta?.assignee?.id === agentId)
  : filteredConversations;
```

**Depois:**
```typescript
// ========================================================================
// CAMADA 1: Atendimento ao Vivo - APENAS CONVERSAS ABERTAS (SEM FILTRO DE DATA)
// Deve exibir o estado REAL do que está acontecendo AGORA
// ========================================================================
const liveConversations = allConversations.filter((conv: any) => conv.status === 'open');

// ========================================================================
// CAMADA 2: Resolução & Histórico - FILTRADO POR DATA
// Conversas que foram criadas ou tiveram atividade no período solicitado
// ========================================================================
const historyConversations = allConversations.filter((conv: any) => {
  const activityDate = conv.last_activity_at 
    ? new Date(conv.last_activity_at * 1000)
    : new Date(conv.created_at);
  const createdAt = new Date(conv.created_at);
  
  const createdInRange = createdAt >= dateFromParsed && createdAt <= dateToParsed;
  const activeInRange = activityDate >= dateFromParsed && activityDate <= dateToParsed;
  
  return createdInRange || activeInRange;
});

// Apply filters to historical data
const filteredHistoryConversations = inboxId 
  ? historyConversations.filter(c => c.inbox_id === inboxId)
  : historyConversations;

const filteredByAgentHistory = agentId 
  ? filteredHistoryConversations.filter(c => c.meta?.assignee?.id === agentId)
  : filteredHistoryConversations;

// Apply filters to live data (inbox only, não filtra por date)
const filteredLiveConversations = inboxId 
  ? liveConversations.filter(c => c.inbox_id === inboxId)
  : liveConversations;
```

#### Mudança 2: Usar `liveConversations` para Camada 1 (linhas 330-365)

**Antes:**
```typescript
let openCount = 0, resolvedCount = 0, pendingCount = 0, unattendedCount = 0;
const finalConversations = filteredByAgentConversations;

for (const conv of finalConversations) {
  if (conv.status === 'open') { /* Atendimento */ }
  if (conv.status === 'resolved') { /* Resolução */ }
}
```

**Depois:**
```typescript
// ============================================================
// PROCESSO 1: ATENDIMENTO AO VIVO (dados reais, sem filtro de data)
// ============================================================
const atendimento: AtendimentoMetrics = {
  total: 0,
  ia: 0,
  humano: 0,
  semAssignee: 0,
};

for (const conv of filteredLiveConversations) {
  atendimento.total++;
  const handler = classifyCurrentHandler(conv);
  
  if (handler === 'ai') {
    atendimento.ia++;
  } else if (handler === 'human') {
    atendimento.humano++;
  } else {
    atendimento.semAssignee++;
  }
}

// ============================================================
// PROCESSO 2: HISTÓRICO & RESOLUÇÕES (filtrado por data)
// ============================================================
let openCount = 0, resolvedCount = 0, pendingCount = 0, unattendedCount = 0;
const finalConversations = filteredByAgentHistory;

for (const conv of finalConversations) {
  if (conv.status === 'open') openCount++;
  if (conv.status === 'resolved') resolvedCount++;
  if (conv.status === 'pending') pendingCount++;
}
```

#### Mudança 3: Melhorar `classifyCurrentHandler` (linhas 24-38)

**Antes:**
```typescript
function classifyCurrentHandler(conv: any): 'ai' | 'human' | 'none' {
  const custom = conv.custom_attributes || {};
  const additional = conv.additional_attributes || {};
  const aiResponded = custom.ai_responded === true || additional.ai_responded === true;
  const hasHumanAssignee = !!(conv.meta?.assignee?.id || conv.assignee_id);

  if (aiResponded) return 'ai';
  if (hasHumanAssignee) return 'human';
  return 'none';
}
```

**Depois:**
```typescript
function classifyCurrentHandler(conv: any): 'ai' | 'human' | 'none' {
  const custom = conv.custom_attributes || {};
  const additional = conv.additional_attributes || {};
  
  // PRIORIDADE 1: ai_responded = true → IA atendendo (explícito)
  const aiResponded = custom.ai_responded === true || additional.ai_responded === true;
  if (aiResponded) return 'ai';

  // PRIORIDADE 2: human_active = true → Humano atendendo (explícito)
  const humanActive = custom.human_active === true || additional.human_active === true;
  if (humanActive) return 'human';

  // PRIORIDADE 3: human_intervened = true → Humano interveio manualmente
  const humanIntervened = custom.human_intervened === true || additional.human_intervened === true;
  if (humanIntervened) return 'human';

  // PRIORIDADE 4: Apenas com assignee humano (sem flags) → Aguardando
  // (evita classificar erroneamente como humano quando flags foram resetados)
  const hasHumanAssignee = !!(conv.meta?.assignee?.id || conv.assignee_id);
  if (hasHumanAssignee && !humanActive && !humanIntervened) {
    return 'none';
  }

  return 'none';
}
```

### Impacto

- **Atendimento ao Vivo** agora mostra APENAS conversas abertas no momento da consulta (status = 'open')
- Não sofre interferência de datas de filtro
- Conversas resolvidas nunca aparecem como "ao vivo"
- Classificação de "Humano" é mais precisa: requer `human_active` ou `human_intervened` marcado
- IA respondendo via conta de agente humano é corretamente identificada se `ai_responded: true` estiver marcado

### Mudanças Técnicas Resumidas

1. Criar `liveConversations` - apenas `status = 'open'`, sem filtro de data
2. Usar `liveConversations` para calcular `atendimento` (Camada 1)
3. Usar `historyConversations` para resolução e histórico (Camada 2)
4. Melhorar `classifyCurrentHandler` para exigir flags operacionais (`human_active`, `human_intervened`)
5. Adicionar logs diagnósticos para rastreamento
