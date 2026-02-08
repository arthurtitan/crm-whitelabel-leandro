
# Sincronizacao Unilateral: CRM Kanban -> Chatwoot

## Resumo da Mudanca

Tornar a criacao de labels/etapas **unilateral**: o CRM e a unica fonte de verdade para a estrutura do funil. Toda etapa criada no Kanban sera automaticamente criada como label no Chatwoot. Labels criadas diretamente no Chatwoot **nao** serao importadas para o CRM. Ao trocar de conta Chatwoot, todas as etapas existentes serao recriadas na nova conta.

---

## O que muda para o usuario

1. O botao "Importar Labels" sera **removido** da pagina Kanban
2. Ao criar uma etapa no Kanban, ela aparecera automaticamente como label no Chatwoot (isso ja funciona)
3. Ao trocar as credenciais do Chatwoot na conta, todas as etapas existentes no CRM serao **automaticamente recriadas** no novo Chatwoot
4. O movimento de leads entre etapas continua bilateral (mover no Kanban atualiza Chatwoot e vice-versa via sync)

---

## Alteracoes Tecnicas

### 1. Nova Edge Function: `push-all-labels-to-chatwoot`

Cria uma edge function que recebe `account_id` e:
- Busca todas as tags ativas (`type = 'stage'`) da conta
- Para cada tag, cria a label correspondente no Chatwoot via API
- Se a label ja existir (mesmo slug), vincula o ID
- Atualiza o `chatwoot_label_id` de cada tag no banco
- Retorna resumo: `{ pushed: N, linked: N, errors: [] }`

Arquivo: `supabase/functions/push-all-labels-to-chatwoot/index.ts`

### 2. Modificar `sync-chatwoot-labels` (limpeza)

- Remover a action `import` e manter apenas `list` (usada internamente pelo sync de contatos para mapear labels)
- Ou simplesmente manter como esta para nao quebrar dependencias, mas o frontend nao chamara mais a action `import`

### 3. Modificar `tags.cloud.service.ts`

- **Remover**: metodo `importChatwootLabels` e `fetchChatwootLabels` (nao serao mais utilizados)
- **Adicionar**: metodo `pushAllLabelsToChatwoot(accountId)` que chama a nova edge function
- **Modificar**: metodo `createStageTag` -- limpar o `chatwoot_label_id` antigo (se houver) antes de chamar o push, garantindo que a label sera recriada na conta atual

### 4. Remover `ImportChatwootLabelsDialog.tsx`

Componente inteiro sera removido, pois nao havera mais importacao de labels.

### 5. Modificar `AdminKanbanPage.tsx`

- Remover o botao "Importar Labels" e o estado `showImportDialog`
- Remover o import e uso do `ImportChatwootLabelsDialog`
- **Adicionar** botao "Enviar Etapas ao Chatwoot" (ou integrar ao botao Sincronizar existente) que chama `pushAllLabelsToChatwoot`
- Este botao so aparece quando Chatwoot esta configurado

### 6. Logica de troca de conta Chatwoot

Quando o usuario salva novas credenciais do Chatwoot na configuracao da conta:
- Resetar todos os `chatwoot_label_id` das tags para `null` (as labels antigas pertencem a outra conta)
- Chamar automaticamente `pushAllLabelsToChatwoot` para recriar todas as etapas no novo Chatwoot

Isso sera feito na edge function `push-all-labels-to-chatwoot` com um parametro opcional `reset_ids: true` que limpa os IDs antigos antes de criar.

### 7. Atualizar `CreateStageDialog.tsx`

Nenhuma alteracao necessaria -- ja chama `pushLabelToChatwoot` apos criar a tag. O fluxo existente esta correto.

---

## Fluxo Resultante

```text
Criar Etapa no Kanban
  |
  v
Salva tag no banco (Supabase)
  |
  v
Push label para Chatwoot (edge function push-chatwoot-label)
  |
  v
Atualiza chatwoot_label_id na tag


Trocar Conta Chatwoot
  |
  v
Reset todos chatwoot_label_id para null
  |
  v
Push ALL tags para novo Chatwoot (edge function push-all-labels-to-chatwoot)
  |
  v
Atualiza chatwoot_label_id com novos IDs


Mover lead no Kanban <---> Label aplicada no Chatwoot
  (bilateral, sem alteracao)
```

---

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| `supabase/functions/push-all-labels-to-chatwoot/index.ts` | Criar (nova edge function) |
| `supabase/config.toml` | Adicionar config da nova function |
| `src/services/tags.cloud.service.ts` | Remover imports, adicionar pushAll |
| `src/components/kanban/ImportChatwootLabelsDialog.tsx` | Remover |
| `src/components/kanban/index.ts` | Remover export do ImportChatwootLabelsDialog |
| `src/pages/admin/AdminKanbanPage.tsx` | Remover importacao, adicionar botao push |
