

# Correcao: Exclusao de Tags (FK) + Criacao Correta de Labels no Chatwoot

## Problemas Identificados

### Bug 1: Exclusao falha com erro de FK
No arquivo `backend/src/services/tag.service.ts`, o metodo `delete()` executa:
1. Linha 252: `prisma.tag.delete({ where: { id } })` -- apaga a tag
2. Linha 255: `prisma.tagHistory.create({ tagId: id, ... })` -- tenta criar historico referenciando a tag deletada

Resultado: "Foreign key constraint violated: tag_history_tag_id_fkey"

**Correcao**: Mover o `tagHistory.create` para ANTES do `prisma.tag.delete`, e usar `tagId: null` (ja que `tagId` e nullable no schema e o `tagName` ja preserva o snapshot).

### Bug 2: Label criada com nome errado no Chatwoot
No `createLabel` (linha 143 de tag.service.ts), o titulo passado e o nome de exibicao (`input.name` = "Novo Lead"), mas o Chatwoot espera o slug como titulo (`novo_lead`). A Edge Function `push-all-labels-to-chatwoot` usa corretamente `tag.slug`, mas o backend Express usa `input.name`.

Isso causa labels com titulos inconsistentes (ex: "Novo Lead" em vez de "novo_lead"), que nao sao reconhecidas pela sincronizacao bilateral.

**Correcao**: Na criacao de labels, usar o `slug` da tag como `title` e o `name` como `description`, igual ao padrao da Edge Function.

### Bug 3: Nao existe endpoint para re-sincronizar labels existentes
Tags criadas antes do Chatwoot estar configurado ficam sem `chatwoot_label_id`. Nao existe forma de corrigir isso sem acessar o banco diretamente.

**Correcao**: Adicionar endpoint `POST /api/tags/sync-labels` que percorre todas as tags do tipo `stage` e cria/vincula labels faltantes.

## Mudancas por Arquivo

### 1. `backend/src/services/tag.service.ts`

**Delete (linhas 252-264)**: Reordenar para registrar historico antes de deletar:
```typescript
// Registrar historico ANTES de deletar (tagId: null para evitar FK)
await prisma.tagHistory.create({
  data: {
    tagId: null,  // tag sera deletada, usar null
    action: 'tag_deleted',
    actorType: 'user',
    actorId: deletedById,
    source: 'api',
    tagName: tag.name,
  },
});

// Agora sim, deletar a tag
await prisma.tag.delete({ where: { id } });
```

**Create (linhas 143-144)**: Corrigir titulo da label para usar slug:
```typescript
const label = await chatwootService.createLabel(input.accountId, {
  title: finalSlug,  // slug, nao o nome de exibicao
  color: input.color || '#6366F1',
});
```

**Novo metodo `syncAllLabels`**: Itera todas as tags stage da conta, usa `chatwootService.syncTagToLabel()` (que ja existe) para cada uma sem `chatwootLabelId`.

### 2. `backend/src/controllers/tag.controller.ts`

Adicionar acao `syncLabels` que chama `tagService.syncAllLabels(accountId)`.

### 3. `backend/src/routes/tag.routes.ts`

Registrar `POST /sync-labels` (requireAdmin) antes das rotas com `:id`.

## Resultado Esperado

- Exclusao de tags funciona sem erro de FK
- Novas tags criadas geram labels com slug correto no Chatwoot (ex: `novo_lead`, nao "Novo Lead")
- Endpoint de re-sync permite vincular tags existentes que ficaram sem label
- Apos deploy e chamada ao `POST /api/tags/sync-labels`, todas as 6 etapas terao labels corretas no Chatwoot
