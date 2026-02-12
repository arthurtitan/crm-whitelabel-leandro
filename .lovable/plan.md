

## Sync Simplificado de Resoluções Humanas

### Principio

A logica de classificacao para persistencia no banco sera **binaria e simples**:

- Conversa resolvida COM `custom_attributes.resolved_by = "ai"` --> IA resolveu. O n8n ja logou via `log-resolution`. **SKIP**.
- Conversa resolvida SEM esse atributo (ou com qualquer outro valor) --> Humano resolveu. **INSERT no banco**.

Isso elimina toda a complexidade de inferencia (bot nativo, transbordo, fallback) para fins de persistencia. O `classifyResolver` atual continua existindo para exibicao no dashboard (Camada 2 visual), mas o INSERT no banco segue a regra binaria.

### Garantias de Integridade

**Conversas diferentes ao mesmo tempo:**
O unique constraint em `resolution_logs` inclui `conversation_id`. Conversa 21 (IA) e conversa 45 (humano) sao registros completamente independentes -- nunca colidem.

**Mesmo conversation_id, ciclos diferentes:**
Cada ciclo de resolucao gera um `resolved_at` diferente (baseado no `last_activity_at` do Chatwoot). O constraint `(account_id, conversation_id, resolved_at)` permite multiplos registros para a mesma conversa em momentos diferentes.

**Reset de ciclo (n8n limpa atributos):**
Quando a conversa e reaberta, o n8n limpa `resolved_by`, `ai_responded`, etc. A sync so processa conversas com `status = "resolved"`, entao conversas abertas sao ignoradas. Quando resolvida novamente, o novo timestamp garante um registro unico.

### Mudancas Tecnicas

#### 1. `supabase/functions/fetch-chatwoot-metrics/index.ts` (linhas 603-647)

Substituir a secao "RESOLUTION LOGS" atual por:

```text
Para cada conversa com status = "resolved":
  1. Ler custom_attributes.resolved_by
  2. Se resolved_by === "ai" --> SKIP (n8n ja logou)
  3. Se resolved_by !== "ai" (null, undefined, "human", qualquer coisa):
     a. Calcular resolved_at = last_activity_at da conversa (Unix -> ISO)
     b. Tentar INSERT em resolution_logs:
        - account_id: UUID do CRM
        - conversation_id: ID da conversa
        - resolved_by: "human"
        - resolution_type: "inferred"
        - resolved_at: timestamp do Chatwoot
     c. Se unique constraint viola (23505) --> Duplicata, skip silencioso
  4. Apos todos os inserts, consultar resolution_logs para o periodo
  5. Retornar totais atualizados
```

**Logica simplificada (pseudocodigo):**
```text
for each resolvedConversation:
    if conv.custom_attributes.resolved_by === "ai":
        continue  // n8n already logged this
    
    resolved_at = new Date(conv.last_activity_at * 1000).toISOString()
    
    INSERT INTO resolution_logs (
        account_id, conversation_id, resolved_by, 
        resolution_type, resolved_at
    ) VALUES (
        dbAccountId, conv.id, 'human', 'inferred', resolved_at
    )
    ON CONFLICT DO NOTHING  // unique constraint handles dedup
```

#### 2. Nenhuma outra mudanca necessaria

- Schema `resolution_logs`: sem alteracao
- Edge Function `log-resolution`: sem alteracao
- Frontend/Dashboard: sem alteracao
- Fluxo n8n de IA: sem alteracao
- RLS policies: sem alteracao

### Cenarios Validados

| Cenario | Resultado |
|---------|-----------|
| IA resolve conversa 21 | n8n loga `ai`. Sync ve `resolved_by: ai`, SKIP |
| Humano resolve conversa 45 | Sync ve sem `resolved_by: ai`, INSERT `human` |
| Ambas ao mesmo tempo | `conversation_id` diferente, dois registros independentes |
| Conversa 21 reaberta, atributos limpos | Status = "open", sync ignora |
| Conversa 21 re-resolvida por humano | Novo `last_activity_at`, novo registro `human` |
| Conversa 21 re-resolvida por IA | n8n loga novo `ai` com novo timestamp |
| Sync roda 2x seguidas | ON CONFLICT DO NOTHING, zero duplicatas |
| 10 conversas humanas + 5 IA simultaneas | 10 inserts human + 5 skips = 15 registros corretos |

### Fluxo Completo

```text
Dashboard carrega
       |
fetch-chatwoot-metrics busca conversas do Chatwoot
       |
Para cada conversa resolvida:
  resolved_by === "ai"?
       |
  SIM --> SKIP (n8n ja logou)
  NAO --> INSERT human em resolution_logs (ON CONFLICT IGNORE)
       |
Consulta resolution_logs do periodo
       |
Retorna metricas com historico atualizado
```

### Ordem de Implementacao

1. Modificar a secao RESOLUTION LOGS (linhas 603-647) do `fetch-chatwoot-metrics`
2. Adicionar loop de INSERT para conversas humanas com ON CONFLICT DO NOTHING
3. Manter a consulta de totais existente (linhas 625-643)
4. Deploy da Edge Function
5. Testar: resolver 1 conversa como humano, carregar dashboard, verificar `resolution_logs`

