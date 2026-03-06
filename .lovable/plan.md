

## Problema

O frontend envia `{ tags: [{ id: tagId1 }, { id: tagId2 }] }` via `swapTagOrder`, mas o backend controller espera `{ tagIds: [...] }` (schema Zod: `reorderBulkSchema`). Isso causa o erro de validação `tagIds: Required`.

Além disso, o `reorderBulk` do backend simplesmente reordena por posição no array — não faz swap de `ordem` entre duas tags específicas.

## Correção

**`src/services/tags.backend.service.ts`** — método `swapTagOrder`:

Alterar o payload enviado de `{ tags: [...] }` para `{ tagIds: [tagId1, tagId2] }`, alinhando com o schema esperado pelo backend:

```typescript
async swapTagOrder(tagId1: string, tagId2: string): Promise<void> {
  return apiClient.post(API_ENDPOINTS.TAGS.REORDER, {
    tagIds: [tagId1, tagId2],
  });
},
```

**`backend/src/services/tag.service.ts`** — método `reorderBulk`:

Verificar se quando recebe exatamente 2 tagIds, ele faz o **swap dos valores de `ordem`** entre as duas tags (em vez de simplesmente atribuir posição 0 e 1). Isso garante que mover uma etapa para a esquerda/direita troque corretamente as posições.

