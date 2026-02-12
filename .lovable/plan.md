


## Fluxo n8n Unificado: Reset + Captura de Resolucao Humana

### Por que o Reset e obrigatorio

Custom attributes no Chatwoot sao **persistentes**. Eles NAO resetam quando a conversa e reaberta. Se a IA setou `resolved_by: "ai"` no ciclo 1, esse valor continua na conversa quando o cliente retorna. Sem o reset, o ciclo seguinte herda dados do ciclo anterior, corrompendo as metricas.

### Fluxo n8n necessario (webhook unico)

Um unico webhook de `conversation_status_changed` com duas ramificacoes:

```text
Webhook: conversation_status_changed
    |
    +---> Conversa mudou para "resolved"?
    |         |
    |         SIM --> resolved_by !== "ai"?
    |                    |
    |                    SIM --> POST log-resolution (resolved_by: "human")
    |                    NAO --> SKIP (n8n ja logou via fluxo de IA)
    |
    +---> Conversa mudou para "open" (reaberta)?
              |
              SIM --> POST custom_attributes:
                        resolved_by: null
                        ai_responded: null
                        handoff_to_human: null
                        human_active: null
                        human_intervened: null
```

### Configuracao dos nos n8n

**No 1: Webhook Trigger**
- Path: `chatwoot-status-change`
- Method: POST

**No 2: Switch (por tipo de evento)**

Ramificacao A — Status mudou para "resolved":
- Condicao: `body.status === "resolved"` OU verificar `changed_attributes`

Ramificacao B — Status mudou de "resolved" para "open":
- Condicao: `body.status === "open"` E `changed_attributes[0].previous_value === "resolved"`

**No 3A (Ramificacao A): IF resolved_by !== "ai"**
- Condicao: `body.custom_attributes.resolved_by` nao e igual a `"ai"`

**No 4A: HTTP Request — Log Resolution**
```text
Method: POST
URL: https://ptcagwncwtuvcuqlwdzj.supabase.co/functions/v1/log-resolution
Headers: Content-Type: application/json
Body:
{
  "chatwoot_account_id": {{ body.account.id }},
  "conversation_id": {{ body.id }},
  "resolved_by": "human",
  "resolution_type": "explicit"
}
```

**No 3B (Ramificacao B): HTTP Request — Reset Attributes**
```text
Method: POST
URL: https://gleps-chatwoot.dqnaqh.easypanel.host/api/v1/accounts/{{ body.account.id }}/conversations/{{ body.id }}/custom_attributes
Headers:
  api_access_token: SUA_API_KEY
  Content-Type: application/json
Body:
{
  "custom_attributes": {
    "resolved_by": null,
    "ai_responded": null,
    "handoff_to_human": null,
    "human_active": null,
    "human_intervened": null
  }
}
```

### Mudancas no codigo do CRM

Nenhuma. O `fetch-chatwoot-metrics` com o sync passivo que ja implementamos continua como safety net. O `log-resolution` ja esta pronto. So precisa configurar o n8n.

### Garantias

| Cenario | Resultado |
|---------|-----------|
| IA resolve | n8n loga "ai" + seta resolved_by. Webhook ve "ai", SKIP |
| Humano resolve | Webhook ve resolved_by !== "ai", loga "human" |
| Cliente retorna (reabertura) | Reset limpa todos os atributos do ciclo anterior |
| Re-resolvida por humano | Atributos limpos, webhook loga novo "human" |
| Re-resolvida por IA | Atributos limpos, n8n seta "ai" + loga normalmente |
| Sync passivo (dashboard) | Safety net, captura qualquer resolucao que o webhook perdeu |

### Resumo

- **O fluxo de reset e OBRIGATORIO** — custom attributes persistem entre ciclos
- **1 webhook, 2 ramificacoes** — captura resolucao humana + reset na reabertura
- **Zero mudancas no codigo** — tudo ja esta implementado no backend
- **Sync passivo como backup** — garante integridade mesmo se o n8n falhar
