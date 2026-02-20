
## Corrigir "Total de Leads" para contar apenas conversas iniciadas no período

### O problema confirmado

O campo `totalLeads` na linha 766 da Edge Function usa `finalConversations.length`.

O `finalConversations` inclui conversas que **ou foram criadas OU tiveram atividade** no período (filtro `createdInRange || activeInRange`). Isso é necessário para métricas de resolução, mas significa que conversas antigas com atividade recente inflam o contador de leads.

Evidência direta dos dados da rede:

- Período selecionado: 13/02 a 20/02
- `totalConversationsFiltered: 4` (com atividade ou criadas no período)
- `picoPorHora` mostra **1 conversa criada** no período (hora 16h)
- Resultado correto: `totalLeads` deveria ser **1**, não 4

### Solução

No loop do Processo 2 (linha 427), já existe a lógica `createdInDateRange` para o gráfico horário (linha 491). Vou aproveitar essa mesma lógica para incrementar um novo contador `leadsInPeriod`.

**Arquivo:** `supabase/functions/fetch-chatwoot-metrics/index.ts`

**Mudança 1** — adicionar contador dentro do loop `finalConversations` (após a linha 499):

```text
// Já existente:
if (createdInDateRange) {
  hourlyCount[hourLocal]++;
  leadsInPeriod++;   ← ADICIONAR ESTA LINHA
}
```

**Mudança 2** — declarar `leadsInPeriod` junto com os outros contadores (linha 313):

```text
let leadsInPeriod = 0;
```

**Mudança 3** — substituir na resposta final (linha 766):

```text
ANTES:
  totalLeads: finalConversations.length,

DEPOIS:
  totalLeads: leadsInPeriod,
```

### Impacto esperado

| Período | Antes | Depois | Correto? |
|---|---|---|---|
| 7 dias (13-20/02) | 4 (inclui conversas antigas com atividade recente) | 1 (apenas iniciadas no período) | Sim |
| 30 dias (21/01-20/02) | ~4 ou mais | ~21 (todas as conversas criadas desde jan/fev) | Sim |
| Dia 07/02 (personalizado) | 0 | 20+ (dia em que as conversas foram criadas) | Sim |

### Por que não usar o banco de dados contacts

A definição anterior buscava contatos do banco, mas o usuário deixou claro: **Total de Leads = conversas iniciadas no Chatwoot no período**. Isso é mais fiel à operação real de atendimento — cada conversa = 1 lead, independente de estar cadastrado no CRM.

### Arquivos alterados

- `supabase/functions/fetch-chatwoot-metrics/index.ts`: 3 alterações pontuais no Processo 2

Nenhum componente de UI precisa mudar — o card "Total de Leads" já exibe o valor retornado pela API.
