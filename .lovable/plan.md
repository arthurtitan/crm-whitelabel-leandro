

## Correção: Lookup de Account com `.maybeSingle()` Falhando

### Problema

A linha 572 do `fetch-chatwoot-metrics` usa `.maybeSingle()` para buscar o `account_id` (UUID) a partir do `chatwoot_account_id`. Porém, existem **5 contas** com `chatwoot_account_id = "1"` no banco:

- Gleps Teste (`5f2e617d-...`) -- a conta correta
- Clínica Integração Teste
- tezte, teste5, teste6

Quando `.maybeSingle()` encontra mais de 1 resultado, retorna `null`. Isso faz com que `accountData?.id` seja `undefined`, e **toda a lógica de resolution_logs seja pulada** (linha 574: `if (accountData?.id)`).

Os 8 registros de resolução por IA **existem no banco** e estão corretos, mas nunca são lidos pelo dashboard.

### Evidencia

```
resolution_logs: 8 registros com account_id = 5f2e617d-... e resolved_by = "ai"
accounts com chatwoot_account_id = "1": 5 registros (maybeSingle falha)
```

### Solucao

Alterar **1 trecho** no arquivo `supabase/functions/fetch-chatwoot-metrics/index.ts` (linhas 568-572):

**De:**
```typescript
const { data: accountData } = await supabase
  .from('accounts')
  .select('id')
  .eq('chatwoot_account_id', normalizedAccountId)
  .maybeSingle();
```

**Para:**
```typescript
const { data: accounts } = await supabase
  .from('accounts')
  .select('id')
  .eq('chatwoot_account_id', normalizedAccountId)
  .order('created_at', { ascending: true })
  .limit(1);

const accountData = accounts?.[0] || null;
```

Isso usa `.limit(1)` com `.order('created_at', ascending)` para sempre pegar a **primeira conta criada** (Gleps Teste), alinhando com o padrao que o `log-resolution` ja usa.

### Impacto

- Unica mudanca: 5 linhas substituidas por 7 linhas
- Nenhuma outra alteracao necessaria
- O dashboard vai finalmente ler os 8 registros de resolucao IA que ja existem
- Resolucoes futuras (tanto IA quanto humanas) serao contabilizadas corretamente

