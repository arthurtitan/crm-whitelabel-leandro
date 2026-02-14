

## Implementar Rastreamento Real de Transbordo

### Problema Atual
A taxa de transbordo esta sempre em **0%** porque o campo `transbordoFinalizado` esta hardcoded como `0` na linha 709 da Edge Function. O sistema nao consegue distinguir entre uma resolucao humana "pura" e uma onde a IA participou antes (transbordo).

### Solucao

Adicionar um campo `ai_participated` na tabela `resolution_logs` para registrar se a IA atuou antes da resolucao humana. Com isso, o calculo de transbordo sera:

- **Transbordo** = resolucoees onde `resolved_by = 'human'` E `ai_participated = true`
- **Taxa** = transbordo / (resolucoes IA + transbordo) x 100

### Fluxo de Dados

```text
Conversa resolvida
       |
       v
  resolved_by = "ai"?
     /         \
   SIM         NAO
    |            |
  n8n loga     Edge Function loga
  ai + ai_participated=true    human + verifica ai_responded
    |            |
    v            v
  resolution_logs      resolution_logs
  resolved_by=ai       resolved_by=human
  ai_participated=true ai_participated=true/false
```

---

### Detalhes Tecnicos

**1. Migracao de banco de dados**

Adicionar coluna `ai_participated` na tabela `resolution_logs`:

```sql
ALTER TABLE resolution_logs 
ADD COLUMN ai_participated boolean DEFAULT false;
```

**2. Atualizar Edge Function `log-resolution`**

Aceitar o novo campo `ai_participated` no payload do n8n:

```typescript
const { chatwoot_account_id, conversation_id, resolved_by, 
        resolution_type, agent_id, ai_participated } = await req.json();

// No insert:
ai_participated: ai_participated || false,
```

**3. Atualizar Edge Function `fetch-chatwoot-metrics`**

Na sincronizacao passiva (Safety Net), verificar `ai_responded` da conversa ao inserir resolucoes humanas:

```typescript
// Ao inserir resolucao humana inferred:
const aiResponded = custom.ai_responded === true || additional.ai_responded === true;

.insert({
  account_id: dbAccountId,
  conversation_id: conv.id,
  resolved_by: 'human',
  resolution_type: 'inferred',
  ai_participated: aiResponded,  // <-- NOVO
  resolved_at: resolvedAt,
})
```

Na consulta de totais, calcular transbordo:

```typescript
const { data: totals } = await supabase
  .from('resolution_logs')
  .select('resolved_by, ai_participated')
  .eq('account_id', dbAccountId)
  .gte('resolved_at', dateFrom)
  .lte('resolved_at', dateTo);

const aiCount = totals.filter(r => r.resolved_by === 'ai').length;
const humanCount = totals.filter(r => r.resolved_by === 'human').length;
const transbordoCount = totals.filter(
  r => r.resolved_by === 'human' && r.ai_participated === true
).length;
```

Substituir o `transbordoFinalizado: 0` pelo valor real:

```typescript
resolucao = {
  ...
  transbordoFinalizado: transbordoCount,  // <-- era 0
};
```

**4. Atualizar registros existentes (retroativo)**

Para as resolucoes humanas ja registradas, inferir `ai_participated` verificando se a conversa correspondente possui `ai_responded: true` no Chatwoot. Isso pode ser feito uma unica vez na proxima execucao da Edge Function ou via query manual.

### Arquivos Alterados

| Arquivo | Alteracao |
|---------|-----------|
| `resolution_logs` (migracao) | Adicionar coluna `ai_participated` |
| `supabase/functions/log-resolution/index.ts` | Aceitar `ai_participated` no payload |
| `supabase/functions/fetch-chatwoot-metrics/index.ts` | Inserir `ai_participated` no sync + calcular transbordo real |

### Contrato n8n Atualizado

O n8n deve passar `ai_participated: true` ao chamar `log-resolution` sempre que a conversa tiver o atributo `ai_responded: true`, independente de quem resolveu.

