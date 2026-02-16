

## Corrigir Backlog: contar apenas conversas em atendimento humano

### Problema atual

O backlog conta **todas** as conversas abertas, incluindo as que a IA esta atendendo normalmente. Isso infla o numero e nao reflete a fila real dos atendentes humanos.

### Solucao

Adicionar um filtro na logica de backlog dentro da Edge Function `fetch-chatwoot-metrics` para considerar **apenas conversas com um agente humano atribuido** (`hasHumanAssignee === true`).

### O que muda

**Arquivo:** `supabase/functions/fetch-chatwoot-metrics/index.ts`

Na secao de calculo do backlog (linhas 468-486), o `if (conv.status === 'open')` sera alterado para `if (conv.status === 'open' && hasHumanAssignee)`.

Isso garante que:
- Conversas atendidas pela IA nao entram no backlog
- Conversas "Em Aberto" (sem ninguem) nao entram no backlog
- Apenas conversas onde um humano assumiu e o cliente aguarda resposta sao contabilizadas

**Arquivo:** `src/components/dashboard/BacklogCard.tsx`

Atualizar o titulo do card de "Backlog de Atendimento" para "Backlog Humano" para deixar claro que se refere a fila dos agentes humanos.

### Detalhe tecnico

```text
ANTES:
  if (conv.status === 'open') {
    // conta TODAS as abertas no backlog
  }

DEPOIS:
  if (conv.status === 'open' && hasHumanAssignee) {
    // conta apenas as que tem agente humano atribuido
  }
```

As variaveis `hasHumanAssignee` e `hasBotAssignee` ja sao calculadas algumas linhas acima (linha 429), entao nenhuma logica nova precisa ser criada — apenas adicionamos a condicao ao filtro existente.

