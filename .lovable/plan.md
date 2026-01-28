
# Plano de Correção: Sincronização Bilateral Kanban ↔ Chatwoot

## Visao Geral dos Requisitos

| Acao | Comportamento Esperado | Status Atual |
|------|------------------------|--------------|
| Label atribuida no Chatwoot | Criar etapa no Kanban se nao existe | Parcial (importa, mas nao cria automaticamente) |
| Etapa criada no Kanban | Criar label no Chatwoot | Funcionando |
| Lead criado no Kanban com etapa | Criar contato + conversa + label no Chatwoot | Falta aplicar label |
| Label conectada a contato no Chatwoot | Mover lead para etapa correspondente | Funcionando (via sync) |
| Multiplas labels no contato | Considerar ultima adicionada | Nao implementado |
| Lead movido no Kanban | Remover label anterior, aplicar nova | Funcionando |
| Lead em duas etapas | Nunca permitir | Reforcar logica |

---

## Etapas de Implementacao

### 1. Aplicar Label no Chatwoot ao Criar Lead

**Problema**: Quando um lead e criado no Kanban e uma etapa inicial e selecionada, a label correspondente nao e aplicada na conversa do Chatwoot.

**Solucao**: Modificar a Edge Function `create-chatwoot-contact` para aceitar um parametro `initial_label` e aplicar a label na conversa recem-criada.

**Arquivos a modificar**:
- `supabase/functions/create-chatwoot-contact/index.ts`: Adicionar logica para aplicar label
- `src/services/contacts.cloud.service.ts`: Passar o nome da etapa para a Edge Function
- `src/components/kanban/CreateLeadDialog.tsx`: Enviar informacao da etapa selecionada

---

### 2. Criar Etapa Automaticamente para Labels Novas

**Problema**: Quando uma label nova e atribuida a um contato no Chatwoot (label que nao existe no Kanban), ela deveria ser criada como etapa automaticamente.

**Solucao**: Modificar a Edge Function `sync-chatwoot-contacts` para criar tags/etapas quando encontrar labels desconhecidas.

**Arquivos a modificar**:
- `supabase/functions/sync-chatwoot-contacts/index.ts`: Adicionar logica para criar tag quando label nao existe

---

### 3. Garantir Lead em Apenas Uma Etapa (Ultima Label)

**Problema**: Se um contato tem multiplas labels no Chatwoot, o sistema precisa considerar apenas a ultima adicionada.

**Solucao**: 
- No Chatwoot, as labels de uma conversa nao tem timestamp individual, entao usaremos a posicao no array (ultima = mais recente) como aproximacao
- Modificar a logica de sync para aplicar apenas UMA etapa por lead

**Arquivos a modificar**:
- `supabase/functions/sync-chatwoot-contacts/index.ts`: Aplicar logica de "ultima label ganha"

---

### 4. Remover Labels Antigas Automaticamente ao Mover

**Problema**: Ja funciona parcialmente, mas precisamos garantir que todas as labels de etapa sejam removidas antes de aplicar a nova.

**Solucao**: A funcao `update-chatwoot-contact-labels` ja faz isso corretamente - apenas confirmar funcionamento.

---

## Detalhamento Tecnico

### Modificacao 1: create-chatwoot-contact

Adicionar parametro `initial_label_name` e aplicar label na conversa:

```text
Apos criar a conversa, chamar:
POST /api/v1/accounts/{account_id}/conversations/{conversation_id}/labels
Body: { labels: [initial_label_name] }
```

### Modificacao 2: sync-chatwoot-contacts

Quando encontrar uma label sem correspondencia:
1. Buscar ou criar o funil padrao
2. Criar nova tag com type='stage'
3. Usar API do Chatwoot para buscar detalhes da label (cor, etc)
4. Vincular chatwoot_label_id

Para multiplas labels:
1. Filtrar apenas labels que correspondem a etapas
2. Pegar a ULTIMA do array (mais recente)
3. Aplicar apenas essa como lead_tag

### Modificacao 3: contacts.cloud.service.ts

Modificar `createContactWithChatwoot` para:
1. Receber `initial_stage_tag_id` como parametro
2. Buscar o nome/slug da tag para enviar como `initial_label_name`
3. Passar para a Edge Function

### Modificacao 4: CreateLeadDialog.tsx

Modificar chamada para passar informacoes da etapa:
1. Quando `create_in_chatwoot` e true E `initial_stage_id` esta definido
2. Buscar a tag selecionada para obter o nome
3. Passar para o service

---

## Fluxo Final Esperado

```text
CRIACAO DE ETAPA NO KANBAN:
Kanban -> createStageTag -> DB + push-chatwoot-label -> Chatwoot

CRIACAO DE LABEL NO CHATWOOT:
Chatwoot -> sync-chatwoot-contacts -> Detecta label sem tag -> Cria tag -> DB

CRIACAO DE LEAD NO KANBAN:
Kanban -> CreateLeadDialog -> createContactWithChatwoot(com label) -> 
  DB + create-chatwoot-contact(com label) -> Chatwoot

ATRIBUICAO DE LABEL NO CHATWOOT:
Chatwoot -> sync-chatwoot-contacts -> Encontra label -> 
  Se ja tem etapa: move lead (remove antigas) -> DB
  Se nao tem etapa: cria etapa + move lead -> DB

MOVIMENTACAO NO KANBAN:
Kanban -> applyStageTag -> DB + update-chatwoot-contact-labels -> 
  Remove labels antigas + aplica nova -> Chatwoot
```

---

## Arquivos a Modificar

1. `supabase/functions/create-chatwoot-contact/index.ts`
2. `supabase/functions/sync-chatwoot-contacts/index.ts`
3. `src/services/contacts.cloud.service.ts`
4. `src/components/kanban/CreateLeadDialog.tsx`

---

## Testes Necessarios

Apos implementacao:
1. Criar etapa no Kanban - verificar se label aparece no Chatwoot
2. Criar lead no Kanban com etapa - verificar se contato e conversa tem a label no Chatwoot
3. Adicionar label a contato no Chatwoot - verificar se lead aparece na etapa correspondente
4. Adicionar segunda label a contato - verificar se lead move para nova etapa (ultima)
5. Mover lead no Kanban - verificar se label antiga foi removida e nova aplicada
6. Adicionar label que nao existe como etapa - verificar se etapa e criada automaticamente
