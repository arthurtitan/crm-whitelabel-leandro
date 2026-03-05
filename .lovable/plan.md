

## Problema

Ao tentar excluir uma etapa do Kanban que possui leads vinculados, o backend retorna erro 400: **"Tag possui leads e não pode ser excluída"**. Isso é uma proteção válida, mas não oferece opção de resolução ao usuário.

## Solução

Adicionar um parâmetro `force=true` na exclusão que, quando presente, **remove os vínculos lead_tag** antes de deletar a tag. Isso desvincula os leads da etapa (sem deletar os contatos) e permite a exclusão.

Também adicionar um `migrateTo` opcional que permite mover os leads para outra etapa antes de excluir.

### Alterações

**1. `backend/src/services/tag.service.ts`** — método `delete`:
- Aceitar parâmetros `force` e `migrateToId`
- Se `force=true` e `migrateToId` fornecido: mover todos os lead_tags para a nova tag
- Se `force=true` sem `migrateToId`: remover todos os lead_tags vinculados
- Manter a proteção padrão (sem `force`, continua bloqueando)

**2. `backend/src/controllers/tag.controller.ts`** — método `delete`:
- Ler `force` e `migrateToId` do query string
- Passar para o service

**3. Frontend — componente de exclusão no Kanban** (provavelmente em `AdminKanbanPage.tsx`):
- Quando a exclusão falhar com erro de leads, exibir dialog perguntando se quer forçar a exclusão
- Opções: "Mover leads para outra etapa" ou "Desvincular leads e excluir"

### Lógica do `delete` atualizada:

```typescript
async delete(id: string, accountId: string, deletedById: string, options?: { force?: boolean; migrateToId?: string }) {
  const tag = await this.getById(id, accountId);
  const leadsCount = await prisma.leadTag.count({ where: { tagId: id } });

  if (leadsCount > 0 && !options?.force) {
    throw new ValidationError(ErrorCodes.TAG_HAS_LEADS);
  }

  if (leadsCount > 0 && options?.force) {
    if (options.migrateToId) {
      // Mover leads para outra etapa
      await prisma.leadTag.updateMany({
        where: { tagId: id },
        data: { tagId: options.migrateToId },
      });
    } else {
      // Desvincular leads
      await prisma.leadTag.deleteMany({ where: { tagId: id } });
    }
  }

  // ... resto do fluxo (delete chatwoot label, history, delete tag)
}
```

