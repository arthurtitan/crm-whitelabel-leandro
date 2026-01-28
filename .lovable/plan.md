
# Plano: Implementar "Abrir Conversa no Chatwoot"

## Resumo
Implementar a funcionalidade que permite abrir diretamente a conversa do lead no Chatwoot em uma nova aba do navegador.

## Como vai funcionar
Ao clicar no botao "Abrir Chatwoot", o sistema vai:
1. Verificar se a conta tem Chatwoot configurado (`chatwoot_base_url` e `chatwoot_account_id`)
2. Verificar se o contato tem uma conversa associada (`chatwoot_conversation_id`)
3. Construir a URL no formato: `{base_url}/app/accounts/{account_id}/conversations/{conversation_id}`
4. Abrir em nova aba do navegador

## Arquivos a modificar

### 1. `src/types/crm.ts`
Adicionar os campos de Chatwoot na interface `Contact`:
- `chatwoot_contact_id?: number | null`
- `chatwoot_conversation_id?: number | null`

### 2. `src/components/leads/LeadProfileSheet.tsx`
- Importar `account` do `useAuth()`
- Atualizar `handleOpenChatwoot()` para construir e abrir a URL real
- Adicionar validacoes e feedback apropriado

### 3. `src/pages/admin/AdminLeadsPage.tsx`
- Importar `account` do `useAuth()` (ja importado)
- Atualizar `handleOpenChatwoot()` para construir e abrir a URL real
- Adicionar validacoes e feedback apropriado

### 4. `src/pages/admin/AdminKanbanPage.tsx`
- Criar funcao `handleOpenChatwoot(contact)` no dialog de detalhes do lead
- Adicionar botao "Abrir Chatwoot" no modal de visualizacao do lead (se existir)

## Logica da funcao

```text
handleOpenChatwoot(contact):
  SE account.chatwoot_base_url E account.chatwoot_account_id:
    SE contact.chatwoot_conversation_id:
      url = `${base_url}/app/accounts/${account_id}/conversations/${conversation_id}`
      window.open(url, '_blank')
    SENAO:
      toast.warning("Este lead nao possui conversa no Chatwoot")
  SENAO:
    toast.error("Chatwoot nao configurado para esta conta")
```

## Detalhes Tecnicos

### URL do Chatwoot
O formato padrao de URL do Chatwoot para acessar uma conversa e:
```
{chatwoot_base_url}/app/accounts/{chatwoot_account_id}/conversations/{chatwoot_conversation_id}
```

Exemplo:
```
https://app.chatwoot.com/app/accounts/123/conversations/456
```

### Dados disponiveis
- `accounts.chatwoot_base_url` - Base URL da instancia Chatwoot (ex: "https://app.chatwoot.com")
- `accounts.chatwoot_account_id` - ID da conta no Chatwoot
- `contacts.chatwoot_conversation_id` - ID da conversa no Chatwoot

### Validacoes
1. Conta precisa ter Chatwoot configurado
2. Contato precisa ter `chatwoot_conversation_id` preenchido
3. Normalizar URL removendo barra final se existir

## Estimativa
Implementacao simples: ~15-20 minutos
