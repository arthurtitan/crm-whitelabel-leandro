

## Normalização de Slugs: Underscore como Padrão Universal

### O que precisa mudar

Uma unica correção em 3 arquivos: trocar a geração de slugs de hífen para underscore, alinhando com o padrão do Chatwoot e eliminando o risco de labels duplicadas.

### O que NAO precisa mudar

- Estrutura do Kanban (colunas dinâmicas, drag-and-drop, reorder) -- ja esta correto
- LeadCard -- funcional como esta
- CreateStageDialog -- ja usa underscore
- Lógica de sincronização bilateral -- funcional
- As 6 etapas padrão serao criadas pelo admin via dialog existente, sem necessidade de seed/migracao automatica

### Arquivos a alterar

**1. `src/services/tags.cloud.service.ts`** (linhas 113 e 220)
- De: `.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')`
- Para: `.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')`

**2. `src/services/tags.service.ts`** (linhas 99 e 130)
- De: `.replace(/\s+/g, '-')`
- Para: `.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')`

**3. `src/contexts/TagContext.tsx`** (linha 353)
- De: `.replace(/\s+/g, '-')`
- Para: `.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')`

### Impacto

- Zero mudança visual no Kanban
- Zero mudança de comportamento para o usuario
- Elimina risco de labels duplicadas no Chatwoot
- Garante que qualquer etapa criada por qualquer caminho (dialog, auto-create, API) tenha o mesmo formato de slug

