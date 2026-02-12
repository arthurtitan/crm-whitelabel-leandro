

## Implementação: Remover Inferência de Resolução Humana e Adicionar Webhook para Detecção

### Contexto
Atualmente, a Edge Function `fetch-chatwoot-metrics` executa uma lógica de inferência que tenta inserir resoluções humanas na tabela `resolution_logs` toda vez que o dashboard é carregado. Isso é problemático porque:
1. Depende do dashboard ser aberto para registrar resoluções humanas
2. Gera múltiplas tentativas de insert por conversa
3. Não captura resoluções em tempo real

A nova arquitetura usa um webhook do Chatwoot (`conversation_status_changed`) para detectar resoluções imediatamente quando ocorrem e registrá-las explicitamente via n8n.

### Mudanças Técnicas

#### 1. **`supabase/functions/fetch-chatwoot-metrics/index.ts`** (Remover linhas 623-654)

**O que remover:**
- Bloco de inferência de resoluções humanas (linhas 623-654)
- Loop `for (const conv of resolvedConversations)` que tenta inserir na `resolution_logs`

**O que manter:**
- A consulta histórica (linhas 656-676) que LE os dados já gravados
- Função `classifyResolver()` continua necessária para a Camada 2 (Resolução) em tempo real

**Motivo:** As resoluções humanas serão gravadas explicitamente pelo webhook n8n em tempo real. O dashboard só precisa LER os dados históricos, não tentar inferir e gravar.

#### 2. **`docs/N8N_CHATWOOT_INTEGRATION.md`** (Adicionar nova seção)

**Adicionar antes da seção "Quando Humano Resolve":**
- Novo fluxo n8n: "Detecção Automática de Resolução Humana via Webhook"
- Configuração completa do webhook no Chatwoot
- Nodes do n8n detalhados (IF, HTTP Request)
- JSON payload de exemplo

**Atualizar seção "Quando Humano Resolve":**
- Remover nota sobre inferência no dashboard
- Adicionar explicação: "O webhook detecta e registra automaticamente em tempo real"

### Fluxo Resultante (n8n)

```
┌─────────────────────────────────────────────────────────────┐
│ Webhook Chatwoot: conversation_status_changed               │
│ (Detecta quando conversa muda para "resolved")              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ IF: Status mudou para "resolved"?                           │
│ (Valida que o evento é uma resolução)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ IF: resolved_by !== "ai"?                                   │
│ (Verifica se IA não resolveu - se tem, ignora)             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ HTTP Request: POST /log-resolution                          │
│ {                                                            │
│   "chatwoot_account_id": 3,                                 │
│   "conversation_id": 456,                                   │
│   "resolved_by": "human",                                   │
│   "resolution_type": "explicit",                            │
│   "agent_id": 10                                            │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
```

### Configuração do Webhook no Chatwoot

```
Name: Human Resolution Detection
URL: https://SEU-N8N.com/webhook/chatwoot-human-resolution
Events: ✓ conversation_status_changed
```

### Nodes do n8n Detalhados

**Node 1: Webhook Trigger**
- Type: Webhook
- HTTP Method: POST
- Path: `chatwoot-human-resolution`
- Response Mode: On Received

**Node 2: IF (Status → Resolved)**
- Type: IF
- Condition: `{{ $json.conversation.status }}` Equal `resolved`

**Node 3: IF (NOT resolved_by: "ai")**
- Type: IF
- Condition: `{{ $json.conversation.custom_attributes.resolved_by }}` Not Equal `ai`

**Node 4: HTTP Request (Log Resolution)**
```
Method: POST
URL: https://ptcagwncwtuvcuqlwdzj.supabase.co/functions/v1/log-resolution

Headers:
- Content-Type: application/json

Body (JSON):
{
  "chatwoot_account_id": {{ $json.account.id }},
  "conversation_id": {{ $json.conversation.id }},
  "resolved_by": "human",
  "resolution_type": "explicit",
  "agent_id": {{ $json.conversation.meta.assignee.id || null }}
}
```

### Ordem de Implementação

1. **Remover linhas 623-654 do `fetch-chatwoot-metrics.ts`** (inferência de humano)
   - Mantém consulta histórica intacta
   - Teste: Dashboard continua exibindo histórico corretamente

2. **Adicionar seção de webhook na documentação**
   - Instrução de configuração no Chatwoot
   - Nodes n8n completos para importação
   - Exemplos de payload

3. **Testar fluxo completo**
   - Resolver conversa como humano no Chatwoot
   - Webhook dispara → n8n registra na resolution_logs
   - Próximo carregamento do dashboard reflete a resolução

### Cenários Cobertos

| Cenário | Antes | Depois |
|---------|-------|--------|
| Humano resolve no Chatwoot | Dashboard precisa carregar para inferir | Webhook registra em tempo real |
| Múltiplos humanos resolvem | Múltiplas tentativas de insert no dashboard | Cada webhook é uma inserção única (idempotência via constraint) |
| IA resolve | n8n POST /log-resolution explicit | Sem mudança |
| Conversa reabre | Log persistido, novo ciclo limpo | Sem mudança |

### Zero Alterações em
- Schema `resolution_logs`
- RLS policies
- Edge function `log-resolution`
- Fluxo n8n de resolução da IA

