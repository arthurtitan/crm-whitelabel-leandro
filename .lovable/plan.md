
## Correção: Sincronização de Leads do Chatwoot para o Kanban

### Problema Raiz

Dois bugs no método `syncContacts` em `backend/src/services/chatwoot.service.ts`:

**Bug 1 - Matching de labels falha por formatação**

O Chatwoot normaliza títulos de labels usando hífens (`novo-lead`, `em-atendimento`), mas os slugs das tags no banco usam underscores (`novo_lead`, `em_atendimento`). O código compara diretamente sem normalizar, então nenhum label é reconhecido como etapa do Kanban.

```text
Chatwoot label:  "novo-lead"
Tag slug no DB:  "novo_lead"
tagBySlug.get("novo-lead") → undefined  (sem match)
tagByName.get("novo-lead") → undefined  (nome é "Novo Lead" → "novo lead")
```

**Bug 2 - Resposta não inclui contagem de lead_tags aplicadas**

O método retorna apenas `contacts_created/updated/deleted`, mas nunca reporta `lead_tags_applied`. O frontend verifica esse campo para decidir se houve mudanças - como é sempre `undefined`, mostra "tudo sincronizado" mesmo quando deveria ter aplicado tags.

---

### Correção (1 arquivo)

**Arquivo:** `backend/src/services/chatwoot.service.ts` - método `syncContacts` (linhas 710-850)

**Mudança 1:** Normalizar labels para comparação, convertendo hífens para underscores (e vice-versa) antes de fazer o match:

```typescript
// Criar mapa adicional normalizado
const normalize = (s: string) => s.toLowerCase().replace(/-/g, '_');
const tagByNormalizedSlug = new Map(stageTags.map(t => [normalize(t.slug), t]));

// Na comparação (linha 789):
const normalized = normalize(label);
const matchedTag = tagBySlug.get(label) 
  || tagByNormalizedSlug.get(normalized) 
  || tagByName.get(label.toLowerCase().replace(/-/g, ' '));
```

**Mudança 2:** Adicionar contador `lead_tags_applied` ao retorno:

```typescript
let leadTagsApplied = 0;
// ... dentro do loop, ao criar leadTag:
leadTagsApplied++;

return {
  contacts_created: created,
  contacts_updated: updated,
  contacts_deleted: deleted,
  lead_tags_applied: leadTagsApplied,
};
```

Isso garante que:
- Labels `novo-lead` do Chatwoot casam com o slug `novo_lead` da tag
- O frontend recebe a contagem real de tags aplicadas e mostra o feedback correto
- O rebuild aplica a correção sem intervenção manual
