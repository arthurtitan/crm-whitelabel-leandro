

## Correcao Definitiva: Transbordo = Toda Resolucao Humana

### Regra de Negocio (confirmada pelo usuario)

Como a IA **sempre** inicia o atendimento, toda resolucao humana implica que a IA participou. Portanto:

- **Transbordo** = qualquer `resolved_by: 'human'` (nao precisa verificar `ai_responded`)
- **Cada ciclo e independente**: IA resolveu = +1 ciclo IA. Humano resolveu = +1 ciclo transbordo. Sem apagar historico.

Isso elimina completamente a dependencia de atributos customizados (`ai_responded`, `handoff_to_human`) para o calculo de transbordo.

### O que muda (3 linhas uteis)

**Arquivo:** `supabase/functions/fetch-chatwoot-metrics/index.ts`

1. **Linha 645**: Remover a verificacao de `ai_responded` e definir `ai_participated: true` para todas as resolucoes humanas:

```typescript
// ANTES (linha 644-645):
// Check if AI participated before human resolved
const aiResponded = custom.ai_responded === true || additional.ai_responded === true;

// DEPOIS:
// IA sempre inicia o atendimento, toda resolução humana = transbordo
const aiResponded = true;
```

2. **`log-resolution/index.ts`**: Quando `resolved_by === 'human'`, forcar `ai_participated: true` independente do payload:

```typescript
// ANTES:
ai_participated: ai_participated === true,

// DEPOIS:
ai_participated: resolved_by === 'human' ? true : (ai_participated === true),
```

3. **Correcao retroativa** (query unica no banco): Atualizar todos os registros humanos antigos que estao com `ai_participated: false`:

```sql
UPDATE resolution_logs 
SET ai_participated = true 
WHERE resolved_by = 'human' AND ai_participated = false;
```

### Sobre a conversa #32 (gap do safety net)

A conversa #32 continua nao sendo capturada porque o safety net so processa `status === 'resolved'` e ela foi reaberta. Porem, com a regra simplificada, da proxima vez que ela for resolvida (por humano ou IA), o ciclo sera registrado corretamente. Se quiser capturar tambem conversas reabertas que tiveram transbordo, pode-se adicionar um filtro secundario para conversas com `handoff_to_human: true` que nao estao em status resolved.

### Resultado

| Cenario | Antes | Depois |
|---------|-------|--------|
| Resolucao humana qualquer | Depende de ai_responded (falha) | ai_participated = true sempre |
| Resolucao por IA | ai_participated = false | ai_participated = false (correto) |
| Registros antigos | ai_participated = false | Corrigidos retroativamente |
| Calculo transbordo | 0% (hardcoded/bug) | Todas resolucoes humanas contam |

### Arquivos alterados

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/fetch-chatwoot-metrics/index.ts` | Linha 645: `ai_participated: true` para toda resolucao humana |
| `supabase/functions/log-resolution/index.ts` | Forcar `ai_participated: true` quando `resolved_by === 'human'` |
| `resolution_logs` (query retroativa) | UPDATE registros humanos antigos |

