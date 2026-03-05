

## Problema

Os leads existem no banco e possuem `lead_tags` vinculados, mas o Kanban mostra 0 leads em todas as etapas.

**Causa raiz**: O endpoint `/api/lead-tags` retorna os dados do Prisma em **camelCase** (`contactId`, `tagId`), mas o frontend espera **snake_case** (`contact_id`, `tag_id`). A busca `leadTags.find(lt => lt.contact_id === contactId)` nunca encontra correspondência porque o campo se chama `lt.contactId`.

Evidência nos logs: `SyncContacts Completed {"leadTagsApplied":0}` — os lead_tags já existem no banco (foram aplicados anteriormente), confirmando que os dados estão corretos no backend. O problema é exclusivamente no mapeamento de campos na resposta da API.

## Correção

**Arquivo: `backend/src/services/contact.service.ts`** — método `listLeadTags`

Mapear os campos do Prisma para snake_case antes de retornar:

```typescript
async listLeadTags(accountId: string) {
  const leadTags = await prisma.leadTag.findMany({
    where: { contact: { accountId } },
    include: { tag: { select: { id: true, name: true, color: true, type: true } } },
  });

  return leadTags.map(lt => ({
    id: lt.id,
    contact_id: lt.contactId,
    tag_id: lt.tagId,
    applied_by_id: lt.appliedById,
    source: lt.source,
    created_at: lt.createdAt?.toISOString?.() ?? lt.createdAt,
  }));
}
```

Isso garante que o frontend receba `contact_id` e `tag_id` conforme a interface `LeadTag` definida em `tags.cloud.service.ts`.

