
# Plano: Adicionar Cliente no Kanban com Cadastro no Chatwoot

## Resumo
Criar uma funcao que permite adicionar um novo cliente diretamente no Kanban, cadastrando-o simultaneamente no CRM (Supabase) e no Chatwoot. O cliente sera criado com uma conversa associada, permitindo que a equipe inicie o atendimento imediatamente.

## Como vai funcionar
1. Usuario clica em "Adicionar Lead" no Kanban
2. Preenche formulario com: Nome, Telefone, Email (opcional), Origem
3. Seleciona a etapa inicial do Kanban (opcional - padrao sera primeira etapa)
4. Sistema cria o contato no Supabase
5. Sistema cria o contato no Chatwoot via API
6. Sistema cria uma conversa no Chatwoot vinculada ao contato
7. Sistema atualiza o contato local com os IDs do Chatwoot (chatwoot_contact_id e chatwoot_conversation_id)
8. Sistema aplica a etapa/label selecionada
9. Lead aparece no Kanban ja pronto para atendimento

## Componentes a criar

### 1. Edge Function: `create-chatwoot-contact`
Nova funcao serverless que:
- Recebe dados do contato (nome, telefone, email)
- Busca configuracao da conta (chatwoot_base_url, chatwoot_account_id, chatwoot_api_key)
- Cria contato na API do Chatwoot (`POST /api/v1/accounts/{id}/contacts`)
- Opcionalmente cria conversa (`POST /api/v1/accounts/{id}/conversations`)
- Retorna IDs criados (contact_id, conversation_id)

### 2. Componente: `CreateLeadDialog.tsx`
Dialog similar ao CreateStageDialog com:
- Campo Nome (obrigatorio)
- Campo Telefone (obrigatorio)
- Campo Email (opcional)
- Seletor de Origem (WhatsApp, Instagram, Site, Manual)
- Seletor de Etapa Inicial (opcional)
- Checkbox "Criar conversa no Chatwoot" (marcado por padrao se Chatwoot configurado)

### 3. Service: `contacts.cloud.service.ts`
Novo servico para operacoes de contato via Cloud:
- `createContact()` - Cria no Supabase
- `createContactWithChatwoot()` - Cria no Supabase + Chatwoot
- `linkChatwootContact()` - Atualiza IDs do Chatwoot no contato existente

## Arquivos a modificar

### Novos arquivos:
- `supabase/functions/create-chatwoot-contact/index.ts`
- `src/components/kanban/CreateLeadDialog.tsx`
- `src/services/contacts.cloud.service.ts`

### Arquivos a modificar:
- `src/pages/admin/AdminKanbanPage.tsx` - Adicionar botao "Novo Lead" e importar o dialog
- `src/components/kanban/index.ts` - Exportar novo componente
- `supabase/config.toml` - Registrar nova edge function

## Detalhes Tecnicos

### API do Chatwoot para criar contato

```text
POST /api/v1/accounts/{account_id}/contacts
Headers: api_access_token: {api_key}
Body: {
  "name": "Nome do Cliente",
  "phone_number": "+5511999999999",
  "email": "email@exemplo.com",
  "identifier": "unique-identifier" (opcional)
}
Response: {
  "payload": {
    "id": 123,
    "name": "Nome do Cliente",
    ...
  }
}
```

### API do Chatwoot para criar conversa

```text
POST /api/v1/accounts/{account_id}/conversations
Headers: api_access_token: {api_key}
Body: {
  "contact_id": 123,
  "inbox_id": 1,
  "status": "open"
}
Response: {
  "id": 456,
  ...
}
```

### Nota sobre inbox_id
Para criar uma conversa no Chatwoot, e necessario um inbox_id. Opcoes:
1. Buscar lista de inboxes da conta e usar o primeiro disponivel
2. Adicionar campo `chatwoot_default_inbox_id` na tabela `accounts`
3. Permitir usuario selecionar o inbox no dialog

A implementacao usara a opcao 1 (buscar primeiro inbox disponivel) como padrao.

### Fluxo da Edge Function

```text
1. Receber dados: { account_id, name, phone, email, create_conversation }
2. Buscar config da conta no Supabase
3. Criar contato no Chatwoot
4. Se create_conversation:
   a. Buscar inboxes da conta
   b. Criar conversa com primeiro inbox
5. Retornar { chatwoot_contact_id, chatwoot_conversation_id }
```

### Interface do Dialog

```text
+----------------------------------+
|     Adicionar Novo Lead          |
+----------------------------------+
| Nome *                           |
| [________________________]       |
|                                  |
| Telefone *                       |
| [________________________]       |
|                                  |
| Email                            |
| [________________________]       |
|                                  |
| Origem                           |
| [v WhatsApp              ]       |
|                                  |
| Etapa Inicial                    |
| [v Novos Leads           ]       |
|                                  |
| [x] Cadastrar no Chatwoot        |
| (cria contato e conversa)        |
|                                  |
|     [Cancelar]  [Adicionar]      |
+----------------------------------+
```

## Validacoes
1. Nome e telefone sao obrigatorios
2. Telefone deve ter formato valido (minimo 10 digitos)
3. Se email informado, validar formato
4. Se Chatwoot nao configurado, checkbox fica desabilitado/oculto
5. Se criacao no Chatwoot falhar, contato ainda e criado localmente (com aviso)

## Estimativa
Implementacao completa: ~45-60 minutos
- Edge Function: 20 min
- Dialog Component: 15 min
- Service + Integration: 15 min
- Testes: 10 min
