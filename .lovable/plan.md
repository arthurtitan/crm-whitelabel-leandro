
## Refatoração da Edge Function log-resolution

### Mudanças Necessárias

**1. Arquivo: `supabase/functions/log-resolution/index.ts`**

Trocar a entrada de `account_id` (UUID que n8n não tem) para `chatwoot_account_id` (numero que n8n já tem do Chatwoot):

- **Linha 16**: Trocar `const { account_id, ...` para `const { chatwoot_account_id, ...`
- **Linha 19**: Trocar validação de `account_id` para `chatwoot_account_id`
- **Linha 21**: Atualizar mensagem de erro
- **Após linha 35**: Adicionar lookup na tabela `accounts`:
  ```
  SELECT id FROM accounts WHERE chatwoot_account_id = '3'
  ```
- **Linha 41**: Usar o UUID encontrado no `account_id` do INSERT
- **Linha 54**: Atualizar log de erro

**2. Arquivo: `docs/N8N_CHATWOOT_INTEGRATION.md`**

Atualizar exemplos de payload na linha 266:
- Trocar `"account_id": "UUID_DA_CONTA"` para `"chatwoot_account_id": 3`
- Adicionar nota explicando que o lookup é automático

### Fluxo Resultante

```
n8n POST {
  "chatwoot_account_id": 3,
  "conversation_id": 456,
  "resolved_by": "ai"
}
        ↓
Edge Function lookup: SELECT id FROM accounts WHERE chatwoot_account_id = '3'
        ↓
Encontra: id = "uuid-clinica-x"
        ↓
INSERT resolution_logs { account_id: "uuid-clinica-x", ... }
        ↓
Histórico permanece vinculado ao UUID da clínica
```

### Cenários Cobertos

| Ação | Resultado |
|------|-----------|
| Super Admin muda chatwoot_account_id de 3 → 5 | Histórico antigo intacto, novos logs usam nova ID |
| n8n envia ID inexistente | Erro 404: "Conta não encontrada no CRM" |
| Conversa reabre no Chatwoot | Não importa - log já foi gravado |
| Filtro por período no dashboard | Continua funcionando via resolved_at + account_id UUID |

### Zero Alterações em
- Schema da tabela `resolution_logs`
- Tabela `accounts` (campo já existe)
- RLS policies
- Índices e constraints
- Edge function `fetch-chatwoot-metrics`
