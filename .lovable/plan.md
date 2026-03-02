
## Correção Definitiva: Novos Leads via histórico completo do Chatwoot

### Problema

A lógica atual de "Novos Leads" tem 3 caminhos que geram resultados inconsistentes:

1. **Caminho DB (Prisma/Postgres)**: Usa `first_resolved_at` da tabela `contacts` — campo frequentemente NULL, fazendo contatos antigos parecerem "novos"
2. **Fallback allConversations**: Lógica correta, mas só roda quando `novosLeads === 0`
3. **Edge Function (Supabase)**: Mesma lógica com os mesmos problemas

### Solução

Substituir os 3 caminhos por **uma única lógica** que usa `allConversations` (já carregado na memória) para determinar se um contato é novo:

```
Para cada contato com conversa criada no período:
  → Encontrar sua conversa MAIS ANTIGA em TODO o histórico
  → Se essa conversa mais antiga foi criada dentro do período = NOVO LEAD
  → Caso contrário = RETORNO
```

### Alterações

#### 1. Backend Express — `backend/src/services/chatwoot-metrics.service.ts`

**Linhas 599-731**: Substituir toda a lógica multi-caminho por:

```typescript
// NOVOS LEADS: Contatos cuja conversa MAIS ANTIGA em todo o histórico
// do Chatwoot foi criada dentro do período.
let novosLeads = (() => {
  const contactIdsInPeriod = [...new Set(
    finalConversations
      .map((c: any) => c.meta?.sender?.id)
      .filter(Boolean)
  )] as number[];

  if (contactIdsInPeriod.length === 0) return 0;

  const earliestByContact = new Map<number, number>();
  for (const conv of allConversations) {
    const sid = conv.meta?.sender?.id;
    if (!sid) continue;
    const raw = conv.created_at;
    const ms = typeof raw === 'number' ? raw * 1000 : new Date(raw).getTime();
    const current = earliestByContact.get(sid);
    if (!current || ms < current) {
      earliestByContact.set(sid, ms);
    }
  }

  let count = 0;
  for (const contactId of contactIdsInPeriod) {
    const earliest = earliestByContact.get(contactId);
    if (!earliest || earliest >= dateFromParsed.getTime()) {
      count++;
    }
  }
  return count;
})();
```

Isso remove:
- A query ao Postgres via Prisma para `first_resolved_at` (linhas 669-698)
- O fallback `allConversations` condicional (linhas 701-731)
- As variáveis `firstResolvedAtAvailable` e sua verificação

O sync de `resolution_logs` via Prisma (linhas 626-667) continua intacto — ele alimenta as métricas de resolução, não os leads.

#### 2. Edge Function — `supabase/functions/fetch-chatwoot-metrics/index.ts`

**Linhas 614-803**: Mesma substituição. Remover:
- Query ao Supabase para `contacts.first_resolved_at` (linhas 729-758)
- Fallback condicional (linhas 770-803)
- Logs de debug do caminho antigo

Substituir por a mesma lógica `allConversations` acima.

#### 3. Documentação — `docs/METRICAS_DASHBOARD.md`

Atualizar a seção "Novos Leads" (KPI 2):

```text
Novos Leads = contatos cujo primeiro contato em TODO o histórico
do Chatwoot foi criado dentro do período selecionado.

Não depende de tabelas do banco (contacts, first_resolved_at).
Usa exclusivamente o histórico completo de conversas da API do Chatwoot.
```

### Exemplo prático

Conta com 50 conversas totais, período de 7 dias com 3 conversas criadas:
- Contato A: conversa criada em 28/02 (mais antiga dele: 15/01) → **Retorno**
- Contato B: conversa criada em 01/03 (mais antiga dele: 01/03) → **Novo Lead**
- Contato C: conversa criada em 02/03 (mais antiga dele: 02/03) → **Novo Lead**

Resultado: Total = 3, Novos = 2, Retornos = 1

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `backend/src/services/chatwoot-metrics.service.ts` | Simplificar novosLeads — única lógica via allConversations |
| `supabase/functions/fetch-chatwoot-metrics/index.ts` | Mesma simplificação |
| `docs/METRICAS_DASHBOARD.md` | Documentar regra definitiva |

### Nota sobre produção

O backend em produção (`360.gleps.com.br`) usa Postgres via Prisma. As alterações no sync de `resolution_logs` (Prisma) permanecem intactas. A mudança remove apenas a dependência do campo `first_resolved_at` para cálculo de novos leads — essa métrica passa a ser 100% baseada na API do Chatwoot.
