

# Correcao: Sincronizacao Bilateral de Leads (Kanban <-> Chatwoot Labels)

## Problemas Identificados

### 1. Edge Function `update-chatwoot-contact-labels` nao esta sendo chamada
A funcao nao possui nenhum log recente, indicando que ao arrastar um lead no Kanban, a sincronizacao com o Chatwoot nao esta disparando. Isso pode ser causado por falha silenciosa na chamada (o `.catch()` engole o erro) ou pela funcao nao estar deployada.

### 2. Incompatibilidade de slugs entre CRM e Chatwoot
O CRM usa hifens nos slugs (`agendamento-realizado`), mas o Chatwoot usa underscores (`agendamento_realizado`). A logica de filtragem na edge function nao normaliza essa diferenca, entao:
- Ao mover um lead, a label antiga pode nao ser removida corretamente
- A label nova pode ser adicionada com formato inconsistente

### 3. Tags duplicadas com mesmo `chatwoot_label_id`
Existem 3 tags com `chatwoot_label_id = 1` (`novos_leads`, `Venda`, `novo_lead`), o que causa conflitos na sincronizacao bilateral.

---

## Plano de Correcao

### 1. Corrigir `update-chatwoot-contact-labels` - Normalizar slugs

Na edge function, a logica de construcao do nome da label (linha 165) e a logica de filtragem (linhas 147-161) precisam normalizar corretamente, considerando que:
- CRM slugs usam hifens: `agendamento-realizado`
- Chatwoot labels usam underscores: `agendamento_realizado`

**Alteracoes:**
- Ao construir `newLabelName`, usar o **slug** da tag (nao o name) e converter hifens para underscores
- Na filtragem, adicionar normalizacao que trate hifens e underscores como equivalentes
- Adicionar logs mais detalhados para debug

### 2. Garantir deploy da edge function

Verificar e redesployer `update-chatwoot-contact-labels` para garantir que esta ativa.

### 3. Adicionar logs de debug no frontend

No metodo `applyStageTag` e `updateContactLabelsInChatwoot`, adicionar logs mais visíveis para rastrear quando a chamada falha.

### 4. Corrigir `sync-chatwoot-contacts` (Chatwoot -> Kanban)

A mesma normalizacao de slugs precisa ser aplicada na funcao de sync de contatos, garantindo que labels do Chatwoot (com underscore) sejam corretamente mapeadas para tags do CRM (com hifen).

---

## Detalhes Tecnicos

### Arquivo: `supabase/functions/update-chatwoot-contact-labels/index.ts`

**Problema atual (linha 165):**
```text
const newLabelName = newTag.name.toLowerCase().replace(/\s+/g, '_');
```
Isso gera `agendamento_realizado` a partir do name `Agendamento Realizado`, mas o slug no banco e `agendamento-realizado`.

**Correcao:**
- Usar o slug da tag, convertendo hifens para underscores para compatibilidade com Chatwoot
- Na filtragem de labels existentes, normalizar tanto hifens quanto underscores antes de comparar

**Logica de filtragem corrigida (linhas 147-161):**
- Adicionar funcao de normalizacao que substitua hifens e underscores por um caractere uniforme antes da comparacao
- Incluir os slugs normalizados (com underscore) no set de comparacao

### Arquivo: `supabase/functions/sync-chatwoot-contacts/index.ts`

**Correcao no `findTagByLabel`:**
- Adicionar normalizacao que converta hifens para underscores (e vice-versa) antes de buscar correspondencia
- Garantir que `desinteressado` no Chatwoot corresponda a `desinteressado` no CRM sem ambiguidade

### Arquivo: `src/services/tags.cloud.service.ts`

- No metodo `updateContactLabelsInChatwoot`, melhorar o tratamento de erros para logar o erro completo em vez de engolir silenciosamente

---

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/update-chatwoot-contact-labels/index.ts` | Normalizar slugs (hifen -> underscore), melhorar filtragem e logs |
| `supabase/functions/sync-chatwoot-contacts/index.ts` | Normalizar matching de labels (hifen/underscore equivalentes) |
| `src/services/tags.cloud.service.ts` | Melhorar logs de erro no `updateContactLabelsInChatwoot` |

