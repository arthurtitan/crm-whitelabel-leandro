

## Crítica: Métrica de Resolução Baseada em Estado Volátil do Chatwoot

### Diagnóstico

O sistema tem **dois silos de dados conflitantes**:

1. **`resolution_logs` (Persistente)**: Tabela no banco que registra imutavelmente cada ciclo resolvido
   - Contém dados corretos: `resolved_by: "ai"` ou `resolved_by: "human"`
   - Nunca é apagada ou modificada
   
2. **Conversas `resolved` no Chatwoot (Volátil)**: Estados de conversas que MUDAM
   - Quando cliente reabre → volta para `status: "open"`
   - Métrica desaparece do dashboard mesmo que o histórico exista no banco

### Fluxo Problemático Identificado

```
1. IA resolve conversa 21
   → Insere em resolution_logs com resolved_by: "ai" ✓
   → Chatwoot: status = "resolved", custom_attributes.resolved_by = "ai" ✓

2. Cliente envia mensagem
   → Chatwoot: status muda para "open"
   → Conversa sai da lista de "resolved" do Chatwoot
   → Dashboard carrega fetch-chatwoot-metrics
   → Lê APENAS conversas status = "resolved"
   → Conversa 21 NÃO aparece
   → Métrica desaparece (IA: 0, Humano: 100%)

3. Mas resolution_logs AINDA TEM o registro:
   → SELECT COUNT(*) FROM resolution_logs WHERE resolved_by = "ai"
   → Retorna 1 ✓ (Correto!)
```

### Causa Raiz

`fetch-chatwoot-metrics` calcula `resolucao` lendo **conversas do Chatwoot** em vez de **registros persistentes em `resolution_logs`**.

O Edge Function já tem `historicoResolucoes` (linhas 607-702) que consulta o banco corretamente, mas o Dashboard não o usa — continua consumindo `resolucao` que vem de Chatwoot.

### Solução: Duas Camadas Integradas

**Camada 1 — Atendimento em Tempo Real (Chatwoot)**
- Quem **ESTÁ atendendo agora**? (conversas abertas)
- Baseado em: `status = "open"` + `ai_responded` ou `assignee`
- **Continua igual** (não muda)

**Camada 2 — Resolução (Histórico Persistente via `resolution_logs`)**
- Quem **RESOLVEU** cada conversa?
- Baseado em: `resolution_logs` do banco
- **MUDA**: De "conversas resolvidas do Chatwoot" → "registros em resolution_logs"

### Mudança Técnica

**No arquivo `supabase/functions/fetch-chatwoot-metrics/index.ts`:**

1. Substituir a lógica de `resolucao` (linhas 314-320, 408-443) para:
   - Consultar diretamente `SELECT COUNT(*) FROM resolution_logs WHERE account_id = ? AND resolved_at BETWEEN ? AND ? GROUP BY resolved_by`
   - Remover a lógica que lê conversas `status = "resolved"` do Chatwoot
   - Manter apenas a lógica de **sincronização** de resoluções humanas (que insere em resolution_logs)

2. Usar `historicoResolucoes` (que já calcula corretamente) como `resolucao`:
   - `resolucao.ia.total` = `historicoResolucoes.totalIA`
   - `resolucao.humano.total` = `historicoResolucoes.totalHumano`
   - Remover métodos de cálculo que usam Chatwoot

3. Manter toda a lógica de **Atendimento em Tempo Real** (que usa Chatwoot e conversas abertas)

### Benefício

- ✓ Métricas nunca desaparecem quando conversa é reaberta
- ✓ Cada ciclo resolvido é contabilizado permanentemente
- ✓ Suporta múltiplos ciclos da mesma conversa
- ✓ Dashboard reflete a realidade (IA: 1, Humano: 0) mesmo após reabertura
- ✓ Fonte de verdade única: `resolution_logs`

### Impacto

- **Dashboard**: Gráfico de "Resolução (Quem Fechou)" passa a usar dados persistentes
- **Fluxo n8n**: Sem mudanças necessárias (continua inserindo em resolution_logs)
- **Edge Function**: Refactoring da seção de Resolução para usar `resolution_logs` como fonte
- **Dados históricos**: Todos os registros em resolution_logs serão usados corretamente

### Ordem de Implementação

1. Refatorar `resolucao` para usar `resolution_logs` como fonte
2. Remover lógica que conta conversas `status = "resolved"` do Chatwoot
3. Manter sincronização de resoluções humanas (ON CONFLICT DO NOTHING)
4. Testar: Resolver como IA, reabrir, verificar que métrica permanece
5. Testar: Resolver como IA, reabrir, resolver como humano, verificar ambos os ciclos aparecem

