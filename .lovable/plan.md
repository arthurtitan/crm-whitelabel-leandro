
# Plano: Sincronizar Exclusoes do Chatwoot no Kanban

## Problema Identificado

Quando voce apaga contatos/conversas no Chatwoot, os leads correspondentes permanecem no Kanban. Isso acontece porque a sincronizacao atual apenas:
- Cria novos contatos quando encontra novas conversas
- Atualiza contatos existentes

Ela NAO remove contatos que foram excluidos no Chatwoot.

---

## Solucao

Adicionar logica de "reconciliacao" na Edge Function `sync-chatwoot-contacts` para:

1. **Antes de processar**: Coletar todos os `chatwoot_contact_id` das conversas do Chatwoot
2. **Apos processar**: Comparar com os contatos no banco que tem `chatwoot_contact_id`
3. **Remover**: Excluir os contatos (e suas `lead_tags`) que nao existem mais no Chatwoot

---

## Detalhamento Tecnico

### Modificacao: sync-chatwoot-contacts/index.ts

Adicionar nova etapa no final do sync:

```text
1. Coletar Set de chatwoot_contact_ids das conversas processadas
2. Buscar contatos no banco com chatwoot_contact_id NOT NULL para esta account
3. Para cada contato que NAO esta no Set do Chatwoot:
   a. Deletar registros de lead_tags associados
   b. Deletar o contato
   c. Incrementar contador contacts_deleted
4. Retornar contacts_deleted no resultado
```

### Nova Estrutura do Resultado

```typescript
interface SyncResult {
  success: boolean;
  contacts_created: number;
  contacts_updated: number;
  contacts_deleted: number;  // NOVO
  lead_tags_applied: number;
  lead_tags_removed: number;
  stages_created: number;
  errors: string[];
}
```

### Atualizacoes Adicionais

- `src/services/tags.cloud.service.ts`: Atualizar interface SyncContactsResult
- `src/pages/admin/AdminKanbanPage.tsx`: Exibir contagem de contatos excluidos no toast

---

## Fluxo Atualizado

```text
SINCRONIZACAO CHATWOOT -> KANBAN:
1. Buscar todas conversas do Chatwoot (paginated)
2. Coletar Set de chatwoot_contact_ids encontrados
3. Para cada conversa:
   - Criar/atualizar contato
   - Aplicar etapa baseado em labels
4. NOVO: Buscar contatos com chatwoot_contact_id que NAO estao no Set
5. NOVO: Remover esses contatos e seus lead_tags
6. Retornar estatisticas incluindo deletados
```

---

## Comportamento Esperado

| Acao no Chatwoot | Resultado no Kanban |
|------------------|---------------------|
| Excluir contato/conversa | Lead removido automaticamente |
| Excluir varios contatos | Leads removidos na proxima sincronizacao |
| Manter contatos | Leads permanecem |

---

## Arquivos a Modificar

1. `supabase/functions/sync-chatwoot-contacts/index.ts` - Logica de exclusao
2. `src/services/tags.cloud.service.ts` - Atualizar interface
3. `src/pages/admin/AdminKanbanPage.tsx` - Atualizar mensagem de toast

---

## Consideracoes de Seguranca

- Apenas contatos COM `chatwoot_contact_id` serao considerados para exclusao
- Contatos criados manualmente (sem `chatwoot_contact_id`) NAO serao afetados
- Historico de tag_history sera preservado (apenas lead_tags removidos)

---

## Teste Apos Implementacao

1. Criar um contato no Chatwoot com label
2. Sincronizar - verificar que aparece no Kanban
3. Apagar o contato no Chatwoot
4. Sincronizar novamente - verificar que lead sumiu do Kanban
5. Criar contato manualmente no Kanban (sem Chatwoot) - verificar que NAO e excluido na sync
