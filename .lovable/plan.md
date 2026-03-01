

# Correcao Final: Limpeza do Banco + Edge Function Upsert

## Verificacao via API real (Chatwoot account 1)

Requisicao direta ao Chatwoot (30 dias) retornou:
- **23 conversas** no total, **22 contatos unicos**
- **9 resolucoes IA** (explicitas via n8n), **8 resolucoes humanas**
- **4 agentes**, **1 inbox** (Prospeccao)

O Edge Function retorna dados corretos para leads (`totalLeads: 22`), mas o **dashboard de producao mostra zeros** porque usa o backend Express (que ainda nao foi redeployado com nossas correcoes anteriores).

## Problemas confirmados no banco de dados (Lovable Cloud)

Consulta direta ao banco revelou:
- **17 registros** na tabela `resolution_logs`, mas apenas **4 conversas unicas** (duplicatas massivas)
- Conversa 21 sozinha tem 10+ registros duplicados
- **Todos os registros `inferred` tem `ai_participated: true`** (corrompidos)
- **Nao existe unique constraint** na tabela (a migracao 0003 nunca foi aplicada)

## Correcoes necessarias

### 1. Criar Edge Function temporaria para limpar o banco

Como o tool `read-query` so aceita SELECT, vou criar uma Edge Function `fix-resolution-logs` que:
- Seta `ai_participated = false` em todos os registros `resolution_type = 'inferred'`
- Remove duplicatas mantendo apenas o registro mais recente por `(account_id, conversation_id)`

Apos executar e confirmar a limpeza, essa funcao sera deletada.

### 2. Adicionar unique constraint via SQL migration

Criar uma migracao que adiciona o indice unico `(account_id, conversation_id)` na tabela `resolution_logs` para evitar futuras duplicatas e suportar UPSERT.

### 3. Atualizar Edge Function `fetch-chatwoot-metrics`

Alterar a logica de sync de resolucoes (linha 690-699) de `.insert()` para `.upsert()`:

```text
// De:
.insert({ ... })  // falha silenciosamente em duplicatas

// Para:
.upsert({ ... }, { onConflict: 'account_id,conversation_id' })
```

Isso garante que futuras execucoes corrijam automaticamente registros existentes.

### 4. Nenhuma alteracao no backend Express

As correcoes anteriores (ai_participated dinamico + UPSERT) ja foram aplicadas. O usuario so precisa fazer o deploy.

## Resultado esperado

Apos as correcoes:
- **Banco limpo**: 4 registros unicos (sem duplicatas), `ai_participated = false` em todos os `inferred`
- **Edge Function**: auto-corrige registros existentes via UPSERT
- **Dashboard producao**: Apos deploy do backend, mostrara totalLeads=22, transbordo=0%

## Arquivos alterados

1. `supabase/functions/fix-resolution-logs/index.ts` (novo, temporario)
2. `supabase/functions/fetch-chatwoot-metrics/index.ts` (insert -> upsert)
3. Migracao SQL: unique constraint em `resolution_logs`
