
# Correcao Definitiva: Sincronizacao Bilateral no Sync Periodico

## Problema Raiz

O `sync-chatwoot-contacts` (que roda a cada 30s) so faz Chatwoot -> CRM. Quando um lead e movido no Kanban, a funcao `update-chatwoot-contact-labels` e chamada pelo frontend, mas depende da sessao do navegador e falha silenciosamente quando ha problemas de autenticacao.

Resultado: leads movidos no Kanban nao recebem a label correspondente no Chatwoot de forma confiavel.

## Solucao

Adicionar uma fase CRM -> Chatwoot ao final do `sync-chatwoot-contacts`. Apos processar todas as conversas (Chatwoot -> CRM), o sync ira:

1. Buscar todos os contatos da conta que possuem `chatwoot_conversation_id` E um `lead_tag` de tipo stage
2. Para cada contato, verificar se a conversa no Chatwoot ja tem a label correta
3. Se a label esta errada ou ausente, atualizar as labels da conversa no Chatwoot

Isso garante que INDEPENDENTE do frontend, a cada 30s o sync corrige as labels no Chatwoot.

## Detalhes Tecnicos

### Arquivo: `supabase/functions/sync-chatwoot-contacts/index.ts`

Adicionar uma nova fase apos a reconciliacao de contatos orfaos (apos linha ~607):

```text
// ============== PHASE: CRM -> Chatwoot Label Sync ==============
// For each contact with a stage tag in CRM and a chatwoot_conversation_id,
// ensure the Chatwoot conversation has the correct stage label
```

Logica:

1. Buscar todos os `lead_tags` da conta onde a tag e `type = 'stage'`, junto com o `contact.chatwoot_conversation_id`
2. Agrupar por `contact_id` (um contato so pode ter 1 stage tag)
3. Para cada contato com `chatwoot_conversation_id`:
   a. Buscar labels atuais da conversa no Chatwoot via API
   b. Verificar se a label da etapa atual (slug com underscore) ja esta presente
   c. Se nao esta: remover labels de outras etapas + adicionar a label correta
   d. Se ja esta correta: nao fazer nada (evitar chamadas desnecessarias)
4. Contabilizar no resultado: adicionar campos `labels_pushed` e `labels_corrected`

A normalizacao de slugs usara a mesma logica do `update-chatwoot-contact-labels`:
- CRM slug `agendamento-realizado` -> Chatwoot label `agendamento_realizado`
- Comparacao trata hifens e underscores como equivalentes

### Arquivo: `src/services/tags.cloud.service.ts`

Manter a chamada ao `update-chatwoot-contact-labels` no drag como otimizacao (feedback rapido), mas o sync periodico ira corrigir qualquer falha.

Nenhuma alteracao necessaria neste arquivo.

### Arquivo: `supabase/functions/update-chatwoot-contact-labels/index.ts`

Nenhuma alteracao. A funcao ja funciona corretamente (comprovado nos logs).

## Fluxo Resultante

```text
A cada 30 segundos (sync periodico):
  |
  v
FASE 1: Chatwoot -> CRM (existente)
  - Cria/atualiza contatos
  - Aplica lead_tags baseado em labels
  |
  v
FASE 2: CRM -> Chatwoot (NOVA)
  - Para cada contato com stage tag no CRM
  - Verifica se a conversa no Chatwoot tem a label correta
  - Se nao, corrige as labels
  |
  v
Resultado: ambos os lados sempre consistentes
```

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/sync-chatwoot-contacts/index.ts` | Adicionar fase CRM->Chatwoot apos reconciliacao |

## Vantagens

- Nao depende de sessao do usuario (usa service role key server-side)
- Auto-correcao a cada 30s
- Funciona para leads ja existentes, nao apenas os arrastados
- Nao altera a logica existente do Chatwoot->CRM
