

## Renomear "Aguardando" para "Em Aberto" e Cadenciamento via n8n

### Problema Atual

A funcao `classifyCurrentHandler` retorna `'none'` para conversas que nao tem `ai_responded: true` NEM um assignee humano. Essas 19 conversas provavelmente ja receberam resposta da IA mas o atributo `ai_responded` nao foi setado (conversas antigas ou falha no fluxo n8n), ou o lead simplesmente parou de responder. O rotulo "Aguardando" passa a impressao errada de que ninguem atendeu.

### Mudanca 1: Renomear no Frontend

**Arquivo:** `src/components/dashboard/AtendimentoRealtimeCard.tsx`

- Trocar o label de "Aguardando" para "Em Aberto"
- Trocar o icone de `Clock` para `MessageCircle` ou `CircleDashed` (indica conversa aberta sem atividade recente)

**Arquivo:** `src/types/chatwoot-metrics.ts`

- Atualizar o comentario do campo `semAssignee` para refletir o novo significado

### Mudanca 2: Logica mais inteligente na classificacao

**Arquivo:** `supabase/functions/fetch-chatwoot-metrics/index.ts`

Atualmente a funcao `classifyCurrentHandler` so verifica `ai_responded` e `assignee`. Podemos manter a mesma logica mas renomear o conceito. O campo `semAssignee` passa a representar "Em Aberto" -- conversas abertas onde nao ha atividade classificada (nem IA confirmada, nem humano atribuido). Nenhuma mudanca de logica necessaria, apenas semantica.

### Fluxo n8n: Cadenciamento de Leads Inativos

Este fluxo deve ser criado no n8n para fazer follow-up automatico em conversas onde o lead parou de responder:

```text
Trigger: Schedule (a cada 30 min ou 1h)
  |
  v
HTTP Request: GET /api/v1/accounts/{id}/conversations?status=open
  |
  v
Filtro: Conversas onde:
  - last_activity_at > 2 horas atras (lead inativo)
  - ai_responded = true (IA ja respondeu)
  - handoff_to_human != true (nao foi transferido)
  - human_active != true (humano nao assumiu)
  |
  v
Loop: Para cada conversa inativa
  |
  v
Verificar cadencia (custom_attribute 'followup_count'):
  - followup_count = 0 ou null -> Enviar mensagem 1 (lembrete gentil)
  - followup_count = 1 -> Enviar mensagem 2 (ultima tentativa)
  - followup_count >= 2 -> Resolver conversa automaticamente
  |
  v
Se enviar mensagem:
  POST /api/v1/accounts/{id}/conversations/{conv_id}/messages
  + PUT /custom_attributes { followup_count: N+1 }

Se encerrar:
  PUT /custom_attributes { resolved_by: 'ai' }
  POST edge-function/log-resolution { resolved_by: 'ai' }
  POST /toggle_status { status: 'resolved' }
```

**Atributos customizados necessarios no Chatwoot:**
- `followup_count` (number): Contador de tentativas de follow-up
- `last_followup_at` (string/date): Timestamp do ultimo follow-up

**Parametros configuraveis:**
- Tempo de inatividade antes do 1o follow-up (sugestao: 2h)
- Tempo entre follow-ups (sugestao: 4h)
- Maximo de follow-ups antes de encerrar (sugestao: 2)

### Resumo dos Arquivos Alterados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/dashboard/AtendimentoRealtimeCard.tsx` | Renomear "Aguardando" para "Em Aberto", trocar icone |
| `src/types/chatwoot-metrics.ts` | Atualizar comentario do campo |

### Fora do escopo (n8n - responsabilidade do usuario)

O fluxo de cadenciamento descrito acima precisa ser implementado diretamente no n8n. A logica esta detalhada para facilitar a criacao.

