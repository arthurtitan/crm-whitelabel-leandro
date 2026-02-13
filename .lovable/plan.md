

## Nodes n8n para Transbordo com Fila Aleatória

Aqui estão os 4 nós formatados no padrão do seu workflow existente, prontos para importar no n8n.

### JSON para Importar

```json
{
  "nodes": [
    {
      "parameters": {
        "method": "GET",
        "url": "https://gleps-chatwoot.dqnaqh.easypanel.host/api/v1/accounts/{{ $('Code in JavaScript').first().json.raw.account_id }}/agents",
        "authentication": "none",
        "sendHeaders": true,
        "specifyHeaders": "json",
        "jsonHeaders": "{\n  \"Content-Type\": \"application/json\",\n  \"api_access_token\": \"c34KYFzSh3p4QatLaUGKzYiz\"\n}",
        "sendBody": false,
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [800, 300],
      "id": "fetch-agents",
      "name": "Buscar Agentes"
    },
    {
      "parameters": {
        "jsCode": "const agents = $input.first().json;\n\n// Filtra apenas agentes online (exclui admins)\nconst onlineAgents = agents.filter(a => \n  a.availability_status === 'online' && a.role === 'agent'\n);\n\nif (onlineAgents.length === 0) {\n  return [{ json: { error: true, message: 'Nenhum agente online' } }];\n}\n\n// Sorteia um agente aleatório\nconst randomIndex = Math.floor(Math.random() * onlineAgents.length);\nconst selected = onlineAgents[randomIndex];\n\nreturn [{ json: { \n  error: false,\n  assignee_id: selected.id, \n  agent_name: selected.name \n} }];"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1020, 300],
      "id": "sortear-agente",
      "name": "Sortear Agente Online"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://gleps-chatwoot.dqnaqh.easypanel.host/api/v1/accounts/{{ $('Code in JavaScript').first().json.raw.account_id }}/conversations/{{ $('Code in JavaScript').first().json.raw.conversation_id }}/assignments",
        "authentication": "none",
        "sendHeaders": true,
        "specifyHeaders": "json",
        "jsonHeaders": "{\n  \"Content-Type\": \"application/json\",\n  \"api_access_token\": \"c34KYFzSh3p4QatLaUGKzYiz\"\n}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "{\n  \"assignee_id\": {{ $json.assignee_id }}\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1240, 300],
      "id": "assign-agent",
      "name": "Atribuir Agente"
    },
    {
      "parameters": {
        "method": "PATCH",
        "url": "https://gleps-chatwoot.dqnaqh.easypanel.host/api/v1/accounts/{{ $('Code in JavaScript').first().json.raw.account_id }}/contacts/{{ $('Code in JavaScript').first().json.raw.sender_id }}",
        "authentication": "none",
        "sendHeaders": true,
        "specifyHeaders": "json",
        "jsonHeaders": "{\n  \"Content-Type\": \"application/json\",\n  \"api_access_token\": \"c34KYFzSh3p4QatLaUGKzYiz\"\n}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "{\n  \"custom_attributes\": {\n    \"handoff_to_human\": true,\n    \"human_active\": true\n  }\n}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1460, 300],
      "id": "mark-flags",
      "name": "Marcar Flags Transbordo"
    }
  ],
  "connections": {
    "Buscar Agentes": {
      "main": [
        [{ "node": "Sortear Agente Online", "type": "main", "index": 0 }]
      ]
    },
    "Sortear Agente Online": {
      "main": [
        [{ "node": "Atribuir Agente", "type": "main", "index": 0 }]
      ]
    },
    "Atribuir Agente": {
      "main": [
        [{ "node": "Marcar Flags Transbordo", "type": "main", "index": 0 }]
      ]
    }
  }
}
```

### O que cada nó faz

1. **Buscar Agentes** (GET) -- Busca todos os agentes da conta no Chatwoot
2. **Sortear Agente Online** (Code) -- Filtra os que estão `online` com role `agent`, sorteia um aleatório
3. **Atribuir Agente** (POST `/assignments`) -- Atribui o agente sorteado à conversa
4. **Marcar Flags Transbordo** (PATCH no contato) -- Seta `handoff_to_human: true` e `human_active: true` nos custom_attributes do contato, bloqueando a IA

### Observacoes

- O nó "Marcar Flags" usa PATCH no **contato** (`/contacts/{sender_id}`) porque os `custom_attributes` persistentes ficam no contato no Chatwoot -- se no seu setup os atributos ficam na **conversa**, troque a URL para `/conversations/{conversation_id}` com o body adequado
- A referencia `$('Code in JavaScript').first().json.raw` segue o padrao do seu workflow existente -- ajuste o nome do nó de referencia se necessário
- Se nenhum agente estiver online, o nó Code retorna `error: true` -- adicione um nó IF após ele para tratar esse cenário (ex: enviar mensagem "Aguarde, retornaremos em breve")

### Como importar

1. Copie o JSON acima
2. No n8n, clique com botão direito no canvas ou use Ctrl+V
3. Conecte o primeiro nó ("Buscar Agentes") ao ponto do seu fluxo onde a IA decide fazer transbordo

