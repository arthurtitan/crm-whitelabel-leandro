# Integração n8n ↔ Chatwoot: Sistema de Transbordo e Reset

Este documento descreve como configurar o sistema completo de atendimento IA → Humano com reset automático de ciclo.

---

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CICLO DE VIDA DO ATENDIMENTO                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  NOVO CONTATO                                                               │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────┐                                                        │
│  │ Conversa Aberta │ ← custom_attributes limpos                             │
│  │ Status: OPEN    │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                    IA RESPONDE (via n8n)                        │        │
│  │  POST /custom_attributes { ai_responded: true }                 │        │
│  └────────────────────────────┬────────────────────────────────────┘        │
│                               │                                             │
│          ┌────────────────────┼────────────────────┐                        │
│          ▼                    ▼                    ▼                        │
│    IA RESOLVE            TRANSBORDO           CONTINUA IA                   │
│    resolved_by: ai       handoff_to_human     (loop de respostas)           │
│                          assignee: humano                                   │
│          │                    │                                             │
│          ▼                    ▼                                             │
│  ┌───────────────┐    ┌───────────────┐                                     │
│  │ Status:       │    │ Humano        │                                     │
│  │ RESOLVED      │    │ resolve       │                                     │
│  └───────┬───────┘    │ resolved_by:  │                                     │
│          │            │ human         │                                     │
│          │            └───────┬───────┘                                     │
│          │                    │                                             │
│          └────────────────────┼─────────────────────────────────────────────┤
│                               ▼                                             │
│                    ┌─────────────────────┐                                  │
│                    │    CLIENTE RETORNA  │                                  │
│                    │  Status: OPEN       │                                  │
│                    │ (reabertura)        │                                  │
│                    └──────────┬──────────┘                                  │
│                               │                                             │
│                               ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              RESET AUTOMÁTICO (via Webhook + n8n)                    │   │
│  │  • ai_responded: null                                                │   │
│  │  • handoff_to_human: null                                            │   │
│  │  • resolved_by: null                                                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                               │                                             │
│                               ▼                                             │
│                    ┌─────────────────────┐                                  │
│                    │ NOVO CICLO LIMPO    │                                  │
│                    │ IA pode responder   │                                  │
│                    └─────────────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Contrato de Atributos

| Atributo | Tipo | Descrição | Quando Setar | Quando Limpar |
|----------|------|-----------|--------------|---------------|
| `ai_responded` | boolean | IA respondeu neste ciclo | Após cada resposta da IA | Reabertura |
| `handoff_to_human` | boolean | IA transferiu para humano | Quando IA detecta necessidade | Reabertura |
| `resolved_by` | string | Quem encerrou ("ai" ou "human") | Antes de resolver | Reabertura |

---

## Passo 1: Configurar Webhook no Chatwoot

### Acessar Configurações

1. Acesse seu Chatwoot
2. Vá em **Settings → Integrations → Webhooks**
3. Clique em **Add New Webhook**

### Configurar o Webhook

```
Name: Reset Cycle on Reopen
URL: https://SEU-N8N.com/webhook/chatwoot-status-change
Events: ☑ conversation_status_changed
```

> ⚠️ Substitua `SEU-N8N.com` pela URL do seu n8n

---

## Passo 2: Criar Fluxo no n8n - Reset na Reabertura

### Estrutura do Fluxo

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Webhook Trigger │───►│ IF: É Reabertura│───►│ Reset Attributes│
│                 │    │ resolved → open │    │ POST /custom_   │
│                 │    │                 │    │ attributes      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Nó 1: Webhook Trigger

**Tipo:** Webhook

**Configuração:**
- HTTP Method: `POST`
- Path: `chatwoot-status-change`
- Response Mode: `On Received`

### Nó 2: IF (Verificar se é Reabertura)

**Tipo:** IF

**Condição (Code):**
```javascript
// Verifica se a conversa foi reaberta (resolved → open)
const changedAttrs = $json.changed_attributes || [];
const isReopen = changedAttrs.some(attr => 
  attr.previous_value === 'resolved' && 
  attr.current_value === 'open'
);

return isReopen;
```

**Ou usando condições visuais:**
- Value 1: `{{ $json.changed_attributes[0].previous_value }}`
- Operation: `Equal`
- Value 2: `resolved`

**E:**
- Value 1: `{{ $json.changed_attributes[0].current_value }}`
- Operation: `Equal`
- Value 2: `open`

### Nó 3: HTTP Request (Reset Custom Attributes)

**Tipo:** HTTP Request

**Configuração:**
```
Method: POST
URL: {{ $json.account.base_url || 'https://SEU-CHATWOOT.com' }}/api/v1/accounts/{{ $json.account.id }}/conversations/{{ $json.conversation.id }}/custom_attributes

Headers:
  api_access_token: SUA_API_KEY_CHATWOOT
  Content-Type: application/json

Body (JSON):
{
  "custom_attributes": {
    "ai_responded": null,
    "handoff_to_human": null,
    "resolved_by": null
  }
}
```

> 💡 **Dica:** Use credenciais do n8n para armazenar a `api_access_token` de forma segura

### Nó 4 (Opcional): Remover Assignee

Se quiser que a conversa reaberta não tenha agente atribuído:

**Tipo:** HTTP Request

```
Method: POST
URL: {{ $json.account.base_url }}/api/v1/accounts/{{ $json.account.id }}/conversations/{{ $json.conversation.id }}/assignments

Headers:
  api_access_token: SUA_API_KEY_CHATWOOT
  Content-Type: application/json

Body:
{
  "assignee_id": null
}
```

---

## Passo 3: Fluxo de Resposta da IA (Marcar ai_responded)

Após cada resposta da IA, adicione um nó HTTP Request no seu fluxo existente:

```
Method: POST
URL: https://SEU-CHATWOOT.com/api/v1/accounts/{{ ACCOUNT_ID }}/conversations/{{ CONVERSATION_ID }}/custom_attributes

Headers:
  api_access_token: SUA_API_KEY
  Content-Type: application/json

Body:
{
  "custom_attributes": {
    "ai_responded": true
  }
}
```

---

## Passo 4: Fluxo de Transbordo (Transferir para Humano)

Quando a IA detectar que precisa de humano:

### 4.1 Marcar Transbordo
```json
POST /custom_attributes
{
  "custom_attributes": {
    "handoff_to_human": true
  }
}
```

### 4.2 Atribuir a Agente Humano
```json
POST /assignments
{
  "assignee_id": ID_DO_AGENTE_HUMANO
}
```

> 💡 Você pode obter IDs de agentes via `GET /api/v1/accounts/{id}/agents`

---

## Passo 5: Marcar resolved_by Antes de Resolver

### Quando IA Resolve

Antes de mudar status para `resolved`:
```json
POST /custom_attributes
{
  "custom_attributes": {
    "resolved_by": "ai"
  }
}
```

### Quando Humano Resolve

Configure um webhook para `conversation_status_changed` que detecte:
- Status mudou para `resolved`
- `handoff_to_human` era `true` ou há assignee humano

Então setar:
```json
POST /custom_attributes
{
  "custom_attributes": {
    "resolved_by": "human"
  }
}
```

---

## Resumo dos Fluxos n8n Necessários

| Fluxo | Trigger | Ação |
|-------|---------|------|
| **1. IA Responde** | Após resposta OpenAI | Marcar `ai_responded: true` |
| **2. Transbordo** | IA detecta necessidade | Marcar `handoff_to_human: true` + atribuir agente |
| **3. IA Resolve** | Antes de resolver | Marcar `resolved_by: "ai"` |
| **4. Humano Resolve** | Webhook: resolved + humano | Marcar `resolved_by: "human"` |
| **5. Reset Ciclo** | Webhook: resolved → open | Limpar todos os atributos |

---

## Payload de Exemplo do Webhook

Quando uma conversa é reaberta, o Chatwoot envia:

```json
{
  "event": "conversation_status_changed",
  "id": 123,
  "account": {
    "id": 3,
    "name": "Minha Conta",
    "base_url": "https://gleps-chatwoot.example.com"
  },
  "conversation": {
    "id": 456,
    "status": "open",
    "custom_attributes": {
      "ai_responded": true,
      "handoff_to_human": true,
      "resolved_by": "human"
    }
  },
  "changed_attributes": [
    {
      "previous_value": "resolved",
      "current_value": "open"
    }
  ]
}
```

---

## Testando a Integração

1. **Resolva uma conversa** no Chatwoot
2. **Reabra a conversa** (simule cliente retornando)
3. **Verifique no n8n** se o webhook foi recebido
4. **Confirme no Chatwoot** que os custom_attributes foram limpos
5. **Teste a IA** - ela deve responder normalmente

---

## Troubleshooting

### Webhook não dispara
- Verifique se o evento `conversation_status_changed` está marcado
- Confirme que a URL do n8n está correta e acessível publicamente

### Atributos não são limpos
- Verifique se a API key tem permissões de escrita
- Confirme que o endpoint está correto (`/custom_attributes` não `/attributes`)

### IA não responde após reset
- Verifique se há outros filtros no seu fluxo de IA
- Confirme que `ai_responded` foi realmente limpo (verifique no Chatwoot)

---

## Endpoints Chatwoot Utilizados

| Ação | Método | Endpoint |
|------|--------|----------|
| Atualizar custom_attributes | POST | `/api/v1/accounts/{id}/conversations/{conv_id}/custom_attributes` |
| Atribuir agente | POST | `/api/v1/accounts/{id}/conversations/{conv_id}/assignments` |
| Listar agentes | GET | `/api/v1/accounts/{id}/agents` |
| Resolver conversa | POST | `/api/v1/accounts/{id}/conversations/{conv_id}/toggle_status` |
